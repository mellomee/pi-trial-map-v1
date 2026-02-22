import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Download, Upload, Loader2, AlertCircle } from "lucide-react";

export default function Export() {
  const { activeCase } = useActiveCase();
  const [exporting, setExporting] = useState(false);
  const [importingJson, setImportingJson] = useState(false);
  const [jsonFile, setJsonFile] = useState(null);
  const [log, setLog] = useState("");

  const handleExport = async () => {
    if (!activeCase) return;
    setExporting(true);
    setLog("Exporting...");
    const cid = activeCase.id;

    const [parties, depositions, transcripts, depoExhibits, masterExhibits, exhibitLinks, jointExhibits, admittedExhibits, trialPoints, questions, questionLinks, depoClips, battleCards] = await Promise.all([
      base44.entities.Parties.filter({ case_id: cid }),
      base44.entities.Depositions.filter({ case_id: cid }),
      base44.entities.DepositionTranscripts.filter({ case_id: cid }),
      base44.entities.DepositionExhibits.filter({ case_id: cid }),
      base44.entities.MasterExhibits.filter({ case_id: cid }),
      base44.entities.ExhibitLinks.filter({ case_id: cid }),
      base44.entities.JointExhibits.filter({ case_id: cid }),
      base44.entities.AdmittedExhibits.filter({ case_id: cid }),
      base44.entities.TrialPoints.filter({ case_id: cid }),
      base44.entities.Questions.filter({ case_id: cid }),
      base44.entities.QuestionLinks.filter({ case_id: cid }),
      base44.entities.DepoClips.filter({ case_id: cid }),
      base44.entities.BattleCards.filter({ case_id: cid }),
    ]);

    const data = {
      exportVersion: 1,
      exportDate: new Date().toISOString(),
      case: activeCase,
      parties, depositions, transcripts, depoExhibits,
      masterExhibits, exhibitLinks, jointExhibits, admittedExhibits,
      trialPoints, questions, questionLinks, depoClips, battleCards,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeCase.name.replace(/\s/g, "_")}_export.json`;
    a.click();
    URL.revokeObjectURL(url);

    setLog(`Exported: ${parties.length} parties, ${depositions.length} depositions, ${masterExhibits.length} exhibits, ${trialPoints.length} trial points, ${questions.length} questions, ${depoClips.length} clips`);
    setExporting(false);
  };

  const handleJsonImport = async () => {
    if (!jsonFile || !activeCase) return;
    setImportingJson(true);
    setLog("Reading JSON...");

    const text = await jsonFile.text();
    const data = JSON.parse(text);
    const cid = activeCase.id;

    // Import order matters - parents before children
    const idMap = {};

    setLog("Importing parties...");
    for (const p of (data.parties || [])) {
      const oldId = p.id;
      const newP = await base44.entities.Parties.create({ ...p, id: undefined, case_id: cid, created_date: undefined, updated_date: undefined, created_by: undefined });
      idMap[oldId] = newP.id;
    }

    setLog("Importing depositions...");
    for (const d of (data.depositions || [])) {
      const oldId = d.id;
      const newD = await base44.entities.Depositions.create({ ...d, id: undefined, case_id: cid, party_id: idMap[d.party_id] || d.party_id, created_date: undefined, updated_date: undefined, created_by: undefined });
      idMap[oldId] = newD.id;
    }

    setLog("Importing transcripts...");
    for (const t of (data.transcripts || [])) {
      await base44.entities.DepositionTranscripts.create({ ...t, id: undefined, case_id: cid, deposition_id: idMap[t.deposition_id] || t.deposition_id, created_date: undefined, updated_date: undefined, created_by: undefined });
    }

    setLog("Importing exhibits & trial data...");
    for (const e of (data.depoExhibits || [])) {
      const oldId = e.id;
      const ne = await base44.entities.DepositionExhibits.create({ ...e, id: undefined, case_id: cid, deponent_party_id: idMap[e.deponent_party_id] || e.deponent_party_id, created_date: undefined, updated_date: undefined, created_by: undefined });
      idMap[oldId] = ne.id;
    }
    for (const e of (data.masterExhibits || [])) {
      const oldId = e.id;
      const ne = await base44.entities.MasterExhibits.create({ ...e, id: undefined, case_id: cid, created_date: undefined, updated_date: undefined, created_by: undefined });
      idMap[oldId] = ne.id;
    }
    for (const e of (data.exhibitLinks || [])) {
      await base44.entities.ExhibitLinks.create({ ...e, id: undefined, case_id: cid, master_exhibit_id: idMap[e.master_exhibit_id] || e.master_exhibit_id, deposition_exhibit_id: idMap[e.deposition_exhibit_id] || e.deposition_exhibit_id, deponent_party_id: idMap[e.deponent_party_id] || e.deponent_party_id, created_date: undefined, updated_date: undefined, created_by: undefined });
    }
    for (const e of (data.jointExhibits || [])) {
      const oldId = e.id;
      const ne = await base44.entities.JointExhibits.create({ ...e, id: undefined, case_id: cid, master_exhibit_id: idMap[e.master_exhibit_id] || e.master_exhibit_id, created_date: undefined, updated_date: undefined, created_by: undefined });
      idMap[oldId] = ne.id;
    }
    for (const e of (data.admittedExhibits || [])) {
      await base44.entities.AdmittedExhibits.create({ ...e, id: undefined, case_id: cid, joint_exhibit_id: idMap[e.joint_exhibit_id] || e.joint_exhibit_id, created_date: undefined, updated_date: undefined, created_by: undefined });
    }
    for (const e of (data.trialPoints || [])) {
      const oldId = e.id;
      const ne = await base44.entities.TrialPoints.create({ ...e, id: undefined, case_id: cid, created_date: undefined, updated_date: undefined, created_by: undefined });
      idMap[oldId] = ne.id;
    }
    for (const e of (data.questions || [])) {
      const oldId = e.id;
      const ne = await base44.entities.Questions.create({ ...e, id: undefined, case_id: cid, party_id: idMap[e.party_id] || e.party_id, created_date: undefined, updated_date: undefined, created_by: undefined });
      idMap[oldId] = ne.id;
    }
    for (const e of (data.questionLinks || [])) {
      await base44.entities.QuestionLinks.create({ ...e, id: undefined, case_id: cid, question_id: idMap[e.question_id] || e.question_id, link_id: idMap[e.link_id] || e.link_id, created_date: undefined, updated_date: undefined, created_by: undefined });
    }
    for (const e of (data.depoClips || [])) {
      await base44.entities.DepoClips.create({ ...e, id: undefined, case_id: cid, deposition_id: idMap[e.deposition_id] || e.deposition_id, linked_master_exhibit_id: idMap[e.linked_master_exhibit_id] || e.linked_master_exhibit_id, created_date: undefined, updated_date: undefined, created_by: undefined });
    }
    for (const e of (data.battleCards || [])) {
      await base44.entities.BattleCards.create({ ...e, id: undefined, case_id: cid, plaintiff_party_id: idMap[e.plaintiff_party_id] || e.plaintiff_party_id, defense_party_id: idMap[e.defense_party_id] || e.defense_party_id, created_date: undefined, updated_date: undefined, created_by: undefined });
    }

    setLog("JSON import complete!");
    setImportingJson(false);
  };

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-1">Export / Import</h1>
      <p className="text-sm text-slate-500 mb-6">Save or restore case data as JSON</p>

      <Card className="bg-[#131a2e] border-[#1e2a45] mb-6">
        <CardHeader><CardTitle className="text-white text-base">Export Case</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-slate-400 mb-3">Downloads all data for "{activeCase.name}" as a single JSON file.</p>
          <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Export JSON
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-[#131a2e] border-[#1e2a45] mb-6">
        <CardHeader><CardTitle className="text-white text-base">Import from JSON</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-slate-400">Import a previously exported JSON file into the active case. Data will be added (not replaced).</p>
          <label className="flex items-center gap-3 p-4 border-2 border-dashed border-[#1e2a45] rounded-lg cursor-pointer hover:border-cyan-500/30 transition-colors">
            <Upload className="w-5 h-5 text-slate-400" />
            <span className="text-sm text-slate-300">{jsonFile ? jsonFile.name : "Choose JSON file..."}</span>
            <input type="file" accept=".json" className="hidden" onChange={e => setJsonFile(e.target.files[0])} />
          </label>
          <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={handleJsonImport} disabled={!jsonFile || importingJson}>
            {importingJson ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Import JSON
          </Button>
        </CardContent>
      </Card>

      {log && (
        <Card className="bg-[#131a2e] border-[#1e2a45]">
          <CardContent className="p-4">
            <p className="text-xs text-slate-300 font-mono">{log}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}