import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Image, ChevronLeft, ChevronRight, FileText } from 'lucide-react';

// ─── Depo Clip detail card ────────────────────────────────────────────────────
function ClipDetailCard({ clip, depositionName, deponentName, onAdd, loading }) {
  if (!clip) return null;
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        {clip.direction && (
          <Badge className={clip.direction === 'HelpsUs' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
            {clip.direction === 'HelpsUs' ? '✓ Helps Us' : '✗ Hurts Us'}
          </Badge>
        )}
        {clip.topic_tag && <Badge variant="outline" className="text-gray-600">{clip.topic_tag}</Badge>}
        {deponentName && <span className="text-xs text-blue-700 font-medium ml-auto">{deponentName}</span>}
      </div>
      {depositionName && (
        <p className="text-xs text-gray-500">Deposition: <span className="text-gray-700">{depositionName}</span></p>
      )}
      <div className="bg-white border border-gray-200 rounded p-3">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-3 h-3 text-blue-500" />
          <span className="text-[11px] font-semibold text-blue-600 tracking-wider uppercase">Testimony</span>
          <span className="text-[11px] text-gray-400 ml-auto font-mono">{clip.start_cite} – {clip.end_cite}</span>
        </div>
        <div className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
          {clip.clip_text || <span className="text-gray-400 italic">No transcript text</span>}
        </div>
      </div>
      {clip.notes && (
        <p className="text-xs text-gray-500 bg-yellow-50 border border-yellow-200 px-3 py-2 rounded">
          <span className="font-medium text-yellow-700">Notes: </span>{clip.notes}
        </p>
      )}
      <Button onClick={onAdd} disabled={loading} className="w-full bg-cyan-600 hover:bg-cyan-700">
        {loading ? 'Adding...' : 'Add This Clip'}
      </Button>
    </div>
  );
}

