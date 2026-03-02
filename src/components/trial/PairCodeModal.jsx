import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, Monitor } from "lucide-react";
import { createPageUrl } from "@/utils";

export default function PairCodeModal({ open, onClose, session }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(session?.pair_code || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openJury = () => {
    const url = createPageUrl(`JuryView?code=${session?.pair_code}`);
    window.open(url, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-400">
            <Monitor className="w-5 h-5" /> Open Jury Screen
          </DialogTitle>
        </DialogHeader>
        <div className="text-center py-4 space-y-4">
          <p className="text-sm text-slate-400">Share this pair code with the jury display device:</p>
          <div className="bg-[#050809] border border-[#1e2a45] rounded-xl py-6">
            <p className="text-5xl font-black text-cyan-300 tracking-[0.3em] font-mono">{session?.pair_code}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 border-slate-600 text-slate-300 hover:text-white" onClick={copy}>
              {copied ? <Check className="w-4 h-4 mr-2 text-green-400" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? "Copied!" : "Copy Code"}
            </Button>
            <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={openJury}>
              <Monitor className="w-4 h-4 mr-2" /> Open in New Tab
            </Button>
          </div>
          <p className="text-[10px] text-slate-500">Jury screen: open /JuryView and enter this code</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}