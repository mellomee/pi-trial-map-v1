import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Plus, Edit2, Trash2, Upload, FileText, Link2,
  ChevronDown, ChevronRight, CheckSquare, List, RefreshCw,
  Highlighter, StickyNote, ExternalLink, MinusCircle
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
  extract_page_start: "",
  extract_page_end: "",
  extract_page_count: "",
  extract_file_url: "",
  notes: "",
};

const EMPTY_JOINT = { marked_no: "", marked_title: "", marked_by_side: "Plaintiff", pages: "", notes: "" };
const EMPTY_ADMIT = { admitted_no: "", admitted_by_side: "Plaintiff", date_admitted: new Date().toISOString().split("T")[0], notes: "" };

export default function Extracts() {
  const { activeCase } = useActiveCase();
  const [extracts, setExtracts] = useState([]);
  const [joints, setJoints] = useState([]);
  const [admitted, setAdmitted] = useState([]);
  const [depoExhibits, setDepoExhibits] = useState([]);
  const [annotationCounts, setAnnotationCounts] = useState({});

  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState("all"); // all | joint | admitted
  const [expandedId, setExpandedId] = useState(null);

  // Dialogs
  const [editExtract, setEditExtract] = useState(null);
  const [markJointDialog, setMarkJointDialog] = useState(null); // extract obj
  const [jointForm, setJointForm] = useState({ ...EMPTY_JOINT });
  const [admitDialog, setAdmitDialog] = useState(null); // { extract, joint }
  const [admitForm, setAdmitForm] = useState({ ...EMPTY_ADMIT });
  const [viewFile, setViewFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!activeCase) return;
    const cid = activeCase.id;
    const [exs, jo, ad, de, anns] = await Promise.all([
      base44.entities.ExhibitExtracts.filter({ case_id: cid }),
      base44.entities.JointExhibits.filter({ case_id: cid }),
      base44.entities.AdmittedExhibits.filter({ case_id: cid }),
      base44.entities.DepositionExhibits.filter({ case_id: cid }),
      base44.entities.ExhibitAnnotations.filter({ case_id: cid }),
    ]);
    setExtracts(exs);
    setJoints(jo);
    setAdmitted(ad);
    setDepoExhibits(de);
    const counts = {};
    anns.forEach(a => { counts[a.extract_id] = (counts[a.extract_id] || 0) + 1; });
    setAnnotationCounts(counts);
  };

  useEffect(() => { load(); }, [activeCase]);

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

  const depoLabel = (id) => {
    const de = depoExhibits.find(x => x.id === id);
    if (!de) return "—";
    return `${de.depo_exhibit_no ? `#${de.depo_exhibit_no} ` : ""}${de.depo_exhibit_title || ""}`.trim();
  };

  // Enriched extracts with joint + admit status
  const enriched = useMemo(() => extracts.map(ex => {
    const joint = jointByExtractId[ex.id] || null;
    const admRec = joint ? (admittedByJointId[joint.id] || null) : null;
    const status = admRec ? "admitted" : joint ? "joint" : "working";
    return { ...ex, _joint: joint, _admRec: admRec, _status: status };
  }), [extracts, jointByExtractId, admittedByJointId]);

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
    const payload = {
      case_id: activeCase.id,
      extract_title_official: editExtract.extract_title_official,
      extract_title_internal: editExtract.extract_title_internal,
      source_depo_exhibit_id: editExtract.source_depo_exhibit_id || null,
      extract_page_start: editExtract.extract_page_start ? Number(editExtract.extract_page_start) : null,
      extract_page_end: editExtract.extract_page_end ? Number(editExtract.extract_page_end) : null,
      extract_page_count: editExtract.extract_page_count ? Number(editExtract.extract_page_count) : null,
      extract_file_url: editExtract.extract_file_url || null,
      notes: editExtract.notes,
    };
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

  // ── Mark as Joint ──
  const openMarkJoint = (ex) => {
    setMarkJointDialog(ex);
    setJointForm({ ...EMPTY_JOINT, marked_title: ex.extract_title_official });
  };

  const saveMarkJoint = async () => {
    if (!markJointDialog || !activeCase) return;
    setSaving(true);
    const joint = await base44.entities.JointExhibits.create({
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
    if (!joint) return;
    if (!confirm(`Remove "${ex.extract_title_official}" from the Joint List?`)) return;
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
      ...admitForm,
      case_id: activeCase.id,
      joint_exhibit_id: admitDialog.joint.id,
    });
    await base44.entities.JointExhibits.update(admitDialog.joint.id, {
      status: "Admitted",
      admitted_no: admitForm.admitted_no,
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

  const counts = { all: enriched.length, joint: enriched.filter(e => e._status !== "working").length, admitted: enriched.filter(e => e._status === "admitted").length };

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-200">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0f1629] border-b border-[#1e2a45] px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-400" /> Extracts
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{filtered.length} shown · {counts.joint} on joint list · {counts.admitted} admitted</p>
          </div>
          <Button onClick={() => setEditExtract({ ...EMPTY_EXTRACT })}
            className="bg-emerald-600/20 text-emerald-400 border border-emerald-600/40 hover:bg-emerald-600/30 gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" /> New Extract
          </Button>
        </div>

        {/* Filter tabs + search */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-[#0a0f1e] rounded-lg p-1 border border-[#1e2a45]">
            {[
              { key: "all", label: "All" },
              { key: "joint", label: "Joint List" },
              { key: "admitted", label: "Admitted" },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilterTab(tab.key)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  filterTab === tab.key
                    ? "bg-cyan-600/20 text-cyan-400 border border-cyan-600/30"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab.label} <span className="text-[10px] ml-0.5 opacity-60">{counts[tab.key]}</span>
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
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

          return (
            <div key={ex.id} className={`bg-[#0f1629] border rounded-xl transition-colors ${
              ex._status === "admitted" ? "border-green-500/30 hover:border-green-500/50" :
              ex._status === "joint" ? "border-cyan-500/20 hover:border-cyan-500/40" :
              "border-[#1e2a45] hover:border-emerald-600/30"
            }`}>
              {/* Row */}
              <div className="p-4 flex items-start gap-3">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : ex.id)}
                  className="mt-0.5 text-slate-500 hover:text-slate-200 flex-shrink-0">
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-emerald-400" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                {/* Main info */}
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : ex.id)}>
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-100">{ex.extract_title_official}</p>
                    {/* Status badges */}
                    {admRec && (
                      <Badge className="text-[10px] bg-green-500/20 text-green-400 border-green-500/30">
                        Ex. {admRec.admitted_no || joint?.admitted_no}
                      </Badge>
                    )}
                    {joint && !admRec && (
                      <Badge className="text-[10px] bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                        Joint #{joint.marked_no}
                      </Badge>
                    )}
                  </div>
                  {ex.extract_title_internal && (
                    <p className="text-xs text-slate-500 italic mt-0.5">"{ex.extract_title_internal}"</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-1.5 items-center">
                    {ex.source_depo_exhibit_id && (
                      <span className="text-[10px] text-slate-600">Source: {depoLabel(ex.source_depo_exhibit_id)}</span>
                    )}
                    {(ex.extract_page_start || ex.extract_page_end) && (
                      <span className="text-[10px] text-slate-500">pp. {ex.extract_page_start}–{ex.extract_page_end}</span>
                    )}
                    {annotationCounts[ex.id] > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-yellow-500/70">
                        <StickyNote className="w-3 h-3" />{annotationCounts[ex.id]}
                      </span>
                    )}
                    {ex.extract_file_url && (
                      <button onClick={e => { e.stopPropagation(); setViewFile({ url: ex.extract_file_url, title: ex.extract_title_official }); }}
                        className="text-[10px] text-emerald-400 hover:underline flex items-center gap-0.5">
                        <ExternalLink className="w-3 h-3" /> View
                      </button>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  {/* Admit / Joint List / Add to Joint actions */}
                  {admRec ? (
                    <div className="text-right mr-1">
                      <span className="text-[10px] text-green-400 font-semibold block">Ex. {admRec.admitted_no}</span>
                      <span className="text-[9px] text-slate-600">{fmtDate(admRec.date_admitted)}</span>
                    </div>
                  ) : joint ? (
                    <button
                      onClick={() => openAdmit(ex)}
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-colors">
                      <CheckSquare className="w-3 h-3" /> Admit
                    </button>
                  ) : (
                    <button
                      onClick={() => openMarkJoint(ex)}
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-colors">
                      <List className="w-3 h-3" /> Add to Joint List
                    </button>
                  )}

                  <Link
                    to={createPageUrl(`AnnotatePage?extractId=${ex.id}`)}
                    className="p-1.5 text-slate-500 hover:text-orange-400"
                    title="Annotate">
                    <Highlighter className="w-3.5 h-3.5" />
                  </Link>
                  <button onClick={() => setEditExtract({ ...ex })} className="p-1.5 text-slate-500 hover:text-slate-200">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => removeExtract(ex)} className="p-1.5 text-slate-500 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Expanded: callouts + joint/admit detail */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-[#1e2a45]">
                  {/* Joint / Admit info strip */}
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
                      <div className="ml-auto flex gap-2 self-start mt-0.5">
                        {admRec && (
                          <button onClick={() => removeAdmit(ex)} className="text-[10px] text-slate-500 hover:text-red-400">
                            Remove Admission
                          </button>
                        )}
                        <button onClick={() => removeFromJoint(ex)} className="flex items-center gap-0.5 text-[10px] text-slate-500 hover:text-orange-400">
                          <MinusCircle className="w-3 h-3" /> Remove from Joint List
                        </button>
                      </div>
                    </div>
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
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-lg">
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
                <Input value={editExtract.extract_title_internal}
                  onChange={e => setEditExtract(p => ({ ...p, extract_title_internal: e.target.value }))}
                  className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"
                  placeholder="Sightlines blocked" />
              </div>
              <div>
                <Label className="text-xs text-slate-400 block mb-1">Source Raw Exhibit</Label>
                <Select value={editExtract.source_depo_exhibit_id || "none"}
                  onValueChange={v => setEditExtract(p => ({ ...p, source_depo_exhibit_id: v === "none" ? "" : v }))}>
                  <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-xs">
                    <SelectValue placeholder="Select source exhibit…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {depoExhibits.map(de => (
                      <SelectItem key={de.id} value={de.id}>
                        {de.depo_exhibit_no ? `#${de.depo_exhibit_no} ` : ""}{de.depo_exhibit_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-xs text-slate-400 block mb-1">Page Start</Label>
                  <Input type="number" value={editExtract.extract_page_start}
                    onChange={e => setEditExtract(p => ({ ...p, extract_page_start: e.target.value }))}
                    className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" placeholder="1" />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-slate-400 block mb-1">Page End</Label>
                  <Input type="number" value={editExtract.extract_page_end}
                    onChange={e => setEditExtract(p => ({ ...p, extract_page_end: e.target.value }))}
                    className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" placeholder="20" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-400 block mb-1">Extract File (PDF/image)</Label>
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
                      className="text-xs text-emerald-400 hover:underline truncate max-w-[160px]">
                      View uploaded file
                    </a>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-400 block mb-1">Notes</Label>
                <Textarea value={editExtract.notes}
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
                  placeholder="e.g. 47"
                  className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" autoFocus />
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
                placeholder="All pages"
                className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkJointDialog(null)} className="border-[#1e2a45]">Cancel</Button>
            <Button onClick={saveMarkJoint} disabled={saving || !jointForm.marked_no}
              className="bg-cyan-600 hover:bg-cyan-700">
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
                  placeholder="e.g. 200"
                  className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" autoFocus />
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
            <Button onClick={saveAdmit} disabled={saving || !admitForm.admitted_no}
              className="bg-green-600 hover:bg-green-700">
              {saving ? "Saving…" : "Admit Exhibit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}