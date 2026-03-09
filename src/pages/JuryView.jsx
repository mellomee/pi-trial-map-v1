import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { usePresentationState } from "@/components/hooks/usePresentationState";
import PdfViewer from "@/components/shared/PdfViewer";
import { PRESENTATION_FRAME_STYLE } from "@/components/trialMode/presentationFrameStyle";
import { Scale } from "lucide-react";

function HighlightOverlay({ highlights }) {
  if (!highlights?.length) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {highlights.map((h, hi) =>
        (h.rects_norm || []).map((rect, ri) => {
          const colorMap = {
            yellow: "rgba(253,224,71,0.45)",
            red: "rgba(239,68,68,0.4)",
            green: "rgba(34,197,94,0.4)",
            blue: "rgba(59,130,246,0.4)"
          };

          const bg = colorMap[h.color] || colorMap.yellow;

          return (
            <div
              key={`${hi}-${ri}`}
              style={{
                position: "absolute",
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.w * 100}%`,
                height: `${rect.h * 100}%`,
                backgroundColor: bg,
                mixBlendMode: "multiply"
              }}
            />
          );
        })
      )}
    </div>
  );
}

export default function JuryView() {
  const { activeCase } = useActiveCase();

  const [trialSessionId, setTrialSessionId] = useState(null);
  const [sessionState, setSessionState] = useState(null);

  const [proofItem, setProofItem] = useState(null);
  const [extract, setExtract] = useState(null);
  const [callout, setCallout] = useState(null);
  const [highlights, setHighlights] = useState([]);

  const [depoClip, setDepoClip] = useState(null);
  const [depo, setDepo] = useState(null);
  const [jx, setJx] = useState(null);

  useEffect(() => {
    if (!activeCase?.id) return;

    base44.entities.TrialSessions
      .filter({
        case_id: activeCase.id,
        status: { $in: ["Setup", "Active"] }
      })
      .then((sessions) => {
        if (sessions.length) {
          setTrialSessionId(sessions[0].id);
        }
      });
  }, [activeCase?.id]);

  const { state: presentationState } =
    usePresentationState(trialSessionId, false);

  const zoom = presentationState?.proof_zoom_level || 1;
  const currentPage = presentationState?.proof_current_page || 1;

  const sharedScrollLeft = presentationState?.proof_scroll_left ?? null;
  const sharedScrollTop = presentationState?.proof_scroll_top ?? null;

  useEffect(() => {
    if (!trialSessionId) return;

    const unsub =
      base44.entities.TrialSessionStates.subscribe((event) => {
        if (event.data?.trial_session_id === trialSessionId) {
          setSessionState(event.data);
        }
      });

    return unsub;
  }, [trialSessionId]);

  useEffect(() => {
    const pid = sessionState?.current_proof_item_id;

    if (!sessionState?.jury_can_see_proof || !pid) {
      setProofItem(null);
      setExtract(null);
      setCallout(null);
      setHighlights([]);
      setDepoClip(null);
      setDepo(null);
      setJx(null);
      return;
    }

    base44.entities.ProofItems
      .filter({ id: pid })
      .then(async (items) => {
        const item = items[0];
        if (!item) return;

        setProofItem(item);

        if (item.type === "depoClip" && item.source_id) {
          const clips = await base44.entities.DepoClips.filter({
            id: item.source_id
          });

          const clip = clips[0] || null;
          setDepoClip(clip);

          if (clip?.deposition_id) {
            const depos =
              await base44.entities.Depositions.filter({
                id: clip.deposition_id
              });

            setDepo(depos[0] || null);
          }

          setExtract(null);
          setCallout(null);
          setHighlights([]);
          setJx(null);
        }

        if (item.type === "extract" && item.source_id) {
          const extracts =
            await base44.entities.ExhibitExtracts.filter({
              id: item.source_id
            });

          const extract = extracts[0];

          if (!extract || !extract.extract_file_url) {
            setExtract(null);
            setCallout(null);
            return;
          }

          setExtract(extract);

          const spotlightCalloutId =
            sessionState?.current_callout_id;

          if (spotlightCalloutId) {
            const callouts =
              await base44.entities.Callouts.filter({
                id: spotlightCalloutId
              });

            const targetCallout = callouts[0] || null;
            setCallout(targetCallout);

            if (targetCallout) {
              const hs =
                await base44.entities.Highlights.filter({
                  callout_id: targetCallout.id
                });

              setHighlights(hs);
            } else {
              setHighlights([]);
            }
          } else {
            setCallout(null);
            setHighlights([]);
          }

          const jxs =
            await base44.entities.JointExhibits.filter({
              exhibit_extract_id: extract.id
            });

          setJx(jxs[0] || null);

          setDepoClip(null);
          setDepo(null);
        }
      });
  }, [
    sessionState?.current_proof_item_id,
    sessionState?.jury_can_see_proof,
    sessionState?.current_callout_id
  ]);

  if (!sessionState || !sessionState.jury_can_see_proof || !proofItem) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <Scale className="w-30 h-30 text-slate-700" strokeWidth={1.5} />
      </div>
    );
  }

  const exhibitLabel =
    jx?.admitted_no
      ? `Exhibit ${jx.admitted_no}`
      : jx?.marked_no
      ? `Exhibit ${jx.marked_no}`
      : null;

  const isPdf =
    extract?.extract_file_url?.match(/\.pdf(\?|$)/i);

  return (
    <div className="fixed inset-0 bg-[#060810] flex items-center justify-center overflow-hidden">

      {proofItem.type === "extract" && extract?.extract_file_url && (
        <div style={PRESENTATION_FRAME_STYLE.container}>
          <div style={PRESENTATION_FRAME_STYLE.inner}>

            {exhibitLabel && (
              <div className="absolute top-3 right-4 z-20">
                <span className="text-slate-300 text-base font-semibold bg-black/60 rounded px-3 py-1 tracking-wide">
                  {exhibitLabel}
                </span>
              </div>
            )}

            {isPdf && (
              <div style={{ width: "100%", height: "100%", position: "relative" }}>
                <PdfViewer
                  fileUrl={extract.extract_file_url}
                  externalZoom={zoom}
                  externalPage={currentPage}
                  externalScrollLeft={sharedScrollLeft}
                  externalScrollTop={sharedScrollTop}
                  readOnly={true}
                  showControls={false}
                  dimmed={false}
                />

                {callout?.snapshot_image_url && (
                  <div
                    className="absolute inset-0 z-5"
                    style={{ background: "rgba(0,0,0,0.35)" }}
                  />
                )}

                {callout?.snapshot_image_url && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="relative inline-block shadow-2xl rounded-lg border border-white/10">
                      <img
                        src={callout.snapshot_image_url}
                        alt="Callout"
                        style={{
                          display: "block",
                          maxWidth: "95vw",
                          maxHeight: "92vh",
                          objectFit: "contain"
                        }}
                        draggable={false}
                      />

                      <HighlightOverlay highlights={highlights} />
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}