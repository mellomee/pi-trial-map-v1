import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * A lightweight in-line admit modal:
 * Given a JointExhibit id, lets the user enter an admitted number + date
 * and marks the JointExhibit as Admitted.
 */
export default function QuickAdmitModal({ jxId, proof, onClose, onAdmitted }) {
  const [admittedNo, setAdmittedNo] = useState('');
  const [admittedDate, setAdmittedDate] = useState(new Date().toISOString().split('T')[0]);
  const [admittedBy, setAdmittedBy] = useState('Plaintiff');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!admittedNo.trim()) { setError('Exhibit number is required'); return; }
    if (!jxId) { setError('No Joint Exhibit found for this extract'); return; }
    setSaving(true);
    setError('');
    const updated = await base44.entities.JointExhibits.update(jxId, {
      status: 'Admitted',
      admitted_no: admittedNo.trim(),
      admitted_date: admittedDate,
      admitted_by: admittedBy,
    });
    setSaving(false);
    onAdmitted && onAdmitted(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#0f1629] border border-[#1e2a45] rounded-xl shadow-2xl p-6 w-80 max-w-[90vw]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <span className="text-sm font-semibold text-white">Mark as Admitted</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {proof?.label && (
          <p className="text-xs text-slate-400 mb-4 bg-[#0a0f1e] rounded-lg px-3 py-2 border border-[#1e2a45] line-clamp-2">
            {proof.label}
          </p>
        )}

        {!jxId && (
          <div className="bg-amber-900/30 border border-amber-700/40 text-amber-300 text-xs rounded-lg px-3 py-2 mb-4">
            This extract is not linked to a Joint Exhibit. Mark it as joint first.
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block mb-1">Admitted Number</label>
            <input
              type="text"
              value={admittedNo}
              onChange={e => setAdmittedNo(e.target.value)}
              placeholder="e.g. 200"
              className="w-full bg-[#0a0f1e] border border-[#1e2a45] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block mb-1">Date Admitted</label>
            <input
              type="date"
              value={admittedDate}
              onChange={e => setAdmittedDate(e.target.value)}
              className="w-full bg-[#0a0f1e] border border-[#1e2a45] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block mb-1">Admitted By</label>
            <select
              value={admittedBy}
              onChange={e => setAdmittedBy(e.target.value)}
              className="w-full bg-[#0a0f1e] border border-[#1e2a45] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="Plaintiff">Plaintiff</option>
              <option value="Defense">Defense</option>
              <option value="Unknown">Unknown</option>
            </select>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-400 mt-3">{error}</p>
        )}

        <div className="flex gap-2 mt-4">
          <Button
            onClick={handleSave}
            disabled={saving || !jxId}
            className="flex-1 bg-green-700 hover:bg-green-600 text-white text-xs gap-1 disabled:opacity-40"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Mark Admitted'}
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            className="px-3 text-slate-400 hover:text-white text-xs"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}