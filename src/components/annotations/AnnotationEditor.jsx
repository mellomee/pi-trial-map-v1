import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Trash2, Save, Link2, X, Search, Target, HelpCircle } from "lucide-react";

/**
 * AnnotationEditor
 * Right-panel form for creating/editing a single annotation.
 * Also manages AnnotationLinks to TrialPoints and Questions.
 *
 * Props:
 *   annotation     – current annotation object (or null for new)
 *   caseId
 *   onSave         – (savedAnnotation) => void
 *   onDelete       – () => void
 *   onCancel       – () => void
 *   trialPoints    – all trial points for case
 *   questions      – all questions for case
 */
export default function AnnotationEditor({
  annotation,
  caseId,
  onSave,
  onDelete,
  onCancel,
  trialPoints = [],
  questions = [],
}) {
  const [form, setForm] = useState({
    label_internal: "",
    note_text: "",
    page_in_extract: 1,
    kind: "Note",
    highlight_rect_json: "",
  });
  const [saving, setSaving] = useState(false);
  const [links, setLinks] = useState([]); // AnnotationLinks for this annotation
  const [tpSearch, setTpSearch] = useState("");
  const [qSearch, setQSearch] = useState("");
  const [showTpPicker, setShowTpPicker] = useState(false);
  const [showQPicker, setShowQPicker] = useState(false);

  useEffect(() => {
    if (annotation) {
      setForm({
        label_internal: annotation.label_internal || "",
        note_text: annotation.note_text || "",
        page_in_extract: annotation.page_in_extract || 1,
        kind: annotation.kind || "Note",
        highlight_rect_json: annotation.highlight_rect_json || "",
      });
      if (annotation.id) loadLinks(annotation.id);
    } else {
      setForm({ label_internal: "", note_text: "", page_in_extract: 1, kind: "Note", highlight_rect_json: "" });
      setLinks([]);
    }
  }, [annotation]);

  const loadLinks = async (annId) => {
    const res = await base44.entities.AnnotationLinks.filter({ annotation_id: annId });
    setLinks(res);
  };

  const handleSave = async () => {
    if (!form.label_internal.trim()) return;
    setSaving(true);
    let saved;
    const payload = { ...form, case_id: caseId, page_in_extract: Number(form.page_in_extract) };
    if (annotation?.id) {
      saved = await base44.entities.ExhibitAnnotations.update(annotation.id, payload);
    } else {
      saved = await base44.entities.ExhibitAnnotations.create({
        ...payload,
        joint_exhibit_id: annotation.joint_exhibit_id,
      });
    }
    setSaving(false);
    onSave(saved);
  };

  const handleDelete = async () => {
    if (!annotation?.id || !confirm("Delete this annotation?")) return;
    // delete links first
    for (const lk of links) await base44.entities.AnnotationLinks.delete(lk.id);
    await base44.entities.ExhibitAnnotations.delete(annotation.id);
    onDelete();
  };

  const addLink = async (type, id) => {
    if (!annotation?.id) return;
    const existing = links.find(l => l.link_type === type && l.link_id === id);
    if (existing) return;
    const rec = await base44.entities.AnnotationLinks.create({
      case_id: caseId,
      annotation_id: annotation.id,
      link_type: type,
      link_id: id,
    });
    setLinks(prev => [...prev, rec]);
    setShowTpPicker(false);
    setShowQPicker(false);
  };

  const removeLink = async (linkId) => {
    await base44.entities.AnnotationLinks.delete(linkId);
    setLinks(prev => prev.filter(l => l.id !== linkId));
  };

  const linkedTpIds = new Set(links.filter(l => l.link_type === "TrialPoint").map(l => l.link_id));
  const linkedQIds = new Set(links.filter(l => l.link_type === "Question").map(l => l.link_id));

  const filteredTPs = trialPoints.filter(tp =>
    !linkedTpIds.has(tp.id) && tp.point_text?.toLowerCase().includes(tpSearch.toLowerCase())
  );
  const filteredQs = questions.filter(q =>
    !linkedQIds.has(q.id) && q.question_text?.toLowerCase().includes(qSearch.toLowerCase())
  );

  if (!annotation) {
    return (
      <div className="h-full flex items-center justify-center text-slate-600 text-sm p-8 text-center">
        Select an annotation or click "Add Note" / "Add Highlight"
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex-1 p-4 space-y-4">
        {/* Kind badge */}
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded border font-medium ${form.kind === "Highlight" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40" : "bg-cyan-500/20 text-cyan-400 border-cyan-500/40"}`}>
            {form.kind}
          </span>
          <span className="text-xs text-slate-500">Page {form.page_in_extract}</span>
        </div>

        <div>
          <Label className="text-slate-400 text-xs">Label (internal) *</Label>
          <Input
            value={form.label_internal}
            onChange={e => setForm(p => ({ ...p, label_internal: e.target.value }))}
            placeholder="e.g. Sightlines blocked"
            className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 mt-1"
          />
        </div>

        <div>
          <Label className="text-slate-400 text-xs">Note</Label>
          <Textarea
            value={form.note_text}
            onChange={e => setForm(p => ({ ...p, note_text: e.target.value }))}
            placeholder="Additional notes…"
            className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 mt-1 text-sm"
            rows={3}
          />
        </div>

        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <Label className="text-slate-400 text-xs">Page in Extract</Label>
            <Input
              type="number"
              min={1}
              value={form.page_in_extract}
              onChange={e => setForm(p => ({ ...p, page_in_extract: e.target.value }))}
              className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 mt-1"
            />
          </div>
        </div>

        {/* Highlight rect info */}
        {form.kind === "Highlight" && form.highlight_rect_json && (
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded p-2">
            <p className="text-[10px] text-yellow-500/80 font-medium mb-1">Highlight Rectangle</p>
            <p className="text-[10px] font-mono text-slate-500">{form.highlight_rect_json}</p>
            <button onClick={() => setForm(p => ({ ...p, highlight_rect_json: "" }))} className="text-[10px] text-red-400 hover:underline mt-1">
              Clear rect
            </button>
          </div>
        )}

        {/* ── Links ─── */}
        {annotation.id && (
          <div className="pt-2 border-t border-[#1e2a45]">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Links</p>

            {/* Linked trial points */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400 flex items-center gap-1"><Target className="w-3 h-3 text-cyan-400" /> Trial Points</span>
                <button onClick={() => { setShowTpPicker(v => !v); setTpSearch(""); }} className="text-[10px] text-cyan-400 hover:underline flex items-center gap-0.5">
                  <Link2 className="w-3 h-3" /> Link
                </button>
              </div>
              {[...linkedTpIds].map(tpId => {
                const tp = trialPoints.find(x => x.id === tpId);
                const lk = links.find(l => l.link_type === "TrialPoint" && l.link_id === tpId);
                return tp ? (
                  <div key={tpId} className="flex items-start gap-1 mb-1">
                    <p className="flex-1 text-xs text-slate-300 bg-[#0f1629] rounded px-2 py-1 leading-snug">{tp.point_text}</p>
                    <button onClick={() => removeLink(lk?.id)} className="text-slate-600 hover:text-red-400 mt-1 flex-shrink-0"><X className="w-3 h-3" /></button>
                  </div>
                ) : null;
              })}
              {showTpPicker && (
                <div className="mt-1 border border-[#1e2a45] rounded bg-[#0a0f1e] max-h-36 overflow-y-auto">
                  <div className="p-1.5 sticky top-0 bg-[#0a0f1e]">
                    <div className="relative">
                      <Search className="absolute left-2 top-1.5 w-3 h-3 text-slate-500" />
                      <input value={tpSearch} onChange={e => setTpSearch(e.target.value)} placeholder="Search…"
                        className="w-full pl-6 pr-2 py-1 bg-[#131a2e] border border-[#1e2a45] rounded text-xs text-slate-200 outline-none" />
                    </div>
                  </div>
                  {filteredTPs.slice(0, 30).map(tp => (
                    <button key={tp.id} onClick={() => addLink("TrialPoint", tp.id)}
                      className="w-full text-left px-2 py-1.5 text-xs text-slate-300 hover:bg-cyan-600/20 hover:text-white">
                      {tp.point_text}
                    </button>
                  ))}
                  {filteredTPs.length === 0 && <p className="text-slate-600 text-xs px-2 py-2">None found</p>}
                </div>
              )}
            </div>

            {/* Linked questions */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400 flex items-center gap-1"><HelpCircle className="w-3 h-3 text-amber-400" /> Questions</span>
                <button onClick={() => { setShowQPicker(v => !v); setQSearch(""); }} className="text-[10px] text-amber-400 hover:underline flex items-center gap-0.5">
                  <Link2 className="w-3 h-3" /> Link
                </button>
              </div>
              {[...linkedQIds].map(qId => {
                const q = questions.find(x => x.id === qId);
                const lk = links.find(l => l.link_type === "Question" && l.link_id === qId);
                return q ? (
                  <div key={qId} className="flex items-start gap-1 mb-1">
                    <p className="flex-1 text-xs text-slate-300 bg-[#0f1629] rounded px-2 py-1 leading-snug line-clamp-2">{q.question_text}</p>
                    <button onClick={() => removeLink(lk?.id)} className="text-slate-600 hover:text-red-400 mt-1 flex-shrink-0"><X className="w-3 h-3" /></button>
                  </div>
                ) : null;
              })}
              {showQPicker && (
                <div className="mt-1 border border-[#1e2a45] rounded bg-[#0a0f1e] max-h-36 overflow-y-auto">
                  <div className="p-1.5 sticky top-0 bg-[#0a0f1e]">
                    <div className="relative">
                      <Search className="absolute left-2 top-1.5 w-3 h-3 text-slate-500" />
                      <input value={qSearch} onChange={e => setQSearch(e.target.value)} placeholder="Search…"
                        className="w-full pl-6 pr-2 py-1 bg-[#131a2e] border border-[#1e2a45] rounded text-xs text-slate-200 outline-none" />
                    </div>
                  </div>
                  {filteredQs.slice(0, 30).map(q => (
                    <button key={q.id} onClick={() => addLink("Question", q.id)}
                      className="w-full text-left px-2 py-1.5 text-xs text-slate-300 hover:bg-amber-600/20 hover:text-white">
                      {q.question_text}
                    </button>
                  ))}
                  {filteredQs.length === 0 && <p className="text-slate-600 text-xs px-2 py-2">None found</p>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer buttons */}
      <div className="p-4 border-t border-[#1e2a45] flex gap-2">
        {annotation.id && (
          <button onClick={handleDelete} className="p-2 text-slate-600 hover:text-red-400">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onCancel} className="border-slate-600 text-slate-400">Cancel</Button>
        <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700" onClick={handleSave} disabled={saving || !form.label_internal.trim()}>
          <Save className="w-3.5 h-3.5 mr-1" /> {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}