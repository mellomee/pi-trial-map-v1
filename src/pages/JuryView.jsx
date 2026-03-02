import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Document, Page, pdfjs } from "react-pdf";
import { Monitor } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

const COLOR_MAP = {
  yellow: "rgba(255,220,0,0.45)",
  red: "rgba(239,68,68,0.45)",
  green: "rgba(34,197,94,0.45)",
  blue: "rgba(59,130,246,0.45)",
};

export default function JuryView() {
  const [inputCode, setInputCode] = useState("");
  const [session, setSession] = useState(null);
  const [callouts, setCallouts] = useState([]);
  const [highlightRects, setHighlightRects] = useState([]);
  const [jointExhibits, setJointExhibits] = useState([]);
  const [extracts, setExtracts] = useState([]);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const connRef = useRef(null);

  // Auto-join via URL code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) joinSession(code.toUpperCase());
  }, []);

  const joinSession = async (code) => {
    setError("");
    setConnecting(true);
    const sessions = await base44.entities.TrialSessions.filter({ pair_code: code.toUpperCase() });
    if (!sessions.length) {
      setError("Session not found. Check the pair code.");
      setConnecting(false);
      return;
    }
    const s = sessions[0];

    const [je, ex, co, rects] = await Promise.all([
      base44.entities.JointExhibits.filter({ case_id: s.case_id }),
      base44.entities.ExhibitExtracts.filter({ case_id: s.case_id }),
      base44.entities.ExtractCallout.filter({ case_id: s.case_id }),
      base44.entities.HighlightRect.list(),
    ]);
    setJointExhibits(je);
    setExtracts(ex);
    setCallouts(co);
    setHighlightRects(rects.filter(r => co.some(c => c.id === r.callout_id)));
    setSession(s);

    // Register JuryConnection
    const existing = await base44.entities.JuryConnection.filter({ session_id: s.id });
    if (existing.length) {
      await base44.entities.JuryConnection.update(existing[0].id, { connected: true, last_seen_at: new Date().toISOString() });
      connRef.current = existing[0];
    } else {
      const conn = await base44.entities.JuryConnection.create({ session_id: s.id, connected: true, last_seen_at: new Date().toISOString() });
      connRef.current = conn;
    }
    setConnecting(false);
  };

  // Heartbeat + poll session every 1.5s
  useEffect(() => {
    if (!session) return;
    const beat = async () => {
      if (connRef.current?.id) {
        await base44.entities.JuryConnection.update(connRef.current.id, { connected: true, last_seen_at: new Date().toISOString() });
      }
      const updated = await base44.entities.TrialSessions.filter({ id: session.id });
      if (updated.length) setSession(updated[0]);
    };
    beat();
    const interval = setInterval(beat, 1500);
    return () => {
      clearInterval(interval);
      if (connRef.current?.id) {
        base44.entities.JuryConnection.update(connRef.current.id, { connected: false });
      }
    };
  }, [session?.id]);

  const type = session?.active_presentable_type || "none";
  const id = session?.active_presentable_id;
  const opts = session?.active_presentable_options || {};

  // Resolve current display
  const je = type === "joint_exhibit" ? jointExhibits.find(j => j.id === id) : null;
  const ext = je?.exhibit_extract_id ? extracts.find(e => e.id === je.exhibit_extract_id) : null;
  const fileUrl = ext?.extract_file_url || je?.file_url;
  const isPdf = fileUrl?.toLowerCase().includes(".pdf");
  const page = opts.page || 1;

  const callout = type === "extract_callout" ? callouts.find(c => c.id === id) : null;
  const calloutRects = callout ? highlightRects.filter(r => r.callout_id === callout.id) : [];

  // Pair code entry screen
  if (!session) {
    return (
      <div className="min-h-screen bg-[#050809] text-slate-200 flex flex-col items-center justify-center p-8">
        <style>{`body { background: #050809; }`}</style>
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-3">
            <Monitor className="w-16 h-16 text-green-400 mx-auto" />
            <h1 className="text-3xl font-black text-white">Jury Display</h1>
            <p className="text-sm text-slate-400">Enter the pair code from the attorney's screen.</p>
          </div>
          <div className="space-y-3">
            <Input
              value={inputCode}
              onChange={e => setInputCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && inputCode.trim() && joinSession(inputCode)}
              placeholder="AB1CD"
              className="text-center text-2xl tracking-[0.4em] font-black font-mono bg-[#131a2e] border-[#1e2a45] text-cyan-300 h-14"
              maxLength={6}
              autoFocus
            />
            {error && <p className="text-sm text-red-400 text-center">{error}</p>}
            <Button className="w-full bg-green-600 hover:bg-green-700 h-12 text-base font-semibold"
              onClick={() => joinSession(inputCode)} disabled={!inputCode.trim() || connecting}>
              {connecting ? "Connecting…" : "Connect to Session"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Connected — full screen display
  return (
    <div className="h-screen w-screen bg-black text-slate-200 flex flex-col overflow-hidden">
      <style>{`body { margin: 0; overflow: hidden; background: black; }`}</style>

      {/* Minimal status bar */}
      <div className="flex items-center justify-between px-4 py-1 bg-[#0a0f1e] border-b border-[#1e2a45] flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] text-green-400 font-medium uppercase tracking-wider">LIVE — {session.title}</span>
        </div>
      </div>

      {/* Main display */}
      <div className="flex-1 relative overflow-hidden">

        {/* BLANK */}
        {type === "none" && (
          <div className="absolute inset-0 bg-black flex items-center justify-center">
            <p className="text-slate-800 text-sm tracking-widest">WAITING FOR EXHIBIT…</p>
          </div>
        )}

        {/* JOINT EXHIBIT — PDF */}
        {type === "joint_exhibit" && fileUrl && isPdf && (
          <div className="absolute inset-0 overflow-auto flex justify-center items-start p-8 bg-[#080808]">
            <Document file={fileUrl} className="shadow-2xl">
              <Page pageNumber={page} scale={1.4} renderTextLayer={false} renderAnnotationLayer={false} />
            </Document>
          </div>
        )}

        {/* JOINT EXHIBIT — Image */}
        {type === "joint_exhibit" && fileUrl && !isPdf && (
          <div className="absolute inset-0 flex justify-center items-center p-8 bg-[#080808]">
            <img src={fileUrl} alt={je?.marked_title} className="max-w-full max-h-full object-contain shadow-2xl" />
          </div>
        )}

        {/* EXTRACT CALLOUT — Spotlight */}
        {type === "extract_callout" && callout?.snapshot_image_url && (
          <div className="absolute inset-0 bg-black flex items-center justify-center p-6">
            <div className="relative max-w-full max-h-full">
              <img
                src={callout.snapshot_image_url}
                alt={callout.name}
                className="max-w-full max-h-[calc(100vh-4rem)] object-contain shadow-2xl rounded"
                style={{ display: "block" }}
              />
              {/* Highlight overlays */}
              {opts.highlightsOn !== false && calloutRects.map((r, i) => (
                <div key={i} style={{
                  position: "absolute",
                  left: `${(r.rect?.x || 0) * 100}%`,
                  top: `${(r.rect?.y || 0) * 100}%`,
                  width: `${(r.rect?.w || 0) * 100}%`,
                  height: `${(r.rect?.h || 0) * 100}%`,
                  background: COLOR_MAP[r.color] || COLOR_MAP.yellow,
                  pointerEvents: "none",
                  borderRadius: "2px",
                }} />
              ))}
            </div>
            {callout.name && (
              <div className="absolute bottom-2 left-0 right-0 text-center">
                <span className="text-xs text-slate-600 bg-black/50 px-3 py-1 rounded-full">{callout.name}</span>
              </div>
            )}
          </div>
        )}

        {/* Callout with quote text only */}
        {type === "extract_callout" && !callout?.snapshot_image_url && callout?.quote_text && (
          <div className="absolute inset-0 bg-black flex items-center justify-center p-12">
            <div className="max-w-3xl text-center">
              <p className="text-3xl font-serif text-white leading-relaxed">"{callout.quote_text}"</p>
              {callout.name && <p className="text-lg text-slate-500 mt-6">{callout.name}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}