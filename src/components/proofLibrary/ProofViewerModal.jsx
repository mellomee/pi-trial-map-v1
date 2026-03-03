import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { FileText, Image, ChevronLeft, ChevronRight, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

function CalloutImageWithHighlights({ callout, highlights }) {
  const colorMap = { yellow: 'rgba(253,224,71,', red: 'rgba(239,68,68,', green: 'rgba(34,197,94,', blue: 'rgba(59,130,246,' };
  const [dims, setDims] = useState(null);

  if (!callout.snapshot_image_url) {
    return (
      <div className="w-full h-48 flex items-center justify-center bg-[#0a0f1e] rounded border border-[#1e2a45] text-gray-500">
        <div className="text-center">
          <Image className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">No snapshot captured yet</p>
        </div>
      </div>);

  }

  return (
    <div className="relative w-full">
      <img
        src={callout.snapshot_image_url}
        alt={callout.name}
        className="w-full rounded border border-[#1e2a45] max-h-96 object-contain bg-black"
        onLoad={(e) => setDims({ w: e.target.offsetWidth, h: e.target.offsetHeight })} />

      {dims && highlights.map((hl, hi) =>
      (hl.rects_norm || []).map((r, ri) => {
        const base = colorMap[hl.color] || colorMap.yellow;
        return (
          <div key={`${hi}-${ri}`} style={{
            position: 'absolute',
            left: `${r.x * 100}%`, top: `${r.y * 100}%`,
            width: `${r.w * 100}%`, height: `${r.h * 100}%`,
            backgroundColor: `${base}${hl.opacity ?? 0.35})`,
            pointerEvents: 'none'
          }} />);

      })
      )}
    </div>);

}

function InlineFileViewer({ url, label, onClose }) {
  const [page, setPage] = useState(1);
  if (!url) return null;

  const lowerUrl = url.toLowerCase().split('?')[0];
  const isImage = lowerUrl.endsWith('.png') || lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg') || lowerUrl.endsWith('.gif') || lowerUrl.endsWith('.webp');

  // Use Google Docs viewer for PDFs — append page param
  const pdfViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true#page=${page}`;

  return (
    <div className="border border-[#1e2a45] rounded-lg overflow-hidden bg-[#0a0f1e]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e2a45] bg-[#131a2e]">
        <span className="text-xs text-cyan-400 font-semibold truncate">{label}</span>
        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
          {!isImage &&
          <>
              <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="text-[11px] text-gray-400 hover:text-cyan-300 disabled:opacity-30 px-1">
              ‹ Prev</button>
              <span className="text-[11px] text-gray-500">Pg {page}</span>
              <button
              onClick={() => setPage((p) => p + 1)}
              className="text-[11px] text-gray-400 hover:text-cyan-300 px-1">
              Next ›</button>
            </>
          }
          <a href={url} download className="text-[11px] text-gray-400 hover:text-cyan-300">Download ↓</a>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">×</button>
        </div>
      </div>
      {isImage ?
      <div className="p-2 flex justify-center bg-black">
          <img src={url} alt={label} className="max-w-full max-h-[520px] object-contain" />
        </div> :

      <iframe
        key={page}
        src={pdfViewerUrl}
        className="w-full"
        style={{ height: '560px', border: 'none' }}
        title={label} />

      }
    </div>);

}

function ViewFileButton({ url, label, viewingFile, setViewingFile }) {
  if (!url) return null;
  const active = viewingFile?.url === url;
  return (
    <button
      onClick={() => setViewingFile(active ? null : { url, label })}
      className="mt-2 flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-200 transition-colors">

      {active ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
      {active ? 'Hide File' : 'View File'}
    </button>);

}

export default function ProofViewerModal({ proofItem, isOpen, onClose, onCalloutSelected, selectionMode = false, availableProofItems = [], onProofSelected, witnessFilter = null }) {
  const [loading, setLoading] = useState(false);
  const [depoClip, setDepoClip] = useState(null);
  const [deposition, setDeposition] = useState(null);
  const [extract, setExtract] = useState(null);
  const [extractMeta, setExtractMeta] = useState(null);
  const [callouts, setCallouts] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [selectedCallout, setSelectedCallout] = useState(null);
  const [viewingFile, setViewingFile] = useState(null); // { url, label }
  const [caseParties, setCaseParties] = useState({}); // id -> name
  const [selectedProofInList, setSelectedProofInList] = useState(proofItem);

  useEffect(() => {
    if (isOpen && (proofItem || selectedProofInList)) {
      loadDetails();
      setViewingFile(null);
    } else {
      setDepoClip(null);setDeposition(null);setExtract(null);
      setExtractMeta(null);setCallouts([]);setHighlights([]);
      setSelectedCallout(null);setViewingFile(null);setCaseParties({});
    }
  }, [isOpen, (proofItem || selectedProofInList)?.id]);

  useEffect(() => {
    if (selectionMode && availableProofItems.length > 0 && !selectedProofInList) {
      setSelectedProofInList(availableProofItems[0]);
    }
  }, [selectionMode, availableProofItems]);

  useEffect(() => {
    if (selectedCallout?.id) {
      base44.entities.Highlights.filter({ callout_id: selectedCallout.id }).
      then(setHighlights).catch(() => setHighlights([]));
    } else {
      setHighlights([]);
    }
  }, [selectedCallout?.id]);

  const loadDetails = async () => {
    setLoading(true);
    const targetProof = selectedProofInList || proofItem;
    if (!targetProof) {
      setLoading(false);
      return;
    }
    try {
      if (targetProof.type === 'depoClip') {
        const clips = await base44.entities.DepoClips.filter({ id: targetProof.source_id });
        if (clips.length > 0) {
          setDepoClip(clips[0]);
          if (clips[0].deposition_id) {
            const deps = await base44.entities.Depositions.filter({ id: clips[0].deposition_id });
            if (deps.length > 0) setDeposition(deps[0]);
          }
        }
      } else if (targetProof.type === 'extract') {
        // Also load all case parties so callout witness names can be resolved
        if (targetProof.case_id) {
          base44.entities.Parties.filter({ case_id: targetProof.case_id }).then(ps => {
            const map = {};
            ps.forEach(p => { map[p.id] = p.display_name || `${p.first_name || ''} ${p.last_name}`.trim(); });
            setCaseParties(map);
          });
        }
        const [extracts, cos] = await Promise.all([
        base44.entities.ExhibitExtracts.filter({ id: targetProof.source_id }),
        base44.entities.Callouts.filter({ extract_id: targetProof.source_id })]
        );

        if (extracts.length > 0) {
          const ext = extracts[0];
          setExtract(ext);

          const [sources, jointExhibits] = await Promise.all([
          base44.entities.ExtractSources.filter({ exhibit_extract_id: ext.id }),
          base44.entities.JointExhibits.filter({ exhibit_extract_id: ext.id })]
          );

          let sourceDepoExhibit = null,deponent = null;
          const primarySrc = sources[0] || null;
          const depoExhibitId = primarySrc?.source_depo_exhibit_id || ext.source_depo_exhibit_id;
          const deponentPartyId = primarySrc?.source_deponent_party_id;

          const [depoExhibits, parties] = await Promise.all([
          depoExhibitId ? base44.entities.DepositionExhibits.filter({ id: depoExhibitId }) : Promise.resolve([]),
          deponentPartyId ? base44.entities.Parties.filter({ id: deponentPartyId }) : Promise.resolve([])]
          );
          if (depoExhibits.length > 0) sourceDepoExhibit = depoExhibits[0];
          if (parties.length > 0) deponent = parties[0];

          // Fallback 1: find deponent via deposition
          if (!deponent && sourceDepoExhibit?.deposition_id) {
            const deps = await base44.entities.Depositions.filter({ id: sourceDepoExhibit.deposition_id });
            if (deps.length > 0 && deps[0].party_id) {
              const pts = await base44.entities.Parties.filter({ id: deps[0].party_id });
              if (pts.length > 0) deponent = pts[0];
            }
          }
          // Fallback 2: find deponent via ExtractWitnesses
          if (!deponent) {
            const ews = await base44.entities.ExtractWitnesses.filter({ extract_id: ext.id });
            if (ews.length > 0) {
              const pts = await base44.entities.Parties.filter({ id: ews[0].witness_id });
              if (pts.length > 0) deponent = pts[0];
            }
          }
          // Fallback 3: use deponent_name string from sourceDepoExhibit
          if (!deponent && sourceDepoExhibit?.deponent_name) {
            deponent = { display_name: sourceDepoExhibit.deponent_name };
          }

          // Find joint exhibit — try exhibit_extract_id first, then depo exhibit fallbacks
          let jx = jointExhibits[0] || null;
          if (!jx && depoExhibitId) {
            const [byPrimary, byMaster] = await Promise.all([
            base44.entities.JointExhibits.filter({ primary_depo_exhibit_id: depoExhibitId }),
            base44.entities.JointExhibits.filter({ master_exhibit_id: depoExhibitId })]
            );
            jx = byPrimary[0] || byMaster[0] || null;
          }
          // Last resort: scan all JointExhibits for this case
          if (!jx && ext.case_id) {
            const allJx = await base44.entities.JointExhibits.filter({ case_id: ext.case_id });
            jx = allJx.find((j) =>
            j.exhibit_extract_id === ext.id ||
            j.primary_depo_exhibit_id === depoExhibitId ||
            j.master_exhibit_id === depoExhibitId ||
            Array.isArray(j.source_depo_exhibit_ids) && j.source_depo_exhibit_ids.includes(depoExhibitId)
            ) || null;
          }
          // If jx found but no admitted_no, check AdmittedExhibits table
          let admittedRecord = null;
          if (jx) {
            const admRecs = await base44.entities.AdmittedExhibits.filter({ joint_exhibit_id: jx.id });
            admittedRecord = admRecs[0] || null;
            console.log('[ProofViewer] jx:', JSON.stringify(jx), '| admitted record:', JSON.stringify(admittedRecord));
          } else {
            console.log('[ProofViewer] no jx found for ext.id:', ext.id, 'depoExhibitId:', depoExhibitId);
          }
          setExtractMeta({ sourceDepoExhibit, deponent, primarySrc, jointExhibit: jx, admittedRecord });
        }

        const sorted = cos.sort((a, b) => (a.page_number || 0) - (b.page_number || 0));
        setCallouts(sorted);
        const linked = targetProof.callout_id ? sorted.find((c) => c.id === targetProof.callout_id) : null;
        setSelectedCallout(linked || (sorted.length > 0 ? sorted[0] : null));
      }
    } catch (err) {
      console.error('Error loading proof details:', err);
    }
    setLoading(false);
  };

  const handleSetAsProofCallout = async () => {
    const targetProof = selectedProofInList || proofItem;
    if (!selectedCallout || !targetProof) return;
    await base44.entities.ProofItems.update(targetProof.id, { callout_id: selectedCallout.id });
    if (onCalloutSelected) onCalloutSelected(targetProof.id, selectedCallout);
    // Don't close — update local proofItem reference so badge shows immediately
    setCallouts(prev => [...prev]); // trigger re-render
  };

  const handleLinkProofToQuestion = async () => {
    if (onProofSelected && selectedProofInList) {
      onProofSelected(selectedProofInList);
    }
  };

  const selectedCalloutIdx = callouts.findIndex((c) => c.id === selectedCallout?.id);
  const targetProof = selectedProofInList || proofItem;
  const isCurrentProofCallout = targetProof?.callout_id && selectedCallout?.id === targetProof?.callout_id;

  const jx = extractMeta?.jointExhibit;
  
  const filteredProofItems = availableProofItems.filter(p => {
    if (!witnessFilter) return true;
    // For extracts with callouts, check if the callout's witness matches filter
    if (p.type === 'extract' && p.callout_id) {
      const calloutWitness = callouts.find(c => c.id === p.callout_id)?.witness_id;
      return calloutWitness === witnessFilter;
    }
    return true;
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0f1629] border-[#1e2a45] text-slate-200 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-cyan-300">{proofItem?.label || 'Proof Detail'}</DialogTitle>
        </DialogHeader>

        {loading ?
        <div className="text-center py-12 text-gray-400">Loading...</div> :

        <>
            {/* DEPO CLIP VIEW */}
            {depoClip &&
          <div className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  <Badge className="bg-blue-500/20 text-blue-300">Deposition Clip</Badge>
                  {depoClip.direction &&
              <Badge className={depoClip.direction === 'HelpsUs' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                      {depoClip.direction === 'HelpsUs' ? '✓ Helps Us' : '✗ Hurts Us'}
                    </Badge>
              }
                  {depoClip.topic_tag && <Badge variant="outline" className="text-gray-300">{depoClip.topic_tag}</Badge>}
                </div>
                {deposition &&
            <div className="text-xs text-gray-400 bg-[#131a2e] px-3 py-2 rounded">
                    <span className="text-gray-500">Deposition: </span>
                    <span className="text-gray-200">{deposition.sheet_name}</span>
                    {deposition.taken_date && <span className="ml-3 text-gray-500">{deposition.taken_date}</span>}
                  </div>
            }
                <div className="bg-[#131a2e] border border-[#1e2a45] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-semibold text-cyan-400 tracking-wider">TESTIMONY</span>
                    <span className="text-xs text-gray-400 ml-auto font-mono">{depoClip.start_cite} – {depoClip.end_cite}</span>
                  </div>
                  <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-mono bg-[#0a0f1e] p-3 rounded max-h-80 overflow-y-auto border border-[#1e2a45]">
                    {depoClip.clip_text || <span className="text-gray-500 italic">No transcript text available</span>}
                  </div>
                </div>
                {depoClip.notes &&
            <div className="text-xs text-gray-400 bg-[#131a2e] px-3 py-2 rounded border border-[#1e2a45]">
                    <span className="text-gray-500">Notes: </span>{depoClip.notes}
                  </div>
            }
              </div>
          }

            {/* EXTRACT VIEW */}
            {extract &&
          <div className="space-y-4">
                <Badge className="bg-purple-500/20 text-purple-300">Exhibit Extract</Badge>

                



                {/* 3-column metadata strip */}
                {extractMeta &&
            <div className="grid grid-cols-3 gap-2">

                    {/* ORIGINAL */}
                    <div className="bg-[#131a2e] border border-[#1e2a45] rounded-lg p-3 flex flex-col gap-1 min-w-0">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Original</p>
                      {extractMeta.sourceDepoExhibit ?
                <>
                          <p className="text-xl font-bold text-yellow-300 leading-none">
                            #{extractMeta.primarySrc?.source_depo_exhibit_no || extractMeta.sourceDepoExhibit.depo_exhibit_no || '—'}
                          </p>
                          <p className="text-xs text-gray-300 leading-tight mt-1">
                            {extractMeta.sourceDepoExhibit.depo_exhibit_title || extractMeta.sourceDepoExhibit.display_title || '—'}
                          </p>
                          {extractMeta.deponent &&
                  <p className="text-[11px] text-cyan-400 mt-1">
                              {extractMeta.deponent.display_name || `${extractMeta.deponent.first_name || ''} ${extractMeta.deponent.last_name}`.trim()}
                            </p>
                  }
                          <ViewFileButton
                    url={extractMeta.sourceDepoExhibit.file_url}
                    label={`Exh ${extractMeta.sourceDepoExhibit.depo_exhibit_no} – Original`}
                    viewingFile={viewingFile}
                    setViewingFile={setViewingFile} />

                        </> :

                <p className="text-gray-500 italic text-xs mt-1">Source not linked</p>
                }
                    </div>

                    {/* MARKED */}
                    <div className={`bg-[#131a2e] border rounded-lg p-3 flex flex-col gap-1 min-w-0 ${jx ? 'border-yellow-500/40' : 'border-[#1e2a45]'}`}>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Marked</p>
                      {jx ?
                <>
                          <p className="text-xl font-bold text-yellow-300 leading-none">#{jx.marked_no}</p>
                          <p className="text-xs text-gray-300 leading-tight mt-1">
                            {jx.internal_name || jx.marked_title || '—'}
                          </p>
                          {/* Source pages extracted from */}
                          {(extractMeta.primarySrc?.referenced_pages || extract.extract_page_start) &&
                  <p className="text-[11px] text-gray-400 mt-1">
                              Source pp.&nbsp;
                              {extractMeta.primarySrc?.referenced_pages ?
                    extractMeta.primarySrc.referenced_pages :
                    `${extract.extract_page_start}${extract.extract_page_end ? `–${extract.extract_page_end}` : ''}`}
                            </p>
                  }
                          {/* Page count of the extracted file */}
                          {extract.extract_page_count ?
                  <p className="text-[11px] text-gray-400">{extract.extract_page_count} pg extracted</p> :
                  null}
                          <Badge className="mt-1 text-[10px] w-fit bg-yellow-500/20 text-yellow-400">{jx.status}</Badge>
                          <ViewFileButton
                    url={extract.extract_file_url}
                    label={`Extract – Marked #${jx.marked_no}`}
                    viewingFile={viewingFile}
                    setViewingFile={setViewingFile} />

                        </> :

                <>
                          <p className="text-gray-500 italic text-xs mt-1">Not on joint list</p>
                          {(extractMeta.primarySrc?.referenced_pages || extract.extract_page_start) &&
                  <p className="text-[11px] text-gray-400 mt-1">
                              Source pp.&nbsp;
                              {extractMeta.primarySrc?.referenced_pages ?
                    extractMeta.primarySrc.referenced_pages :
                    `${extract.extract_page_start}${extract.extract_page_end ? `–${extract.extract_page_end}` : ''}`}
                            </p>
                  }
                          {extract.extract_page_count ?
                  <p className="text-[11px] text-gray-400">{extract.extract_page_count} pg extracted</p> :
                  null}
                          <ViewFileButton
                    url={extract.extract_file_url}
                    label="Extract File"
                    viewingFile={viewingFile}
                    setViewingFile={setViewingFile} />

                        </>
                }
                    </div>

                    {/* ADMITTED */}
                    {(() => {
                const adm = extractMeta?.admittedRecord;
                const admNo = adm?.admitted_no || jx?.admitted_no;
                const admDate = adm?.date_admitted || jx?.admitted_date;
                const admBy = adm?.admitted_by_side || jx?.admitted_by;
                const isAdmitted = admNo || jx?.status === 'Admitted';
                return (
                  <div className={`bg-[#131a2e] border rounded-lg p-3 flex flex-col gap-1 min-w-0 ${isAdmitted ? 'border-green-500/40' : 'border-[#1e2a45]'}`}>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Admitted</p>
                          {isAdmitted ?
                    <>
                              {admNo &&
                      <p className="text-xl font-bold text-green-300 leading-none">#{admNo}</p>
                      }
                              {admDate &&
                      <p className="text-[11px] text-gray-300 mt-1">{admDate}</p>
                      }
                              {admBy &&
                      <p className="text-[11px] text-gray-400">By: {admBy}</p>
                      }
                              <Badge className="mt-1 w-fit text-[10px] bg-green-500/20 text-green-400">✓ Admitted</Badge>
                            </> :

                    <p className="text-gray-500 italic text-xs mt-1">Not admitted</p>
                    }
                        </div>);

              })()}
                  </div>
            }

                {/* Inline file viewer — shown below the metadata strip */}
                {viewingFile &&
            <InlineFileViewer
              url={viewingFile.url}
              label={viewingFile.label}
              onClose={() => setViewingFile(null)} />

            }

                {/* Callouts */}
                {callouts.length > 0 ?
            <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-cyan-400 tracking-wider">CALLOUTS ({callouts.length})</span>
                      {callouts.length > 1 &&
                <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-white"
                  disabled={selectedCalloutIdx <= 0}
                  onClick={() => setSelectedCallout(callouts[selectedCalloutIdx - 1])}>
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <span className="text-xs text-gray-400">{selectedCalloutIdx + 1} / {callouts.length}</span>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-white"
                  disabled={selectedCalloutIdx >= callouts.length - 1}
                  onClick={() => setSelectedCallout(callouts[selectedCalloutIdx + 1])}>
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                }
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {callouts.map((c, idx) => {
                        const witName = c.witness_id ? caseParties[c.witness_id] : null;
                        return (
                <button key={c.id} onClick={() => setSelectedCallout(c)}
                className={`flex-shrink-0 rounded border-2 transition-all relative ${selectedCallout?.id === c.id ? 'border-cyan-400 shadow-lg shadow-cyan-500/20' : 'border-[#1e2a45] hover:border-gray-500'}`}>
                          {proofItem?.callout_id === c.id &&
                  <div className="absolute top-0.5 right-0.5 z-10">
                              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 bg-[#0f1629] rounded-full" />
                            </div>
                  }
                          {c.snapshot_image_url ?
                  <img src={c.snapshot_image_url} alt={c.name || `Callout ${idx + 1}`} className="h-16 w-20 object-cover rounded" /> :

                  <div className="h-16 w-20 flex items-center justify-center bg-[#131a2e] rounded">
                              <Image className="w-5 h-5 text-gray-600" />
                            </div>
                  }
                          {c.name && <p className="text-[9px] text-gray-400 text-center px-1 pt-0.5 truncate w-20">{c.name}</p>}
                          {witName && <p className="text-[9px] text-cyan-400 text-center px-1 pb-0.5 truncate w-20">{witName}</p>}
                        </button>
                        );
                      })}
                    </div>

                    {selectedCallout &&
              <div className={`border rounded-lg p-3 space-y-2 ${isCurrentProofCallout ? 'bg-cyan-900/20 border-cyan-500/50' : 'bg-[#131a2e] border-[#1e2a45]'}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-cyan-400 font-semibold">{selectedCallout.name || `Callout – Page ${selectedCallout.page_number}`}</span>
                          <span className="text-xs text-gray-500">Pg {selectedCallout.page_number}</span>
                          {selectedCallout.jury_safe && <Badge className="bg-green-500/20 text-green-400 text-xs">Jury Safe</Badge>}
                          {isCurrentProofCallout ?
                  <Badge className="bg-cyan-500/20 text-cyan-300 text-xs ml-auto">✓ Current Proof Callout</Badge> :

                  <Button size="sm" className="ml-auto h-7 text-xs bg-cyan-600 hover:bg-cyan-700 px-3" onClick={handleSetAsProofCallout}>
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Set as Proof Callout
                            </Button>
                  }
                        </div>
                        <CalloutImageWithHighlights callout={selectedCallout} highlights={highlights} />
                      </div>
              }
                  </div> :

            <div className="text-center py-8 bg-[#131a2e] rounded border border-dashed border-[#1e2a45] text-gray-500">
                    <Image className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No callouts on this extract yet</p>
                    <p className="text-xs mt-1 text-gray-600">Go to Extracts to add callouts and highlights</p>
                  </div>
            }

                {extract.notes &&
            <div className="text-xs text-gray-400 bg-[#131a2e] px-3 py-2 rounded border border-[#1e2a45]">
                    <span className="text-gray-500">Notes: </span>{extract.notes}
                  </div>
            }
              </div>
          }

            {!depoClip && !extract && !loading &&
          <div className="text-center py-8 text-gray-500">Could not load proof details.</div>
          }
          </>
        }
      </DialogContent>
    </Dialog>);

}