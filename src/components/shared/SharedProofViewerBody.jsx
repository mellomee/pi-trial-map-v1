import React from 'react';
import { Eye, Image as ImageIcon, X, CheckCircle2 } from 'lucide-react';

// ── Highlight overlay ────────────────────────────────────────────────────────
function HighlightOverlay({ highlights }) {
  if (!highlights?.length) return null;
  const colorMap = {
    yellow: 'rgba(253,224,71,0.5)', red: 'rgba(239,68,68,0.45)',
    green: 'rgba(34,197,94,0.45)', blue: 'rgba(59,130,246,0.45)',
  };
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
      {highlights.map((h, hi) =>
        (h.rects_norm || []).map((rect, ri) => (
          <div key={`${hi}-${ri}`} style={{
            position: 'absolute',
            left: `${rect.x * 100}%`, top: `${rect.y * 100}%`,
            width: `${rect.w * 100}%`, height: `${rect.h * 100}%`,
            backgroundColor: colorMap[h.color] || colorMap.yellow,
          }} />
        ))
      )}
    </div>
  );
}

// ── Spotlight overlay (absolute — scoped to parent) ──────────────────────────
function SpotlightOverlay({ callout, highlights, onClose }) {
  if (!callout?.snapshot_image_url) return null;
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center"
      style={{ background: 'rgba(5,8,22,0.88)' }}
    >
      <button
        onClick={onClose}
        className="absolute top-2 right-2 bg-red-900/80 hover:bg-red-700 text-red-300 p-1.5 rounded-lg z-30 touch-manipulation"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <div
        className="relative inline-block shadow-2xl rounded-lg border border-white/10"
        style={{ maxWidth: '92%', maxHeight: '88%' }}
      >
        <img
          src={callout.snapshot_image_url}
          alt={callout.name || 'Callout'}
          className="block"
          style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', display: 'block' }}
          draggable={false}
        />
        <HighlightOverlay highlights={highlights} />
      </div>
      {callout.name && (
        <div className="absolute bottom-3 left-0 right-0 text-center z-30">
          <span className="text-slate-300 text-xs bg-black/70 px-3 py-1 rounded-full">{callout.name}</span>
        </div>
      )}
    </div>
  );
}

// ── Callout sidebar item ─────────────────────────────────────────────────────
function CalloutSidebarItem({ callout, witnessName, isActive, isLinked, onClick, onSetAsProof }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border p-1.5 transition-all space-y-1 touch-manipulation ${
        isActive
          ? 'border-amber-400 bg-amber-500/10'
          : isLinked
          ? 'border-cyan-500/40 bg-cyan-900/20'
          : 'border-[#1e2a45] hover:border-slate-500 hover:bg-[#131a2e]'
      }`}
    >
      {callout.snapshot_image_url ? (
        <div className="w-full aspect-video rounded overflow-hidden bg-black">
          <img src={callout.snapshot_image_url} alt={callout.name} className="w-full h-full object-contain" />
        </div>
      ) : (
        <div className="w-full aspect-video rounded bg-[#0a0f1e] flex items-center justify-center">
          <ImageIcon className="w-3 h-3 text-slate-600" />
        </div>
      )}
      {callout.name && <p className="text-[9px] text-slate-300 truncate leading-tight">{callout.name}</p>}
      {witnessName && <p className="text-[9px] text-cyan-400 truncate leading-tight">{witnessName}</p>}
      <div className="flex items-center gap-1 flex-wrap">
        {isActive && (
          <span className="flex items-center gap-0.5 text-[8px] text-amber-400 font-medium">
            <Eye className="w-2 h-2" /> Active
          </span>
        )}
        {isLinked && <CheckCircle2 className="w-2.5 h-2.5 text-cyan-400 ml-auto" />}
      </div>
      {isActive && onSetAsProof && !isLinked && (
        <button
          onClick={(e) => { e.stopPropagation(); onSetAsProof(); }}
          className="w-full text-[8px] bg-cyan-700/50 hover:bg-cyan-600/60 text-cyan-300 rounded py-0.5 mt-0.5 transition-colors"
        >
          Set as Proof
        </button>
      )}
    </button>
  );
}

// ── Main shared body ─────────────────────────────────────────────────────────
/**
 * SharedProofViewerBody
 *
 * Reusable extract viewer used by:
 *   - ProofViewerModal  (read-only, fullscreen overlay)
 *   - ExtractViewerZone (inline, with publish controls outside this component)
 *
 * Props:
 *   extract           — ExhibitExtract record
 *   callouts          — sorted Callout[]
 *   witnessNames      — { [witnessId]: displayName }
 *   selectedCallout   — currently spotlighted Callout | null
 *   onSelectCallout   — (callout | null) => void
 *   proofItemCalloutId — the callout_id linked on the ProofItem (for the checkmark)
 *   highlights        — Highlight[] for the selectedCallout
 *   onSetAsProof      — optional (callout) => void  — shows "Set as Proof" btn in modal
 */
export default function SharedProofViewerBody({
  extract,
  callouts = [],
  witnessNames = {},
  selectedCallout,
  onSelectCallout,
  proofItemCalloutId,
  highlights = [],
  onSetAsProof,
}) {
  const fileUrl = extract?.extract_file_url;
  const isPdf = fileUrl?.match(/\.pdf(\?|$)/i);

  return (
    <div className="flex h-full relative overflow-hidden bg-[#080c18]">
      {/* Spotlight overlay — absolute, scoped to this container */}
      {selectedCallout?.snapshot_image_url && (
        <SpotlightOverlay
          callout={selectedCallout}
          highlights={highlights}
          onClose={() => onSelectCallout(null)}
        />
      )}

      {/* File viewer */}
      <div className="flex-1 overflow-auto relative">
        {fileUrl ? (
          isPdf ? (
            <iframe
              src={fileUrl}
              title={extract.extract_title_internal || extract.extract_title_official || 'Extract'}
              className="w-full"
              style={{ height: '100%', minHeight: '400px', border: 'none', display: 'block' }}
            />
          ) : (
            <div className="p-2 flex justify-center bg-black">
              <img
                src={fileUrl}
                alt={extract.extract_title_internal || extract.extract_title_official || 'Extract'}
                className="block max-w-full shadow-xl"
                draggable={false}
              />
            </div>
          )
        ) : (
          <div className="flex items-center justify-center h-full min-h-[200px] text-slate-500">
            <div className="text-center space-y-2">
              <ImageIcon className="w-8 h-8 mx-auto opacity-20" />
              <p className="text-xs">No file uploaded</p>
            </div>
          </div>
        )}
      </div>

      {/* Callout sidebar */}
      {callouts.length > 0 && (
        <div className="w-32 flex-shrink-0 bg-[#0f1629] border-l border-[#1e2a45] overflow-y-auto">
          <div className="p-1.5 space-y-1.5">
            <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold px-1 pt-1">
              Callouts ({callouts.length})
            </p>
            {callouts.map((c) => (
              <CalloutSidebarItem
                key={c.id}
                callout={c}
                witnessName={c.witness_id ? witnessNames[c.witness_id] : null}
                isActive={selectedCallout?.id === c.id}
                isLinked={proofItemCalloutId === c.id}
                onClick={() => onSelectCallout(selectedCallout?.id === c.id ? null : c)}
                onSetAsProof={onSetAsProof ? () => onSetAsProof(c) : null}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}