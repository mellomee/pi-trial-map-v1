import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

function normalizeSide(raw) {
  if (!raw) return "Unknown";
  const s = raw.toString().trim().toLowerCase();
  if (s.includes("plaintiff")) return "Plaintiff";
  if (s.includes("defense") || s.includes("defendant")) return "Defense";
  if (s.includes("independent")) return "Independent";
  return "Unknown";
}

function normalizeSheetKey(name) {
  return name.replace(/[\s\-]/g, "").toUpperCase();
}

function detectVolLabel(sheetName) {
  const m = sheetName.match(/VOL(\d+)/i);
  return m ? `VOL${m[1]}` : null;
}

function findHeaderRow(sheet, maxRows = 10) {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  for (let r = range.s.r; r <= Math.min(range.e.r, maxRows); r++) {
    const cells = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      cells.push(sheet[addr]?.v?.toString().toLowerCase() || "");
    }
    const joined = cells.join(" ");
    if (joined.includes("first") && joined.includes("last")) return r;
    if (joined.includes("firstname") || (joined.includes("first_name") && joined.includes("last_name"))) return r;
  }
  return 0;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export default function Import() {
  const { activeCase } = useActiveCase();
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("SYNC");
  const [importing, setImporting] = useState(false);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!activeCase) return;
    base44.entities.ImportRuns.filter({ case_id: activeCase.id }, "-created_date", 10).then(setHistory);
  }, [activeCase]);

  const log = (msg, type = "info") => {
    setLogs(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString() }]);
  };

  const handleImport = async () => {
    if (!file || !activeCase) return;
    setImporting(true);
    setLogs([]);
    setProgress(0);
    const caseId = activeCase.id;
    const summary = { parties: 0, depositions: 0, transcriptLines: 0, exhibits: 0, sheets: [] };

    const run = await base44.entities.ImportRuns.create({
      case_id: caseId, file_name: file.name, mode, status: "running", progress_percent: 1,
    });

    log(`Starting ${mode} import of ${file.name}...`);

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    log(`Found ${wb.SheetNames.length} sheets: ${wb.SheetNames.join(", ")}`);
    summary.sheets = wb.SheetNames;

    // If REPLACE mode, wipe existing data
    if (mode === "REPLACE") {
      log("REPLACE mode: wiping existing case data...", "warn");
      const entities = ["DepoClips", "QuestionLinks", "Questions", "AdmittedExhibits", "JointExhibits", "ExhibitLinks", "DepositionTranscripts", "DepositionExhibits", "Depositions", "BattleCards", "TrialPoints", "Parties"];
      for (const ent of entities) {
        const items = await base44.entities[ent].filter({ case_id: caseId });
        for (const item of items) await base44.entities[ent].delete(item.id);
        if (items.length > 0) log(`  Deleted ${items.length} ${ent}`);
      }
    }

    setProgress(10);

    // === PARTIES ===
    const partiesSheetName = wb.SheetNames.find(n => n.toLowerCase() === "parties");
    let partyMap = {};

    if (partiesSheetName) {
      log("Parsing Parties sheet...");
      const sheet = wb.Sheets[partiesSheetName];
      const headerRow = findHeaderRow(sheet);
      log(`  Detected header at row ${headerRow + 1}`);
      const rows = XLSX.utils.sheet_to_json(sheet, { range: headerRow });

      for (const row of rows) {
        const firstName = (row.first_name || row.FirstName || row.firstname || row["First Name"] || "").toString().trim();
        const lastName = (row.last_name || row.LastName || row.lastname || row["Last Name"] || "").toString().trim();
        if (!lastName) continue;

        const data = {
          case_id: caseId,
          first_name: firstName,
          last_name: lastName,
          credential_text: (row.Credentials || row.credential_text || row.credentials || "").toString().trim(),
          role_title: (row.Role || row.role_title || row.role || "").toString().trim(),
          side: normalizeSide(row.Side || row.side),
          party_type: (row.party_type || row.PartyType || "").toString().trim(),
          display_name: (row.display_name || row.DisplayName || `${firstName} ${lastName}`).toString().trim(),
          will_testify: (row.will_testify || "").toString().trim(),
          notes: (row.notes || "").toString().trim(),
        };

        // Upsert: check existing
        const existing = await base44.entities.Parties.filter({ case_id: caseId, last_name: lastName, first_name: firstName });
        let party;
        if (existing.length > 0) {
          await base44.entities.Parties.update(existing[0].id, data);
          party = { ...existing[0], ...data };
        } else {
          party = await base44.entities.Parties.create(data);
        }
        partyMap[normalizeSheetKey(lastName)] = party;
        // Also store with first+last for multi-word names
        partyMap[normalizeSheetKey(`${firstName}${lastName}`)] = party;
        summary.parties++;
      }
      log(`  Imported ${summary.parties} parties`);
    }
    setProgress(25);

    // === EXHIBITS ===
    const exhibitsSheetName = wb.SheetNames.find(n => n.toLowerCase() === "exhibits");
    if (exhibitsSheetName) {
      log("Parsing Exhibits sheet...");
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[exhibitsSheetName]);
      const batch = [];

      for (const row of rows) {
        const exhibitNo = (row.exhibit_no || row.Exhibit || row.ExhibitNo || row["Exhibit #"] || row.No || "").toString().trim();
        const title = (row.exhibit_title || row.Title || row.ExhibitName || row.Description || "").toString().trim();
        if (!exhibitNo && !title) continue;

        const deponentKey = normalizeSheetKey((row.deponent || row.Deponent || row.Witness || row.LastName || "").toString());
        const party = partyMap[deponentKey];

        batch.push({
          case_id: caseId,
          deponent_party_id: party?.id || "",
          deponent_sheet_key: deponentKey,
          depo_exhibit_no: exhibitNo,
          depo_exhibit_title: title,
          referenced_page: (row.referenced_page || row.Page || "").toString().trim(),
          provided_by_side: normalizeSide(row.SIDE || row.Side || row.side),
          raw_label: (row.raw_label || row.Label || "").toString().trim(),
        });
      }

      // Batch insert
      for (let i = 0; i < batch.length; i += 50) {
        const chunk = batch.slice(i, i + 50);
        await base44.entities.DepositionExhibits.bulkCreate(chunk);
        summary.exhibits += chunk.length;
        await sleep(500);
      }
      log(`  Imported ${summary.exhibits} deposition exhibits`);
    }
    setProgress(40);

    // === TRANSCRIPTS ===
    const skipSheets = new Set(["parties", "exhibits"]);
    const transcriptSheets = wb.SheetNames.filter(n => !skipSheets.has(n.toLowerCase()));
    const totalTranscripts = transcriptSheets.length;

    for (let t = 0; t < totalTranscripts; t++) {
      const sheetName = transcriptSheets[t];
      log(`Processing transcript: ${sheetName}...`);

      const sheet = wb.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      // Build transcript text: col0 = cite, col1 = text
      const lines = [];
      for (const row of rawRows) {
        const cite = (row[0] || "").toString().trim();
        const text = (row[1] || "").toString().trim();
        if (!cite && !text) continue;
        lines.push(`${cite}\t${text}`);
      }

      if (lines.length === 0) {
        log(`  Skipped ${sheetName} (no data)`, "warn");
        continue;
      }

      const transcriptText = lines.join("\n");
      const lineCount = lines.length;
      // Simple hash
      const hash = `${sheetName}-${lineCount}-${transcriptText.length}`;

      // Match party
      const key = normalizeSheetKey(sheetName);
      const volLabel = detectVolLabel(sheetName);
      const baseKey = key.replace(/VOL\d+/i, "");
      const party = partyMap[key] || partyMap[baseKey];

      // Upsert deposition
      const existingDepo = await base44.entities.Depositions.filter({ case_id: caseId, sheet_name: sheetName });
      let depo;
      const depoData = {
        case_id: caseId,
        party_id: party?.id || "",
        sheet_name: sheetName,
        volume_label: volLabel || "",
        source_file_name: file.name,
      };
      if (existingDepo.length > 0) {
        await base44.entities.Depositions.update(existingDepo[0].id, depoData);
        depo = { ...existingDepo[0], ...depoData };
      } else {
        depo = await base44.entities.Depositions.create(depoData);
      }

      // Upsert transcript (ONE row per deposition)
      const existingTranscript = await base44.entities.DepositionTranscripts.filter({ deposition_id: depo.id });
      if (existingTranscript.length > 0) {
        await base44.entities.DepositionTranscripts.update(existingTranscript[0].id, {
          transcript_text: transcriptText, line_count: lineCount, hash
        });
      } else {
        await base44.entities.DepositionTranscripts.create({
          case_id: caseId, deposition_id: depo.id, format: "CITE_TAB_TEXT",
          transcript_text: transcriptText, line_count: lineCount, hash,
        });
      }

      summary.depositions++;
      summary.transcriptLines += lineCount;
      log(`  ${sheetName}: ${lineCount} lines (party: ${party?.display_name || "unmatched"})`);
      setProgress(40 + Math.round(((t + 1) / totalTranscripts) * 55));
      await sleep(300);
    }

    // Final
    setProgress(100);
    await base44.entities.ImportRuns.update(run.id, {
      status: "done", progress_percent: 100,
      summary_json: JSON.stringify(summary),
    });
    log(`Import complete! ${summary.parties} parties, ${summary.depositions} depositions (${summary.transcriptLines} total lines), ${summary.exhibits} exhibits`, "success");
    setImporting(false);
    base44.entities.ImportRuns.filter({ case_id: activeCase.id }, "-created_date", 10).then(setHistory);
  };

  if (!activeCase) return <div className="p-8 text-slate-400">No active case. Go to Settings first.</div>;

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-white mb-1">Import</h1>
      <p className="text-sm text-slate-500 mb-6">Import data from Excel workbook</p>

      <Card className="bg-[#131a2e] border-[#1e2a45] mb-6">
        <CardContent className="p-6 space-y-4">
          <div>
            <Label className="text-slate-400 text-xs">Excel File</Label>
            <label className="mt-1 flex items-center gap-3 p-4 border-2 border-dashed border-[#1e2a45] rounded-lg cursor-pointer hover:border-cyan-500/30 transition-colors">
              <Upload className="w-5 h-5 text-slate-400" />
              <span className="text-sm text-slate-300">{file ? file.name : "Choose file..."}</span>
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => setFile(e.target.files[0])} />
            </label>
          </div>
          <div>
            <Label className="text-slate-400 text-xs">Mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SYNC">SYNC (add new, keep existing)</SelectItem>
                <SelectItem value="REPLACE">REPLACE (wipe & reimport)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-slate-500 mt-1">SYNC is safest for initial import. Use REPLACE only to re-import corrected data.</p>
          </div>
          <Button
            className="bg-cyan-600 hover:bg-cyan-700"
            disabled={!file || importing}
            onClick={handleImport}
          >
            {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Start Import
          </Button>
        </CardContent>
      </Card>

      {/* Progress & Logs */}
      {(logs.length > 0 || importing) && (
        <Card className="bg-[#131a2e] border-[#1e2a45] mb-6">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-white">Import Progress</CardTitle>
              <span className="text-xs text-cyan-400">{progress}%</span>
            </div>
            <div className="w-full bg-[#0a0f1e] rounded-full h-2 mt-2">
              <div className="bg-cyan-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-[#0a0f1e] rounded p-3 max-h-64 overflow-y-auto font-mono text-xs space-y-1">
              {logs.map((l, i) => (
                <div key={i} className={`${l.type === "error" ? "text-red-400" : l.type === "warn" ? "text-amber-400" : l.type === "success" ? "text-green-400" : "text-slate-400"}`}>
                  <span className="text-slate-600">[{l.time}]</span> {l.msg}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card className="bg-[#131a2e] border-[#1e2a45]">
          <CardHeader><CardTitle className="text-sm text-white">Import History</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {history.map(h => {
              const s = h.summary_json ? JSON.parse(h.summary_json) : {};
              return (
                <div key={h.id} className="flex items-center justify-between p-2 rounded border border-[#1e2a45]">
                  <div className="flex items-center gap-3">
                    {h.status === "done" ? <CheckCircle className="w-4 h-4 text-green-400" /> : h.status === "error" ? <AlertCircle className="w-4 h-4 text-red-400" /> : <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />}
                    <div>
                      <p className="text-xs text-white">{h.file_name}</p>
                      <p className="text-[10px] text-slate-500">{new Date(h.created_date).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-slate-500 border-slate-600 text-[10px]">{h.mode}</Badge>
                    {s.parties != null && <Badge variant="outline" className="text-slate-400 border-slate-600 text-[10px]">{s.parties}P {s.depositions}D {s.exhibits}E</Badge>}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}