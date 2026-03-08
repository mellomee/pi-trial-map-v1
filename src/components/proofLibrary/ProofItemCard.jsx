import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Pencil, Check, X, Image } from 'lucide-react';
import { getProofTypeIcon } from './proofItemResolver';
import { base44 } from '@/api/base44Client';
import ChangeCalloutModal from './ChangeCalloutModal';

export default function ProofItemCard({ proofItem, onRemove, onUpdated, witnesses = [], trialPoints = [] }) {
  const [editing, setEditing] = useState(false);
  const [labelVal, setLabelVal] = useState(proofItem.label);
  const [saving, setSaving] = useState(false);
  const [showCalloutModal, setShowCalloutModal] = useState(false);

  const saveLabel = async () => {
    if (!labelVal.trim() || labelVal === proofItem.label) { setEditing(false); return; }
    setSaving(true);
    const updated = await base44.entities.ProofItems.update(proofItem.id, { label: labelVal.trim() });
    setSaving(false);
    setEditing(false);
    onUpdated?.(updated);
  };

  return (
    <>
      <Card className="p-3 bg-gray-800 border-gray-700 hover:border-gray-600">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{getProofTypeIcon(proofItem.type)}</span>
              {editing ? (
                <div className="flex items-center gap-1 flex-1">
                  <Input
                    value={labelVal}
                    onChange={e => setLabelVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveLabel(); if (e.key === 'Escape') { setEditing(false); setLabelVal(proofItem.label); } }}
                    className="h-7 text-xs bg-gray-700 border-gray-600 text-gray-100 flex-1"
                    autoFocus
                  />
                  <button onClick={saveLabel} disabled={saving} className="text-green-400 hover:text-green-300 p-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { setEditing(false); setLabelVal(proofItem.label); }} className="text-gray-400 hover:text-gray-300 p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <h4 className="text-sm font-semibold text-gray-100 truncate flex-1">{proofItem.label}</h4>
                  <button onClick={() => setEditing(true)} className="text-gray-500 hover:text-gray-300 flex-shrink-0">
                    <Pencil className="w-3 h-3" />
                  </button>
                </>
              )}
              <Badge variant="outline" className="text-xs flex-shrink-0">{proofItem.type}</Badge>
            </div>

            {proofItem.notes && <p className="text-xs text-gray-400 mb-2">{proofItem.notes}</p>}

            {/* Callout thumbnail + change button for extract proofs */}
            {proofItem.type === 'extract' && (
              <div className="flex items-center gap-2 mb-2">
                {proofItem.callout_id ? (
                  <div className="flex items-center gap-2">
                    <Image className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                    <span className="text-[11px] text-cyan-400">Callout attached</span>
                  </div>
                ) : (
                  <span className="text-[11px] text-gray-500 italic">No callout</span>
                )}
                <button
                  onClick={() => setShowCalloutModal(true)}
                  className="text-[11px] text-gray-400 hover:text-cyan-400 underline"
                >
                  {proofItem.callout_id ? 'Change callout' : 'Attach callout'}
                </button>
              </div>
            )}

            {witnesses && witnesses.length > 0 && (
              <div className="mb-2">
                <p className="text-xs text-gray-500 mb-1">Witnesses:</p>
                <div className="flex flex-wrap gap-1">
                  {witnesses.map((w) => (
                    <Badge key={w.id} variant="secondary" className="text-xs">
                      {w.display_name || w.last_name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {trialPoints && trialPoints.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Trial Points:</p>
                <div className="flex flex-wrap gap-1">
                  {trialPoints.map((tp) => (
                    <Badge key={tp.id} variant="outline" className="text-xs">
                      {tp.point_text?.substring(0, 30)}...
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => onRemove(proofItem.id)}
            className="h-8 w-8 p-0 text-gray-400 hover:text-red-400 flex-shrink-0"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </Card>

      {showCalloutModal && (
        <ChangeCalloutModal
          proofItem={proofItem}
          onClose={() => setShowCalloutModal(false)}
          onSaved={(updated) => { setShowCalloutModal(false); onUpdated?.(updated); }}
        />
      )}
    </>
  );
}