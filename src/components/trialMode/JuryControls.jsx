import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, Play, X, Copy, Check } from 'lucide-react';

export default function JuryControls({
  caseId,
  trialSession,
  onPublish,
  publishedProof,
}) {
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionCode, setSessionCode] = useState('');
  const [copied, setCopied] = useState(false);

  // Generate or load session code
  useEffect(() => {
    if (trialSession) {
      setSessionCode(trialSession.pair_code || trialSession.id?.slice(0, 6).toUpperCase() || 'START');
    }
  }, [trialSession]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sessionCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-80 bg-[#0f1629] border-l border-[#1e2a45] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#1e2a45]">
        <h3 className="font-semibold text-slate-200 flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          Jury Display
        </h3>
      </div>

      {/* Session status */}
      <div className="p-4 border-b border-[#1e2a45] space-y-3">
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-2">Session Status</p>
          {trialSession ? (
            <div className="space-y-2">
              <Badge className="bg-green-900 text-green-200">Connected</Badge>
              <div className="bg-[#131a2e] rounded p-2 space-y-1">
                <p className="text-xs text-slate-400">Session Code</p>
                <div className="flex items-center gap-1">
                  <code className="text-sm font-mono text-cyan-300 flex-1">{sessionCode}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopyCode}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => setSessionOpen(true)}
              className="w-full bg-cyan-600 hover:bg-cyan-700"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Live Session
            </Button>
          )}
        </div>
      </div>

      {/* Currently published */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-2">Currently Published</p>
            {publishedProof ? (
              <Card className="bg-[#131a2e] border-[#1e2a45] p-3">
                <p className="text-sm text-slate-200 font-medium line-clamp-2">{publishedProof.label}</p>
                <Badge variant="outline" className="text-xs mt-2">{publishedProof.type}</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onPublish(null)}
                  className="w-full mt-2 text-red-400 hover:text-red-300"
                >
                  <X className="w-3 h-3 mr-1" />
                  Clear Jury
                </Button>
              </Card>
            ) : (
              <div className="bg-[#131a2e] border border-[#1e2a45] rounded p-3 text-center">
                <p className="text-xs text-slate-500">Nothing published</p>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Start Session Dialog */}
      <Dialog open={sessionOpen} onOpenChange={setSessionOpen}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45]">
          <DialogHeader>
            <DialogTitle>Start Live Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              This will create a live session code that jury members can use to join and see what you publish.
            </p>
            <Button
              onClick={() => {
                // TODO: Call API to create TrialSession
                setSessionOpen(false);
              }}
              className="w-full bg-cyan-600 hover:bg-cyan-700"
            >
              Create Session
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}