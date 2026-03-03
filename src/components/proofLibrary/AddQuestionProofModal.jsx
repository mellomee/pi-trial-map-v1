import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, FileText, Image, Eye } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

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
  const [selectedExtractMeta, setSelectedExtractMeta] = useState(null);
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
  const [viewingFile, setViewingFile] = useState(null);
  const [fileViewerPage, setFileViewerPage] = useState(1);
  const [fileViewerNumPages, setFileViewerNumPages] = useState(1);
  const [fileViewerScale, setFileViewerScale] = useState(1.2);
  const [fileViewerPdfDoc, setFileViewerPdfDoc] = useState(null);
  const [caseParties, setCaseParties] = useState({});

  const canvasRef = React.useRef(null);
  const fileViewerCanvasRef = React.useRef(null);

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
      const partiesNameMap = {};
      allParties.forEach(p => { 
        partiesMap[p.id] = p;
        partiesNameMap[p.id] = p.display_name || `${p.first_name || ''} ${p.last_name}`.trim();
      });
      setParties(partiesMap);
      setCaseParties(partiesNameMap);

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

      // Filter extracts for witness (via callouts)
      const witExtracts = [];
      for (const extract of allExtracts) {
        const extractCallouts = await base44.entities.Callouts.filter({ extract_id: extract.id });
        if (extractCallouts.some(co => co.witness_id === question.party_id)) {
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

  // Load extract metadata and callouts
  useEffect(() => {
    if (!selectedExtract?.id) return;
    loadExtractMetadata();
  }, [selectedExtract?.id]);

  const loadExtractMetadata = async () => {
    try {
      const [cos, sources, jointExhibits] = await Promise.all([
        base44.entities.Callouts.filter({ extract_id: selectedExtract.id }),
        base44.entities.ExtractSources.filter({ exhibit_extract_id: selectedExtract.id }),
        base44.entities.JointExhibits.filter({ exhibit_extract_id: selectedExtract.id })
      ]);

      setCallouts(cos);

      let sourceDepoExhibit = null, deponent = null;
      const primarySrc = sources[0] || null;
      const depoExhibitId = primarySrc?.source_depo_exhibit_id || selectedExtract.source_depo_exhibit_id;
      const deponentPartyId = primarySrc?.source_deponent_party_id;

      const [depoExhibits, pts] = await Promise.all([
        depoExhibitId ? base44.entities.DepositionExhibits.filter({ id: depoExhibitId }) : Promise.resolve([]),
        deponentPartyId ? base44.entities.Parties.filter({ id: deponentPartyId }) : Promise.resolve([])
      ]);

      if (depoExhibits.length > 0) sourceDepoExhibit = depoExhibits[0];
      if (pts.length > 0) deponent = pts[0];

      if (!deponent && sourceDepoExhibit?.deposition_id) {
        const deps = await base44.entities.Depositions.filter({ id: sourceDepoExhibit.deposition_id });
        if (deps.length > 0 && deps[0].party_id) {
          const pts2 = await base44.entities.Parties.filter({ id: deps[0].party_id });
          if (pts2.length > 0) deponent = pts2[0];
        }
      }

      if (!deponent) {
        const ews = await base44.entities.ExtractWitnesses.filter({ extract_id: selectedExtract.id });
        if (ews.length > 0) {
          const pts3 = await base44.entities.Parties.filter({ id: ews[0].witness_id });
          if (pts3.length > 0) deponent = pts3[0];
        }
      }

      if (!deponent && sourceDepoExhibit?.deponent_name) {
        deponent = { display_name: sourceDepoExhibit.deponent_name };
      }

      let jx = jointExhibits[0] || null;
      if (!jx && depoExhibitId) {
        const [byPrimary, byMaster] = await Promise.all([
          base44.entities.JointExhibits.filter({ primary_depo_exhibit_id: depoExhibitId }),
          base44.entities.JointExhibits.filter({ master_exhibit_id: depoExhibitId })
        ]);
        jx = byPrimary[0] || byMaster[0] || null;
      }

      if (!jx && selectedExtract.case_id) {
        const allJx = await base44.entities.JointExhibits.filter({ case_id: selectedExtract.case_id });
        jx = allJx.find((j) =>
          j.exhibit_extract_id === selectedExtract.id ||
          j.primary_depo_exhibit_id === depoExhibitId ||
          j.master_exhibit_id === depoExhibitId ||
          (Array.isArray(j.source_depo_exhibit_ids) && j.source_depo_exhibit_ids.includes(depoExhibitId))
        ) || null;
      }

      let admittedRecord = null;
      if (jx) {
        const admRecs = await base44.entities.AdmittedExhibits.filter({ joint_exhibit_id: jx.id });
        admittedRecord = admRecs[0] || null;
      }

      setSelectedExtractMeta({ sourceDepoExhibit, deponent, primarySrc, jointExhibit: jx, admittedRecord });
    } catch (error) {
      console.error('Error loading extract metadata:', error);
    }
  };

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

  // Load PDF for file viewer
  useEffect(() => {
    if (!viewingFile?.extract_file_url?.toLowerCase().includes('.pdf')) {
      setFileViewerPdfDoc(null);
      return;
    }
    pdfjs.getDocument(viewingFile.extract_file_url).promise.then(doc => {
      setFileViewerPdfDoc(doc);
      setFileViewerNumPages(doc.numPages);
      setFileViewerPage(1);
    });
  }, [viewingFile]);

  // Render file viewer PDF page
  useEffect(() => {
    if (!fileViewerPdfDoc || !fileViewerCanvasRef.current) return;
    let cancelled = false;
    fileViewerPdfDoc.getPage(fileViewerPage).then(page => {
      if (cancelled) return;
      const vp = page.getViewport({ scale: fileViewerScale });
      const canvas = fileViewerCanvasRef.current;
      canvas.width = vp.width;
      canvas.height = vp.height;
      page.render({ canvasContext: canvas.getContext("2d"), viewport: vp });
    });
    return () => { cancelled = true; };
  }, [fileViewerPdfDoc, fileViewerPage, fileViewerScale]);

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
              {/* Clips List - Full width */}
              <div className="border border-gray-700 rounded bg-gray-950">
                <div className="px-3 py-2 border-b border-gray-700">
                  <p className="text-xs font-semibold text-gray-400 uppercase">Deposition Clips ({depoClips.length})</p>
                </div>
                <div className="grid grid-cols-2 gap-2 p-2 max-h-32 overflow-y-auto">
                  {depoClips.map(clip => (
                    <button
                      key={clip.id}
                      onClick={() => setSelectedClip(clip)}
                      className={`text-left p-2 rounded border transition-colors ${
                        selectedClip?.id === clip.id
                          ? 'border-cyan-400 bg-cyan-500/10'
                          : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex gap-1 items-center">
                        <p className="text-xs font-medium text-gray-200 truncate flex-1">{clip.topic_tag || clip.clip_title || clip.start_cite}</p>
                        {clip.direction && (
                          <Badge className={clip.direction === 'HelpsUs' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'} size="sm">
                            {clip.direction === 'HelpsUs' ? '✓' : '✗'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">{clip.start_cite}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Clip Details Preview - Full width */}
              {selectedClip && (
                <div className="border border-gray-700 rounded bg-gray-950 p-4 space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-cyan-300">{selectedClip.clip_title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Citation: {selectedClip.start_cite} – {selectedClip.end_cite}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Badge className="bg-blue-500/20 text-blue-300 text-[10px]">Deposition Clip</Badge>
                      {selectedClip.direction && (
                        <Badge className={selectedClip.direction === 'HelpsUs' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'} size="sm">
                          {selectedClip.direction === 'HelpsUs' ? '✓ Helps Us' : '✗ Hurts Us'}
                        </Badge>
                      )}
                      {selectedClip.topic_tag && <Badge variant="outline" className="text-gray-300 border-gray-600 text-[10px]">{selectedClip.topic_tag}</Badge>}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Testimony</p>
                    <div className="bg-gray-900 rounded border border-gray-700 p-3">
                      <p className="text-xs text-gray-200 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{selectedClip.clip_text}</p>
                    </div>
                  </div>
                  {selectedClip.notes && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Notes</p>
                      <p className="text-xs text-gray-300">{selectedClip.notes}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-3">
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
               {/* Extracts list - Full width */}
               <div className="border border-gray-700 rounded bg-gray-950">
                 <div className="px-3 py-2 border-b border-gray-700">
                   <p className="text-xs font-semibold text-gray-400 uppercase">Exhibit Extracts ({extracts.length})</p>
                 </div>
                 <div className="space-y-1 p-2 max-h-40 overflow-y-auto">
                   {extracts.length > 0 ? (
                     extracts.map(extract => (
                       <button
                         key={extract.id}
                         onClick={() => { setSelectedExtract(extract); setSelectedCallout(null); }}
                         className={`text-left p-3 rounded border transition-colors w-full ${
                           selectedExtract?.id === extract.id
                             ? 'border-cyan-400 bg-cyan-500/10'
                             : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                         }`}
                       >
                         <p className="text-xs font-semibold text-gray-100">{extract.extract_title_internal || extract.extract_title_official || 'Untitled'}</p>
                         <p className="text-[10px] text-gray-400 mt-1">{extract.extract_title_official || '—'}</p>
                       </button>
                     ))
                   ) : (
                     <div className="text-center py-4 text-gray-500 text-xs">No extracts available</div>
                   )}
                 </div>
               </div>

              {/* Extract Details - Full width */}
               {selectedExtract && selectedExtractMeta && (
                 <div className="border border-gray-700 rounded bg-gray-950 p-3 space-y-3">
                   {/* 3-column metadata tiles */}
                   <div className="grid grid-cols-3 gap-3">
                     {/* ORIGINAL */}
                     <div className="bg-gray-900 border border-gray-700 rounded p-3 space-y-2">
                       <p className="text-[10px] text-gray-500 uppercase font-semibold">Original</p>
                       {selectedExtractMeta.sourceDepoExhibit ? (
                         <>
                           <p className="text-xl font-bold text-yellow-300">
                             #{selectedExtractMeta.primarySrc?.source_depo_exhibit_no || selectedExtractMeta.sourceDepoExhibit.depo_exhibit_no || '—'}
                           </p>
                           <p className="text-xs text-gray-300 leading-tight mt-1">
                             {selectedExtractMeta.sourceDepoExhibit.depo_exhibit_title || selectedExtractMeta.sourceDepoExhibit.display_title || '—'}
                           </p>
                           {selectedExtractMeta.deponent && (
                             <p className="text-[11px] text-cyan-400 mt-1">
                               {selectedExtractMeta.deponent.display_name || `${selectedExtractMeta.deponent.first_name || ''} ${selectedExtractMeta.deponent.last_name}`.trim()}
                             </p>
                           )}
                           {selectedExtractMeta.sourceDepoExhibit.file_url && (
                             <Button 
                               size="sm" 
                               variant="ghost" 
                               onClick={() => setViewingFile(selectedExtract)}
                               className="h-6 text-cyan-400 hover:text-cyan-300 p-0 text-[10px]"
                             >
                               <Eye className="w-3 h-3 mr-1" /> View File
                             </Button>
                           )}
                         </>
                       ) : (
                         <p className="text-gray-500 italic text-xs mt-1">Source not linked</p>
                       )}
                     </div>

                     {/* MARKED */}
                     <div className={`bg-gray-900 border rounded p-3 space-y-2 ${selectedExtractMeta.jointExhibit ? 'border-yellow-500/40' : 'border-gray-700'}`}>
                       <p className="text-[10px] text-gray-500 uppercase font-semibold">Marked</p>
                       {selectedExtractMeta.jointExhibit ? (
                         <>
                           <p className="text-xl font-bold text-yellow-300">#{selectedExtractMeta.jointExhibit.marked_no}</p>
                           <p className="text-xs text-gray-300 leading-tight mt-1">
                             {selectedExtractMeta.jointExhibit.internal_name || selectedExtractMeta.jointExhibit.marked_title || '—'}
                           </p>
                           {selectedExtractMeta.jointExhibit.status && (
                             <Badge className="mt-1 text-[10px] bg-yellow-500/20 text-yellow-400">{selectedExtractMeta.jointExhibit.status}</Badge>
                           )}
                         </>
                       ) : (
                         <>
                           <p className="text-gray-500 italic text-xs mt-1">Not on joint list</p>
                           {selectedExtract.extract_page_count && (
                             <p className="text-[11px] text-gray-400 mt-1">{selectedExtract.extract_page_count} pg extracted</p>
                           )}
                         </>
                       )}
                     </div>

                     {/* ADMITTED */}
                     <div className={`bg-gray-900 border rounded p-3 space-y-2 ${selectedExtractMeta.admittedRecord?.admitted_no || selectedExtractMeta.jointExhibit?.admitted_no ? 'border-green-500/40' : 'border-gray-700'}`}>
                       <p className="text-[10px] text-gray-500 uppercase font-semibold">Admitted</p>
                       {selectedExtractMeta.admittedRecord?.admitted_no || selectedExtractMeta.jointExhibit?.admitted_no ? (
                         <>
                           <p className="text-xl font-bold text-green-300">#{selectedExtractMeta.admittedRecord?.admitted_no || selectedExtractMeta.jointExhibit.admitted_no}</p>
                           {(selectedExtractMeta.admittedRecord?.date_admitted || selectedExtractMeta.jointExhibit?.admitted_date) && (
                             <p className="text-[11px] text-gray-300 mt-1">{selectedExtractMeta.admittedRecord?.date_admitted || selectedExtractMeta.jointExhibit.admitted_date}</p>
                           )}
                           <Badge className="mt-1 text-[10px] bg-green-500/20 text-green-400">✓ Admitted</Badge>
                         </>
                       ) : (
                         <p className="text-gray-500 italic text-xs mt-1">Not admitted</p>
                       )}
                     </div>
                   </div>

                  {/* Callouts row */}
                  {callouts.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-cyan-400 uppercase">Callouts ({callouts.length})</p>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {callouts.map((callout, idx) => (
                          <button
                            key={callout.id}
                            onClick={() => setSelectedCallout(callout)}
                            className={`flex-shrink-0 rounded border-2 transition-all ${
                              selectedCallout?.id === callout.id
                                ? 'border-cyan-400 shadow-lg shadow-cyan-500/20'
                                : 'border-gray-700 hover:border-gray-500'
                            }`}
                          >
                            {callout.snapshot_image_url ? (
                              <img src={callout.snapshot_image_url} alt={callout.name} className="h-20 w-24 object-cover rounded" />
                            ) : (
                              <div className="h-20 w-24 flex items-center justify-center bg-gray-800 rounded">
                                <Image className="w-5 h-5 text-gray-600" />
                              </div>
                            )}
                            {callout.name && <p className="text-[9px] text-gray-400 text-center px-1 py-0.5 truncate w-24">{callout.name}</p>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Full-width preview */}
                  {selectedCallout && (
                    <div className="border border-gray-700 rounded bg-black p-3 flex items-center justify-center min-h-64">
                      {selectedCallout.snapshot_image_url ? (
                        <div className="relative max-w-full">
                          <img 
                            src={selectedCallout.snapshot_image_url} 
                            alt="Callout" 
                            className="max-w-full max-h-96 object-contain"
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
                      ) : (
                        <div className="text-center text-gray-600">
                          <Image className="w-12 h-12 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No snapshot</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-3">
                <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300 flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleAddExtractProof}
                  disabled={!selectedExtract || !selectedCallout}
                  className="bg-cyan-600 hover:bg-cyan-700 flex-1"
                >
                  Link Callout
                </Button>
              </div>
              </TabsContent>
              </Tabs>
              )}

              {/* File Viewer Modal */}
              {viewingFile && (
              <Dialog open={!!viewingFile} onOpenChange={() => setViewingFile(null)}>
              <DialogContent className="bg-gray-950 border-gray-700 max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-gray-100">{viewingFile.depo_exhibit_no} – {viewingFile.depo_exhibit_title}</DialogTitle>
              </DialogHeader>

              {viewingFile.extract_file_url?.toLowerCase().includes('.pdf') ? (
                <div className="space-y-2">
                  <canvas ref={fileViewerCanvasRef} className="w-full border border-gray-700 rounded" />
                  {fileViewerNumPages > 1 && (
                    <div className="flex items-center justify-center gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => setFileViewerPage(p => Math.max(1, p - 1))} 
                        disabled={fileViewerPage === 1}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-200"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-xs text-gray-400">{fileViewerPage} / {fileViewerNumPages}</span>
                      <Button 
                        size="sm" 
                        onClick={() => setFileViewerPage(p => Math.min(fileViewerNumPages, p + 1))} 
                        disabled={fileViewerPage === fileViewerNumPages}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-200"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border border-gray-700 rounded bg-black p-2">
                  <img src={viewingFile.extract_file_url} alt="Extract" className="w-full max-h-96 object-contain" />
                </div>
              )}

              <Button onClick={() => setViewingFile(null)} className="w-full bg-gray-800 hover:bg-gray-700">
                Close
              </Button>
              </DialogContent>
              </Dialog>
              )}
              </DialogContent>
              </Dialog>
              );
              }