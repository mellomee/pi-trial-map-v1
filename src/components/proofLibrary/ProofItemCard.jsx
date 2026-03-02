import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { getProofTypeIcon } from './proofItemResolver';

export default function ProofItemCard({ proofItem, onRemove, witnesses = [], trialPoints = [] }) {
  const [resolvedData, setResolvedData] = useState(null);

  useEffect(() => {
    // Load witness and trial point names
    const load = async () => {
      const data = {};
      if (witnesses && witnesses.length > 0) {
        data.witnesses = witnesses;
      }
      if (trialPoints && trialPoints.length > 0) {
        data.trialPoints = trialPoints;
      }
      setResolvedData(data);
    };
    load();
  }, [witnesses, trialPoints]);

  return (
    <Card className="p-3 bg-gray-800 border-gray-700 hover:border-gray-600">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{getProofTypeIcon(proofItem.type)}</span>
            <h4 className="text-sm font-semibold text-gray-100 truncate">{proofItem.label}</h4>
            <Badge variant="outline" className="text-xs flex-shrink-0">
              {proofItem.type}
            </Badge>
          </div>

          {proofItem.notes && <p className="text-xs text-gray-400 mb-2">{proofItem.notes}</p>}

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
  );
}