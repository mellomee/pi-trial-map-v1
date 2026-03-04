import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, Play, Square, CheckCircle, XCircle, SkipForward } from 'lucide-react';

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
  allQuestions,
  childQuestions,
  bucketName,
  onStatusChange,
  onSelectQuestion,
}) {
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [currentTime, setCurrentTime] = useState('');
  const intervalRef = useRef(null);
  const timerRef = useRef(null);

  // Update current time every second (PT / America/Los_Angeles)
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const ptTime = now.toLocaleTimeString('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      setCurrentTime(ptTime);
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

  const handleExpected = () => onStatusChange('Asked');
  const handleUnexpected = () => onStatusChange('NeedsFollowUp');
  const handleSkip = () => onStatusChange('Skipped');

  if (!question) {
    return (
      <div className="flex flex-col h-full bg-[#0a0f1e] items-center justify-center text-slate-500">
        <p className="text-sm">Select a question to start</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0f1e]">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1e2a45] bg-[#0f1629] flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Clock */}
          <div className="flex items-center gap-1.5 text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-xs font-mono">{currentTime} PT</span>
          </div>
          {/* Timer */}
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-mono font-bold ${timerRunning ? 'text-cyan-300' : 'text-slate-500'}`}>
              {formatElapsed(elapsed)}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setTimerRunning(true); }}
              disabled={timerRunning}
              className="h-7 w-7 p-0 text-green-400 hover:text-green-300"
            >
              <Play className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setTimerRunning(false); setElapsed(0); }}
              className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
            >
              <Square className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        {/* Bucket + question type */}
        <div className="flex items-center gap-2">
          {bucketName && (
            <span className="text-xs text-cyan-400 font-medium truncate max-w-[140px]">
              Bucket: {bucketName}
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
          <div className="flex items-center gap-2 mb-2">
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
            onClick={handleExpected}
            className="flex-1 min-w-[100px] bg-green-700 hover:bg-green-600 text-white font-semibold h-12 text-base rounded-xl gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            Expected
          </Button>
          <Button
            onClick={handleUnexpected}
            className="flex-1 min-w-[100px] bg-red-700 hover:bg-red-600 text-white font-semibold h-12 text-base rounded-xl gap-2"
          >
            <XCircle className="w-5 h-5" />
            Unexpected
          </Button>
          <Button
            onClick={handleSkip}
            variant="outline"
            className="flex-1 min-w-[100px] border-[#1e2a45] text-slate-300 hover:bg-[#1a2340] h-12 text-base rounded-xl gap-2"
          >
            <SkipForward className="w-5 h-5" />
            Skip
          </Button>
        </div>

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