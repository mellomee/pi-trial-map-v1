import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Pencil, Trash2, Check, X } from 'lucide-react';

export default function DepoClipsViewer({ isOpen, onClose, caseId, defaultDepositionId, depositions, parties }) {
  const [selectedDepoId, setSelectedDepoId] = useState(defaultDepositionId || '');
  const [clips, setClips] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    if (defaultDepositionId) setSelectedDepoId(defaultDepositionId);
  }, [defaultDepositionId]);

  useEffect(() => {
    if (!caseId) { setClips([]); return; }
    loadClips();
  }, [selectedDepoId, caseId]);

  const loadClips = () => {
    const filter = selectedDepoId === '__all__' || !selectedDepoId
      ? { case_id: caseId }
      : { deposition_id: selectedDepoId };
    base44.entities.DepoClips.filter(filter).then(c =>
      setClips(c.sort((a, b) => (a.start_cite || '').localeCompare(b.start_cite || '')))
    );
  };

  const getDepoLabel = (d) => {
    const party = parties.find(p => p.id === d.party_id);
    const name = party ? `${party.first_name || ''} ${party.last_name}`.trim() : d.sheet_name;
    return d.volume_label ? `${name} - ${d.volume_label}` : name;
  };

  const CLIP_TAG_COLORS = {
    Scene: 'bg-purple-900/70 text-purple-200',
    Scope: 'bg-blue-900/70 text-blue-200',
    Credibility: 'bg-orange-900/70 text-orange-200',
    Opinion: 'bg-pink-900/70 text-pink-200',
  };

  const startEdit = (clip) => {
    setEditingId(clip.id);
    setEditForm({
      topic_tag: clip.topic_tag || '',
      clip_tag: clip.clip_tag || '',
      direction: clip.direction || 'HelpsUs',
      impeachment_ready: clip.impeachment_ready || false,
      notes: clip.notes || '',
    });
  };

  const saveEdit = async (clipId) => {
    await base44.entities.DepoClips.update(clipId, editForm);
    setEditingId(null);
    loadClips();
  };

  const deleteClip = async (clipId) => {
    if (!confirm('Delete this clip?')) return;
    await base44.entities.DepoClips.delete(clipId);
    loadClips();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0f1629] border-[#1e2a45] text-slate-200 max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-cyan-300">Depo Clips</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 mb-2">
          <Select value={selectedDepoId || '__all__'} onValueChange={v => setSelectedDepoId(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-64 bg-[#131a2e] border-[#1e2a45]">
              <SelectValue placeholder="Select deposition..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Clips</SelectItem>
              {depositions.map(d => (
                <SelectItem key={d.id} value={d.id}>{getDepoLabel(d)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-slate-500">{clips.length} clips</span>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="space-y-2 pr-2">
            {clips.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">No clips for this deposition.</div>
            ) : clips.map(clip => (
              <div key={clip.id} className="bg-[#131a2e] border border-[#1e2a45] rounded-lg p-3">
                {editingId === clip.id ? (
                  <div className="space-y-2">
                    <div>
                      <Label className="text-slate-400 text-xs">Title</Label>
                      <Input
                        value={editForm.topic_tag}
                        onChange={e => setEditForm({ ...editForm, topic_tag: e.target.value })}
                        className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 mt-1"
                      />
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      <div>
                        <Label className="text-slate-400 text-xs">Direction</Label>
                        <Select value={editForm.direction} onValueChange={v => setEditForm({ ...editForm, direction: v })}>
                          <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] w-36 mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="HelpsUs">Helps Us</SelectItem>
                            <SelectItem value="HurtsUs">Hurts Us</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-slate-400 text-xs">Clip Tag</Label>
                        <Select value={editForm.clip_tag || '__none__'} onValueChange={v => setEditForm({ ...editForm, clip_tag: v === '__none__' ? '' : v })}>
                          <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] w-36 mt-1">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            <SelectItem value="Scene">Scene</SelectItem>
                            <SelectItem value="Scope">Scope</SelectItem>
                            <SelectItem value="Credibility">Credibility</SelectItem>
                            <SelectItem value="Opinion">Opinion</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end gap-2 pb-1">
                        <Switch checked={editForm.impeachment_ready} onCheckedChange={v => setEditForm({ ...editForm, impeachment_ready: v })} />
                        <Label className="text-xs text-slate-400">Impeachment Ready</Label>
                      </div>
                    </div>
                    <div>
                      <Label className="text-slate-400 text-xs">Notes</Label>
                      <Textarea
                        value={editForm.notes}
                        onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                        className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 mt-1"
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveEdit(clip.id)} className="bg-cyan-600 hover:bg-cyan-700 gap-1">
                        <Check className="w-3 h-3" /> Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="text-slate-400">
                        <X className="w-3 h-3" /> Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {clip.topic_tag || <span className="text-slate-500 italic">Untitled</span>}
                        </p>
                        <p className="text-xs font-mono text-cyan-400 mt-0.5">{clip.start_cite} – {clip.end_cite}</p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
                        <Badge className={clip.direction === 'HelpsUs' ? 'bg-green-900 text-green-200 text-[10px]' : 'bg-red-900 text-red-200 text-[10px]'}>
                          {clip.direction === 'HelpsUs' ? 'Helps' : 'Hurts'}
                        </Badge>
                        {clip.clip_tag && (
                          <Badge className={`text-[10px] ${CLIP_TAG_COLORS[clip.clip_tag] || 'bg-slate-700 text-slate-300'}`}>{clip.clip_tag}</Badge>
                        )}
                        {clip.impeachment_ready && (
                          <Badge className="bg-amber-900 text-amber-200 text-[10px]">Impeachment</Badge>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => startEdit(clip)} className="h-7 w-7 p-0 text-slate-400 hover:text-white">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteClip(clip.id)} className="h-7 w-7 p-0 text-red-400 hover:text-red-300">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="bg-[#0a0f1e] rounded p-2 max-h-24 overflow-y-auto">
                      <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono">{clip.clip_text}</pre>
                    </div>
                    {clip.notes && <p className="text-xs text-slate-500 mt-1">Notes: {clip.notes}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}