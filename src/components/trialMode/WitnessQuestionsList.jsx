import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, ChevronLeft } from 'lucide-react';

const statusColors = {
  NotAsked: 'bg-slate-700 text-slate-200',
  Asked: 'bg-green-800 text-green-200',
  NeedsFollowUp: 'bg-amber-800 text-amber-200',
  Skipped: 'bg-gray-700 text-gray-200',
};

const statusIcons = {
  Asked: '✓',
  NeedsFollowUp: '⚠',
  Skipped: '—',
  NotAsked: '',
};

export default function WitnessQuestionsList({
  witnesses,
  questions,
  selectedWitnessId,
  onSelectWitness,
  selectedQuestionId,
  onSelectQuestion,
  examType,
  onExamTypeChange,
  onCollapse,
  selectedQuestionBucket,
}) {
  const [searchText, setSearchText] = useState('');

  // Only show parent questions (no parent_id), sorted by order_index
  const filteredQuestions = useMemo(() => {
    let qs = questions.filter(q => q.party_id === selectedWitnessId && !q.parent_id);
    if (examType !== 'All') {
      // "Main" maps to Direct + Cross
      if (examType === 'Main') qs = qs.filter(q => q.exam_type === 'Direct' || q.exam_type === 'Cross');
      else qs = qs.filter(q => q.exam_type === examType);
    }
    if (searchText) qs = qs.filter(q => q.question_text.toLowerCase().includes(searchText.toLowerCase()));
    return qs.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  }, [questions, selectedWitnessId, examType, searchText]);

  const selectedWitness = witnesses.find(w => w.id === selectedWitnessId);

  return (
    <div className="flex flex-col h-full w-full bg-[#0f1629] border-r border-[#1e2a45]">
      {/* Header with collapse button */}
      <div className="p-3 border-b border-[#1e2a45] flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Witness</label>
        <button
          onClick={onCollapse}
          className="text-slate-500 hover:text-slate-200 p-1 rounded transition-colors"
          title="Hide panel"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Witness selector */}
      <div className="p-3 border-b border-[#1e2a45]">
        <Select value={selectedWitnessId || ''} onValueChange={onSelectWitness}>
          <SelectTrigger className="bg-[#131a2e] border-[#1e2a45] text-sm">
            <SelectValue placeholder="Select witness..." />
          </SelectTrigger>
          <SelectContent>
            {witnesses.map(w => (
              <SelectItem key={w.id} value={w.id}>
                {w.display_name || `${w.first_name || ''} ${w.last_name}`.trim() || 'Unnamed'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedWitness && (
        <>
          {/* Exam type toggle */}
          <div className="p-3 border-b border-[#1e2a45] flex gap-1.5">
            {['Main', 'Repair', 'All'].map(type => (
              <Button
                key={type}
                variant={examType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => onExamTypeChange(type)}
                className={`flex-1 text-xs py-1 h-8 ${examType === type ? 'bg-cyan-600 hover:bg-cyan-700 text-white' : 'border-[#1e2a45] text-slate-400'}`}
              >
                {type}
              </Button>
            ))}
          </div>

          {/* Search */}
          <div className="p-3 border-b border-[#1e2a45]">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
              <Input
                placeholder="Search questions..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="pl-8 bg-[#131a2e] border-[#1e2a45] text-xs h-8"
              />
            </div>
          </div>

          {/* Question count */}
          <div className="px-3 py-1.5 border-b border-[#1e2a45] flex items-center justify-between">
            <span className="text-xs text-slate-500">{filteredQuestions.length} questions</span>
          </div>

          {/* Question list */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredQuestions.length === 0 ? (
                <p className="text-xs text-slate-500 p-4 text-center">No questions found</p>
              ) : (
                filteredQuestions.map((q, idx) => {
                  const isSelected = selectedQuestionId === q.id;
                  const statusIcon = statusIcons[q.status];
                  const examLabel = q.exam_type === 'Direct' || q.exam_type === 'Cross' ? 'Main' : q.exam_type;

                  return (
                    <button
                      key={q.id}
                      onClick={() => onSelectQuestion(q.id)}
                      className={`w-full text-left p-2.5 rounded-lg transition-colors ${
                        isSelected
                          ? 'bg-cyan-500/20 border border-cyan-400'
                          : 'bg-[#131a2e] border border-[#1e2a45] hover:bg-[#1a2340] active:bg-cyan-500/10'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className={`text-xs font-bold mt-0.5 flex-shrink-0 w-5 text-right ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`}>
                          {idx + 1}.
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <span className={`text-xs font-medium line-clamp-2 leading-snug ${isSelected ? 'text-cyan-200' : 'text-slate-200'}`}>
                              {q.question_text}
                            </span>
                            {statusIcon && (
                              <span className={`text-sm flex-shrink-0 font-bold ${q.status === 'Asked' ? 'text-green-400' : q.status === 'NeedsFollowUp' ? 'text-amber-400' : 'text-slate-500'}`}>
                                {statusIcon}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColors[q.status]} opacity-80`}>
                              {q.status === 'NotAsked' ? 'Not Asked' : q.status}
                            </span>
                            {examLabel && (
                              <span className="text-[10px] text-slate-500">{examLabel}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}