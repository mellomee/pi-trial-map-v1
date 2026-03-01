import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Edit2, Trash2, Upload, BookOpen, FileText, ExternalLink, ChevronDown, ChevronRight, Highlighter } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import useActiveCase from "@/components/hooks/useActiveCase";
import AnnotationsSection from "@/components/exhibits/AnnotationsSection";
import FileViewerModal from "@/components/exhibits/FileViewerModal";

const EMPTY = {
  extract_title_official: "",
  extract_title_internal: "",
  source_depo_exhibit_id: "",
  extract_page_start: "",
  extract_page_end: "",
  extract_page_count: "",
  extract_file_url: "",
  notes: "",
};

export default function Extracts() {
  const { activeCase } = useActiveCase();
  const [extracts, setExtracts] = useState([]);
  const [depoExhibits, setDepoExhibits] = useState([]);
  const [parties, setParties] = useState([]);
  const [depositions, setDepositions] = useState([]);
  const [joints, setJoints] = useState([]);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [editing, setEditing] = useState(null); // null | EMPTY | extract obj
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewFile, setViewFile] = useState(null); // { url, title }

  useEffect(() => {
    if (!activeCase) return;
    Promise.all([
      base44.entities.ExhibitExtracts.filter({ case_id: activeCase.id }),
      base44.entities.DepositionExhibits.filter({ case_id: activeCase.id }),
      base44.entities.Parties.filter({ case_id: activeCase.id }),
      base44.entities.Depositions.filter({ case_id: activeCase.id }),
      base44.entities.JointExhibits.filter({ case_id: activeCase.id }),
    ]).then(([exs, depo, pts, deps, jo]) => {
      setExtracts(exs);
      setDepoExhibits(depo);
      setParties(pts);
      setDepositions(deps);
      setJoints(jo);
    });
  }, [activeCase]);

  // Map extract_id → joint exhibits
  const jointsByExtractId = useMemo(() => {
    const m = {};
    joints.forEach(j => {
      if (j.exhibit_extract_id) {
        if (!m[j.exhibit_extract_id]) m[j.exhibit_extract_id] = [];
        m[j.exhibit_extract_id].push(j);
      }
    });
    return m;
  }, [joints]);

  const depoExhibitLabel = (id) => {
    const de = depoExhibits.find(x => x.id === id);
    if (!de) return "—";
    return `${de.depo_exhibit_no ? `#${de.depo_exhibit_no} ` : ""}${de.depo_exhibit_title || ""}`.trim() || id;
  };

  const deponentName = (depoExhibitId) => {
    const de = depoExhibits.find(x => x.id === depoExhibitId);
    if (!de) return "";
    const dep = depositions.find(x => x.id === de.deposition_id);
    if (!dep) return de.deponent_name || "";
    const p = parties.find(x => x.id === dep.party_id);
    return p ? (p.display_name || `${p.first_name || ""} ${p.last_name || ""}`.trim()) : dep.sheet_name;
  };

  const filtered = useMemo(() =>
    extracts.filter(e => {
      if (!search) return true;
      const q = search.toLowerCase();
      return [e.extract_title_official, e.extract_title_internal, e.notes]
        .some(v => v?.toLowerCase().includes(q));
    }), [extracts, search]);

  const openNew = () => setEditing({ ...EMPTY });
  const openEdit = (e) => setEditing({ ...e });

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setEditing(prev => ({ ...prev, extract_file_url: file_url }));
    setUploading(false);
  };

  const save = async () => {
    if (!editing || !activeCase) return;
    setSaving(true);
    const payload = {
      case_id: activeCase.id,
      extract_title_official: editing.extract_title_official,
      extract_title_internal: editing.extract_title_internal,
      source_depo_exhibit_id: editing.source_depo_exhibit_id || null,
      extract_page_start: editing.extract_page_start ? Number(editing.extract_page_start) : null,
      extract_page_end: editing.extract_page_end ? Number(editing.extract_page_end) : null,
      extract_page_count: editing.extract_page_count ? Number(editing.extract_page_count) : null,
      extract_file_url: editing.extract_file_url || null,
      notes: editing.notes,
    };
    let result;
    if (editing.id) {
      result = await base44.entities.ExhibitExtracts.update(editing.id, payload);
      setExtracts(prev => prev.map(e => e.id === result.id ? result : e));
    } else {
      result = await base44.entities.ExhibitExtracts.create(payload);
      setExtracts(prev => [...prev, result]);
    }
    setEditing(null);
    setSaving(false);
  };

  const remove = async (e) => {
    if (!confirm(`Delete extract "${e.extract_title_official}"?`)) return;
    await base44.entities.ExhibitExtracts.delete(e.id);
    setExtracts(prev => prev.filter(x => x.id !== e.id));
  };

  if (!activeCase) return <div className="p-8 text-slate-400">No active case.</div>;

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-200">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0f1629] border-b border-[#1e2a45] px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-400" /> Exhibit Extracts
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{filtered.length} of {extracts.length} extracts</p>
          </div>
          <Button onClick={openNew}
            className="bg-emerald-600/20 text-emerald-400 border border-emerald-600/40 hover:bg-emerald-600/30 gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" /> New Extract
          </Button>
        </div>
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search extracts…"
            className="pl-8 h-8 bg-[#0a0f1e] border-[#1e2a45] text-slate-200 text-xs" />
        </div>
      </div>

      {/* List */}
      <div className="px-6 py-4 max-w-4xl space-y-2">
        {filtered.length === 0 ? (
          <div className="border border-dashed border-[#1e2a45] rounded-xl p-12 text-center text-slate-600">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>No extracts yet. Create an extract from a raw depo exhibit.</p>
          </div>
        ) : filtered.map(ex => (
          <div key={ex.id}
            className="bg-[#0f1629] border border-[#1e2a45] hover:border-emerald-600/30 rounded-xl transition-colors">
            {/* Row header */}
            <div className="p-4 flex items-start gap-3">
              <button
                onClick={() => setExpandedId(expandedId === ex.id ? null : ex.id)}
                className="mt-0.5 text-slate-500 hover:text-slate-200 flex-shrink-0">
                {expandedId === ex.id
                  ? <ChevronDown className="w-4 h-4 text-emerald-400" />
                  : <ChevronRight className="w-4 h-4" />}
              </button>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedId(expandedId === ex.id ? null : ex.id)}>
                <p className="text-sm font-semibold text-slate-100">{ex.extract_title_official}</p>
                {ex.extract_title_internal && (
                  <p className="text-xs text-slate-500 italic mt-0.5">"{ex.extract_title_internal}"</p>
                )}
                <div className="flex flex-wrap gap-2 mt-1.5 items-center">
                  {ex.source_depo_exhibit_id && (
                    <Badge className="text-[10px] bg-slate-600/20 text-slate-400 border-slate-600/30">
                      Source: {depoExhibitLabel(ex.source_depo_exhibit_id)}
                    </Badge>
                  )}
                  {deponentName(ex.source_depo_exhibit_id) && (
                    <span className="text-[10px] text-slate-600">{deponentName(ex.source_depo_exhibit_id)}</span>
                  )}
                  {(ex.extract_page_start || ex.extract_page_end) && (
                    <span className="text-[10px] text-slate-500">
                      pp. {ex.extract_page_start}–{ex.extract_page_end}
                    </span>
                  )}
                  {ex.extract_file_url && (
                    <button
                      onClick={e => { e.stopPropagation(); setViewFile({ url: ex.extract_file_url, title: ex.extract_title_official }); }}
                      className="text-[10px] text-emerald-400 hover:underline flex items-center gap-0.5">
                      <ExternalLink className="w-3 h-3" /> View File
                    </button>
                  )}
                  {(jointsByExtractId[ex.id] || []).map(j => (
                    <Badge key={j.id} className="text-[10px] bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                      Joint #{j.marked_no}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => openEdit(ex)} className="p-1.5 text-slate-500 hover:text-slate-200">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => remove(ex)} className="p-1.5 text-slate-500 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {/* Expanded annotations section */}
            {expandedId === ex.id && (
              <div className="px-4 pb-4">
                <AnnotationsSection extractId={ex.id} extractFileUrl={ex.extract_file_url} />
              </div>
            )}
          </div>
        ))}
      </div>

      {viewFile && <FileViewerModal url={viewFile.url} title={viewFile.title} onClose={() => setViewFile(null)} />}

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-emerald-400 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {editing?.id ? "Edit Extract" : "New Extract"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Official Title (judge-facing)*</label>
                <Input value={editing.extract_title_official}
                  onChange={e => setEditing(p => ({ ...p, extract_title_official: e.target.value }))}
                  className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"
                  placeholder="Traffic Control Signal Log – Intersection A" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Internal Name (your team only)</label>
                <Input value={editing.extract_title_internal}
                  onChange={e => setEditing(p => ({ ...p, extract_title_internal: e.target.value }))}
                  className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"
                  placeholder="Sightlines blocked" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Source Raw Exhibit</label>
                <Select value={editing.source_depo_exhibit_id || "none"}
                  onValueChange={v => setEditing(p => ({ ...p, source_depo_exhibit_id: v === "none" ? "" : v }))}>
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
                  <label className="text-xs text-slate-400 block mb-1">Page Start</label>
                  <Input type="number" value={editing.extract_page_start}
                    onChange={e => setEditing(p => ({ ...p, extract_page_start: e.target.value }))}
                    className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" placeholder="1" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-400 block mb-1">Page End</label>
                  <Input type="number" value={editing.extract_page_end}
                    onChange={e => setEditing(p => ({ ...p, extract_page_end: e.target.value }))}
                    className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" placeholder="20" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-400 block mb-1">Page Count</label>
                  <Input type="number" value={editing.extract_page_count}
                    onChange={e => setEditing(p => ({ ...p, extract_page_count: e.target.value }))}
                    className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" placeholder="20" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Extract File (PDF/image)</label>
                <div className="flex gap-2 items-center">
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={e => handleUpload(e.target.files?.[0])}
                    className="hidden" id="extract-file-input" />
                  <label htmlFor="extract-file-input"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1e2a45] hover:bg-[#263450] text-slate-300 text-xs cursor-pointer border border-[#2e3a55]">
                    <Upload className="w-3.5 h-3.5" />
                    {uploading ? "Uploading…" : "Upload File"}
                  </label>
                  {editing.extract_file_url && (
                    <a href={editing.extract_file_url} target="_blank" rel="noreferrer"
                      className="text-xs text-emerald-400 hover:underline truncate max-w-xs">
                      View uploaded file
                    </a>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Notes</label>
                <Textarea value={editing.notes}
                  onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))}
                  className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setEditing(null)} className="border-[#1e2a45]">Cancel</Button>
                <Button onClick={save} disabled={saving || !editing.extract_title_official}
                  className="bg-emerald-600 hover:bg-emerald-700">
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}