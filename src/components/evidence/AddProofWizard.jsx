import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Search, CheckCircle } from "lucide-react";

const STEPS = {
  CHOICE: "choice",
  EXHIBIT_RAW: "exhibit_raw",
  EXTRACT: "extract",
  CALLOUT: "callout",
  WITNESSES: "witnesses",
  DEPO_SELECT: "depo_select",
  DEPO_CLIP: "depo_clip",
};

export default function AddProofWizard({
  open,
  onClose,
  evidenceGroup,
  onProofAdded,
  parties,
  depositions,
  extracts,
  callouts,
  depoClips,
  depoExhibits,
}) {
  const [step, setStep] = useState(STEPS.CHOICE);
  const [proofType, setProofType] = useState(null);
  
  // Exhibit flow state
  const [selectedRawExhibit, setSelectedRawExhibit] = useState(null);
  const [selectedExtract, setSelectedExtract] = useState(null);
  const [selectedCallout, setSelectedCallout] = useState(null);
  const [rawExhibitSearch, setRawExhibitSearch] = useState("");
  
  // Shared witness/notes state
  const [proofTitle, setProofTitle] = useState("");
  const [proofNotes, setProofNotes] = useState("");
  const [selectedWitnesses, setSelectedWitnesses] = useState([]);
  const [sourceParty, setSourceParty] = useState("");
  
  // Depo flow state
  const [selectedDeposition, setSelectedDeposition] = useState(null);
  const [selectedClip, setSelectedClip] = useState(null);
  
  const [saving, setSaving] = useState(false);

  const filteredRawExhibits = depoExhibits.filter(de =>
    !rawExhibitSearch || (
      (de.depo_exhibit_no?.toLowerCase().includes(rawExhibitSearch.toLowerCase())) ||
      (de.depo_exhibit_title?.toLowerCase().includes(rawExhibitSearch.toLowerCase()))
    )
  );

  const rawDepoName = (depoExhibitId) => {
    const de = depoExhibits.find(x => x.id === depoExhibitId);
    if (!de) return "";
    const dep = depositions.find(x => x.id === de.deposition_id);
    if (!dep) return de.deponent_name || "";
    const p = parties.find(x => x.id === dep.party_id);
    return p ? (p.display_name || `${p.first_name || ""} ${p.last_name || ""}`.trim()) : dep.sheet_name;
  };

  const partyName = (id) => {
    const p = parties.find(x => x.id === id);
    return p ? (p.display_name || `${p.first_name || ""} ${p.last_name || ""}`.trim()) : "—";
  };

  const depoName = (depoId) => {
    const d = depositions.find(x => x.id === depoId);
    if (!d) return "—";
    const p = parties.find(x => x.id === d.party_id);
    return p ? (p.display_name || `${p.first_name || ""} ${p.last_name || ""}`.trim()) : d.sheet_name;
  };

  const extractsForRaw = selectedRawExhibit
    ? extracts.filter(e => e.source_depo_exhibit_id === selectedRawExhibit.id)
    : [];

  const calloutsForExtract = selectedExtract
    ? callouts.filter(c => c.extract_id === selectedExtract.id)
    : [];

  const clipsForDepo = selectedDeposition
    ? depoClips.filter(c => c.deposition_id === selectedDeposition.id)
    : [];

  const saveExhibitProof = async () => {
    if (!selectedCallout) return;
    setSaving(true);
    try {
      const title = proofTitle || selectedCallout.name || "Callout";
      await base44.entities.ProofItems.create({
        evidence_group_id: evidenceGroup.id,
        proof_type: "EXTRACT_CALLOUT",
        title,
        notes: proofNotes,
        source_party_id: sourceParty || null,
        testify_party_ids: selectedWitnesses,
        raw_depo_exhibit_id: selectedRawExhibit.id,
        extract_id: selectedExtract.id,
        callout_id: selectedCallout.id,
      });
      onProofAdded();
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const saveDepoProof = async () => {
    if (!selectedClip) return;
    setSaving(true);
    try {
      const deponent = selectedDeposition ? depositions.find(d => d.id === selectedDeposition.id)?.party_id : null;
      const title = proofTitle || selectedClip.clip_title || selectedClip.topic_tag || "Depo Clip";
      await base44.entities.ProofItems.create({
        evidence_group_id: evidenceGroup.id,
        proof_type: "DEPO_CLIP",
        title,
        notes: proofNotes,
        source_party_id: deponent || null,
        testify_party_ids: selectedWitnesses.length ? selectedWitnesses : (deponent ? [deponent] : []),
        depo_clip_id: selectedClip.id,
      });
      onProofAdded();
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setStep(STEPS.CHOICE);
    setProofType(null);
    setSelectedRawExhibit(null);
    setSelectedExtract(null);
    setSelectedCallout(null);
    setSelectedDeposition(null);
    setSelectedClip(null);
    setProofTitle("");
    setProofNotes("");
    setSelectedWitnesses([]);
    setSourceParty("");
    setRawExhibitSearch("");
  };

  const goBack = () => {
    if (proofType === "EXHIBIT") {
      if (step === STEPS.EXTRACT) {
        setStep(STEPS.EXHIBIT_RAW);
      } else if (step === STEPS.CALLOUT) {
        setStep(STEPS.EXTRACT);
        setSelectedCallout(null);
      } else if (step === STEPS.WITNESSES) {
        setStep(STEPS.CALLOUT);
      }
    } else if (proofType === "DEPO") {
      if (step === STEPS.DEPO_CLIP) {
        setStep(STEPS.DEPO_SELECT);
      } else if (step === STEPS.WITNESSES) {
        setStep(STEPS.DEPO_CLIP);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Proof to Evidence Group</DialogTitle>
        </DialogHeader>

        {/* CHOICE STEP */}
        {step === STEPS.CHOICE && (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">Choose the type of proof to add:</p>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => {
                  setProofType("EXHIBIT");
                  setStep(STEPS.EXHIBIT_RAW);
                }}
                className="p-4 border border-cyan-600/40 bg-cyan-900/10 hover:bg-cyan-900/20 rounded-lg text-left transition-colors"
              >
                <p className="font-semibold text-cyan-400">📄 Exhibit Proof</p>
                <p className="text-xs text-slate-400 mt-1">Raw depo exhibit → Extract → Callout with highlights</p>
              </button>
              <button
                onClick={() => {
                  setProofType("DEPO");
                  setStep(STEPS.DEPO_SELECT);
                }}
                className="p-4 border border-violet-600/40 bg-violet-900/10 hover:bg-violet-900/20 rounded-lg text-left transition-colors"
              >
                <p className="font-semibold text-violet-400">🎬 Depo Clip Proof</p>
                <p className="text-xs text-slate-400 mt-1">Select or create a transcript clip</p>
              </button>
            </div>
          </div>
        )}

        {/* EXHIBIT FLOW: RAW EXHIBIT */}
        {step === STEPS.EXHIBIT_RAW && (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            <p className="text-sm font-medium text-white">Step 1: Select Raw Deposition Exhibit</p>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-600" />
              <Input
                placeholder="Search by number or title…"
                value={rawExhibitSearch}
                onChange={e => setRawExhibitSearch(e.target.value)}
                className="pl-8 bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-xs"
              />
            </div>
            {filteredRawExhibits.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No raw exhibits found.</p>
            ) : (
              <div className="space-y-1">
                {filteredRawExhibits.map(de => (
                  <button
                    key={de.id}
                    onClick={() => {
                      setSelectedRawExhibit(de);
                      setStep(STEPS.EXTRACT);
                    }}
                    className={`w-full text-left p-2.5 rounded border transition-colors ${
                      selectedRawExhibit?.id === de.id
                        ? "bg-cyan-900/20 border-cyan-600/40"
                        : "bg-[#0a0f1e] border-[#1e2a45] hover:border-cyan-600/40"
                    }`}
                  >
                    <p className="text-xs font-medium text-white">
                      #{de.depo_exhibit_no} {de.depo_exhibit_title}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{rawDepoName(de.id)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* EXHIBIT FLOW: SELECT EXTRACT */}
        {step === STEPS.EXTRACT && selectedRawExhibit && (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            <p className="text-sm font-medium text-white">Step 2: Choose Extract</p>
            <p className="text-xs text-slate-500">
              From: <span className="text-white">#{selectedRawExhibit.depo_exhibit_no} {selectedRawExhibit.depo_exhibit_title}</span>
            </p>
            {extractsForRaw.length === 0 ? (
              <div className="bg-[#0a0f1e] border border-dashed border-[#1e2a45] rounded p-4 text-center">
                <p className="text-xs text-slate-500">No extracts for this exhibit.</p>
                <Button size="sm" className="mt-2 text-xs bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30">
                  Create New Extract
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {extractsForRaw.map(ex => (
                  <button
                    key={ex.id}
                    onClick={() => {
                      setSelectedExtract(ex);
                      setStep(STEPS.CALLOUT);
                    }}
                    className={`w-full text-left p-2.5 rounded border transition-colors ${
                      selectedExtract?.id === ex.id
                        ? "bg-cyan-900/20 border-cyan-600/40"
                        : "bg-[#0a0f1e] border-[#1e2a45] hover:border-cyan-600/40"
                    }`}
                  >
                    <p className="text-xs font-medium text-white">{ex.extract_title_official}</p>
                    {ex.extract_title_internal && (
                      <p className="text-[10px] text-slate-500 italic">{ex.extract_title_internal}</p>
                    )}
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      pp. {ex.extract_page_start}–{ex.extract_page_end}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* EXHIBIT FLOW: SELECT CALLOUT */}
        {step === STEPS.CALLOUT && selectedExtract && (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            <p className="text-sm font-medium text-white">Step 3: Choose Callout</p>
            <p className="text-xs text-slate-500">
              From: <span className="text-white">{selectedExtract.extract_title_official}</span>
            </p>
            {calloutsForExtract.length === 0 ? (
              <div className="bg-[#0a0f1e] border border-dashed border-[#1e2a45] rounded p-4 text-center">
                <p className="text-xs text-slate-500">No callouts for this extract.</p>
                <Button size="sm" className="mt-2 text-xs bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30">
                  Create New Callout
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {calloutsForExtract.map(co => (
                  <button
                    key={co.id}
                    onClick={() => {
                      setSelectedCallout(co);
                      setProofTitle(co.name || "");
                      setStep(STEPS.WITNESSES);
                    }}
                    className={`w-full text-left p-2.5 rounded border transition-colors ${
                      selectedCallout?.id === co.id
                        ? "bg-yellow-900/20 border-yellow-600/40"
                        : "bg-[#0a0f1e] border-[#1e2a45] hover:border-yellow-600/40"
                    }`}
                  >
                    {co.snapshot_image_url && (
                      <img src={co.snapshot_image_url} alt="" className="w-full h-16 object-cover rounded mb-1.5" />
                    )}
                    <p className="text-xs font-medium text-white">{co.name || `Page ${co.page_number}`}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DEPO FLOW: SELECT DEPOSITION */}
        {step === STEPS.DEPO_SELECT && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-white">Step 1: Select Deposition</p>
            {depositions.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No depositions found.</p>
            ) : (
              <div className="space-y-1">
                {depositions.map(dep => (
                  <button
                    key={dep.id}
                    onClick={() => {
                      setSelectedDeposition(dep);
                      setStep(STEPS.DEPO_CLIP);
                    }}
                    className={`w-full text-left p-2.5 rounded border transition-colors ${
                      selectedDeposition?.id === dep.id
                        ? "bg-violet-900/20 border-violet-600/40"
                        : "bg-[#0a0f1e] border-[#1e2a45] hover:border-violet-600/40"
                    }`}
                  >
                    <p className="text-xs font-medium text-white">{depoName(dep.id)}</p>
                    {dep.volume_label && (
                      <p className="text-[10px] text-slate-500 mt-0.5">{dep.volume_label}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DEPO FLOW: SELECT CLIP */}
        {step === STEPS.DEPO_CLIP && selectedDeposition && (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            <p className="text-sm font-medium text-white">Step 2: Select or Create Clip</p>
            <p className="text-xs text-slate-500">
              From: <span className="text-white">{depoName(selectedDeposition.id)}</span>
            </p>
            {clipsForDepo.length === 0 ? (
              <div className="bg-[#0a0f1e] border border-dashed border-[#1e2a45] rounded p-4 text-center">
                <p className="text-xs text-slate-500">No clips for this deposition yet.</p>
                <Button size="sm" className="mt-2 text-xs bg-violet-600/20 text-violet-400 hover:bg-violet-600/30">
                  Create New Clip (go to Transcripts)
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {clipsForDepo.map(clip => (
                  <button
                    key={clip.id}
                    onClick={() => {
                      setSelectedClip(clip);
                      setProofTitle(clip.clip_title || clip.topic_tag || "");
                      setStep(STEPS.WITNESSES);
                    }}
                    className={`w-full text-left p-2.5 rounded border transition-colors ${
                      selectedClip?.id === clip.id
                        ? "bg-violet-900/20 border-violet-600/40"
                        : "bg-[#0a0f1e] border-[#1e2a45] hover:border-violet-600/40"
                    }`}
                  >
                    <p className="text-xs font-medium text-white">{clip.clip_title || clip.topic_tag}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{clip.start_cite}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* WITNESSES & NOTES */}
        {step === STEPS.WITNESSES && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-white">Final: Assign Witnesses & Notes</p>
            <div>
              <Label className="text-xs text-slate-400">Proof Title</Label>
              <Input
                value={proofTitle}
                onChange={e => setProofTitle(e.target.value)}
                className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 mt-1 text-sm"
                placeholder="e.g., Sightlines blocked – Smith position"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Notes (optional)</Label>
              <Textarea
                value={proofNotes}
                onChange={e => setProofNotes(e.target.value)}
                className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 mt-1 text-sm resize-none"
                rows={2}
              />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Testify Witnesses (multi-select)</Label>
              <Select
                value={selectedWitnesses[0] || ""}
                onValueChange={v => {
                  if (!v) return;
                  const current = new Set(selectedWitnesses);
                  if (current.has(v)) current.delete(v);
                  else current.add(v);
                  setSelectedWitnesses(Array.from(current));
                }}
              >
                <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 mt-1">
                  <SelectValue placeholder="Click to add witnesses…" />
                </SelectTrigger>
                <SelectContent>
                  {parties.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {partyName(p.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-2 flex flex-wrap gap-1">
                {selectedWitnesses.map(pId => (
                  <Badge key={pId} className="bg-green-600/20 text-green-400 text-xs flex items-center gap-1">
                    {partyName(pId)}
                    <button
                      onClick={() =>
                        setSelectedWitnesses(selectedWitnesses.filter(id => id !== pId))
                      }
                      className="ml-1"
                    >
                      ✕
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step !== STEPS.CHOICE && (
            <Button variant="outline" onClick={goBack} className="border-slate-600 text-slate-300">
              <ArrowLeft className="w-3 h-3 mr-1" /> Back
            </Button>
          )}
          {step === STEPS.CHOICE && (
            <Button variant="outline" onClick={onClose} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
          )}
          {step === STEPS.WITNESSES && (
            <>
              <Button variant="outline" onClick={onClose} className="border-slate-600 text-slate-300">
                Cancel
              </Button>
              <Button
                onClick={proofType === "EXHIBIT" ? saveExhibitProof : saveDepoProof}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1"
              >
                {saving ? "Saving…" : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" /> Save Proof
                  </>
                )}
              </Button>
            </>
          )}
          {step !== STEPS.CHOICE && step !== STEPS.WITNESSES && (
            <Button
              onClick={() => {}}
              disabled={
                (step === STEPS.EXHIBIT_RAW && !selectedRawExhibit) ||
                (step === STEPS.EXTRACT && !selectedExtract) ||
                (step === STEPS.CALLOUT && !selectedCallout) ||
                (step === STEPS.DEPO_SELECT && !selectedDeposition) ||
                (step === STEPS.DEPO_CLIP && !selectedClip)
              }
              className="bg-cyan-600 hover:bg-cyan-700 text-white flex items-center gap-1"
            >
              Next <ArrowRight className="w-3 h-3" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}