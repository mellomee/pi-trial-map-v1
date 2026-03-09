import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { FileText, Image, Eye, EyeOff, X, ZoomIn, ZoomOut, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SharedProofViewer from '@/components/shared/SharedProofViewer';



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

// ---------- Highlight overlay ----------
function HighlightOverlay({ highlights }) {
  if (!highlights?.length) return null;
  const colorMap = { yellow: 'rgba(253,224,71,0.5)', red: 'rgba(239,68,68,0.45)', green: 'rgba(34,197,94,0.45)', blue: 'rgba(59,130,246,0.45)' };
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
      {highlights.map((h, hi) => (h.rects_norm || []).map((rect, ri) => (
        <div key={`${hi}-${ri}`} style={{
          position: 'absolute', left: `${rect.x * 100}%`, top: `${rect.y * 100}%`,
          width: `${rect.w * 100}%`, height: `${rect.h * 100}%`,
          backgroundColor: colorMap[h.color] || colorMap.yellow,
        }} />
      )))}
    </div>
  );
}

// ---------- Spotlight overlay ----------
function SpotlightOverlay({ extractFileUrl, callout, highlights, onClose }) {
  const [zoom, setZoom] = useState(1);
  return (
    <div className="fixed inset-0 z-50 overflow-hidden" style={{ background: 'rgba(0,0,0,0.0)' }}>
      {extractFileUrl && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 1 }}>
          <img src={extractFileUrl} alt="Extract" className="block max-w-full max-h-full object-contain"
            style={{ opacity: 0.15, filter: 'blur(1px)', userSelect: 'none' }} draggable={false} />
        </div>
      )}
      <div className="absolute inset-0" style={{ background: 'rgba(5,8,22,0.82)', zIndex: 2 }} />
      <div className="absolute top-4 right-4 flex items-center gap-2 z-40">
        <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))} className="bg-[#0f1629]/90 hover:bg-[#1e2a45] border border-[#1e2a45] text-white p-2 rounded-lg"><ZoomOut className="w-4 h-4" /></button>
        <button onClick={() => setZoom(1)} className="bg-[#0f1629]/90 border border-[#1e2a45] text-slate-300 px-3 py-2 rounded-lg text-xs font-mono">{Math.round(zoom * 100)}%</button>
        <button onClick={() => setZoom(z => Math.min(z + 0.25, 4))} className="bg-[#0f1629]/90 hover:bg-[#1e2a45] border border-[#1e2a45] text-white p-2 rounded-lg"><ZoomIn className="w-4 h-4" /></button>
        <button onClick={onClose} className="bg-red-900/80 hover:bg-red-700 border border-red-600/40 text-red-300 p-2 rounded-lg ml-1"><X className="w-4 h-4" /></button>
      </div>
      <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 3 }}>
        <div className="overflow-auto" style={{ maxWidth: '95vw', maxHeight: '90vh' }}>
          <div className="relative inline-block shadow-2xl rounded-lg border border-white/10"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.15s' }}>
            <img src={callout.snapshot_image_url} alt={callout.name || 'Callout'} className="block"
              style={{ maxWidth: '88vw', maxHeight: '82vh', objectFit: 'contain' }} draggable={false} />
            <HighlightOverlay highlights={highlights} />
          </div>
        </div>
      </div>
      {callout.name && (
        <div className="absolute bottom-6 left-0 right-0 text-center z-40">
          <span className="text-slate-300 text-sm bg-black/70 px-4 py-1.5 rounded-full font-medium">{callout.name}</span>
        </div>
      )}
    </div>
  );
}

