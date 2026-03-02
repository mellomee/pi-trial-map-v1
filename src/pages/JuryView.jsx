import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

export default function JuryView() {
  const urlParams = new URLSearchParams(window.location.search);
  const pairCode = urlParams.get("code");

  const [session, setSession] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [codeInput, setCodeInput] = useState("");
  const [publishedContent, setPublishedContent] = useState(null);

  // Try to connect using pair code from URL or input
  useEffect(() => {
    if (!pairCode && !codeInput) {
      setLoading(false);
      return;
    }
    
    const code = pairCode || codeInput;
    const joinSession = async () => {
      setLoading(true);
      try {
        const sessions = await base44.entities.TrialSessions.filter({ pair_code: code });
        if (sessions.length > 0) {
          const s = sessions[0];
          setSession(s);
          // Create jury connection record
          await base44.entities.JuryConnection.create({
            session_id: s.id,
            connected: true,
            last_seen_at: new Date().toISOString(),
          });
          setConnected(true);
          // Poll for updates
          const pollInterval = setInterval(async () => {
            const updated = await base44.entities.TrialSessions.filter({ id: s.id });
            if (updated.length > 0) {
              setSession(updated[0]);
              setPublishedContent(updated[0].active_presentable_type !== "none" ? updated[0] : null);
            }
          }, 1000);
          return () => clearInterval(pollInterval);
        } else {
          setLoading(false);
        }
      } catch (err) {
        setLoading(false);
      }
    };
    joinSession();
  }, [pairCode, codeInput]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="text-slate-400 text-sm">Connecting…</div>
      </div>
    );
  }

  if (!connected || !session) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="text-center space-y-4">
          <p className="text-slate-300 text-lg">Enter Pair Code</p>
          <input
            type="text"
            value={codeInput}
            onChange={e => setCodeInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && codeInput && window.location.reload()}
            placeholder="e.g. 2MSMG"
            className="px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white text-center text-xl tracking-widest font-mono"
            maxLength={6}
          />
          <button
            onClick={() => codeInput && window.location.reload()}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium"
          >
            Connect
          </button>
        </div>
      </div>
    );
  }

  // Jury is connected and waiting for content
  if (!publishedContent || session.active_presentable_type === "none") {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="text-slate-400 text-center">
          <div className="text-sm mb-4">Connected</div>
          <div className="w-2 h-2 bg-green-500 rounded-full mx-auto mb-8 animate-pulse" />
          <p className="text-xs text-slate-600">Waiting for attorney…</p>
        </div>
      </div>
    );
  }

  // Show published content (full screen, no controls)
  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center overflow-hidden relative">
      {/* Content area - placeholder */}
      <div className="flex items-center justify-center w-full h-full text-slate-500">
        <div className="text-center">
          <p className="text-sm">{session.active_presentable_type}</p>
          <p className="text-xs text-slate-700 mt-2">Content display here</p>
        </div>
      </div>

      {/* Top corner: Connection indicator */}
      <div className="absolute top-4 right-4 flex items-center gap-2 text-[10px] text-green-400">
        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
        <span>Connected</span>
      </div>
    </div>
  );
}