import React, { useState, useEffect, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Plus, Edit2, Trash2, Upload, FileText,
  ChevronDown, ChevronRight, CheckSquare, List,
  Highlighter, StickyNote, ExternalLink, MinusCircle,
  Users, Star, Link2, User
} from "lucide-react";
import useActiveCase from "@/components/hooks/useActiveCase";
import CalloutEditor from "@/components/extracts/CalloutEditor";
import FileViewerModal from "@/components/exhibits/FileViewerModal";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";

const fmtDate = (d) => { try { return format(new Date(d), "MMM d, yyyy"); } catch { return d || "—"; } };

const EMPTY_EXTRACT = {
  extract_title_official: "",
  extract_title_internal: "",
  source_depo_exhibit_id: "",
  source_depo_exhibit_ids: [],
  primary_depo_exhibit_id: "",
  extract_page_start: "",
  extract_page_end: "",
  extract_page_count: "",
  extract_file_url: "",
  notes: "",
  _groupName: null, // UI-only: if set, this came from a group
};

const EMPTY_JOINT = { marked_no: "", marked_title: "", marked_by_side: "Plaintiff", pages: "", notes: "" };
const EMPTY_ADMIT = { admitted_no: "", admitted_by_side: "Plaintiff", date_admitted: new Date().toISOString().split("T")[0], notes: "" };