// ---------- Extract file + callout sidebar widget ----------
function ExtractFileWithCallouts({ extract, callouts, caseParties, proofItem, spotlightCallout, highlights, onSpotlightCallout, onSetAsProofCallout, isCurrentProofCallout }) {
  const extractFileUrl = extract?.extract_file_url || null;
  const isImage = extractFileUrl?.match(/\.(jpe?g|png|gif|webp)(\?|$)/i);

  return (
    <div className="rounded-lg border border-[#1e2a45] overflow-hidden bg-[#0a0f1e]">
      {spotlightCallout?.snapshot_image_url && (
        <SpotlightOverlay
          extractFileUrl={extractFileUrl}
          callout={spotlightCallout}
          highlights={highlights}
          onClose={() => onSpotlightCallout(null)}
        />
      )}
      <div className="flex" style={{ minHeight: '320px', maxHeight: '500px' }}>
        {/* Extract file */}
        <div className="flex-1 overflow-auto bg-[#080c18]">
          {extractFileUrl ? (
            isImage ? (
              <img src={extractFileUrl} alt={extract.extract_title_internal || extract.extract_title_official}
                className="block max-w-full" draggable={false} />
            ) : (
              <iframe src={extractFileUrl} title={extract.extract_title_internal || extract.extract_title_official}
                className="w-full" style={{ minHeight: '460px', border: 'none' }} />
            )
          ) : (
            <div className="flex items-center justify-center h-full min-h-[200px] text-slate-500">
              <div className="text-center space-y-2">
                <Image className="w-8 h-8 mx-auto opacity-20" />
                <p className="text-xs">No file uploaded</p>
              </div>
            </div>
          )}
        </div>
        {/* Callout sidebar */}
        {callouts.length > 0 && (
          <div className="w-32 flex-shrink-0 bg-[#0f1629] border-l border-[#1e2a45] overflow-y-auto">
            <div className="p-1.5 space-y-1.5">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold px-1 pt-1">
                Callouts ({callouts.length})
              </p>
              {callouts.map(c => {
                const witName = c.witness_id ? caseParties[c.witness_id] : null;
                const isActive = spotlightCallout?.id === c.id;
                const isLinkedProof = proofItem?.callout_id === c.id;
                return (
                  <button key={c.id} onClick={() => onSpotlightCallout(isActive ? null : c)}
                    className={`w-full text-left rounded-lg border p-1.5 transition-all space-y-1 ${
                      isActive ? 'border-amber-400 bg-amber-500/10' : 'border-[#1e2a45] hover:border-slate-500 hover:bg-[#131a2e]'
                    }`}>
                    {c.snapshot_image_url ? (
                      <div className="relative w-full aspect-video rounded overflow-hidden bg-black">
                        <img src={c.snapshot_image_url} alt={c.name} className="w-full h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-full aspect-video rounded bg-[#0a0f1e] flex items-center justify-center">
                        <Image className="w-3 h-3 text-slate-600" />
                      </div>
                    )}
                    {c.name && <p className="text-[9px] text-slate-300 truncate leading-tight">{c.name}</p>}
                    {witName && <p className="text-[9px] text-cyan-400 truncate leading-tight">{witName}</p>}
                    <div className="flex items-center gap-1 flex-wrap">
                      {isActive && <span className="text-[8px] text-amber-400 font-medium flex items-center gap-0.5"><Eye className="w-2 h-2" /> Active</span>}
                      {isLinkedProof && <CheckCircle2 className="w-2.5 h-2.5 text-cyan-400 ml-auto" />}
                    </div>
                    {isActive && !isCurrentProofCallout && (
                      <button onClick={(e) => { e.stopPropagation(); onSetAsProofCallout(); }}
                        className="w-full text-[8px] bg-cyan-700/50 hover:bg-cyan-600/60 text-cyan-300 rounded py-0.5 mt-0.5 transition-colors">
                        Set as Proof
                      </button>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProofViewerModal({ proofItem, isOpen, onClose, onCalloutSelected }) {
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

  useEffect(() => {
    if (isOpen && proofItem) {
      loadDetails();
      setViewingFile(null);
    } else {
      setDepoClip(null);setDeposition(null);setExtract(null);
      setExtractMeta(null);setCallouts([]);setHighlights([]);
      setSelectedCallout(null);setViewingFile(null);setCaseParties({});
    }
  }, [isOpen, proofItem?.id]);

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
    try {
      if (proofItem.type === 'depoClip') {
        const clips = await base44.entities.DepoClips.filter({ id: proofItem.source_id });
        if (clips.length > 0) {
          setDepoClip(clips[0]);
          if (clips[0].deposition_id) {
            const deps = await base44.entities.Depositions.filter({ id: clips[0].deposition_id });
            if (deps.length > 0) setDeposition(deps[0]);
          }
        }
      } else if (proofItem.type === 'extract') {
        // Also load all case parties so callout witness names can be resolved
        if (proofItem.case_id) {
          base44.entities.Parties.filter({ case_id: proofItem.case_id }).then(ps => {
            const map = {};
            ps.forEach(p => { map[p.id] = p.display_name || `${p.first_name || ''} ${p.last_name}`.trim(); });
            setCaseParties(map);
          });
        }
        const [extracts, cos] = await Promise.all([
        base44.entities.ExhibitExtracts.filter({ id: proofItem.source_id }),
        base44.entities.Callouts.filter({ extract_id: proofItem.source_id })]
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
        // Only pre-select a callout if the proof item explicitly has one linked
        const linked = proofItem.callout_id ? sorted.find((c) => c.id === proofItem.callout_id) : null;
        setSelectedCallout(linked || null);
      }
    } catch (err) {
      console.error('Error loading proof details:', err);
    }
    setLoading(false);
  };

  const handleSetAsProofCallout = async () => {
    if (!selectedCallout || !proofItem) return;
    await base44.entities.ProofItems.update(proofItem.id, { callout_id: selectedCallout.id });
    if (onCalloutSelected) onCalloutSelected(proofItem.id, selectedCallout);
    // Don't close — update local proofItem reference so badge shows immediately
    setCallouts(prev => [...prev]); // trigger re-render
  };

  const selectedCalloutIdx = callouts.findIndex((c) => c.id === selectedCallout?.id);
  const isCurrentProofCallout = proofItem?.callout_id && selectedCallout?.id === proofItem?.callout_id;

  const jx = extractMeta?.jointExhibit;

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

                {/* Extract file + callout sidebar */}
                <ExtractFileWithCallouts
                  extract={extract}
                  callouts={callouts}
                  caseParties={caseParties}
                  proofItem={proofItem}
                  spotlightCallout={selectedCallout}
                  highlights={highlights}
                  onSpotlightCallout={setSelectedCallout}
                  onSetAsProofCallout={handleSetAsProofCallout}
                  isCurrentProofCallout={isCurrentProofCallout}
                />



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

                {/* (callouts handled above in ExtractFileWithCallouts) */}

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