import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Edit2 } from 'lucide-react';

export default function EvidenceGroupCard({ group, isSelected, onSelect, onEdit, onDelete }) {
  return (
    <Card
      onClick={() => onSelect(group.id)}
      className={`p-3 cursor-pointer transition-all ${
        isSelected
          ? 'border-cyan-400 bg-cyan-900/40 shadow-md ring-1 ring-cyan-400/50'
          : 'border-gray-600 bg-[#131a2e] hover:border-gray-400 hover:bg-[#1a2340]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-100 truncate">{group.title}</h3>
          {group.description && (
            <p className="text-xs text-gray-400 line-clamp-2">{group.description}</p>
          )}
          {group.tags && group.tags.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {group.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                  {tag}
                </span>
              ))}
              {group.tags.length > 2 && <span className="text-xs text-gray-500">+{group.tags.length - 2}</span>}
            </div>
          )}
          <div className="mt-1 text-xs text-gray-500">Priority: {group.priority}</div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(group);
            }}
            className="h-8 w-8 p-0 text-gray-400 hover:text-gray-200"
          >
            <Edit2 className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(group.id);
            }}
            className="h-8 w-8 p-0 text-gray-400 hover:text-red-400"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
}