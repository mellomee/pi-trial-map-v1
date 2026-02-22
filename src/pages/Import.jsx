import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

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

  const handleImport = async () => {
    if (!file || !activeCase) return;
    setImporting(true);
    setLogs([]);
    setProgress(10);

    setLogs(prev => [...prev, { msg: "Uploading file...", type: "info", time: new Date().toLocaleTimeString() }]);

    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setProgress(20);
    setLogs(prev => [...prev, { msg: "File uploaded. Starting import (this may take a few minutes for large files)...", type: "info", time: new Date().toLocaleTimeString() }]);

    // Kick off import — returns immediately with runId
    const response = await base44.functions.invoke("importExcel", {
      file_url,
      case_id: activeCase.id,
      mode,
      file_name: file.name,
    });

    const { runId } = response.data;

    // Poll the ImportRun record for status
    const poll = setInterval(async () => {
      const runs = await base44.entities.ImportRuns.filter({ id: runId });
      const run = runs[0];
      if (!run) return;

      setProgress(run.progress_percent || 20);

      if (run.status === "done") {
        clearInterval(poll);
        setProgress(100);
        const logMsgs = run.diagnostics_json ? JSON.parse(run.diagnostics_json) : [];
        setLogs(logMsgs.map(msg => ({ msg, type: "info", time: "" })));
        setLogs(prev => [...prev, { msg: "Import complete!", type: "success", time: new Date().toLocaleTimeString() }]);
        setImporting(false);
        base44.entities.ImportRuns.filter({ case_id: activeCase.id }, "-created_date", 10).then(setHistory);
      } else if (run.status === "error") {
        clearInterval(poll);
        setProgress(100);
        const logMsgs = run.diagnostics_json ? JSON.parse(run.diagnostics_json) : [];
        setLogs(logMsgs.map(msg => ({ msg, type: "info", time: "" })));
        setLogs(prev => [...prev, { msg: `Error: ${run.error_text}`, type: "error", time: new Date().toLocaleTimeString() }]);
        setImporting(false);
        base44.entities.ImportRuns.filter({ case_id: activeCase.id }, "-created_date", 10).then(setHistory);
      }
    }, 3000);
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