import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as XLSX from 'npm:xlsx@0.18.5';

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

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { file_url, case_id, mode, file_name } = await req.json();
  if (!file_url || !case_id) {
    return Response.json({ error: "file_url and case_id required" }, { status: 400 });
  }

  const summary = { parties: 0, depositions: 0, transcriptLines: 0, exhibits: 0, sheets: [] };
  const logs = [];
  const log = (msg) => logs.push(msg);

  // Create import run
  const run = await base44.entities.ImportRuns.create({
    case_id, file_name: file_name || "upload.xlsx", mode: mode || "SYNC", status: "running", progress_percent: 1,
  });

  try {
    // Fetch the file
    const resp = await fetch(file_url);
    const buf = await resp.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
    
    log(`Found ${wb.SheetNames.length} sheets: ${wb.SheetNames.join(", ")}`);
    summary.sheets = wb.SheetNames;

    // If REPLACE mode, wipe existing data
    if (mode === "REPLACE") {
      log("REPLACE mode: wiping existing case data...");
      const entities = ["DepoClips", "QuestionLinks", "Questions", "AdmittedExhibits", "JointExhibits", "ExhibitLinks", "DepositionTranscripts", "DepositionExhibits", "Depositions", "BattleCards", "TrialPoints", "Parties"];
      for (const ent of entities) {
        const items = await base44.asServiceRole.entities[ent].filter({ case_id });
        for (const item of items) {
          await base44.asServiceRole.entities[ent].delete(item.id);
          await sleep(50);
        }
        if (items.length > 0) log(`Deleted ${items.length} ${ent}`);
      }
    }

    // === PARTIES ===
    const partiesSheetName = wb.SheetNames.find(n => n.toLowerCase() === "parties");
    const partyMap = {};

    if (partiesSheetName) {
      log("Parsing Parties sheet...");
      const sheet = wb.Sheets[partiesSheetName];
      const headerRow = findHeaderRow(sheet);
      log(`Detected header at row ${headerRow + 1}`);
      const rows = XLSX.utils.sheet_to_json(sheet, { range: headerRow });

      for (const row of rows) {
        const firstName = (row.first_name || row.FirstName || row.firstname || row["First Name"] || "").toString().trim();
        const lastName = (row.last_name || row.LastName || row.lastname || row["Last Name"] || "").toString().trim();
        if (!lastName) continue;

        const data = {
          case_id,
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

        const existing = await base44.asServiceRole.entities.Parties.filter({ case_id, last_name: lastName, first_name: firstName });
        let party;
        if (existing.length > 0) {
          await base44.asServiceRole.entities.Parties.update(existing[0].id, data);
          party = { ...existing[0], ...data };
        } else {
          party = await base44.asServiceRole.entities.Parties.create(data);
        }
        partyMap[normalizeSheetKey(lastName)] = party;
        partyMap[normalizeSheetKey(`${firstName}${lastName}`)] = party;
        summary.parties++;
        await sleep(100);
      }
      log(`Imported ${summary.parties} parties`);
    }

    // === EXHIBITS ===
    const exhibitsSheetName = wb.SheetNames.find(n => n.toLowerCase() === "exhibits");
    if (exhibitsSheetName) {
      log("Parsing Exhibits sheet...");
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[exhibitsSheetName]);

      for (const row of rows) {
        const exhibitNo = (row.exhibit_no || row.Exhibit || row.ExhibitNo || row["Exhibit #"] || row.No || "").toString().trim();
        const title = (row.exhibit_title || row.Title || row.ExhibitName || row.Description || "").toString().trim();
        if (!exhibitNo && !title) continue;

        const side = normalizeSide(row.SIDE || row.Side || row.side);
        const deponentKey = normalizeSheetKey((row.deponent || row.Deponent || row.Witness || row.LastName || "").toString());
        const party = partyMap[deponentKey];
        const dedupeKey = `${exhibitNo}|${title}`.toLowerCase();

        // Upsert into MasterExhibits
        const existingMaster = await base44.asServiceRole.entities.MasterExhibits.filter({ case_id, dedupe_key: dedupeKey });
        let masterExhibit;
        if (existingMaster.length > 0) {
          masterExhibit = existingMaster[0];
        } else {
          masterExhibit = await base44.asServiceRole.entities.MasterExhibits.create({
            case_id,
            master_title: title || `Exhibit ${exhibitNo}`,
            master_description: (row.Description || row.description || "").toString().trim(),
            dedupe_key: dedupeKey,
            provided_by_side: side,
            notes: (row.notes || row.Notes || "").toString().trim(),
          });
          summary.exhibits++;
        }

        // Also create DepositionExhibit record
        await base44.asServiceRole.entities.DepositionExhibits.create({
          case_id,
          deponent_party_id: party?.id || "",
          deponent_sheet_key: deponentKey,
          depo_exhibit_no: exhibitNo,
          depo_exhibit_title: title,
          referenced_page: (row.referenced_page || row.Page || "").toString().trim(),
          provided_by_side: side,
          raw_label: (row.raw_label || row.Label || "").toString().trim(),
        });
        await sleep(300);

        // Link them
        await base44.asServiceRole.entities.ExhibitLinks.create({
          case_id,
          master_exhibit_id: masterExhibit.id,
          depo_exhibit_no: exhibitNo,
          depo_exhibit_title: title,
        });

        await sleep(400);
      }
      log(`Imported ${summary.exhibits} master exhibits from Exhibits sheet`);
    }

    // === TRANSCRIPTS ===
    const skipSheets = new Set(["parties", "exhibits"]);
    const transcriptSheets = wb.SheetNames.filter(n => !skipSheets.has(n.toLowerCase()));

    for (const sheetName of transcriptSheets) {
      log(`Processing transcript: ${sheetName}...`);
      const sheet = wb.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const lines = [];
      for (const row of rawRows) {
        const cite = (row[0] || "").toString().trim();
        const text = (row[1] || "").toString().trim();
        if (!cite && !text) continue;
        lines.push(`${cite}\t${text}`);
      }

      if (lines.length === 0) {
        log(`Skipped ${sheetName} (no data)`);
        continue;
      }

      const transcriptText = lines.join("\n");
      const lineCount = lines.length;
      const hash = `${sheetName}-${lineCount}-${transcriptText.length}`;

      const key = normalizeSheetKey(sheetName);
      const volLabel = detectVolLabel(sheetName);
      const baseKey = key.replace(/VOL\d+/i, "");
      const party = partyMap[key] || partyMap[baseKey];

      const existingDepo = await base44.asServiceRole.entities.Depositions.filter({ case_id, sheet_name: sheetName });
      let depo;
      const depoData = {
        case_id,
        party_id: party?.id || "",
        sheet_name: sheetName,
        volume_label: volLabel || "",
        source_file_name: file_name || "upload.xlsx",
      };
      if (existingDepo.length > 0) {
        await base44.asServiceRole.entities.Depositions.update(existingDepo[0].id, depoData);
        depo = { ...existingDepo[0], ...depoData };
      } else {
        depo = await base44.asServiceRole.entities.Depositions.create(depoData);
      }

      // Upload transcript text as a file to avoid field size limits
      const transcriptFile = new File([transcriptText], `${sheetName}.txt`, { type: "text/plain" });
      const uploadResp = await base44.asServiceRole.integrations.Core.UploadFile({ file: transcriptFile });
      const transcript_url = uploadResp.file_url;

      const existingTranscript = await base44.asServiceRole.entities.DepositionTranscripts.filter({ deposition_id: depo.id });
      if (existingTranscript.length > 0) {
        await base44.asServiceRole.entities.DepositionTranscripts.update(existingTranscript[0].id, {
          transcript_url, line_count: lineCount, hash
        });
      } else {
        await base44.asServiceRole.entities.DepositionTranscripts.create({
          case_id, deposition_id: depo.id, format: "CITE_TAB_TEXT",
          transcript_url, line_count: lineCount, hash,
        });
      }

      summary.depositions++;
      summary.transcriptLines += lineCount;
      log(`${sheetName}: ${lineCount} lines (party: ${party?.display_name || "unmatched"})`);
      await sleep(300);
    }

    await base44.asServiceRole.entities.ImportRuns.update(run.id, {
      status: "done", progress_percent: 100,
      summary_json: JSON.stringify(summary),
    });

    log(`Import complete! ${summary.parties} parties, ${summary.depositions} depositions (${summary.transcriptLines} lines), ${summary.exhibits} exhibits`);

    return Response.json({ success: true, summary, logs, runId: run.id });

  } catch (error) {
    await base44.asServiceRole.entities.ImportRuns.update(run.id, {
      status: "error", error_text: error.message,
    });
    return Response.json({ success: false, error: error.message, logs }, { status: 500 });
  }
});