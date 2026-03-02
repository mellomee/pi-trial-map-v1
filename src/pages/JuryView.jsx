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
  const [liveState, setLiveState] = useState(null);
  const [jointExhibits, setJointExhibits] = useState([]);
  const [admittedExhibits, setAdmittedExhibits] = useState([]);
  const [extracts, setExtracts] = useState([]);
  const [numPages, setNumPages] = useState(null);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const connRef = useRef(null); // JuryConnection record
  const heartbeatRef = useRef(null);

  // Auto-join via URL code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) { setInputCode(code.toUpperCase()); joinSession(code.toUpperCase()); }
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
    setSession(s);

    const [je, ae, ex, states] = await Promise.all([
      base44.entities.JointExhibits.filter({ case_id: s.case_id }),
      base44.entities.AdmittedExhibits.filter({ case_id: s.case_id }),
      base44.entities.ExhibitExtracts.filter({ case_id: s.case_id }),
      base44.entities.LiveState.filter({ session_id: s.id }),
    ]);
    setJointExhibits(je);
    setAdmittedExhibits(ae);
    setExtracts(ex);
    if (states.length) setLiveState(states[0]);

    // Create or update JuryConnection
    const existingConns = await base44.entities.JuryConnection.filter({ session_id: s.id });
    let conn;
    if (existingConns.length) {
      conn = await base44.entities.JuryConnection.update(existingConns[0].id, {
        connected: true, last_seen_at: new Date().toISOString(),
      });
      connRef.current = existingConns[0];
    } else {
      conn = await base44.entities.JuryConnection.create({
        session_id: s.id, connected: true, last_seen_at: new Date().toISOString(),
      });
      connRef.current = conn;
    }

    setConnecting(false);
  };

  // Heartbeat: update last_seen_at every 5s while connected
  useEffect(() => {
    if (!session || !connRef.current) return;
    const beat = async () => {
      if (connRef.current?.id) {
        await base44.entities.JuryConnection.update(connRef.current.id, {
          connected: true, last_seen_at: new Date().toISOString(),
        });
      }
    };
    heartbeatRef.current = setInterval(beat, 5000);
    return () => {
      clearInterval(heartbeatRef.current);
      // Mark disconnected on unmount
      if (connRef.current?.id) {
        base44.entities.JuryConnection.update(connRef.current.id, { connected: false });
      }
    };
  }, [session?.id]);

  // Poll LiveState every 1.5s
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(async () => {
      const states = await base44.entities.LiveState.filter({ session_id: session.id });
      if (states.length) setLiveState(states[0]);
    }, 1500);
    return () => clearInterval(interval);
  }, [session?.id]);

  const mode = liveState?.mode || "blank";
  const je = liveState?.joint_exhibit_id ? jointExhibits.find(j => j.id === liveState.joint_exhibit_id) : null;
  const ext = liveState?.extract_id ? extracts.find(e => e.id === liveState.extract_id) : null;
  const fileUrl = ext?.extract_file_url || je?.file_url;
  const isPdf = fileUrl?.toLowerCase().includes(".pdf");
  const page = liveState?.page || 1;

  // Pair code entry screen
  if (!session) {
    return (
      <div className="min-h-screen bg-[#050809] text-slate-200 flex flex-col items-center justify-center p-8">
        <style>{`body { background: #050809; }`}</style>
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-3">
            <Monitor className="w-16 h-16 text-green-400 mx-auto" />
            <h1 className="text-3xl font-black text-white tracking-tight">Jury Display</h1>
            <p className="text-sm text-slate-400">Enter the pair code from the attorney's screen to connect.</p>
          </div>
          <div className="space-y-3">
            <Input
              value={inputCode}
              onChange={e => setInputCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && inputCode.trim() && joinSession(inputCode)}
              placeholder="AB1CD"
              className="text-center text-2xl tracking-[0.4em] font-black font-mono bg-[#131a2e] border-[#1e2a45] text-cyan-300 h-14"
              maxLength={6}
            />
            {error && <p className="text-sm text-red-400 text-center">{error}</p>}
            <Button
              className="w-full bg-green-600 hover:bg-green-700 h-12 text-base font-semibold"
              onClick={() => joinSession(inputCode)}
              disabled={!inputCode.trim() || connecting}
            >
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
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#0a0f1e] border-b border-[#1e2a45] flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] text-green-400 font-medium uppercase tracking-wider">LIVE — {session.title}</span>
        </div>
        {liveState?.label && (
          <p className="text-xs font-semibold text-slate-300">{liveState.label}</p>
        )}
      </div>

      {/* Main content area */}
      <div className="flex-1 relative overflow-hidden">

        {/* BLANK */}
        {mode === "blank" && (
          <div className="absolute inset-0 bg-black flex items-center justify-center">
            <p className="text-slate-800 text-sm">Waiting…</p>
          </div>
        )}

        {/* EXHIBIT — PDF */}
        {mode === "exhibit" && fileUrl && isPdf && (
          <div className="absolute inset-0 overflow-auto flex justify-center items-start p-8 bg-[#080808]">
            <Document file={fileUrl} onLoadSuccess={({ numPages }) => setNumPages(numPages)} className="shadow-2xl">
              <Page pageNumber={page} scale={1.4} renderTextLayer={false} renderAnnotationLayer={false} />
            </Document>
          </div>
        )}

        {/* EXHIBIT — Image */}
        {mode === "exhibit" && fileUrl && !isPdf && (
          <div className="absolute inset-0 overflow-auto flex justify-center items-center p-8 bg-[#080808]">
            <img src={fileUrl} alt={je?.marked_title} className="max-w-full max-h-full object-contain shadow-2xl" />
          </div>
        )}

        {/* SPOTLIGHT */}
        {mode === "spotlight" && liveState?.spotlight_image_url && (
          <div className="absolute inset-0 bg-black flex items-center justify-center p-8">
            <div className="relative max-w-full max-h-full">
              <img
                src={liveState.spotlight_image_url}
                alt="Spotlight"
                className="max-w-full max-h-[calc(100vh-6rem)] object-contain shadow-2xl rounded-lg"
                style={{ display: "block" }}
              />
              {/* Highlight overlays */}
              {liveState.highlights_visible && (liveState.highlight_rects || []).map((r, i) => (
                <div key={i} style={{
                  position: "absolute",
                  left: `${r.x * 100}%`,
                  top: `${r.y * 100}%`,
                  width: `${r.w * 100}%`,
                  height: `${r.h * 100}%`,
                  background: COLOR_MAP[r.color] || COLOR_MAP.yellow,
                  pointerEvents: "none",
                  borderRadius: "2px",
                }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}