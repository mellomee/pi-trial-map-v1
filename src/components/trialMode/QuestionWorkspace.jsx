import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pencil, X, Check, Eye, Send } from 'lucide-react';

const statusBadges = {
  NotAsked: 'bg-slate-700',
  Asked: 'bg-green-700',
  NeedsFollowUp: 'bg-amber-700',
  Skipped: 'bg-gray-700',
};

export default function QuestionWorkspace({
  question,
  evidenceGroups,
  trialPoints,
  proofItems,
  onUpdateQuestion,
  onPreviewProof,
  onPublishProof,
  onStatusChange,
}) {
  const [editingText, setEditingText] = useState(false);
  const [editedText, setEditedText] = useState(question?.question_text || '');

  if (!question) {
    return (
      <div className="flex-1 bg-[#0a0f1e] flex items-center justify-center text-slate-400">
        <p>Select a question to begin</p>
      </div>
    );
  }

  const handleSaveText = async () => {
    if (editedText.trim() !== question.question_text) {
      await onUpdateQuestion({ ...question, question_text: editedText });
    }
    setEditingText(false);
  };

  return (
    <div className="flex-1 bg-[#0a0f1e] overflow-y-auto">
      <div className="p-6 space-y-6 max-w-4xl">
        
        {/* Question header */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              {editingText ? (
                <Textarea
                  value={editedText}
                  onChange={e => setEditedText(e.target.value)}
                  className="text-lg font-semibold bg-[#131a2e] border-cyan-500/50"
                  rows={3}
                />
              ) : (
                <p className="text-lg font-semibold text-white leading-relaxed">{question.question_text}</p>
              )}
            </div>
            {editingText ? (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setEditingText(false); setEditedText(question.question_text); }}>
                  <X className="w-4 h-4" />
                </Button>
                <Button size="sm" onClick={handleSaveText} className="bg-cyan-600 hover:bg-cyan-700">
                  <Check className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setEditingText(true)}>
                <Pencil className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Status + priority tags */}
          <div className="flex flex-wrap gap-2">
            <Badge className={statusBadges[question.status]}>{question.status}</Badge>
            {question.priority && <Badge variant="outline">{question.priority} priority</Badge>}
            {question.exam_type && <Badge variant="outline">{question.exam_type}</Badge>}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex gap-2 flex-wrap">
          {['Asked', 'NeedsFollowUp', 'Skipped'].map(status => (
            <Button
              key={status}
              size="sm"
              variant={question.status === status ? 'default' : 'outline'}
              onClick={() => onStatusChange(status)}
              className={question.status === status ? 'bg-cyan-600' : ''}
            >
              {status}
            </Button>
          ))}
        </div>

        {/* Goal & Expected Answer */}
        {(question.goal || question.expected_answer) && (
          <Card className="bg-[#131a2e] border-[#1e2a45] p-4 space-y-2">
            {question.goal && (
              <div>
                <p className="text-xs font-semibold text-slate-400">Goal</p>
                <p className="text-sm text-slate-200">{question.goal}</p>
              </div>
            )}
            {question.expected_answer && (
              <div>
                <p className="text-xs font-semibold text-slate-400">Expected Answer</p>
                <p className="text-sm text-slate-200">{question.expected_answer}</p>
              </div>
            )}
          </Card>
        )}

        {/* Linked Evidence Groups */}
        {evidenceGroups.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-300">Linked Evidence Groups</h3>
            <div className="space-y-2">
              {evidenceGroups.map(eg => (
                <Card key={eg.id} className="bg-[#131a2e] border-[#1e2a45] p-3">
                  <p className="font-medium text-sm text-cyan-300">{eg.title}</p>
                  {eg.description && <p className="text-xs text-slate-400 mt-1">{eg.description}</p>}
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Linked Trial Points */}
        {trialPoints.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-300">Linked Trial Points</h3>
            <div className="space-y-2">
              {trialPoints.map(tp => (
                <Card key={tp.id} className="bg-[#131a2e] border-[#1e2a45] p-3">
                  <p className="font-medium text-sm text-slate-200">{tp.point_text}</p>
                  <div className="flex gap-2 mt-1">
                    {tp.theme && <Badge variant="outline" className="text-xs">{tp.theme}</Badge>}
                    {tp.status && <Badge variant="outline" className="text-xs">{tp.status}</Badge>}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Proof Items */}
        {proofItems.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-300">Proof ({proofItems.length})</h3>
            <div className="space-y-2">
              {proofItems.map(pi => (
                <Card key={pi.id} className="bg-[#131a2e] border-[#1e2a45] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-slate-200 line-clamp-2">{pi.label}</p>
                      <Badge variant="outline" className="text-xs mt-1">{pi.type}</Badge>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => onPreviewProof(pi)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onPublishProof(pi)}>
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Live notes */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-400">Live Notes</label>
          <Textarea
            value={question.live_notes || ''}
            onChange={e => onUpdateQuestion({ ...question, live_notes: e.target.value })}
            placeholder="Add notes during exam..."
            className="bg-[#131a2e] border-[#1e2a45] text-sm"
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}