import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Play, Pause, Square, CheckCircle, XCircle, SkipForward, RotateCcw, BookOpen } from 'lucide-react';

const examTypeLabel = (type) => {
  if (type === 'Direct' || type === 'Cross') return 'Main';
  return type || '';
};

const examTypeBadgeColor = (type) => {
  if (type === 'Direct') return 'bg-blue-800 text-blue-200';
  if (type === 'Cross') return 'bg-purple-800 text-purple-200';
  if (type === 'Repair') return 'bg-amber-800 text-amber-200';
  return 'bg-slate-700 text-slate-200';
};

export default function RunnerZone({
  question,
  nextQuestion,
  questionIndex,
  totalQuestions,
  bucketName,
  onStatusChange,
  onSelectQuestion,
  onSelectCurrentQuestion,
  childQuestions,
  hasProof,
}) {
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [currentTime, setCurrentTime] = useState('');
  const intervalRef = useRef(null);
  const timerRef = useRef(null);

  // Clock PT
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
      }));
    };
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // Timer
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerRunning]);

  const formatElapsed = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  if (!question) {
    return (
      <div className="flex flex-col h-full bg-[#0a0f1e] items-center justify-center text-slate-500">
        <p className="text-sm">Select a question to start</p>
      </div>
    );
  }

  const isMarked = question.status === 'Asked' || question.status === 'NeedsFollowUp' || question.status === 'Skipped';
  const childCount = childQuestions?.length || 0;

  return (
    <div className="flex flex-col h-full bg-[#0a0f1e]">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1e2a45] bg-[#0f1629] flex-shrink-0 gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-slate-400">
            <Clock className="w-3 h-3" />
            <span className="text-[10px] font-mono">{currentTime} PT</span>
          </div>
          <div className="flex items-center gap-0.5">
            <span className={`text-xs font-mono font-bold min-w-[40px] ${timerRunning ? 'text-cyan-300' : elapsed > 0 ? 'text-slate-300' : 'text-slate-600'}`}>
              {formatElapsed(elapsed)}
            </span>
            {!timerRunning ? (
              <Button size="sm" variant="ghost" onClick={() => setTimerRunning(true)} className="h-6 w-6 p-0 text-green-400 hover:text-green-300">
                <Play className="w-3 h-3" />
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setTimerRunning(false)} className="h-6 w-6 p-0 text-yellow-400 hover:text-yellow-300">
                <Pause className="w-3 h-3" />
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => { setTimerRunning(false); setElapsed(0); }} className="h-6 w-6 p-0 text-red-400 hover:text-red-300">
              <Square className="w-3 h-3" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          {bucketName && (
            <span className="text-[10px] text-cyan-400 font-medium truncate max-w-[100px]" title={bucketName}>{bucketName}</span>
          )}
          {question.exam_type && (
            <Badge className={`text-[10px] px-1 py-0 h-4 ${examTypeBadgeColor(question.exam_type)}`}>
              {examTypeLabel(question.exam_type)}
            </Badge>
          )}
        </div>
        <div className="text-[10px] text-slate-500 flex-shrink-0">
          <span className="text-slate-300 font-semibold">{questionIndex + 1}</span>
          <span>/{totalQuestions}</span>
          {childCount > 0 && <span className="ml-1 text-cyan-600">+{childCount}</span>}
        </div>
      </div>

      {/* Scrollable question + answer content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Question number + text + status inline */}
        <button
          className="flex items-start gap-2 w-full text-left group"
          onClick={onSelectCurrentQuestion}
          title="Click to show proofs for this question"
        >
          <span className="text-[11px] text-slate-500 font-semibold mt-1.5 flex-shrink-0">Q{questionIndex + 1}</span>
          <h1 className="text-xl font-bold text-white leading-snug flex-1 group-hover:text-cyan-100 transition-colors">{question.question_text}</h1>
          {question.status === 'Asked' && <span className="text-green-400 text-base flex-shrink-0 mt-1">✓</span>}
          {question.status === 'NeedsFollowUp' && <span className="text-red-400 text-base flex-shrink-0 mt-1">✗</span>}
          {question.status === 'Skipped' && <span className="text-slate-500 text-base flex-shrink-0 mt-1">—</span>}
        </button>

        {/* Expected answer — arrow + colored text, no label */}
        {question.expected_answer && (
          <div className="flex gap-2 items-start pl-2">
            <span className="text-amber-400 text-base flex-shrink-0 mt-0.5">↓</span>
            <p className="text-sm text-amber-200/80 leading-relaxed italic">{question.expected_answer}</p>
          </div>
        )}

        {/* Goal */}
        {question.goal && (
          <div className="bg-[#0f1629] border-l-2 border-cyan-700 pl-3 py-1.5 rounded-r">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Goal</p>
            <p className="text-xs text-slate-300">{question.goal}</p>
          </div>
        )}
      </div>

      {/* FIXED bottom action bar — never moves */}
      <div className="flex-shrink-0 border-t border-[#1e2a45] bg-[#0a0f1e] p-2 space-y-2">
        {/* Action buttons */}
        <div className="flex gap-1.5">
          <button
            onClick={() => onStatusChange('Asked')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-colors touch-manipulation ${
              question.status === 'Asked' ? 'bg-green-600 ring-1 ring-green-400 text-white' : 'bg-green-900/60 hover:bg-green-800 text-green-300'
            }`}
          >
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Expected
          </button>
          <button
            onClick={() => onStatusChange('NeedsFollowUp')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-colors touch-manipulation ${
              question.status === 'NeedsFollowUp' ? 'bg-red-600 ring-1 ring-red-400 text-white' : 'bg-red-900/60 hover:bg-red-800 text-red-300'
            }`}
          >
            <XCircle className="w-4 h-4 flex-shrink-0" />
            Unexpected
          </button>
          <button
            onClick={() => onStatusChange('Skipped')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-colors touch-manipulation ${
              question.status === 'Skipped' ? 'border border-slate-400 bg-slate-700 text-slate-200' : 'border border-[#1e2a45] text-slate-400 hover:bg-[#1a2340] hover:text-slate-300'
            }`}
          >
            <SkipForward className="w-4 h-4 flex-shrink-0" />
            Skip
          </button>
          {isMarked && (
            <button
              onClick={() => onStatusChange('NotAsked')}
              className="flex items-center justify-center px-2.5 py-2.5 rounded-lg border border-dashed border-[#2e3a55] text-slate-600 hover:text-slate-400 transition-colors touch-manipulation"
              title="Clear"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Next question preview */}
        {nextQuestion && (
          <div
            className="bg-[#0f1629] border border-[#1e2a45] rounded-lg px-3 py-2 cursor-pointer hover:border-cyan-500/40 transition-colors"
            onClick={() => onSelectQuestion(nextQuestion.id)}
          >
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Next → Q{questionIndex + 2}</p>
            <p className="text-xs text-slate-400 line-clamp-1">{nextQuestion.question_text}</p>
          </div>
        )}
      </div>
    </div>
  );
}