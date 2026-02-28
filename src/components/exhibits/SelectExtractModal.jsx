import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { BookOpen } from "lucide-react";

/**
 * SelectExtractModal — when a depo exhibit has >1 extract, user picks one before marking joint
 *
 * Props:
 *   open: bool
 *   onClose: fn()
 *   extracts: ExhibitExtract[]
 *   onSelected: fn(extract)
 */
export default function SelectExtractModal({ open, onClose, extracts, onSelected }) {
  const [selectedId, setSelectedId] = useState(null);

  React.useEffect(() => {
    if (open && extracts?.length) setSelectedId(extracts[0].id);
  }, [open, extracts]);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose?.()}>
      <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-amber-400 flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> Choose Extract to Mark
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-1">
            This raw exhibit has {extracts?.length} extracts. Select which one to mark as a joint exhibit.
          </p>
        </DialogHeader>

        <div className="space-y-2">
          {(extracts || []).map(ex => (
            <button key={ex.id}
              onClick={() => setSelectedId(ex.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                selectedId === ex.id
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                  : "border-[#1e2a45] bg-[#0a0f1e] text-slate-300 hover:border-emerald-500/30"
              }`}>
              <p className="text-sm font-medium">{ex.extract_title_official}</p>
              {ex.extract_title_internal && (
                <p className="text-xs text-slate-500 italic">"{ex.extract_title_internal}"</p>
              )}
              {(ex.extract_page_start || ex.extract_page_end) && (
                <p className="text-[10px] text-slate-600 mt-0.5">
                  Raw pp. {ex.extract_page_start}–{ex.extract_page_end}
                </p>
              )}
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-[#1e2a45]">Cancel</Button>
          <Button
            onClick={() => {
              const ex = extracts?.find(e => e.id === selectedId);
              if (ex) onSelected?.(ex);
            }}
            disabled={!selectedId}
            className="bg-emerald-600 hover:bg-emerald-700">
            Use this Extract
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}