// ── Depo group selector component ──────────────────────────────────────────────
function DepoGroupSelector({ depoExhibits, selectedIds, primaryId, onChange, onPrimaryChange }) {
  const toggle = (id) => {
    const next = selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id];
    onChange(next);
    // Auto-set primary if cleared or not in new list
    if (primaryId && !next.includes(primaryId)) onPrimaryChange(next[0] || "");
    if (!primaryId && next.length) onPrimaryChange(next[0]);
  };

  // Group depos by group_name
  const grouped = useMemo(() => {
    const g = {};
    depoExhibits.forEach(d => {
      const key = d.group_name || "__ungrouped__";
      if (!g[key]) g[key] = [];
      g[key].push(d);
    });
    return g;
  }, [depoExhibits]);

  return (
    <div className="border border-[#1e2a45] rounded-lg max-h-52 overflow-y-auto">
      {Object.entries(grouped).map(([gName, items]) => (
        <div key={gName}>
          {gName !== "__ungrouped__" && (
            <div className="px-3 py-1 bg-[#0a0f1e] border-b border-[#1e2a45] text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Users className="w-3 h-3" /> {gName}
            </div>
          )}
          {items.map(de => {
            const isSelected = selectedIds.includes(de.id);
            const isPrimary = primaryId === de.id;
            const hasFile = !!(de.file_url || de.external_link);
            return (
              <div key={de.id}
                className={`flex items-center gap-2 px-3 py-2 border-b border-[#1e2a45] last:border-0 cursor-pointer hover:bg-[#131a2e] transition-colors ${isSelected ? "bg-[#0f1629]" : ""}`}
                onClick={() => toggle(de.id)}>
                <input type="checkbox" checked={isSelected} onChange={() => {}} className="accent-cyan-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-200 truncate">
                    {de.depo_exhibit_no ? <span className="text-cyan-400 font-mono mr-1">#{de.depo_exhibit_no}</span> : null}
                    {de.display_title || de.depo_exhibit_title}
                  </p>
                  {de.deponent_name && <p className="text-[10px] text-slate-500 truncate">{de.deponent_name}</p>}
                  {!hasFile && <p className="text-[10px] text-amber-500/60">no file</p>}
                </div>
                {isSelected && (
                  <button
                    onClick={e => { e.stopPropagation(); onPrimaryChange(de.id); }}
                    title="Set as primary attachment"
                    className={`p-1 rounded flex-shrink-0 ${isPrimary ? "text-amber-400" : "text-slate-600 hover:text-amber-300"}`}>
                    <Star className={`w-3.5 h-3.5 ${isPrimary ? "fill-amber-400" : ""}`} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ))}
      {depoExhibits.length === 0 && (
        <p className="text-xs text-slate-600 p-3 text-center">No depo exhibits found.</p>
      )}
    </div>
  );
}

// ── Callout summary row (for collapsed extract view) ──────────────────────────
function CalloutSummary({ extractId, parties }) {
  const [callouts, setCallouts] = useState([]);
  useEffect(() => {
    if (!extractId) return;
    base44.entities.Callouts.filter({ extract_id: extractId }).then(cs => {
      setCallouts(cs.sort((a, b) => (a.page_number ?? 0) - (b.page_number ?? 0)));
    });
  }, [extractId]);

  if (!callouts.length) return null;

  const witName = (wid) => {
    if (!wid || !parties) return null;
    const p = parties.find(x => x.id === wid);
    return p ? (p.display_name || `${p.first_name || ""} ${p.last_name}`.trim()) : null;
  };

  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {callouts.map(c => (
        <span key={c.id} className="inline-flex items-center gap-1 text-[10px] bg-orange-900/20 border border-orange-700/20 text-orange-300/80 px-1.5 py-0.5 rounded">
          <StickyNote className="w-2.5 h-2.5 flex-shrink-0" />
          {c.name || `p.${c.page_number}`}
          {witName(c.witness_id) && (
            <span className="text-cyan-400/70 flex items-center gap-0.5">
              <User className="w-2 h-2" />{witName(c.witness_id)}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

export default function Extracts() {
  const { activeCase } = useActiveCase();
  const [extracts, setExtracts] = useState([]);
  const [joints, setJoints] = useState([]);
  const [admitted, setAdmitted] = useState([]);
  const [depoExhibits, setDepoExhibits] = useState([]);
  const [parties, setParties] = useState([]);
  const [calloutCounts, setCalloutCounts] = useState({}); // extractId -> count

  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  // Dialogs
  const [editExtract, setEditExtract] = useState(null);
  const [markJointDialog, setMarkJointDialog] = useState(null);
  const [jointForm, setJointForm] = useState({ ...EMPTY_JOINT });
  const [admitDialog, setAdmitDialog] = useState(null);
  const [admitForm, setAdmitForm] = useState({ ...EMPTY_ADMIT });
  const [viewFile, setViewFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pendingDepoId, setPendingDepoId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("newExtractFromDepo") || null;
  });

  // Auto-open new extract dialog if navigated from Depo Exhibits
  useEffect(() => {
    if (pendingDepoId && depoExhibits.length > 0) {
      const depo = depoExhibits.find(d => d.id === pendingDepoId);
      const groupName = depo?.group_name || null;
      // If the depo exhibit is part of a group, pre-select all exhibits in that group
      const groupExhibits = groupName
        ? depoExhibits.filter(d => d.group_name === groupName)
        : [depo].filter(Boolean);
      const groupIds = groupExhibits.map(d => d.id);
      setEditExtract({
        ...EMPTY_EXTRACT,
        source_depo_exhibit_id: pendingDepoId,
        source_depo_exhibit_ids: groupIds,
        primary_depo_exhibit_id: pendingDepoId,
        extract_title_official: groupName || (depo ? (depo.display_title || depo.depo_exhibit_title || "") : ""),
        _groupName: groupName,
      });
      setPendingDepoId(null);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [pendingDepoId, depoExhibits]);

  const load = useCallback(async () => {
    if (!activeCase) return;
    const cid = activeCase.id;
    const [exs, jo, ad, de, pts, callouts] = await Promise.all([
      base44.entities.ExhibitExtracts.filter({ case_id: cid }),
      base44.entities.JointExhibits.filter({ case_id: cid }),
      base44.entities.AdmittedExhibits.filter({ case_id: cid }),
      base44.entities.DepositionExhibits.filter({ case_id: cid }),
      base44.entities.Parties.filter({ case_id: cid }),
      base44.entities.Callouts.filter({ case_id: cid }),
    ]);
    setExtracts(exs);
    setJoints(jo);
    setAdmitted(ad);
    setDepoExhibits(de);
    setParties(pts);
    const counts = {};
    callouts.forEach(c => { counts[c.extract_id] = (counts[c.extract_id] || 0) + 1; });
    setCalloutCounts(counts);
  }, [activeCase]);

  useEffect(() => { load(); }, [load]);

  // Lookup maps
  const jointByExtractId = useMemo(() => {
    const m = {};
    joints.forEach(j => { if (j.exhibit_extract_id) m[j.exhibit_extract_id] = j; });
    return m;
  }, [joints]);

  const admittedByJointId = useMemo(() => {
    const m = {};
    admitted.forEach(a => { m[a.joint_exhibit_id] = a; });
    return m;
  }, [admitted]);

  const depoById = useMemo(() => {
    const m = {};
    depoExhibits.forEach(d => { m[d.id] = d; });
    return m;
  }, [depoExhibits]);

  // Which depo exhibit IDs are already in the joint list (via JointExhibits entity or extract source)
  const markedDepoIds = useMemo(() => {
    const ids = new Set();
    joints.forEach(j => {
      (j.source_depo_exhibit_ids || []).forEach(id => ids.add(id));
      if (j.primary_depo_exhibit_id) ids.add(j.primary_depo_exhibit_id);
    });
    extracts.forEach(ex => {
      (ex.source_depo_exhibit_ids || []).forEach(id => ids.add(id));
      if (ex.source_depo_exhibit_id) ids.add(ex.source_depo_exhibit_id);
      if (ex.primary_depo_exhibit_id) ids.add(ex.primary_depo_exhibit_id);
    });
    return ids;
  }, [joints, extracts]);

  const depoLabel = (id) => {
    const de = depoById[id];
    if (!de) return "—";
    return `${de.depo_exhibit_no ? `#${de.depo_exhibit_no} ` : ""}${de.display_title || de.depo_exhibit_title || ""}`.trim();
  };

  // Get effective file URL for an extract (uploaded file first, then primary depo exhibit file)
  const getFileUrl = (ex) => {
    if (ex.extract_file_url) return { url: ex.extract_file_url, isUpload: true };
    const primaryId = ex.primary_depo_exhibit_id || ex.source_depo_exhibit_id;
    const de = primaryId ? depoById[primaryId] : null;
    if (de?.file_url) return { url: de.file_url, isUpload: false };
    if (de?.external_link) return { url: de.external_link, isUpload: false };
    return null;
  };

  // Enriched extracts
  const enriched = useMemo(() => extracts.map(ex => {
    const joint = jointByExtractId[ex.id] || null;
    const admRec = joint ? (admittedByJointId[joint.id] || null) : null;
    const status = admRec ? "admitted" : joint ? "joint" : "working";
    const fileInfo = getFileUrl(ex);
    return { ...ex, _joint: joint, _admRec: admRec, _status: status, _fileInfo: fileInfo };
  }), [extracts, jointByExtractId, admittedByJointId, depoById]);

  const filtered = useMemo(() => enriched.filter(ex => {
    if (filterTab === "joint" && ex._status === "working") return false;
    if (filterTab === "admitted" && ex._status !== "admitted") return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return [ex.extract_title_official, ex.extract_title_internal, ex._joint?.marked_no, ex._admRec?.admitted_no, ex.notes]
      .some(v => v?.toLowerCase().includes(q));
  }), [enriched, filterTab, search]);

  // ── Extract CRUD ──
  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setEditExtract(prev => ({ ...prev, extract_file_url: file_url }));
    setUploading(false);
  };

  const saveExtract = async () => {
    if (!editExtract || !activeCase) return;
    setSaving(true);
    const useGroup = editExtract._useGroup;
    const payload = {
      case_id: activeCase.id,
      extract_title_official: editExtract.extract_title_official,
      extract_title_internal: editExtract.extract_title_internal,
      notes: editExtract.notes,
      extract_file_url: editExtract.extract_file_url || null,
      extract_page_start: editExtract.extract_page_start ? Number(editExtract.extract_page_start) : null,
      extract_page_end: editExtract.extract_page_end ? Number(editExtract.extract_page_end) : null,
      extract_page_count: editExtract.extract_page_count ? Number(editExtract.extract_page_count) : null,
    };
    if (useGroup) {
      payload.source_depo_exhibit_ids = editExtract.source_depo_exhibit_ids || [];
      payload.primary_depo_exhibit_id = editExtract.primary_depo_exhibit_id || null;
      payload.source_depo_exhibit_id = editExtract.primary_depo_exhibit_id || null; // keep legacy in sync
    } else {
      payload.source_depo_exhibit_id = editExtract.source_depo_exhibit_id || null;
      payload.source_depo_exhibit_ids = editExtract.source_depo_exhibit_id ? [editExtract.source_depo_exhibit_id] : [];
      payload.primary_depo_exhibit_id = null;
    }
    if (editExtract.id) {
      await base44.entities.ExhibitExtracts.update(editExtract.id, payload);
    } else {
      await base44.entities.ExhibitExtracts.create(payload);
    }
    setEditExtract(null);
    setSaving(false);
    load();
  };

  const removeExtract = async (ex) => {
    if (!confirm(`Delete extract "${ex.extract_title_official}"? This will also remove its Joint List entry if any.`)) return;
    const joint = jointByExtractId[ex.id];
    if (joint) {
      const admRec = admittedByJointId[joint.id];
      if (admRec) await base44.entities.AdmittedExhibits.delete(admRec.id);
      await base44.entities.JointExhibits.delete(joint.id);
    }
    await base44.entities.ExhibitExtracts.delete(ex.id);
    load();
  };

  const openEditExtract = (ex) => {
    const groupIds = ex.source_depo_exhibit_ids?.length
      ? ex.source_depo_exhibit_ids
      : ex.source_depo_exhibit_id ? [ex.source_depo_exhibit_id] : [];
    // Detect group name from source exhibits
    const firstDepo = depoById[ex.primary_depo_exhibit_id || groupIds[0]];
    const groupName = firstDepo?.group_name || null;
    setEditExtract({
      ...ex,
      source_depo_exhibit_ids: groupIds,
      _groupName: groupName,
    });
  };

  // ── Mark as Joint ──
  const openMarkJoint = (ex) => {
    setMarkJointDialog(ex);
    setJointForm({ ...EMPTY_JOINT, marked_title: ex.extract_title_official });
  };

  const saveMarkJoint = async () => {
    if (!markJointDialog || !activeCase) return;
    setSaving(true);
    await base44.entities.JointExhibits.create({
      case_id: activeCase.id,
      exhibit_extract_id: markJointDialog.id,
      marked_no: jointForm.marked_no,
      marked_title: jointForm.marked_title || markJointDialog.extract_title_official,
      marked_by_side: jointForm.marked_by_side,
      pages: jointForm.pages || null,
      notes: jointForm.notes || null,
      status: "Marked",
    });
    setMarkJointDialog(null);
    setSaving(false);
    load();
  };

  const removeFromJoint = async (ex) => {
    const joint = jointByExtractId[ex.id];
    if (!joint || !confirm(`Remove "${ex.extract_title_official}" from the Joint List?`)) return;
    const admRec = admittedByJointId[joint.id];
    if (admRec) await base44.entities.AdmittedExhibits.delete(admRec.id);
    await base44.entities.JointExhibits.delete(joint.id);
    load();
  };

  // ── Admit ──
  const openAdmit = (ex) => {
    const joint = jointByExtractId[ex.id];
    if (!joint) return;
    setAdmitDialog({ extract: ex, joint });
    setAdmitForm({ ...EMPTY_ADMIT });
  };

  const saveAdmit = async () => {
    if (!admitDialog || !activeCase) return;
    setSaving(true);
    await base44.entities.AdmittedExhibits.create({
      ...admitForm, case_id: activeCase.id, joint_exhibit_id: admitDialog.joint.id,
    });
    await base44.entities.JointExhibits.update(admitDialog.joint.id, {
      status: "Admitted", admitted_no: admitForm.admitted_no,
    });
    setAdmitDialog(null);
    setSaving(false);
    load();
  };

  const removeAdmit = async (ex) => {
    const joint = jointByExtractId[ex.id];
    const admRec = joint ? admittedByJointId[joint.id] : null;
    if (!admRec || !confirm("Remove admission? Exhibit will revert to Joint (Marked) status.")) return;
    await base44.entities.AdmittedExhibits.delete(admRec.id);
    await base44.entities.JointExhibits.update(joint.id, { status: "Marked", admitted_no: null });
    load();
  };

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  const counts = {
    all: enriched.length,
    joint: enriched.filter(e => e._status !== "working").length,
    admitted: enriched.filter(e => e._status === "admitted").length
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-200">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0f1629] border-b border-[#1e2a45] px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-400" /> Extracts & Joint List
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{filtered.length} shown · {counts.joint} on joint list · {counts.admitted} admitted</p>
          </div>
          <Button onClick={() => setEditExtract({ ...EMPTY_EXTRACT })}
            className="bg-emerald-600/20 text-emerald-400 border border-emerald-600/40 hover:bg-emerald-600/30 gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" /> New Extract
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-[#0a0f1e] rounded-lg p-1 border border-[#1e2a45]">
            {[{ key: "all", label: "All" }, { key: "joint", label: "Joint List" }, { key: "admitted", label: "Admitted" }].map(tab => (
              <button key={tab.key} onClick={() => setFilterTab(tab.key)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  filterTab === tab.key ? "bg-cyan-600/20 text-cyan-400 border border-cyan-600/30" : "text-slate-500 hover:text-slate-300"
                }`}>
                {tab.label} <span className="text-[10px] ml-0.5 opacity-60">{counts[tab.key]}</span>
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="pl-8 h-8 bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-xs" />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="px-6 py-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="border border-dashed border-[#1e2a45] rounded-xl p-12 text-center text-slate-600">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>{extracts.length === 0 ? "No extracts yet." : "No extracts match this filter."}</p>
          </div>
        ) : filtered.map(ex => {
          const joint = ex._joint;
          const admRec = ex._admRec;
          const isExpanded = expandedId === ex.id;
          const fileInfo = ex._fileInfo;
          const groupIds = ex.source_depo_exhibit_ids || [];
          const primaryDepo = ex.primary_depo_exhibit_id ? depoById[ex.primary_depo_exhibit_id]
            : ex.source_depo_exhibit_id ? depoById[ex.source_depo_exhibit_id] : null;

          return (
            <div key={ex.id} className={`bg-[#0f1629] border rounded-xl transition-colors ${
              ex._status === "admitted" ? "border-green-500/30 hover:border-green-500/50" :
              ex._status === "joint" ? "border-cyan-500/20 hover:border-cyan-500/40" :
              "border-[#1e2a45] hover:border-emerald-600/30"
            }`}>
              {/* Row */}
              <div className="p-4 flex items-start gap-3">
                <button onClick={() => setExpandedId(isExpanded ? null : ex.id)}
                  className="mt-0.5 text-slate-500 hover:text-slate-200 flex-shrink-0">
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-emerald-400" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                {/* Main info */}
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : ex.id)}>
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-100">{ex.extract_title_official}</p>
                    {admRec && <Badge className="text-[10px] bg-green-500/20 text-green-400 border-green-500/30">Ex. {admRec.admitted_no || joint?.admitted_no}</Badge>}
                    {joint && !admRec && <Badge className="text-[10px] bg-cyan-500/20 text-cyan-400 border-cyan-500/30">Joint #{joint.marked_no}</Badge>}
                  </div>
                  {ex.extract_title_internal && (
                    <p className="text-xs text-slate-500 italic mt-0.5">"{ex.extract_title_internal}"</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-1 items-center">
                    {/* Source info */}
                    {groupIds.length > 1 ? (
                      <span className="flex items-center gap-1 text-[10px] text-slate-500">
                        <Users className="w-3 h-3" /> {groupIds.length} source exhibits
                        {primaryDepo && <span className="text-slate-600">· primary: {depoLabel(primaryDepo.id)}</span>}
                      </span>
                    ) : primaryDepo ? (
                      <span className="text-[10px] text-slate-600">Source: {depoLabel(primaryDepo.id)}</span>
                    ) : null}
                    {(ex.extract_page_start || ex.extract_page_end) && (
                      <span className="text-[10px] text-slate-500">pp. {ex.extract_page_start}–{ex.extract_page_end}</span>
                    )}
                    {/* Callout count */}
                    {(calloutCounts[ex.id] || 0) > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-orange-400/70">
                        <StickyNote className="w-3 h-3" />{calloutCounts[ex.id]} callout{calloutCounts[ex.id] > 1 ? "s" : ""}
                      </span>
                    )}
                    {fileInfo && (
                      <button onClick={e => { e.stopPropagation(); setViewFile({ url: fileInfo.url, title: ex.extract_title_official }); }}
                        className={`text-[10px] flex items-center gap-0.5 hover:underline ${fileInfo.isUpload ? "text-emerald-400" : "text-cyan-400"}`}>
                        <ExternalLink className="w-3 h-3" /> {fileInfo.isUpload ? "View Shortened File" : "View File"}
                      </button>
                    )}
                  </div>
                  {/* Callout pills (collapsed view) */}
                  {!isExpanded && <CalloutSummary extractId={ex.id} parties={parties} />}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  {admRec ? (
                    <div className="text-right mr-1">
                      <span className="text-[10px] text-green-400 font-semibold block">Ex. {admRec.admitted_no}</span>
                      <span className="text-[9px] text-slate-600">{fmtDate(admRec.date_admitted)}</span>
                    </div>
                  ) : joint ? (
                    <button onClick={() => openAdmit(ex)}
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-colors">
                      <CheckSquare className="w-3 h-3" /> Admit
                    </button>
                  ) : (
                    <button onClick={() => openMarkJoint(ex)}
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-colors">
                      <List className="w-3 h-3" /> Add to Joint List
                    </button>
                  )}
                  <Link to={createPageUrl(`AnnotatePage?extractId=${ex.id}`)}
                    className="p-1.5 text-slate-500 hover:text-orange-400" title="Annotate">
                    <Highlighter className="w-3.5 h-3.5" />
                  </Link>
                  <button onClick={() => openEditExtract(ex)} className="p-1.5 text-slate-500 hover:text-slate-200">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => removeExtract(ex)} className="p-1.5 text-slate-500 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Expanded */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-[#1e2a45]">
                  {/* Joint/Admit info strip */}
                  {joint && (
                    <div className={`mt-3 mb-3 rounded-lg p-3 text-xs flex flex-wrap gap-4 items-start ${
                      admRec ? "bg-green-500/5 border border-green-500/20" : "bg-cyan-500/5 border border-cyan-500/20"
                    }`}>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Joint List</p>
                        <p className="text-cyan-400 font-semibold">#{joint.marked_no}</p>
                        <p className="text-slate-400">{joint.marked_title}</p>
                        <p className="text-slate-500">{joint.marked_by_side}{joint.pages ? ` · pp. ${joint.pages}` : ""}</p>
                      </div>
                      {admRec && (
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Admitted</p>
                          <p className="text-green-400 font-semibold">Ex. {admRec.admitted_no}</p>
                          <p className="text-slate-400">{fmtDate(admRec.date_admitted)} · {admRec.admitted_by_side}</p>
                        </div>
                      )}
                      <div className="ml-auto flex gap-3 self-start">
                        {admRec && <button onClick={() => removeAdmit(ex)} className="text-[10px] text-slate-500 hover:text-red-400">Remove Admission</button>}
                        <button onClick={() => removeFromJoint(ex)} className="flex items-center gap-0.5 text-[10px] text-slate-500 hover:text-orange-400">
                          <MinusCircle className="w-3 h-3" /> Remove from Joint List
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Source exhibits group accordion */}
                  {groupIds.length > 1 && (
                    <SourceGroupAccordion
                      ids={groupIds}
                      primaryId={ex.primary_depo_exhibit_id}
                      depoById={depoById}
                      onViewFile={(url, title) => setViewFile({ url, title })}
                    />
                  )}

                  <CalloutEditor extract={ex} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {viewFile && <FileViewerModal url={viewFile.url} title={viewFile.title} onClose={() => setViewFile(null)} />}

      {/* ── New/Edit Extract Dialog ── */}
      <Dialog open={!!editExtract} onOpenChange={() => setEditExtract(null)}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-emerald-400 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {editExtract?.id ? "Edit Extract" : "New Extract"}
            </DialogTitle>
          </DialogHeader>
          {editExtract && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-slate-400 block mb-1">Official Title (judge-facing)*</Label>
                <Input value={editExtract.extract_title_official}
                  onChange={e => setEditExtract(p => ({ ...p, extract_title_official: e.target.value }))}
                  className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"
                  placeholder="Traffic Control Signal Log – Intersection A" />
              </div>
              <div>
                <Label className="text-xs text-slate-400 block mb-1">Internal Name</Label>
                <Input value={editExtract.extract_title_internal || ""}
                  onChange={e => setEditExtract(p => ({ ...p, extract_title_internal: e.target.value }))}
                  className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"
                  placeholder="Sightlines blocked" />
              </div>

              {/* Source Depo Exhibit(s) */}
              <div>
                <Label className="text-xs text-slate-400 block mb-1.5">Source Depo Exhibit(s)</Label>
                {editExtract._groupName ? (
                  // Group mode: show only exhibits from this group, let user pick primary
                  <div>
                    <p className="text-[10px] text-slate-400 mb-1.5 flex items-center gap-1">
                      <Users className="w-3 h-3 text-indigo-400" />
                      Group: <span className="text-indigo-300 font-medium">{editExtract._groupName}</span>
                      <span className="text-slate-600 ml-1">— star the exhibit whose file should be the primary attachment</span>
                    </p>
                    <DepoGroupSelector
                      depoExhibits={depoExhibits.filter(d => d.group_name === editExtract._groupName)}
                      selectedIds={editExtract.source_depo_exhibit_ids || []}
                      primaryId={editExtract.primary_depo_exhibit_id || ""}
                      onChange={ids => setEditExtract(p => ({ ...p, source_depo_exhibit_ids: ids }))}
                      onPrimaryChange={id => setEditExtract(p => ({ ...p, primary_depo_exhibit_id: id }))}
                    />
                    {(editExtract.source_depo_exhibit_ids || []).length > 0 && !editExtract.extract_file_url && (
                      <p className="text-[10px] text-slate-500 mt-1.5">
                        Primary file: <span className="text-cyan-400">{depoLabel(editExtract.primary_depo_exhibit_id || editExtract.source_depo_exhibit_ids[0])}</span>'s attachment
                      </p>
                    )}
                  </div>
                ) : (
                  // Single mode
                  <Select value={editExtract.source_depo_exhibit_id || "none"}
                    onValueChange={v => setEditExtract(p => ({ ...p, source_depo_exhibit_id: v === "none" ? "" : v, source_depo_exhibit_ids: v === "none" ? [] : [v] }))}>
                    <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-xs">
                      <SelectValue placeholder="Select source exhibit…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {depoExhibits.map(de => (
                        <SelectItem key={de.id} value={de.id}>
                          {de.depo_exhibit_no ? `#${de.depo_exhibit_no} ` : ""}{de.display_title || de.depo_exhibit_title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-xs text-slate-400 block mb-1">Page Start</Label>
                  <Input type="number" value={editExtract.extract_page_start || ""}
                    onChange={e => setEditExtract(p => ({ ...p, extract_page_start: e.target.value }))}
                    className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" placeholder="1" />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-slate-400 block mb-1">Page End</Label>
                  <Input type="number" value={editExtract.extract_page_end || ""}
                    onChange={e => setEditExtract(p => ({ ...p, extract_page_end: e.target.value }))}
                    className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" placeholder="20" />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-slate-400 block mb-1">Page Count</Label>
                  <Input type="number" value={editExtract.extract_page_count || ""}
                    onChange={e => setEditExtract(p => ({ ...p, extract_page_count: e.target.value }))}
                    className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" placeholder="—" />
                </div>
              </div>

              <div>
                <Label className="text-xs text-slate-400 block mb-1">
                  Upload Shortened Extract File <span className="text-slate-600">(optional — used instead of the full original in Extracts & Joint List views; original always preserved in Depo Exhibits)</span>
                </Label>
                <div className="flex gap-2 items-center">
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={e => handleUpload(e.target.files?.[0])}
                    className="hidden" id="extract-file-input" />
                  <label htmlFor="extract-file-input"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1e2a45] hover:bg-[#263450] text-slate-300 text-xs cursor-pointer border border-[#2e3a55]">
                    <Upload className="w-3.5 h-3.5" />
                    {uploading ? "Uploading…" : "Upload File"}
                  </label>
                  {editExtract.extract_file_url && (
                    <a href={editExtract.extract_file_url} target="_blank" rel="noreferrer"
                      className="text-xs text-emerald-400 hover:underline truncate max-w-[160px]">View uploaded file</a>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-xs text-slate-400 block mb-1">Notes</Label>
                <Textarea value={editExtract.notes || ""}
                  onChange={e => setEditExtract(p => ({ ...p, notes: e.target.value }))}
                  className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditExtract(null)} className="border-[#1e2a45]">Cancel</Button>
            <Button onClick={saveExtract} disabled={saving || !editExtract?.extract_title_official}
              className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add to Joint List Dialog ── */}
      <Dialog open={!!markJointDialog} onOpenChange={() => setMarkJointDialog(null)}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-cyan-400 flex items-center gap-2">
              <List className="w-4 h-4" /> Add to Joint List
            </DialogTitle>
            {markJointDialog && <p className="text-xs text-slate-500 mt-1">{markJointDialog.extract_title_official}</p>}
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-400 block mb-1">Marked # *</Label>
                <Input value={jointForm.marked_no}
                  onChange={e => setJointForm(p => ({ ...p, marked_no: e.target.value }))}
                  placeholder="e.g. 47" className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" autoFocus />
              </div>
              <div>
                <Label className="text-xs text-slate-400 block mb-1">Marked By</Label>
                <Select value={jointForm.marked_by_side} onValueChange={v => setJointForm(p => ({ ...p, marked_by_side: v }))}>
                  <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{["Plaintiff","Defense","Unknown"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-400 block mb-1">Trial Title</Label>
              <Input value={jointForm.marked_title}
                onChange={e => setJointForm(p => ({ ...p, marked_title: e.target.value }))}
                className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
            </div>
            <div>
              <Label className="text-xs text-slate-400 block mb-1">Pages <span className="text-slate-600">(optional, e.g. "1-5")</span></Label>
              <Input value={jointForm.pages}
                onChange={e => setJointForm(p => ({ ...p, pages: e.target.value }))}
                placeholder="All pages" className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkJointDialog(null)} className="border-[#1e2a45]">Cancel</Button>
            <Button onClick={saveMarkJoint} disabled={saving || !jointForm.marked_no} className="bg-cyan-600 hover:bg-cyan-700">
              {saving ? "Saving…" : "Add to Joint List"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Admit Dialog ── */}
      <Dialog open={!!admitDialog} onOpenChange={() => setAdmitDialog(null)}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-green-400 flex items-center gap-2">
              <CheckSquare className="w-4 h-4" /> Admit Exhibit
            </DialogTitle>
            {admitDialog && (
              <p className="text-xs text-slate-500 mt-1">
                Joint #{admitDialog.joint.marked_no} — {admitDialog.joint.marked_title}
              </p>
            )}
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-400 block mb-1">Admitted # *</Label>
                <Input value={admitForm.admitted_no}
                  onChange={e => setAdmitForm(p => ({ ...p, admitted_no: e.target.value }))}
                  placeholder="e.g. 200" className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" autoFocus />
              </div>
              <div>
                <Label className="text-xs text-slate-400 block mb-1">Date Admitted</Label>
                <Input type="date" value={admitForm.date_admitted}
                  onChange={e => setAdmitForm(p => ({ ...p, date_admitted: e.target.value }))}
                  className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-400 block mb-1">Admitted By</Label>
              <Select value={admitForm.admitted_by_side} onValueChange={v => setAdmitForm(p => ({ ...p, admitted_by_side: v }))}>
                <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{["Plaintiff","Defense","Unknown"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-400 block mb-1">Notes</Label>
              <Textarea value={admitForm.notes}
                onChange={e => setAdmitForm(p => ({ ...p, notes: e.target.value }))}
                className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdmitDialog(null)} className="border-[#1e2a45]">Cancel</Button>
            <Button onClick={saveAdmit} disabled={saving || !admitForm.admitted_no} className="bg-green-600 hover:bg-green-700">
              {saving ? "Saving…" : "Admit Exhibit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Source Group Accordion (expanded view) ────────────────────────────────────
function SourceGroupAccordion({ ids, primaryId, depoById, onViewFile }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3 bg-[#080d1a] border border-[#1e2a45] rounded-lg overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-[#0f1629] transition-colors">
        {open ? <ChevronDown className="w-3.5 h-3.5 text-cyan-400" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <Users className="w-3.5 h-3.5 text-slate-500" />
        <span className="font-medium">{ids.length} source exhibits in group</span>
        <span className="text-slate-600 text-[10px]">· click to {open ? "collapse" : "expand"}</span>
      </button>
      {open && (
        <div className="border-t border-[#1e2a45]">
          {ids.map(id => {
            const de = depoById[id];
            if (!de) return null;
            const isPrimary = id === primaryId;
            const fileUrl = de.file_url || de.external_link;
            return (
              <div key={id} className={`flex items-center gap-2 px-3 py-2 border-b border-[#1e2a45] last:border-0 ${isPrimary ? "bg-amber-500/5" : ""}`}>
                {isPrimary
                  ? <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />
                  : <Link2 className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-200 truncate">
                    {de.depo_exhibit_no && <span className="text-cyan-400 font-mono mr-1">#{de.depo_exhibit_no}</span>}
                    {de.display_title || de.depo_exhibit_title}
                    {isPrimary && <span className="ml-1.5 text-[10px] text-amber-400/80">PRIMARY</span>}
                  </p>
                  {de.deponent_name && <p className="text-[10px] text-slate-500">{de.deponent_name}</p>}
                </div>
                {fileUrl && (
                  <button onClick={() => onViewFile(fileUrl, de.display_title || de.depo_exhibit_title)}
                    className="text-[10px] text-cyan-400 hover:underline flex items-center gap-0.5 flex-shrink-0">
                    <ExternalLink className="w-3 h-3" /> View
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}