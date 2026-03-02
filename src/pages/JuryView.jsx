import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Monitor, Wifi } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

export default function JuryView() {
  const [pairCode, setPairCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [session, setSession] = useState(null);
  const [liveState, setLiveState] = useState(null);
  const [jointExhibits, setJointExhibits] = useState([]);
  const [admittedExhibits, setAdmittedExhibits] = useState([]);
  const [extracts, setExtracts] = useState([]);
  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(1.0);
  const [error, setError] = useState("");

  // Auto-join if pair_code in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) { setInputCode(code); joinSession(code); }
  }, []);

  const joinSession = async (code) => {
    setError("");
    const sessions = await base44.entities.TrialSessions.filter({ pair_code: code.toUpperCase() });
    if (!sessions.length) { setError("Session not found. Check the pair code."); return; }
    const s = sessions[0];
    setSession(s);
    setPairCode(code.toUpperCase());

    const [je, ae, ex] = await Promise.all([
      base44.entities.JointExhibits.filter({ case_id: s.case_id }),
      base44.entities.AdmittedExhibits.filter({ case_id: s.case_id }),
      base44.entities.ExhibitExtracts.filter({ case_id: s.case_id }),
    ]);
    setJointExhibits(je);
    setAdmittedExhibits(ae);
    setExtracts(ex);

    // Load initial live state
    const states = await base44.entities.LiveState.filter({ session_id: s.id });
    if (states.length) setLiveState(states[0]);

    // Increment connected count
    if (states.length) {
      await base44.entities.LiveState.update(states[0].id, {
        connected_jury_clients: (states[0].connected_jury_clients || 0) + 1,
      });
    }
  };

  // Poll for live state changes every 2s
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(async () => {
      const states = await base44.entities.LiveState.filter({ session_id: session.id });
      if (states.length) setLiveState(states[0]);
    }, 2000);
    return () => {
      clearInterval(interval);
      // Decrement on unmount
      if (liveState?.id) {
        base44.entities.LiveState.update(liveState.id, {
          connected_jury_clients: Math.max(0, (liveState.connected_jury_clients || 1) - 1),
        });
      }
    };
  }, [session?.id]);

  const admittedById = useMemo(() => {
    const m = {};
    admittedExhibits.forEach(a => { m[a.joint_exhibit_id] = a; });
    return m;
  }, [admittedExhibits]);

  const currentExhibit = liveState?.joint_exhibit_id
    ? jointExhibits.find(j => j.id === liveState.joint_exhibit_id)
    : null;

  const adm = currentExhibit ? admittedById[currentExhibit.id] : null;

  const ext = currentExhibit?.exhibit_extract_id
    ? extracts.find(e => e.id === currentExhibit.exhibit_extract_id)
    : null;

  const fileUrl = ext?.extract_file_url || currentExhibit?.file_url;
  const isPdf = fileUrl?.toLowerCase().includes(".pdf");
  const currentPage = liveState?.page || 1;

  if (!session) {
    return (
      <div className="min-h-screen bg-[#050809] text-slate-200 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <Monitor className="w-12 h-12 text-green-400 mx-auto" />
            <h1 className="text-2xl font-bold text-white">Jury Display</h1>
            <p className="text-sm text-slate-400">Enter the pair code from the Attorney View to connect.</p>
          </div>
          <div className="space-y-3">
            <Input
              value={inputCode}
              onChange={e => setInputCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && joinSession(inputCode)}
              placeholder="Enter pair code (e.g. AB1CD)"
              className="text-center text-lg tracking-widest font-mono bg-[#131a2e] border-[#1e2a45] text-white h-12"
              maxLength={6}
            />
            {error && <p className="text-sm text-red-400 text-center">{error}</p>}
            <Button className="w-full bg-green-600 hover:bg-green-700 h-12 text-base" onClick={() => joinSession(inputCode)} disabled={!inputCode.trim()}>
              Connect to Session
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050809] text-slate-200 flex flex-col">
      <style>{`body { margin: 0; overflow: hidden; }`}</style>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0a0f1e] border-b border-[#1e2a45] flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] text-green-400 font-medium">LIVE — {session.title}</span>
        </div>
        {currentExhibit && adm && (
          <div className="flex items-center gap-4">
            <p className="text-sm font-black text-green-300">
              Admitted Exhibit {adm.admitted_no}
            </p>
            <p className="text-[10px] text-slate-500">(Marked #{currentExhibit.marked_no})</p>
            {isPdf && (
              <div className="flex items-center gap-1.5">
                <button onClick={() => {}} disabled className="p-0.5 text-slate-500 disabled:opacity-30"><ChevronLeft className="w-3.5 h-3.5" /></button>
                <span className="text-[10px] text-slate-400">{currentPage} / {numPages || "…"}</span>
                <button onClick={() => {}} disabled className="p-0.5 text-slate-500 disabled:opacity-30"><ChevronRight className="w-3.5 h-3.5" /></button>
                <div className="w-px h-3 bg-[#1e2a45]" />
                <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-0.5 text-slate-500 hover:text-white"><ZoomOut className="w-3 h-3" /></button>
                <span className="text-[9px] text-slate-600">{Math.round(scale * 100)}%</span>
                <button onClick={() => setScale(s => Math.min(3, s + 0.25))} className="p-0.5 text-slate-500 hover:text-white"><ZoomIn className="w-3 h-3" /></button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main display */}
      <div className="flex-1 overflow-auto flex justify-center items-start bg-[#050809] p-6 relative">
        {(!liveState || liveState.mode === "BLANK" || !fileUrl) && (
          <div className="flex flex-col items-center justify-center h-full w-full text-slate-700 gap-4 min-h-[60vh]">
            <Monitor className="w-24 h-24 opacity-10" />
            <p className="text-lg opacity-30">Waiting for attorney…</p>
          </div>
        )}

        {liveState?.mode === "EXHIBIT" && fileUrl && isPdf && (
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            className="shadow-2xl"
          >
            <Page pageNumber={currentPage} scale={scale} renderTextLayer={false} renderAnnotationLayer={false} />
          </Document>
        )}

        {liveState?.mode === "EXHIBIT" && fileUrl && !isPdf && (
          <img src={fileUrl} alt={currentExhibit?.marked_title}
            className="max-w-full shadow-2xl"
            style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}
          />
        )}

        {/* Spotlight overlay for callouts */}
        {liveState?.spotlight && liveState?.mode === "CALLOUT" && (
          <div className="absolute inset-0 bg-black/85 flex items-center justify-center z-10">
            <div className="max-w-2xl max-h-[80vh] overflow-hidden rounded-xl border border-yellow-500/40 shadow-2xl bg-[#080d1a] p-2">
              <p className="text-xs text-yellow-400 font-semibold text-center py-2">✦ Spotlight</p>
              <p className="text-sm text-slate-400 text-center p-4">Callout display</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}