// ─── Callout picker (shared with extract panel) ───────────────────────────────
function CalloutPicker({ callouts, selectedCallout, setSelectedCallout, proofCalloutId, caseParties = {} }) {
  const [highlights, setHighlights] = useState([]);
  const idx = callouts.findIndex(c => c.id === selectedCallout?.id);

  useEffect(() => {
    if (selectedCallout?.id) {
      base44.entities.Highlights.filter({ callout_id: selectedCallout.id })
        .then(setHighlights).catch(() => setHighlights([]));
    } else {
      setHighlights([]);
    }
  }, [selectedCallout?.id]);

  if (callouts.length === 0) {
    return (
      <div className="text-center py-6 border border-dashed border-gray-300 rounded text-gray-400 text-sm">
        No callouts on this extract yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Callouts ({callouts.length})</span>
        <div className="flex items-center gap-2">
          {selectedCallout && (
            <button onClick={() => setSelectedCallout(null)}
              className="text-xs text-gray-400 hover:text-red-500 underline">
              No callout
            </button>
          )}
          {callouts.length > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={() => setSelectedCallout(callouts[Math.max(0, idx - 1)])}
                disabled={idx <= 0}
                className="text-xs px-2 py-1 text-gray-500 hover:text-gray-800 disabled:opacity-30">‹</button>
              <span className="text-xs text-gray-500">{idx + 1}/{callouts.length}</span>
              <button onClick={() => setSelectedCallout(callouts[Math.min(callouts.length - 1, idx + 1)])}
                disabled={idx >= callouts.length - 1}
                className="text-xs px-2 py-1 text-gray-500 hover:text-gray-800 disabled:opacity-30">›</button>
            </div>
          )}
        </div>
      </div>

      {/* Thumbnails */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {callouts.map((c, i) => {
          const witName = c.witness_id ? caseParties[c.witness_id] : null;
          return (
          <button key={c.id} onClick={() => setSelectedCallout(c)}
            className={`flex-shrink-0 rounded border-2 transition-all relative ${selectedCallout?.id === c.id ? 'border-cyan-500' : 'border-gray-200 hover:border-gray-400'}`}>
            {proofCalloutId === c.id && (
              <div className="absolute top-0.5 right-0.5 z-10">
                <CheckCircle2 className="w-3 h-3 text-cyan-500 bg-white rounded-full" />
              </div>
            )}
            {c.snapshot_image_url
              ? <img src={c.snapshot_image_url} alt={c.name || `Callout ${i + 1}`} className="h-14 w-18 object-cover rounded" />
              : <div className="h-14 w-18 flex items-center justify-center bg-gray-100 rounded px-3"><Image className="w-4 h-4 text-gray-400" /></div>
            }
            {c.name && <p className="text-[9px] text-gray-500 text-center px-1 pt-0.5 truncate max-w-[72px]">{c.name}</p>}
            {witName && <p className="text-[9px] text-blue-600 text-center px-1 pb-0.5 truncate max-w-[72px]">{witName}</p>}
          </button>
          );
        })}
      </div>

      {/* Selected callout */}
      {selectedCallout && (
        <div className={`border rounded p-2 ${selectedCallout.id === proofCalloutId ? 'border-cyan-400 bg-cyan-50' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-gray-700">{selectedCallout.name || `Callout – Pg ${selectedCallout.page_number}`}</span>
            <span className="text-xs text-gray-400">Pg {selectedCallout.page_number}</span>
          </div>
          <div className="relative">
            {selectedCallout.snapshot_image_url
              ? <img src={selectedCallout.snapshot_image_url} alt={selectedCallout.name} className="w-full max-h-64 object-contain rounded border border-gray-200 bg-black" />
              : <div className="h-32 flex items-center justify-center bg-gray-100 rounded text-gray-400 text-xs">No snapshot</div>
            }
            {highlights.map((hl, hi) =>
              (hl.rects_norm || []).map((r, ri) => {
                const colors = { yellow: 'rgba(253,224,71,', red: 'rgba(239,68,68,', green: 'rgba(34,197,94,', blue: 'rgba(59,130,246,' };
                const base = colors[hl.color] || colors.yellow;
                return (
                  <div key={`${hi}-${ri}`} style={{
                    position: 'absolute',
                    left: `${r.x * 100}%`, top: `${r.y * 100}%`,
                    width: `${r.w * 100}%`, height: `${r.h * 100}%`,
                    backgroundColor: `${base}${hl.opacity ?? 0.35})`,
                    pointerEvents: 'none',
                  }} />
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Extract detail panel ─────────────────────────────────────────────────────
function ExtractDetailPanel({ extract, caseId, selectedCallout, setSelectedCallout, onAdd, loading }) {
  const [meta, setMeta] = useState(null);
  const [callouts, setCallouts] = useState([]);
  const [metaLoading, setMetaLoading] = useState(false);
  const [caseParties, setCaseParties] = useState({});

  useEffect(() => {
    if (!extract) return;
    setMetaLoading(true);
    loadMeta();
  }, [extract?.id]);

  const loadMeta = async () => {
    try {
      const [sources, jxList, cos] = await Promise.all([
        base44.entities.ExtractSources.filter({ exhibit_extract_id: extract.id }),
        base44.entities.JointExhibits.filter({ exhibit_extract_id: extract.id }),
        base44.entities.Callouts.filter({ extract_id: extract.id }),
      ]);

      const primarySrc = sources[0] || null;
      const depoExhibitId = primarySrc?.source_depo_exhibit_id || extract.source_depo_exhibit_id;
      const deponentPartyId = primarySrc?.source_deponent_party_id;

      const [depoExhibits, parties] = await Promise.all([
        depoExhibitId ? base44.entities.DepositionExhibits.filter({ id: depoExhibitId }) : Promise.resolve([]),
        deponentPartyId ? base44.entities.Parties.filter({ id: deponentPartyId }) : Promise.resolve([]),
      ]);

      let sourceDepoExhibit = depoExhibits[0] || null;
      let deponent = parties[0] || null;

      if (!deponent && sourceDepoExhibit?.deponent_name) {
        deponent = { display_name: sourceDepoExhibit.deponent_name };
      }
      if (!deponent) {
        const ews = await base44.entities.ExtractWitnesses.filter({ extract_id: extract.id });
        if (ews.length > 0) {
          const pts = await base44.entities.Parties.filter({ id: ews[0].witness_id });
          if (pts.length > 0) deponent = pts[0];
        }
      }

      let jx = jxList[0] || null;
      if (!jx && depoExhibitId) {
        const [byPrimary, byMaster] = await Promise.all([
          base44.entities.JointExhibits.filter({ primary_depo_exhibit_id: depoExhibitId }),
          base44.entities.JointExhibits.filter({ master_exhibit_id: depoExhibitId }),
        ]);
        jx = byPrimary[0] || byMaster[0] || null;
      }

      let admittedRecord = null;
      if (jx) {
        const admRecs = await base44.entities.AdmittedExhibits.filter({ joint_exhibit_id: jx.id });
        admittedRecord = admRecs[0] || null;
      }

      const sorted = cos.sort((a, b) => (a.page_number || 0) - (b.page_number || 0));
      setCallouts(sorted);
      setSelectedCallout(null); // no callout pre-selected
      setMeta({ sourceDepoExhibit, deponent, primarySrc, jointExhibit: jx, admittedRecord });

      // Load all case parties for witness name resolution
      if (caseId) {
        const parts = await base44.entities.Parties.filter({ case_id: caseId });
        const map = {};
        parts.forEach(p => { map[p.id] = p.display_name || `${p.first_name || ''} ${p.last_name}`.trim(); });
        setCaseParties(map);
      }
    } catch (e) {
      console.error('Error loading extract meta:', e);
    }
    setMetaLoading(false);
  };

  if (!extract) return null;
  if (metaLoading) return <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>;

  const jx = meta?.jointExhibit;
  const adm = meta?.admittedRecord;
  const admNo = adm?.admitted_no || jx?.admitted_no;
  const admDate = adm?.date_admitted || jx?.admitted_date;
  const admBy = adm?.admitted_by_side || jx?.admitted_by;
  const isAdmitted = admNo || jx?.status === 'Admitted';

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-gray-800">{extract.extract_title_internal || extract.extract_title_official}</p>

      {/* 3-tile metadata */}
      {meta && (
        <div className="grid grid-cols-3 gap-2">
          {/* Original */}
          <div className="bg-gray-50 border border-gray-200 rounded p-2 flex flex-col gap-1">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Original</p>
            {meta.sourceDepoExhibit ? (
              <>
                <p className="text-base font-bold text-yellow-600">#{meta.primarySrc?.source_depo_exhibit_no || meta.sourceDepoExhibit.depo_exhibit_no}</p>
                <p className="text-[11px] text-gray-600 leading-tight">{meta.sourceDepoExhibit.depo_exhibit_title || '—'}</p>
                {meta.deponent && (
                  <p className="text-[11px] text-blue-600 font-medium">
                    {meta.deponent.display_name || `${meta.deponent.first_name || ''} ${meta.deponent.last_name || ''}`.trim()}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-gray-400 italic">Not linked</p>
            )}
          </div>

          {/* Marked */}
          <div className={`bg-gray-50 border rounded p-2 flex flex-col gap-1 ${jx ? 'border-yellow-400' : 'border-gray-200'}`}>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Marked</p>
            {jx ? (
              <>
                <p className="text-base font-bold text-yellow-600">#{jx.marked_no}</p>
                <p className="text-[11px] text-gray-600 leading-tight">{jx.internal_name || jx.marked_title || '—'}</p>
                {(meta.primarySrc?.referenced_pages || extract.extract_page_start) && (
                  <p className="text-[11px] text-gray-400">
                    pp. {meta.primarySrc?.referenced_pages || `${extract.extract_page_start}${extract.extract_page_end ? `–${extract.extract_page_end}` : ''}`}
                  </p>
                )}
                {extract.extract_page_count && <p className="text-[11px] text-gray-400">{extract.extract_page_count} pg</p>}
                <Badge className="mt-auto text-[9px] w-fit bg-yellow-100 text-yellow-700">{jx.status}</Badge>
              </>
            ) : (
              <p className="text-xs text-gray-400 italic">Not on joint list</p>
            )}
          </div>

          {/* Admitted */}
          <div className={`bg-gray-50 border rounded p-2 flex flex-col gap-1 ${isAdmitted ? 'border-green-400' : 'border-gray-200'}`}>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Admitted</p>
            {isAdmitted ? (
              <>
                {admNo && <p className="text-base font-bold text-green-600">#{admNo}</p>}
                {admDate && <p className="text-[11px] text-gray-600">{admDate}</p>}
                {admBy && <p className="text-[11px] text-gray-400">By: {admBy}</p>}
                <Badge className="mt-auto text-[9px] w-fit bg-green-100 text-green-700">✓ Admitted</Badge>
              </>
            ) : (
              <p className="text-xs text-gray-400 italic">Not admitted</p>
            )}
          </div>
        </div>
      )}

      {/* Callout picker */}
      <CalloutPicker
        callouts={callouts}
        selectedCallout={selectedCallout}
        setSelectedCallout={setSelectedCallout}
        proofCalloutId={null}
        caseParties={caseParties}
      />

      <Button onClick={onAdd} disabled={loading} className="w-full bg-cyan-600 hover:bg-cyan-700">
        {loading ? 'Adding...' : selectedCallout ? 'Add Extract with This Callout' : 'Add Extract'}
      </Button>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export default function AddProofModal({ isOpen, onClose, caseId, onProofAdded, evidenceGroupId }) {
  const [activeTab, setActiveTab] = useState('depoClips');
  const [depoClips, setDepoClips] = useState([]);
  const [extracts, setExtracts] = useState([]);
  const [depositions, setDepositions] = useState({});
  const [parties, setParties] = useState({});
  const [selectedClipId, setSelectedClipId] = useState(null);
  const [selectedExtractId, setSelectedExtractId] = useState(null);
  const [selectedCallout, setSelectedCallout] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadProof();
      setSelectedClipId(null);
      setSelectedExtractId(null);
      setSelectedCallout(null);
      setError('');
    }
  }, [isOpen, caseId]);

  const loadProof = async () => {
    setDataLoading(true);
    try {
      const [clips, exts, deps, parts] = await Promise.all([
        base44.entities.DepoClips.filter({ case_id: caseId }),
        base44.entities.ExhibitExtracts.filter({ case_id: caseId }),
        base44.entities.Depositions.filter({ case_id: caseId }),
        base44.entities.Parties.filter({ case_id: caseId }),
      ]);
      setDepoClips(clips);
      setExtracts(exts);
      // Build lookup maps
      const depMap = {};
      deps.forEach(d => { depMap[d.id] = d; });
      setDepositions(depMap);
      const partyMap = {};
      parts.forEach(p => { partyMap[p.id] = p; });
      setParties(partyMap);
    } catch (e) {
      console.error('Error loading proof:', e);
    }
    setDataLoading(false);
  };

  const selectedClip = depoClips.find(c => c.id === selectedClipId);
  const selectedExtract = extracts.find(e => e.id === selectedExtractId);

  const getClipDeponent = (clip) => {
    if (!clip) return null;
    const dep = depositions[clip.deposition_id];
    if (!dep) return null;
    const party = parties[dep.party_id];
    return party ? (party.display_name || `${party.first_name || ''} ${party.last_name}`.trim()) : dep.sheet_name;
  };

  const getClipDepositionName = (clip) => {
    if (!clip) return null;
    const dep = depositions[clip.deposition_id];
    return dep?.sheet_name || null;
  };

  const handleAddClip = async () => {
    if (!selectedClip || !evidenceGroupId) return;
    setLoading(true);
    setError('');
    try {
      const label = selectedClip.topic_tag || `${selectedClip.start_cite} - ${selectedClip.end_cite}`;

      // Always create a new ProofItem per evidence-group + source combo to avoid sharing
      let proofItem;
      const existing = await base44.entities.EvidenceGroupProofItems.filter({ evidence_group_id: evidenceGroupId });
      const existingProofIds = existing.map(l => l.proof_item_id);
      const existingInGroup = existingProofIds.length > 0
        ? await base44.entities.ProofItems.filter({ case_id: caseId, type: 'depoClip', source_id: selectedClip.id })
        : [];
      const alreadyInGroup = existingInGroup.find(p => existingProofIds.includes(p.id));

      if (alreadyInGroup) {
        proofItem = alreadyInGroup;
      } else {
        proofItem = await base44.entities.ProofItems.create({
          case_id: caseId,
          type: 'depoClip',
          source_id: selectedClip.id,
          label,
          notes: selectedClip.notes || '',
        });
        await base44.entities.EvidenceGroupProofItems.create({
          evidence_group_id: evidenceGroupId,
          proof_item_id: proofItem.id,
          order_index: 0,
        });
      }

      setLoading(false);
      onProofAdded(proofItem);
    } catch (err) {
      setError(err.message || 'Failed to add');
      setLoading(false);
    }
  };

  const handleAddExtract = async () => {
    if (!selectedExtract || !evidenceGroupId) return;
    setLoading(true);
    setError('');
    try {
      const label = selectedExtract.extract_title_internal || selectedExtract.extract_title_official;

      // Always create a brand-new ProofItem so each callout is a separate proof entry
      const proofItem = await base44.entities.ProofItems.create({
        case_id: caseId,
        type: 'extract',
        source_id: selectedExtract.id,
        label,
        notes: selectedExtract.notes || '',
        callout_id: selectedCallout?.id || undefined,
      });
      await base44.entities.EvidenceGroupProofItems.create({
        evidence_group_id: evidenceGroupId,
        proof_item_id: proofItem.id,
        order_index: 0,
      });

      setLoading(false);
      onProofAdded(proofItem);
    } catch (err) {
      setError(err.message || 'Failed to add');
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white border-gray-300">
        <DialogHeader>
          <DialogTitle className="text-gray-900">Add Proof to Bucket</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-300 rounded p-3 text-sm text-red-700">{error}</div>
        )}

        <Tabs value={activeTab} onValueChange={(t) => { setActiveTab(t); setSelectedClipId(null); setSelectedExtractId(null); setSelectedCallout(null); }}>
          <TabsList className="grid w-full grid-cols-2 bg-gray-100">
            <TabsTrigger value="depoClips" className="text-xs">Deposition Clips</TabsTrigger>
            <TabsTrigger value="extracts" className="text-xs">Exhibit Extracts</TabsTrigger>
          </TabsList>

          {/* ── DEPO CLIPS TAB ── */}
          <TabsContent value="depoClips" className="mt-4 space-y-3">
            {dataLoading ? (
              <div className="text-center py-4 text-gray-400 text-sm">Loading clips...</div>
            ) : (
              <>
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto border border-gray-200 rounded">
                  {depoClips.length === 0 && (
                    <p className="text-sm text-gray-400 p-3 text-center">No deposition clips found</p>
                  )}
                  {depoClips.map(clip => {
                    const deponent = getClipDeponent(clip);
                    const isSelected = selectedClipId === clip.id;
                    return (
                      <button key={clip.id} onClick={() => setSelectedClipId(isSelected ? null : clip.id)}
                        className={`text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-cyan-50 border-l-2 border-cyan-500' : 'border-l-2 border-transparent'}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 font-medium truncate">{clip.topic_tag || `${clip.start_cite} – ${clip.end_cite}`}</p>
                          {deponent && <p className="text-xs text-blue-600">{deponent}</p>}
                        </div>
                        {clip.direction && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${clip.direction === 'HelpsUs' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {clip.direction === 'HelpsUs' ? 'Helps' : 'Hurts'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedClip && (
                  <ClipDetailCard
                    clip={selectedClip}
                    depositionName={getClipDepositionName(selectedClip)}
                    deponentName={getClipDeponent(selectedClip)}
                    onAdd={handleAddClip}
                    loading={loading}
                  />
                )}
              </>
            )}
          </TabsContent>

          {/* ── EXTRACTS TAB ── */}
          <TabsContent value="extracts" className="mt-4 space-y-3">
            {dataLoading ? (
              <div className="text-center py-4 text-gray-400 text-sm">Loading extracts...</div>
            ) : (
              <>
                <div className="flex flex-col gap-1 max-h-40 overflow-y-auto border border-gray-200 rounded">
                  {extracts.length === 0 && (
                    <p className="text-sm text-gray-400 p-3 text-center">No exhibit extracts found</p>
                  )}
                  {extracts.map(ext => {
                    const isSelected = selectedExtractId === ext.id;
                    return (
                      <button key={ext.id} onClick={() => { setSelectedExtractId(isSelected ? null : ext.id); setSelectedCallout(null); }}
                        className={`text-left px-3 py-2 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-cyan-50 border-l-2 border-cyan-500' : 'border-l-2 border-transparent'}`}>
                        <p className="text-sm text-gray-800 font-medium">{ext.extract_title_internal || ext.extract_title_official}</p>
                        {ext.extract_title_internal && ext.extract_title_official && (
                          <p className="text-xs text-gray-400">{ext.extract_title_official}</p>
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedExtract && (
                  <ExtractDetailPanel
                    key={selectedExtract.id}
                    extract={selectedExtract}
                    caseId={caseId}
                    selectedCallout={selectedCallout}
                    setSelectedCallout={setSelectedCallout}
                    onAdd={handleAddExtract}
                    loading={loading}
                  />
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}