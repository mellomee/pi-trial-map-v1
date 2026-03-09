import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { usePresentationState } from "@/components/hooks/usePresentationState";
import SharedProofViewer from "@/components/shared/SharedProofViewer";
import { Scale } from "lucide-react";

export default function JuryView() {
  const { activeCase } = useActiveCase();
  const [trialSessionId, setTrialSessionId] = useState(null);
  const [sessionState, setSessionState] = useState(null);
  const [proofItem, setProofItem] = useState(null);
  const [extract, setExtract] = useState(null);
  const [callouts, setCallouts] = useState([]);
  const [spotlightCallout, setSpotlightCallout] = useState(null);
  const [depoClip, setDepoClip] = useState(null);
  const [depo, setDepo] = useState(null);
  const [jx, setJx] = useState(null);

  // Find current trial session
  useEffect(() => {
    if (!activeCase?.id) return;
    base44.entities.TrialSessions.filter({
      case_id: activeCase.id,
      status: { $in: ['Setup', 'Active'] },
    }).then((sessions) => {
      if (sessions.length) setTrialSessionId(sessions[0].id);
    });
  }, [activeCase?.id]);

  // Use shared presentation state (jury is reader-only).
  // usePresentationState loads initial state + subscribes — same record as sessionState.
  const { state: presentationState } = usePresentationState(trialSessionId, false);
  const externalPage = sessionState?.proof_current_page ?? presentationState?.proof_current_page ?? null;
  // Attorney uses iframe — never writes zoom/scroll. Pass null so centerOnInit applies.
  const externalScale = null;
  const externalPositionX = null;
  const externalPositionY = null;

  // Load initial session state + subscribe to changes
  useEffect(() => {
    if (!trialSessionId) return;
    // Fetch initial state immediately so jury doesn't wait for first event
    base44.entities.TrialSessionStates.filter({ trial_session_id: trialSessionId })
      .then((states) => { if (states[0]) setSessionState(states[0]); });

    const unsub = base44.entities.TrialSessionStates.subscribe((event) => {
      if (event.data?.trial_session_id === trialSessionId) {
        setSessionState(event.data);
      }
    });
    return unsub;
  }, [trialSessionId]);

  // Load proof item when session state changes
  useEffect(() => {
    const pid = sessionState?.current_proof_item_id;
    if (!sessionState?.jury_can_see_proof || !pid) {
      setProofItem(null); setExtract(null); setCallouts([]);
      setSpotlightCallout(null); setDepoClip(null); setDepo(null); setJx(null);
      return;
    }

    base44.entities.ProofItems.filter({ id: pid }).then(async (items) => {
      const item = items[0];
      if (!item) return;
      setProofItem(item);

      if (item.type === 'depoClip' && item.source_id) {
        const clips = await base44.entities.DepoClips.filter({ id: item.source_id });
        const clip = clips[0] || null;
        setDepoClip(clip);
        if (clip?.deposition_id) {
          const depos = await base44.entities.Depositions.filter({ id: clip.deposition_id });
          setDepo(depos[0] || null);
        }
        setExtract(null); setCallouts([]); setSpotlightCallout(null); setJx(null);

      } else if (item.type === 'extract' && item.source_id) {
        const extracts = await base44.entities.ExhibitExtracts.filter({ id: item.source_id });
        const ext = extracts[0];
        if (!ext?.extract_file_url) { setExtract(null); return; }
        setExtract(ext);
        setDepoClip(null); setDepo(null);

        const [cos, jxList] = await Promise.all([
          base44.entities.Callouts.filter({ extract_id: ext.id }),
          base44.entities.JointExhibits.filter({ exhibit_extract_id: ext.id }),
        ]);
        const sorted = [...cos].sort((a, b) => (a.page_number || 0) - (b.page_number || 0));
        setCallouts(sorted);
        setJx(jxList[0] || null);

        // Spotlight: driven by session state
        const sid = sessionState?.current_callout_id;
        if (sid) {
          const sc = sorted.find((c) => c.id === sid) || null;
          setSpotlightCallout(sc);
        } else {
          setSpotlightCallout(null);
        }
      }
    });
  }, [sessionState?.current_proof_item_id, sessionState?.jury_can_see_proof, sessionState?.current_callout_id]);

  // Blank screen when nothing is published
  if (!sessionState || !sessionState.jury_can_see_proof || !proofItem) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <Scale className="w-20 h-20 text-slate-800" strokeWidth={1} />
      </div>
    );
  }

  const exhibitLabel = jx?.admitted_no ? `Exhibit ${jx.admitted_no}` : jx?.marked_no ? `Exhibit ${jx.marked_no}` : null;

  return (
    <div className="fixed inset-0 bg-[#060810] flex flex-col overflow-hidden">
      {/* Depo clip view */}
      {proofItem.type === 'depoClip' && depoClip && (
        <div className="w-full h-full flex flex-col justify-center px-10 py-10">
          <div className="mb-6 flex flex-wrap gap-4 items-baseline">
            {depo && (
              <span className="text-slate-400 text-xl font-semibold tracking-wide uppercase">{depo.sheet_name}</span>
            )}
            <span className="text-cyan-300 font-mono text-lg">{depoClip.start_cite} – {depoClip.end_cite}</span>
          </div>
          <div className="overflow-y-auto max-h-[75vh]">
            {(depoClip.clip_text || '').split('\n').filter(Boolean).map((line, i) => {
              const parts = line.match(/^(\d+:\d+)\s+(.*)$/);
              if (parts) {
                return (
                  <div key={i} className="flex border-b border-white/5 py-3">
                    <span className="font-mono text-cyan-400 text-2xl font-bold w-28 flex-shrink-0 pr-4 text-right leading-tight">{parts[1]}</span>
                    <span className="text-white text-2xl leading-tight flex-1">{parts[2]}</span>
                  </div>
                );
              }
              return <div key={i} className="text-white text-2xl py-3">{line}</div>;
            })}
          </div>
        </div>
      )}

      {/* Extract view — use SharedProofViewer in readOnly mode, mirroring attorney */}
      {proofItem.type === 'extract' && extract?.extract_file_url && (
        <div className="flex flex-col flex-1 overflow-hidden relative">
          {exhibitLabel && (
            <div className="absolute top-3 right-4 z-30">
              <span className="text-slate-300 text-base font-semibold bg-black/60 rounded px-3 py-1 tracking-wide">{exhibitLabel}</span>
            </div>
          )}
          {/* Spotlight driven by session state callout */}
          {spotlightCallout?.snapshot_image_url && (
            <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.72)' }}>
              <img
                src={spotlightCallout.snapshot_image_url}
                alt={spotlightCallout.name || 'Callout'}
                className="block shadow-2xl rounded-lg border border-white/10"
                style={{ maxWidth: '92%', maxHeight: '88vh', objectFit: 'contain' }}
                draggable={false}
              />
              {spotlightCallout.name && (
                <div className="absolute bottom-4 left-0 right-0 text-center z-30">
                  <span className="text-slate-300 text-lg bg-black/70 px-4 py-1.5 rounded-full">{spotlightCallout.name}</span>
                </div>
              )}
            </div>
          )}
          <SharedProofViewer
            extract={extract}
            callouts={[]}
            caseParties={{}}
            proofItem={proofItem}
            externalPage={externalPage}
            externalScale={externalScale}
            externalPositionX={externalPositionX}
            externalPositionY={externalPositionY}
            readOnly={true}
          />
        </div>
      )}
    </div>
  );
}