import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Search, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

const COLOR_CSS = {
  yellow: "rgba(255,220,0,0.40)",
  red:    "rgba(239,68,68,0.40)",
  green:  "rgba(34,197,94,0.40)",
  blue:   "rgba(59,130,246,0.40)",
};

export default function AddQuestionProofModal({ isOpen, onClose, question, evidenceGroupId, caseId, onProofLinked }) {
  const [proofTab, setProofTab] = useState('depoClip');
  const [depoClips, setDepoClips] = useState([]);
  const [extracts, setExtracts] = useState([]);
  const [selectedClip, setSelectedClip] = useState(null);
  const [selectedExtract, setSelectedExtract] = useState(null);
  const [selectedCallout, setSelectedCallout] = useState(null);
  const [callouts, setCallouts] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [searchClip, setSearchClip] = useState('');
  const [searchExtract, setSearchExtract] = useState('');
  const [scale, setScale] = useState(1.2);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [parties, setParties] = useState({});
  const [depositions, setDepositions] = useState({});

  const canvasRef = React.useRef(null);

  // Get witness name
  const getWitnessName = (witId) => {
    const p = parties[witId];
    if (!p) return 'Unknown';
    return p.display_name || `${p.first_name || ''} ${p.last_name}`.trim();
  };

  // Load initial data
  useEffect(() => {
    if (!isOpen || !question?.party_id) return;
    loadProofsForWitness();
  }, [isOpen, question?.party_id]);

  const loadProofsForWitness = async () => {
    setLoading(true);
    try {
      const [allParties, allDeps, allClips, allExtracts] = await Promise.all([
        base44.entities.Parties.filter({ case_id: caseId }),
        base44.entities.Depositions.filter({ case_id: caseId }),
        base44.entities.DepoClips.filter({ case_id: caseId }),
        base44.entities.ExhibitExtracts.filter({ case_id: caseId }),
      ]);

      // Build maps
      const partiesMap = {};
      allParties.forEach(p => { partiesMap[p.id] = p; });
      setParties(partiesMap);

      const depsMap = {};
      allDeps.forEach(d => { depsMap[d.id] = d; });
      setDepositions(depsMap);

      // Filter clips for witness
      const witClips = [];
      for (const clip of allClips) {
        if (clip.deposition_id) {
          const dep = depsMap[clip.deposition_id];
          if (dep && dep.party_id === question.party_id) {
            witClips.push(clip);
          }
        }
      }
      setDepoClips(witClips);

      // Filter extracts for witness (via ExtractWitnesses or extract source)
      const witExtracts = [];
      for (const extract of allExtracts) {
        const extractWits = await base44.entities.ExtractWitnesses.filter({ extract_id: extract.id });
        if (extractWits.some(ew => ew.witness_id === question.party_id)) {
          witExtracts.push(extract);
        }
      }
      setExtracts(witExtracts);
    } catch (error) {
      console.error('Error loading proofs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load callouts for selected extract
  useEffect(() => {
    if (!selectedExtract?.id) return;
    base44.entities.Callouts.filter({ extract_id: selectedExtract.id }).then(setCallouts);
  }, [selectedExtract?.id]);

  // Load highlights for selected callout
  useEffect(() => {
    if (!selectedCallout?.id) return;
    base44.entities.Highlights.filter({ callout_id: selectedCallout.id }).then(setHighlights);
  }, [selectedCallout?.id]);

  // Load PDF for selected extract
  useEffect(() => {
    if (!selectedExtract?.extract_file_url?.toLowerCase().includes('.pdf')) {
      setPdfDoc(null);
      return;
    }
    pdfjs.getDocument(selectedExtract.extract_file_url).promise.then(doc => {
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setPageNum(selectedCallout?.page_number || 1);
    });
  }, [selectedExtract, selectedCallout]);

  // Render PDF page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;
    pdfDoc.getPage(pageNum).then(page => {
      if (cancelled) return;
      const vp = page.getViewport({ scale });
      const canvas = canvasRef.current;
      canvas.width = vp.width;
      canvas.height = vp.height;
      page.render({ canvasContext: canvas.getContext("2d"), viewport: vp });
    });
    return () => { cancelled = true; };
  }, [pdfDoc, pageNum, scale]);

  // Handle adding clip as proof
  const handleAddClipProof = async () => {
    if (!selectedClip) return;
    try {
      // Create proof item
      const proofItem = await base44.entities.ProofItems.create({
        case_id: caseId,
        type: 'depoClip',
        label: selectedClip.clip_title || `Depo Clip (${selectedClip.start_cite})`,
        source_id: selectedClip.id,
        notes: selectedClip.notes,
      });

      // Link to evidence group
      await base44.entities.EvidenceGroupProofItems.create({
        evidence_group_id: evidenceGroupId,
        proof_item_id: proofItem.id,
      });

      // Link to question
      await base44.entities.QuestionProofItems.create({
        case_id: caseId,
        evidence_group_id: evidenceGroupId,
        question_id: question.id,
        proof_item_id: proofItem.id,
      });

      // Link witness
      await base44.entities.ProofItemWitnesses.create({
        case_id: caseId,
        proof_item_id: proofItem.id,
        witness_id: question.party_id,
      });

      onProofLinked();
    } catch (error) {
      console.error('Error adding clip proof:', error);
    }
  };

  // Handle adding extract + callout as proof
  const handleAddExtractProof = async () => {
    if (!selectedExtract || !selectedCallout) return;
    try {
      // Create proof item with callout
      const proofItem = await base44.entities.ProofItems.create({
        case_id: caseId,
        type: 'extract',
        label: selectedExtract.title || 'Exhibit Extract',
        source_id: selectedExtract.id,
        callout_id: selectedCallout.id,
      });

      // Link to evidence group
      await base44.entities.EvidenceGroupProofItems.create({
        evidence_group_id: evidenceGroupId,
        proof_item_id: proofItem.id,
      });

      // Link to question
      await base44.entities.QuestionProofItems.create({
        case_id: caseId,
        evidence_group_id: evidenceGroupId,
        question_id: question.id,
        proof_item_id: proofItem.id,
      });

      // Link witness from callout
      if (selectedCallout.witness_id) {
        await base44.entities.ProofItemWitnesses.create({
          case_id: caseId,
          proof_item_id: proofItem.id,
          witness_id: selectedCallout.witness_id,
        });
      }

      onProofLinked();
    } catch (error) {
      console.error('Error adding extract proof:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-100">
            Link Proof to "{question?.question_text?.slice(0, 40)}..."
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading proofs...</div>
        ) : (
          <Tabs value={proofTab} onValueChange={setProofTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-gray-800">
              <TabsTrigger value="depoClip">Deposition Clips</TabsTrigger>
              <TabsTrigger value="extract">Exhibit Extracts</TabsTrigger>
            </TabsList>

            {/* Deposition Clips Tab */}
            <TabsContent value="depoClip" className="space-y-3 mt-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Search clips..."
                  value={searchClip}
                  onChange={(e) => setSearchClip(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700 text-xs text-gray-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                {depoClips.filter(c => 
                  c.clip_title?.toLowerCase().includes(searchClip.toLowerCase()) ||
                  c.clip_text?.toLowerCase().includes(searchClip.toLowerCase())
                ).map(clip => (
                  <div
                    key={clip.id}
                    onClick={() => setSelectedClip(clip)}
                    className={`p-3 rounded border-2 cursor-pointer transition-colors ${
                      selectedClip?.id === clip.id
                        ? 'border-cyan-400 bg-cyan-500/10'
                        : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                    }`}
                  >
                    <p className="text-xs font-medium text-gray-100 truncate">{clip.clip_title || `${clip.start_cite}`}</p>
                    <p className="text-[10px] text-gray-500 mt-1">{clip.start_cite} - {clip.end_cite}</p>
                    {clip.direction && (
                      <p className={`text-[10px] mt-1 font-medium ${clip.direction === 'HelpsUs' ? 'text-green-400' : 'text-red-400'}`}>
                        {clip.direction === 'HelpsUs' ? '✓ Helps Us' : '✗ Hurts Us'}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {selectedClip && (
                <div className="bg-gray-800 border border-gray-700 rounded p-4 mt-4 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase">Clip Details</p>
                    <p className="text-sm text-gray-200 mt-2">{selectedClip.clip_title || 'Untitled Clip'}</p>
                    <p className="text-xs text-gray-500 mt-1">Citation: {selectedClip.start_cite} - {selectedClip.end_cite}</p>
                    {selectedClip.direction && (
                      <p className={`text-xs mt-2 font-medium ${selectedClip.direction === 'HelpsUs' ? 'text-green-400' : 'text-red-400'}`}>
                        Direction: {selectedClip.direction === 'HelpsUs' ? 'Helps Us' : 'Hurts Us'}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase">Clip Text</p>
                    <p className="text-xs text-gray-300 mt-1 max-h-24 overflow-y-auto bg-gray-900 p-2 rounded">
                      {selectedClip.clip_text}
                    </p>
                  </div>
                  {selectedClip.notes && (
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase">Notes</p>
                      <p className="text-xs text-gray-300 mt-1">{selectedClip.notes}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300 flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleAddClipProof}
                  disabled={!selectedClip}
                  className="bg-cyan-600 hover:bg-cyan-700 flex-1"
                >
                  Link Clip
                </Button>
              </div>
            </TabsContent>

            {/* Exhibit Extracts Tab */}
            <TabsContent value="extract" className="space-y-3 mt-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Search extracts..."
                  value={searchExtract}
                  onChange={(e) => setSearchExtract(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700 text-xs text-gray-100"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Extracts list */}
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {extracts.filter(e =>
                    e.title?.toLowerCase().includes(searchExtract.toLowerCase()) ||
                    e.marked_title?.toLowerCase().includes(searchExtract.toLowerCase())
                  ).map(extract => (
                    <div
                      key={extract.id}
                      onClick={() => { setSelectedExtract(extract); setSelectedCallout(null); }}
                      className={`p-2 rounded border-2 cursor-pointer transition-colors text-xs ${
                        selectedExtract?.id === extract.id
                          ? 'border-cyan-400 bg-cyan-500/10'
                          : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                      }`}
                    >
                      <p className="font-medium text-gray-100 truncate">{extract.title || extract.marked_title}</p>
                      <p className="text-gray-500 text-[10px] mt-0.5">{extract.marked_no}</p>
                    </div>
                  ))}
                </div>

                {/* Callouts list */}
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {selectedExtract ? (
                    callouts.map(callout => (
                      <div
                        key={callout.id}
                        onClick={() => setSelectedCallout(callout)}
                        className={`p-2 rounded border-2 cursor-pointer transition-colors text-xs ${
                          selectedCallout?.id === callout.id
                            ? 'border-orange-400 bg-orange-500/10'
                            : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                        }`}
                      >
                        <p className="font-medium text-gray-100 truncate">{callout.name}</p>
                        <p className="text-gray-500 text-[10px] mt-0.5">p.{callout.page_number}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500 text-[10px] text-center py-4">Select extract to view callouts</div>
                  )}
                </div>

                {/* PDF/Callout preview */}
                <div className="max-h-96 overflow-y-auto border border-gray-700 rounded bg-gray-900 flex flex-col">
                  {selectedExtract && selectedCallout?.snapshot_image_url ? (
                    <div className="flex-1 flex flex-col">
                      <div className="flex-1 overflow-auto flex justify-center items-center p-2">
                        <div className="relative">
                          <img 
                            src={selectedCallout.snapshot_image_url} 
                            alt="Callout" 
                            className="max-w-full max-h-full"
                          />
                          {/* Highlights overlay */}
                          {highlights.map(hl =>
                            (hl.rects_norm || []).map((r, ri) => (
                              <div key={`${hl.id}-${ri}`} style={{
                                position: "absolute",
                                left: `${r.x * 100}%`, top: `${r.y * 100}%`,
                                width: `${r.w * 100}%`, height: `${r.h * 100}%`,
                                background: COLOR_CSS[hl.color] || COLOR_CSS.yellow,
                                pointerEvents: "none",
                              }} />
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  ) : selectedExtract && pdfDoc ? (
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-center gap-1 px-2 py-1 bg-gray-800 border-b border-gray-700">
                        <button onClick={() => setPageNum(p => Math.max(1, p - 1))} disabled={pageNum <= 1} className="p-1 text-gray-400 hover:text-white disabled:opacity-30">
                          <ChevronLeft className="w-3 h-3" />
                        </button>
                        <span className="text-[10px] text-gray-500">{pageNum} / {numPages}</span>
                        <button onClick={() => setPageNum(p => Math.min(numPages, p + 1))} disabled={pageNum >= numPages} className="p-1 text-gray-400 hover:text-white disabled:opacity-30">
                          <ChevronRight className="w-3 h-3" />
                        </button>
                        <div className="w-px h-4 bg-gray-700 mx-1" />
                        <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-1 text-gray-400 hover:text-white">
                          <ZoomOut className="w-3 h-3" />
                        </button>
                        <span className="text-[10px] text-gray-500 w-7 text-center">{Math.round(scale * 100)}%</span>
                        <button onClick={() => setScale(s => Math.min(4, s + 0.25))} className="p-1 text-gray-400 hover:text-white">
                          <ZoomIn className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex-1 overflow-auto flex justify-center items-center p-2 bg-gray-950">
                        <canvas ref={canvasRef} style={{ display: "block" }} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500 text-[10px]">
                      {selectedExtract ? 'No preview available' : 'Select extract'}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300 flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleAddExtractProof}
                  disabled={!selectedExtract || !selectedCallout}
                  className="bg-cyan-600 hover:bg-cyan-700 flex-1"
                >
                  Link Extract
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}