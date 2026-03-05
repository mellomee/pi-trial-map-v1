import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { base44 } from '@/api/base44Client';
import { FileText, Image, Video, BookOpen } from 'lucide-react';

const statusColors = {
  NotAsked: 'bg-slate-700 text-slate-300',
  Asked: 'bg-green-800 text-green-200',
  NeedsFollowUp: 'bg-red-800 text-red-200',
  Skipped: 'bg-gray-700 text-gray-300',
};

const statusIcons = {
  Asked: '✓',
  NeedsFollowUp: '✗',
  Skipped: '—',
  NotAsked: '',
};

const examTypeLabel = (type) => {
  if (type === 'Direct' || type === 'Cross') return 'Main';
  return type || '';
};

const examTypeBadgeColor = (type) => {
  if (type === 'Direct') return 'bg-blue-900 text-blue-300';
  if (type === 'Cross') return 'bg-purple-900 text-purple-300';
  if (type === 'Repair') return 'bg-amber-900 text-amber-300';
  return 'bg-slate-800 text-slate-400';
};

// Check if a child question has any proof linked (via QuestionProofItems OR QuestionEvidenceGroups)
function useChildProofFlags(childQuestions) {
  const [flags, setFlags] = useState({}); // { [questionId]: boolean }

  useEffect(() => {
    if (!childQuestions?.length) { setFlags({}); return; }
    let cancelled = false;
    Promise.all(
      childQuestions.map(async (q) => {
        // Check direct QuestionProofItems first (used by child questions)
        const direct = await base44.entities.QuestionProofItems.filter({ question_id: q.id });
        if (direct.length > 0) return [q.id, true];
        // Also check via EvidenceGroups
        const links = await base44.entities.QuestionEvidenceGroups.filter({ question_id: q.id });
        if (!links.length) return [q.id, false];
        const egIds = links.map(l => l.evidence_group_id);
        const piLinks = await base44.entities.EvidenceGroupProofItems.filter({ evidence_group_id: { $in: egIds } });
        return [q.id, piLinks.length > 0];
      })
    ).then(results => {
      if (cancelled) return;
      setFlags(Object.fromEntries(results));
    });
    return () => { cancelled = true; };
  }, [childQuestions?.map(q => q.id).join(',')]);

  return flags;
}

export default function ChildQuestionsZone({ parentQuestion, childQuestions, selectedChildId, onSelectChild }) {
  const proofFlags = useChildProofFlags(childQuestions);

  if (!parentQuestion) {
    return (
      <div className="flex flex-col h-full bg-[#0a0f1e] border-t border-[#1e2a45] items-center justify-center text-slate-600">
        <p className="text-xs">No question selected</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0f1e] border-t border-[#1e2a45]">
      <div className="px-4 py-2 border-b border-[#1e2a45] flex items-center gap-2 flex-shrink-0">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Child Questions ({childQuestions.length})
        </span>
      </div>

      {childQuestions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-600">
          <p className="text-xs">No child questions</p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {childQuestions.map((q, idx) => {
              const isSelected = selectedChildId === q.id;
              const hasProof = proofFlags[q.id];
              return (
                <button
                  key={q.id}
                  onClick={() => onSelectChild && onSelectChild(q)}
                  className={`w-full text-left rounded-lg p-3 border transition-colors ${
                    isSelected
                      ? 'bg-cyan-500/20 border-cyan-400'
                      : 'bg-[#0f1629] border-[#1e2a45] hover:bg-[#131a2e] hover:border-cyan-500/30'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`text-xs flex-shrink-0 mt-0.5 font-bold ${isSelected ? 'text-cyan-400' : 'text-slate-600'}`}>{idx + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className={`text-xs leading-snug line-clamp-3 flex-1 ${isSelected ? 'text-cyan-200' : 'text-slate-200'}`}>{q.question_text}</p>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
                          {hasProof && (
                            <BookOpen className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" title="Has linked proof" />
                          )}
                          {statusIcons[q.status] && (
                            <span className={`text-sm font-bold ${q.status === 'Asked' ? 'text-green-400' : q.status === 'NeedsFollowUp' ? 'text-red-400' : 'text-slate-500'}`}>
                              {statusIcons[q.status]}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Expected answer */}
                      {q.expected_answer && (
                        <p className="text-[10px] text-amber-300/70 italic mt-1 line-clamp-2 leading-snug">↳ {q.expected_answer}</p>
                      )}
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {q.question_type && (
                          <span className="text-[10px] text-slate-500 bg-[#131a2e] px-1.5 py-0.5 rounded">
                            {q.question_type}
                          </span>
                        )}
                        {q.exam_type && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${examTypeBadgeColor(q.exam_type)}`}>
                            {examTypeLabel(q.exam_type)}
                          </span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColors[q.status] || statusColors.NotAsked}`}>
                          {q.status === 'NotAsked' ? 'Not Asked' : q.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}