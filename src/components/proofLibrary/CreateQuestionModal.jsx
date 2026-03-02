import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function CreateQuestionModal({
  isOpen,
  onClose,
  caseId,
  evidenceGroupId,
  witnesses,
  onQuestionCreated,
}) {
  const [formData, setFormData] = useState({ witness_id: '', exam_type: 'Direct', question_text: '' });
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateQuestion = async () => {
    if (!formData.witness_id || !formData.question_text.trim()) return;
    setIsCreating(true);

    try {
      // Create question
      const newQuestion = await base44.entities.Questions.create({
        case_id: caseId,
        party_id: formData.witness_id,
        exam_type: formData.exam_type,
        question_text: formData.question_text,
        status: 'NotAsked',
        importance: 'Med',
      });

      // Link to evidence group
      await base44.entities.QuestionEvidenceGroups.create({
        question_id: newQuestion.id,
        evidence_group_id: evidenceGroupId,
        is_primary: false,
      });

      // Link to trial points in this group
      const tpLinks = await base44.entities.EvidenceGroupTrialPoints.filter({
        evidence_group_id: evidenceGroupId,
      });

      for (const link of tpLinks) {
        const existing = await base44.entities.QuestionLinks.filter({
          question_id: newQuestion.id,
          trial_point_id: link.trial_point_id,
        });
        if (existing.length === 0) {
          await base44.entities.QuestionLinks.create({
            question_id: newQuestion.id,
            trial_point_id: link.trial_point_id,
          });
        }
      }

      // Call parent callback with new question
      onQuestionCreated({
        id: newQuestion.id,
        question_text: formData.question_text,
        exam_type: formData.exam_type,
        party_id: formData.witness_id,
        status: 'NotAsked',
      });

      toast.success('Question created');
      handleClose();
    } catch (error) {
      console.error('Error creating question:', error);
      toast.error('Failed to create question');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    // Reset form state BEFORE closing modal
    setFormData({ witness_id: '', exam_type: 'Direct', question_text: '' });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-lg" style={{ zIndex: 9999 }}>
        <DialogHeader>
          <DialogTitle className="text-gray-100">Create Question</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-200">Question Text *</label>
            <Textarea
              placeholder="Type your question here..."
              value={formData.question_text}
              onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
              className="mt-1 bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-200">Witness *</label>
            <Select value={formData.witness_id} onValueChange={(v) => setFormData({ ...formData, witness_id: v })}>
              <SelectTrigger className="mt-1 bg-gray-800 border-gray-700 text-gray-100">
                <SelectValue placeholder="Select witness..." />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700 z-[10000]">
                {witnesses.length > 0 ? (
                  witnesses.map((wit) => (
                    <SelectItem key={wit.id} value={wit.id} className="text-gray-100">
                      {wit.display_name || wit.last_name}
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-xs text-gray-400">Assign witnesses to this evidence group first</div>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-200">Exam Type</label>
            <Select value={formData.exam_type} onValueChange={(v) => setFormData({ ...formData, exam_type: v })}>
              <SelectTrigger className="mt-1 bg-gray-800 border-gray-700 text-gray-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700 z-[10000]">
                <SelectItem value="Direct" className="text-gray-100">
                  Direct
                </SelectItem>
                <SelectItem value="Cross" className="text-gray-100">
                  Cross
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} className="text-gray-100">
            Cancel
          </Button>
          <Button
            onClick={handleCreateQuestion}
            disabled={!formData.witness_id || !formData.question_text.trim() || isCreating}
            className="bg-cyan-600 hover:bg-cyan-700 text-white relative z-[10001]"
          >
            {isCreating ? 'Creating...' : 'Create Question'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}