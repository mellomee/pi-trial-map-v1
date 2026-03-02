import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, X } from "lucide-react";

export default function ProofPreviewPanel({ proof, onClose, extracts, callouts, depoClips, parties }) {
  const [highlightsVisible, setHighlightsVisible] = useState(true);

  if (!proof) return null;

  if (proof.proof_type === "DEPO_CLIP") {
    const clip = depoClips.find(c => c.id === proof.depo_clip_id);
    return (
      <Dialog open={!!proof} onOpenChange={onClose}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-2xl max-h-96 flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              🎬 {proof.title}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3">
            {clip && (
              <>
                <div>
                  <p className="text-xs text-slate-400">Cite Range</p>
                  <p className="text-sm font-mono text-slate-200 mt-1">
                    {clip.start_cite}{clip.end_cite ? ` → ${clip.end_cite}` : ""}
                  </p>
                </div>

                {clip.topic_tag && (
                  <div>
                    <p className="text-xs text-slate-400">Topic</p>
                    <p className="text-sm text-violet-400 mt-1">{clip.topic_tag}</p>
                  </div>
                )}

                {clip.clip_text && (
                  <div>
                    <p className="text-xs text-slate-400">Transcript Text</p>
                    <div className="bg-[#0a0f1e] border border-[#1e2a45] rounded p-3 mt-1 text-xs leading-relaxed">
                      {clip.clip_text.split("\n").map((line, i) => {
                        const tabIdx = line.indexOf("\t");
                        const cite = tabIdx >= 0 ? line.substring(0, tabIdx) : "";
                        const text = tabIdx >= 0 ? line.substring(tabIdx + 1) : line;
                        return (
                          <div key={i} className="flex gap-4 mb-1">
                            {cite && <span className="font-mono text-slate-600 w-20 flex-shrink-0">{cite}</span>}
                            <span className="text-slate-300">{text}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {proof.notes && (
                  <div>
                    <p className="text-xs text-slate-400">Notes</p>
                    <p className="text-sm text-slate-300 italic mt-1">{proof.notes}</p>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} className="border-slate-600 text-slate-300">
              <X className="w-3 h-3 mr-1" /> Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // EXTRACT_CALLOUT
  const callout = callouts.find(c => c.id === proof.callout_id);
  const extract = callout ? extracts.find(e => e.id === callout.extract_id) : null;

  return (
    <Dialog open={!!proof} onOpenChange={onClose}>
      <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-2xl max-h-96 flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              👁️ {proof.title}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="text-slate-400 hover:text-slate-200"
              onClick={() => setHighlightsVisible(!highlightsVisible)}
            >
              {highlightsVisible ? (
                <>
                  <Eye className="w-4 h-4 mr-1" /> Highlights: ON
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4 mr-1" /> Highlights: OFF
                </>
              )}
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3">
          {callout && (
            <>
              <div>
                <p className="text-xs text-slate-400">Callout</p>
                <p className="text-sm font-medium text-white mt-1">{callout.name || `Page ${callout.page_number}`}</p>
              </div>

              {extract && (
                <div>
                  <p className="text-xs text-slate-400">From Extract</p>
                  <p className="text-sm text-slate-300 mt-1">{extract.extract_title_official}</p>
                  {extract.extract_title_internal && (
                    <p className="text-xs text-slate-500 italic">{extract.extract_title_internal}</p>
                  )}
                </div>
              )}

              {callout.snapshot_image_url && (
                <div>
                  <p className="text-xs text-slate-400 mb-1.5">Snapshot</p>
                  <div
                    className="border border-[#1e2a45] rounded overflow-hidden bg-[#0a0f1e]"
                    style={{
                      position: "relative",
                      width: "100%",
                      maxHeight: "250px",
                    }}
                  >
                    <img
                      src={callout.snapshot_image_url}
                      alt="Callout snapshot"
                      style={{ width: "100%", height: "auto" }}
                    />
                  </div>
                </div>
              )}

              {proof.notes && (
                <div>
                  <p className="text-xs text-slate-400">Notes</p>
                  <p className="text-sm text-slate-300 italic mt-1">{proof.notes}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-slate-400">Source Party</p>
                {proof.source_party_id ? (
                  <p className="text-sm text-slate-300 mt-1">
                    {parties.find(p => p.id === proof.source_party_id)?.display_name || "—"}
                  </p>
                ) : (
                  <p className="text-sm text-slate-500 italic mt-1">Not specified</p>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-slate-600 text-slate-300">
            <X className="w-3 h-3 mr-1" /> Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}