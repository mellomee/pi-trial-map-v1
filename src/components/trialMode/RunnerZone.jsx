import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Play, Pause, Square, CheckCircle, XCircle, SkipForward, RotateCcw } from 'lucide-react';

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

  return (
    <div className="flex flex-col h-full bg-[#0a0f1e]">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1e2a45] bg-[#0f1629] flex-shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {/* Clock */}
          <div className="flex items-center gap-1.5 text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-xs font-mono">{currentTime} PT</span>
          </div>
          {/* Timer with play/pause/stop */}
          <div className="flex items-center gap-1">
            <span className={`text-sm font-mono font-bold min-w-[48px] ${timerRunning ? 'text-cyan-300' : elapsed > 0 ? 'text-slate-300' : 'text-slate-600'}`}>
              {formatElapsed(elapsed)}
            </span>
            {!timerRunning ? (
              <Button size="sm" variant="ghost" onClick={() => setTimerRunning(true)}
                className="h-7 w-7 p-0 text-green-400 hover:text-green-300">
                <Play className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setTimerRunning(false)}
                className="h-7 w-7 p-0 text-yellow-400 hover:text-yellow-300">
                <Pause className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => { setTimerRunning(false); setElapsed(0); }}
              className="h-7 w-7 p-0 text-red-400 hover:text-red-300">
              <Square className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Bucket + question type */}
        <div className="flex items-center gap-2">
          {bucketName && (
            <span className="text-xs text-cyan-400 font-medium truncate max-w-[140px]">
              {bucketName}
            </span>
          )}
          {question.exam_type && (
            <Badge className={`text-[10px] px-1.5 py-0 ${examTypeBadgeColor(question.exam_type)}`}>
              {examTypeLabel(question.exam_type)}
            </Badge>
          )}
        </div>

        {/* Q counter */}
        <div className="text-xs text-slate-500">
          <span className="text-slate-300 font-semibold">{questionIndex + 1}</span>
          <span> / {totalQuestions}</span>
        </div>
      </div>

      {/* Main runner content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Current question heading */}
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Q{questionIndex + 1} — Current Question</span>
            {question.status === 'Asked' && <span className="text-green-400 text-sm font-bold">✓ Expected</span>}
            {question.status === 'NeedsFollowUp' && <span className="text-red-400 text-sm font-bold">✗ Unexpected</span>}
            {question.status === 'Skipped' && <span className="text-slate-500 text-sm">— Skipped</span>}
          </div>
          <h1 className="text-2xl font-bold text-white leading-snug">{question.question_text}</h1>
        </div>

        {/* Expected answer */}
        {question.expected_answer && (
          <div className="bg-[#131a2e] border border-[#1e2a45] rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Expected Answer</p>
            <p className="text-sm text-slate-200 leading-relaxed">{question.expected_answer}</p>
          </div>
        )}

        {/* Goal */}
        {question.goal && (
          <div className="bg-[#0f1629] border border-[#1e2a45] rounded-xl p-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Goal</p>
            <p className="text-sm text-slate-300">{question.goal}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 flex-wrap pt-1">
          <Button
            onClick={() => onStatusChange('Asked')}
            className={`flex-1 min-w-[90px] font-semibold h-12 text-base rounded-xl gap-2 ${question.status === 'Asked' ? 'bg-green-600 ring-2 ring-green-400' : 'bg-green-800 hover:bg-green-700 text-white'}`}
          >
            <CheckCircle className="w-5 h-5" />
            Expected
          </Button>
          <Button
            onClick={() => onStatusChange('NeedsFollowUp')}
            className={`flex-1 min-w-[90px] font-semibold h-12 text-base rounded-xl gap-2 ${question.status === 'NeedsFollowUp' ? 'bg-red-600 ring-2 ring-red-400' : 'bg-red-800 hover:bg-red-700 text-white'}`}
          >
            <XCircle className="w-5 h-5" />
            Unexpected
          </Button>
          <Button
            onClick={() => onStatusChange('Skipped')}
            variant="outline"
            className={`flex-1 min-w-[90px] h-12 text-base rounded-xl gap-2 ${question.status === 'Skipped' ? 'border-slate-400 text-slate-200 bg-slate-700' : 'border-[#1e2a45] text-slate-300 hover:bg-[#1a2340]'}`}
          >
            <SkipForward className="w-5 h-5" />
            Skip
          </Button>
        </div>

        {/* Revert/Clear button — shown when question has been marked */}
        {isMarked && (
          <Button
            onClick={() => onStatusChange('NotAsked')}
            variant="ghost"
            size="sm"
            className="w-full text-slate-500 hover:text-slate-300 border border-dashed border-[#1e2a45] gap-2 rounded-xl"
          >
            <RotateCcw className="w-4 h-4" />
            Clear / Revert to Not Asked
          </Button>
        )}

        {/* Next question preview */}
        {nextQuestion && (
          <div
            className="bg-[#0f1629] border border-[#1e2a45] rounded-xl p-3 cursor-pointer hover:border-cyan-500/40 transition-colors"
            onClick={() => onSelectQuestion(nextQuestion.id)}
          >
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Next → Q{questionIndex + 2}
            </p>
            <p className="text-sm text-slate-400 line-clamp-2">{nextQuestion.question_text}</p>
          </div>
        )}
      </div>
    </div>
  );
}