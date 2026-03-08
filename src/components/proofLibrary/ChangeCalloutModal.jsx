import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Image } from 'lucide-react';

export default function ChangeCalloutModal({ proofItem, onClose, onSaved }) {
  const [callouts, setCallouts] = useState([]);
  const [selectedCallout, setSelectedCallout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, [proofItem.source_id]);

  const load = async () => {
    setLoading(true);
    const cos = await base44.entities.Callouts.filter({ extract_id: proofItem.source_id });
    const sorted = cos.sort((a, b) => (a.page_number || 0) - (b.page_number || 0));
    setCallouts(sorted);
    // Pre-select the current callout
    const current = sorted.find(c => c.id === proofItem.callout_id) || sorted[0] || null;
    setSelectedCallout(current);
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const updated = await base44.entities.ProofItems.update(proofItem.id, {
      callout_id: selectedCallout?.id || null,
    });
    setSaving(false);
    onSaved(updated);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto bg-white border-gray-300">
        <DialogHeader>
          <DialogTitle className="text-gray-900">Change Callout</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-gray-500 -mt-2">{proofItem.label}</p>

        {loading ? (
          <div className="text-center py-8 text-gray-400 text-sm">Loading callouts...</div>
        ) : callouts.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm border border-dashed border-gray-300 rounded">
            No callouts on this extract yet
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {callouts.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCallout(c)}
                  className={`relative flex-shrink-0 rounded border-2 transition-all ${selectedCallout?.id === c.id ? 'border-cyan-500' : 'border-gray-200 hover:border-gray-400'}`}
                >
                  {proofItem.callout_id === c.id && (
                    <div className="absolute top-0.5 right-0.5 z-10">
                      <CheckCircle2 className="w-3 h-3 text-cyan-500 bg-white rounded-full" />
                    </div>
                  )}
                  {c.snapshot_image_url
                    ? <img src={c.snapshot_image_url} alt={c.name || `Callout ${i + 1}`} className="h-16 w-20 object-cover rounded" />
                    : <div className="h-16 w-20 flex items-center justify-center bg-gray-100 rounded"><Image className="w-4 h-4 text-gray-400" /></div>
                  }
                  <p className="text-[9px] text-gray-500 text-center px-1 pt-0.5 truncate max-w-[80px]">
                    {c.name || `Pg ${c.page_number}`}
                  </p>
                </button>
              ))}
            </div>

            {selectedCallout?.snapshot_image_url && (
              <div className="border border-gray-200 rounded overflow-hidden">
                <img src={selectedCallout.snapshot_image_url} alt={selectedCallout.name} className="w-full max-h-64 object-contain bg-black" />
                {selectedCallout.name && (
                  <p className="text-xs text-gray-600 px-2 py-1 bg-gray-50">{selectedCallout.name} — Pg {selectedCallout.page_number}</p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || loading} className="bg-cyan-600 hover:bg-cyan-700">
            {saving ? 'Saving...' : 'Save Callout'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}