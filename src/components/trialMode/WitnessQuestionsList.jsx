import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, ChevronDown } from 'lucide-react';

const statusColors = {
  NotAsked: 'bg-slate-700 text-slate-200',
  Asked: 'bg-green-900 text-green-200',
  NeedsFollowUp: 'bg-amber-900 text-amber-200',
  Skipped: 'bg-gray-700 text-gray-200',
};

const priorityColors = {
  High: 'text-red-400',
  Med: 'text-yellow-400',
  Low: 'text-slate-400',
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
}) {
  const [searchText, setSearchText] = useState('');
  const [filterTrialPoint, setFilterTrialPoint] = useState('');

  const filteredQuestions = useMemo(() => {
    let qs = questions.filter(q => q.party_id === selectedWitnessId);
    if (examType !== 'All') qs = qs.filter(q => q.exam_type === examType);
    if (searchText) qs = qs.filter(q => q.question_text.toLowerCase().includes(searchText.toLowerCase()));
    return qs.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  }, [questions, selectedWitnessId, examType, searchText]);

  const selectedWitness = witnesses.find(w => w.id === selectedWitnessId);
  const selectedWitnessName = selectedWitness ? (selectedWitness.display_name || selectedWitness.last_name || selectedWitness.name || 'Unnamed') : 'Unnamed';

  return (
    <div className="flex flex-col h-full bg-[#0f1629] border-r border-[#1e2a45]">
      {/* Witness selector */}
      <div className="p-4 border-b border-[#1e2a45] space-y-2">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Witness: {selectedWitnessName}</label>
        <Select value={selectedWitnessId || ''} onValueChange={onSelectWitness}>
          <SelectTrigger className="bg-[#131a2e] border-[#1e2a45]">
            <SelectValue placeholder="Select witness..." />
          </SelectTrigger>
          <SelectContent>
            {witnesses.map(w => (
              <SelectItem key={w.id} value={w.id}>
                {w.display_name || w.last_name || w.name || 'Unnamed'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedWitness && (
        <>
          {/* Exam type toggle */}
          <div className="p-4 border-b border-[#1e2a45] flex gap-2">
            {['Direct', 'Cross'].map(type => (
              <Button
                key={type}
                variant={examType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => onExamTypeChange(type)}
                className={examType === type ? 'bg-cyan-600 hover:bg-cyan-700' : ''}
              >
                {type}
              </Button>
            ))}
          </div>

          {/* Search */}
          <div className="p-4 border-b border-[#1e2a45]">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search questions..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="pl-8 bg-[#131a2e] border-[#1e2a45] text-sm"
              />
            </div>
          </div>

          {/* Question list */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredQuestions.length === 0 ? (
                <p className="text-xs text-slate-500 p-4 text-center">No questions for this witness</p>
              ) : (
                filteredQuestions.map(q => {
                  const isSelected = selectedQuestionId === q.id;
                  return (
                    <button
                      key={q.id}
                      onClick={() => onSelectQuestion(q.id)}
                      className={`w-full text-left p-3 rounded-lg transition-colors text-xs ${
                        isSelected
                          ? 'bg-cyan-500/20 border border-cyan-400'
                          : 'bg-[#131a2e] border border-[#1e2a45] hover:bg-[#1a2340]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className={`font-medium line-clamp-2 ${isSelected ? 'text-cyan-300' : 'text-slate-200'}`}>
                          {q.question_text}
                        </span>
                        <Badge className={`${statusColors[q.status] || statusColors.NotAsked} text-xs flex-shrink-0`}>
                          {q.status}
                        </Badge>
                      </div>
                      {q.priority && (
                        <div className={`text-xs ${priorityColors[q.priority]}`}>
                          {q.priority} priority
                        </div>
                      )}
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