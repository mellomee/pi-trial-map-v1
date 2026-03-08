import React, { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { base44 } from '@/api/base44Client';
import { FileText, Image, Video, Play, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import QuickAdmitModal from '@/components/trialMode/QuickAdmitModal';

const typeIcon = (type) => {
  if (type === 'depoClip') return <FileText className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />;
  if (type === 'extract') return <Image className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />;
  if (type === 'videoClip') return <Video className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />;
  return <Play className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />;
};

// Check if a proof item's exhibit is admitted
function useProofAdmitStatus(proofItems) {
  const [statusMap, setStatusMap] = useState({}); // { [proofId]: { admitted: bool, jxId, admittedNo } }

  useEffect(() => {
    if (!proofItems?.length) { setStatusMap({}); return; }
    let cancelled = false;

    Promise.all(proofItems.map(async (proof) => {
      if (proof.type === 'depoClip') {
        // Depo clips don't require admission to publish
        return [proof.id, { admitted: true, type: 'depoClip' }];
      }
      if (proof.type === 'extract' && proof.source_id) {
        // Look up JointExhibit for this extract
        const jxs = await base44.entities.JointExhibits.filter({ exhibit_extract_id: proof.source_id });
        const jx = jxs[0];
        if (!jx) return [proof.id, { admitted: false, jxId: null, admittedNo: null }];
        const admitted = jx.status === 'Admitted' && !!jx.admitted_no;
        return [proof.id, { admitted, jxId: jx.id, admittedNo: jx.admitted_no, jx }];
      }
      return [proof.id, { admitted: true }]; // fallback
    })).then(results => {
      if (cancelled) return;
      setStatusMap(Object.fromEntries(results));
    });

    return () => { cancelled = true; };
  }, [proofItems?.map(p => p.id).join(',')]);

  return statusMap;
}

function ProofCard({ proof, isSelected, onClick, admitStatus, onAdmit }) {
  const displayLabel = proof.type === 'depoClip'
    ? (proof.clip_title || proof.topic_tag || proof.label)
    : proof.label;
  const calloutName = proof.type === 'extract' ? (proof.callout_name || null) : null;

  const admitted = admitStatus?.admitted;
  const isExtract = proof.type === 'extract';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
        isSelected
          ? 'bg-cyan-500/20 border-cyan-400'
          : 'bg-[#0f1629] border-[#1e2a45] hover:bg-[#131a2e] active:bg-cyan-500/10'
      }`}
    >
      <div className="flex items-start gap-2">
        {typeIcon(proof.type)}
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium line-clamp-2 leading-snug ${isSelected ? 'text-cyan-200' : 'text-slate-200'}`}>
            {displayLabel}
          </p>
          {calloutName && (
            <p className="text-[10px] text-cyan-400 mt-0.5 line-clamp-1">↳ {calloutName}</p>
          )}
          {proof.meta && (
            <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{proof.meta}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              proof.type === 'depoClip' ? 'bg-blue-900 text-blue-200' :
              proof.type === 'extract' ? 'bg-purple-900 text-purple-200' :
              'bg-slate-800 text-slate-200'
            }`}>
              {proof.type === 'depoClip' ? 'Depo Clip' : proof.type === 'extract' ? 'Extract' : 'Video'}
            </span>
            {isExtract && admitted && admitStatus?.admittedNo && (
              <span className="text-[10px] text-green-300 flex items-center gap-0.5 bg-green-900/30 border border-green-700/30 px-1.5 py-0.5 rounded">
                <CheckCircle2 className="w-2.5 h-2.5" />
                Ex. {admitStatus.admittedNo}
              </span>
            )}
            {isExtract && !admitted && (
              <button
                onClick={e => { e.stopPropagation(); onAdmit && onAdmit(proof, admitStatus); }}
                className="text-[10px] text-amber-400 flex items-center gap-0.5 bg-amber-900/20 border border-amber-700/30 px-1.5 py-0.5 rounded hover:bg-amber-800/40 transition-colors"
                title="Mark as admitted to enable publishing"
              >
                <Lock className="w-2.5 h-2.5" />
                Admit
              </button>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function ProofZone({ proofItems, selectedProofId, onSelectProof, childQuestionActive, onProofAdmitted, calloutNames }) {
  const admitStatusMap = useProofAdmitStatus(proofItems);
  const [admitTarget, setAdmitTarget] = useState(null); // { proof, admitStatus }

  const handleAdmit = (proof, admitStatus) => {
    setAdmitTarget({ proof, admitStatus });
  };

  if (!proofItems || proofItems.length === 0) {
    return (
      <div className="flex flex-col h-full bg-[#0a0f1e] border-l border-[#1e2a45]">
        <div className="px-4 py-2 border-b border-[#1e2a45]">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Proof (0)</span>
          {childQuestionActive && <span className="ml-2 text-[10px] text-cyan-400">child</span>}
        </div>
        <div className="flex-1 flex items-center justify-center text-slate-600">
          <p className="text-xs text-center px-4">No proofs linked<br />to this question</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full bg-[#0a0f1e] border-l border-[#1e2a45]">
        <div className="px-4 py-2 border-b border-[#1e2a45] flex-shrink-0 flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Proof ({proofItems.length})
          </span>
          {childQuestionActive && <span className="text-[10px] text-cyan-400">• child</span>}
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 grid grid-cols-2 gap-2">
            {proofItems.map(proof => (
              <ProofCard
                key={proof.id}
                proof={proof}
                isSelected={selectedProofId === proof.id}
                admitStatus={admitStatusMap[proof.id]}
                onClick={() => onSelectProof(proof)}
                onAdmit={handleAdmit}
                calloutNames={calloutNames}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {admitTarget && (
        <QuickAdmitModal
          proof={admitTarget.proof}
          jxId={admitTarget.admitStatus?.jxId}
          onClose={() => setAdmitTarget(null)}
          onAdmitted={(jx) => {
            setAdmitTarget(null);
            onProofAdmitted && onProofAdmitted();
          }}
        />
      )}
    </>
  );
}