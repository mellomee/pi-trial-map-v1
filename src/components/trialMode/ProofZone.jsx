import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Image, Video, Play } from 'lucide-react';

const typeIcon = (type) => {
  if (type === 'depoClip') return <FileText className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />;
  if (type === 'extract') return <Image className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />;
  if (type === 'videoClip') return <Video className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />;
  return <Play className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />;
};

const typeBadgeColor = (type) => {
  if (type === 'depoClip') return 'bg-blue-900 text-blue-200';
  if (type === 'extract') return 'bg-purple-900 text-purple-200';
  if (type === 'videoClip') return 'bg-green-900 text-green-200';
  return 'bg-slate-800 text-slate-200';
};

function ProofCard({ proof, isSelected, onClick }) {
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
            {proof.label}
          </p>
          {proof.meta && (
            <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{proof.meta}</p>
          )}
          <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded ${typeBadgeColor(proof.type)}`}>
            {proof.type === 'depoClip' ? 'Depo Clip' : proof.type === 'extract' ? 'Extract' : 'Video'}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function ProofZone({ proofItems, selectedProofId, onSelectProof }) {
  if (!proofItems || proofItems.length === 0) {
    return (
      <div className="flex flex-col h-full bg-[#0a0f1e] border-l border-[#1e2a45]">
        <div className="px-4 py-2 border-b border-[#1e2a45]">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Proof (0)</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-slate-600">
          <p className="text-xs text-center px-4">No proofs linked<br />to this question</p>
        </div>
      </div>
    );
  }

  // Split into 2 columns
  const col1 = proofItems.filter((_, i) => i % 2 === 0);
  const col2 = proofItems.filter((_, i) => i % 2 === 1);

  return (
    <div className="flex flex-col h-full bg-[#0a0f1e] border-l border-[#1e2a45]">
      <div className="px-4 py-2 border-b border-[#1e2a45] flex-shrink-0">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Proof ({proofItems.length})
        </span>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 grid grid-cols-2 gap-2">
          {proofItems.map(proof => (
            <ProofCard
              key={proof.id}
              proof={proof}
              isSelected={selectedProofId === proof.id}
              onClick={() => onSelectProof(proof)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}