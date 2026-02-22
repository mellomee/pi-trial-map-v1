import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import useActiveCase from "@/components/hooks/useActiveCase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Search, CheckSquare, Pencil, Trash2, X, ChevronDown, ExternalLink, ChevronsUpDown, ChevronUp } from "lucide-react";
import FileViewerModal from "@/components/exhibits/FileViewerModal";
import { format } from "date-fns";

const statusColors = {
  Marked: "bg-cyan-500/20 text-cyan-400",
  Offered: "bg-blue-500/20 text-blue-400",
  Admitted: "bg-green-500/20 text-green-400",
  Excluded: "bg-red-500/20 text-red-400",
  Withdrawn: "bg-yellow-500/20 text-yellow-400",
  NotUsed: "bg-slate-500/20 text-slate-400",
};

const fmtDate = (d) => { try { return format(new Date(d), "MMM d, yyyy"); } catch { return d || "—"; } };

export default function JointExhibits() {
  const { activeCase } = useActiveCase();
  const [joints, setJoints] = useState([]);
  const [admitted, setAdmitted] = useState([]);
  const [depoExhibits, setDepoExhibits] = useState([]);

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSide, setFilterSide] = useState("all");

  // Dialogs
  const [editJoint, setEditJoint] = useState(null);
  const [admitDialog, setAdmitDialog] = useState(null);
  const [admitForm, setAdmitForm] = useState({ admitted_no: "", admitted_by_side: "Plaintiff", date_admitted: new Date().toISOString().split("T")[0], notes: "" });
  const [editAdmit, setEditAdmit] = useState(null);
  const [viewFile, setViewFile] = useState(null); // { url, title }
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <ChevronsUpDown className="w-3 h-3 ml-1 text-slate-500 inline" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 ml-1 text-cyan-400 inline" />
      : <ChevronDown className="w-3 h-3 ml-1 text-cyan-400 inline" />;
  };

  const load = async () => {
    if (!activeCase) return;
    const cid = activeCase.id;
    const [jo, ad, de] = await Promise.all([
      base44.entities.JointExhibits.filter({ case_id: cid }),
      base44.entities.AdmittedExhibits.filter({ case_id: cid }),
      base44.entities.DepositionExhibits.filter({ case_id: cid }),
    ]);
    setJoints(jo);
    setAdmitted(ad);
    setDepoExhibits(de);
  };

  useEffect(() => { load(); }, [activeCase]);

  const admittedByJointId = useMemo(() => {
    const m = {};
    admitted.forEach(a => { m[a.joint_exhibit_id] = a; });
    return m;
  }, [admitted]);

  // Map joint_id -> array of all depo exhibits in that group
  const deposByJointId = useMemo(() => {
    const m = {};
    depoExhibits.forEach(d => {
      if (d.joint_exhibit_id) {
        if (!m[d.joint_exhibit_id]) m[d.joint_exhibit_id] = [];
        m[d.joint_exhibit_id].push(d);
      }
    });
    return m;
  }, [depoExhibits]);

  // Legacy single depo lookup
  const depoByJointId = useMemo(() => {
    const m = {};
    depoExhibits.forEach(d => { if (d.joint_exhibit_id) m[d.joint_exhibit_id] = d; });
    return m;
  }, [depoExhibits]);

  const filtered = useMemo(() => joints.filter(j => {
    const admRec = admittedByJointId[j.id];
    const matchSearch = !search ||
      j.marked_title?.toLowerCase().includes(search.toLowerCase()) ||
      j.marked_no?.toLowerCase().includes(search.toLowerCase()) ||
      admRec?.admitted_no?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || j.status === filterStatus;
    const matchSide = filterSide === "all" || j.marked_by_side === filterSide;
    return matchSearch && matchStatus && matchSide;
  }), [joints, admitted, search, filterStatus, filterSide, admittedByJointId]);

  // Edit joint
  const saveJoint = async () => {
    await base44.entities.JointExhibits.update(editJoint.id, editJoint);
    setEditJoint(null);
    load();
  };

  const removeJoint = async (j) => {
    if (!confirm("Remove this exhibit from the Joint List? It will return to Deposition Exhibits as unmarked.")) return;
    // un-mark all source depo exhibits
    const allDepos = deposByJointId[j.id] || (depoByJointId[j.id] ? [depoByJointId[j.id]] : []);
    for (const depo of allDepos) {
      await base44.entities.DepositionExhibits.update(depo.id, { joint_exhibit_id: "" });
    }
    // delete admitted record if exists
    const admRec = admittedByJointId[j.id];
    if (admRec) await base44.entities.AdmittedExhibits.delete(admRec.id);
    await base44.entities.JointExhibits.delete(j.id);
    load();
  };

  // Admit
  const openAdmit = (joint) => {
    setAdmitDialog(joint);
    setAdmitForm({ admitted_no: "", admitted_by_side: "Plaintiff", date_admitted: new Date().toISOString().split("T")[0], notes: "" });
  };

  const saveAdmit = async () => {
    const data = { ...admitForm, case_id: activeCase.id, joint_exhibit_id: admitDialog.id };
    await base44.entities.AdmittedExhibits.create(data);
    await base44.entities.JointExhibits.update(admitDialog.id, { status: "Admitted" });
    setAdmitDialog(null);
    load();
  };

  const saveEditAdmit = async () => {
    await base44.entities.AdmittedExhibits.update(editAdmit.id, editAdmit);
    setEditAdmit(null);
    load();
  };

  const removeAdmit = async (admRec, jointId) => {
    if (!confirm("Remove admission? Exhibit will revert to Marked status.")) return;
    await base44.entities.AdmittedExhibits.delete(admRec.id);
    await base44.entities.JointExhibits.update(jointId, { status: "Marked" });
    load();
  };

  if (!activeCase) return <div className="p-8 text-slate-400">No active case selected.</div>;

  const admittedCount = joints.filter(j => admittedByJointId[j.id]).length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Joint Exhibit List</h1>
          <div className="flex gap-3 mt-1 text-xs text-slate-500">
            <span>{joints.length} marked</span>
            <span className="text-slate-600">·</span>
            <span className="text-green-400">{admittedCount} admitted</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="relative min-w-[200px] max-w-xs flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-[#131a2e] border-[#1e2a45] text-slate-200" />
        </div>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 bg-[#131a2e] border-[#1e2a45] text-slate-200 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {["Marked","Offered","Admitted","Excluded","Withdrawn","NotUsed"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterSide} onValueChange={setFilterSide}>
          <SelectTrigger className="w-36 bg-[#131a2e] border-[#1e2a45] text-slate-200 h-9"><SelectValue placeholder="Side" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sides</SelectItem>
            {["Plaintiff","Defense","Unknown"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.map(j => {
          const admRec = admittedByJointId[j.id];
          const depo = depoByJointId[j.id];
          return (
            <Accordion key={j.id} type="single" collapsible>
              <AccordionItem value={j.id} className="bg-[#131a2e] border border-[#1e2a45] rounded-lg">
                <AccordionTrigger className="px-4 py-3 hover:no-underline [&>svg]:hidden">
                  <div className="flex items-center gap-3 w-full text-left">
                    {/* Exhibit number */}
                    <div className="flex-shrink-0 text-center w-16">
                      <span className="text-lg font-bold text-cyan-400">#{j.marked_no}</span>
                    </div>

                    {/* Title + source */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-white font-medium">{j.marked_title}</p>
                        {(() => {
                          const allDepos = deposByJointId[j.id] || [];
                          const primary = allDepos.find(d => d.id === j.primary_depo_exhibit_id) || allDepos[0];
                          return primary?.file_url ? (
                            <button
                              onClick={e => { e.stopPropagation(); setViewFile({ url: primary.file_url, title: j.marked_title }); }}
                              className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 rounded px-1.5 py-0.5"
                              title="View attached file"
                            >
                              <ExternalLink className="w-3 h-3" /> View File
                            </button>
                          ) : null;
                        })()}
                      </div>
                      {(() => {
                        const allDepos = deposByJointId[j.id] || [];
                        const primary = allDepos.find(d => d.id === j.primary_depo_exhibit_id) || allDepos[0];
                        return primary && primary.depo_exhibit_title !== j.marked_title
                          ? <p className="text-xs text-slate-600">Depo: {primary.display_title || primary.depo_exhibit_title}{allDepos.length > 1 ? ` +${allDepos.length - 1} more` : ""}{j.pages ? ` · pp. ${j.pages}` : ""}</p>
                          : j.pages ? <p className="text-xs text-slate-600">pp. {j.pages}</p> : null;
                      })()}
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <Badge className={`text-[10px] ${statusColors[j.status]}`}>{j.status}</Badge>
                        <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-700">{j.marked_by_side}</Badge>
                      </div>
                    </div>

                    {/* Admitted chip or button */}
                    <div className="flex-shrink-0 flex items-center gap-2 pr-2">
                      {admRec ? (
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block">Admitted</span>
                          <span className="text-xs font-semibold text-green-400">#{admRec.admitted_no} · {fmtDate(admRec.date_admitted)}</span>
                          <span className="text-[10px] text-slate-600 block">{admRec.admitted_by_side}</span>
                        </div>
                      ) : (
                        <button
                          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-colors"
                          onClick={e => { e.stopPropagation(); openAdmit(j); }}
                        >
                          <CheckSquare className="w-3 h-3" /> Admit
                        </button>
                      )}
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="px-4 pb-4 pt-0 border-t border-[#1e2a45]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
                    {/* Left: joint details */}
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Marking Details</p>
                      <div className="space-y-1 text-xs text-slate-400">
                        <p><span className="text-slate-500">Marked #:</span> {j.marked_no}</p>
                        <p><span className="text-slate-500">Title:</span> {j.marked_title}</p>
                        <p><span className="text-slate-500">By:</span> {j.marked_by_side}</p>
                        <p><span className="text-slate-500">Status:</span> {j.status}</p>
                        {j.pages && <p><span className="text-slate-500">Pages:</span> {j.pages}</p>}
                        {j.notes && <p className="text-slate-500 italic">{j.notes}</p>}
                        {(() => {
                          const allDepos = deposByJointId[j.id] || (depoByJointId[j.id] ? [depoByJointId[j.id]] : []);
                          if (!allDepos.length) return null;
                          return (
                            <div className="mt-2 pt-2 border-t border-[#1e2a45]">
                              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                Source Exhibit{allDepos.length > 1 ? "s" : ""} ({allDepos.length})
                              </p>
                              {allDepos.map(d => (
                                <div key={d.id} className={`mb-1 pb-1 border-b border-[#1e2a45] last:border-0 ${j.primary_depo_exhibit_id === d.id ? "text-cyan-300" : ""}`}>
                                  <p>
                                    {j.primary_depo_exhibit_id === d.id && <span className="text-[9px] text-cyan-500 mr-1">[PRIMARY]</span>}
                                    No. {d.depo_exhibit_no} — {d.display_title || d.depo_exhibit_title}
                                  </p>
                                  {d.deponent_name && <p className="text-slate-600 text-[10px]">Deponent: {d.deponent_name}</p>}
                                  {d.referenced_page && <p className="text-slate-500 text-[10px]">Page {d.referenced_page}</p>}
                                  {(d.tags || []).length > 0 && (
                                    <div className="flex gap-1 mt-0.5 flex-wrap">
                                      {(d.tags || []).map(t => <Badge key={t} variant="outline" className="text-[10px] text-slate-500 border-slate-700">{t}</Badge>)}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button className="text-[10px] text-slate-400 hover:text-cyan-400" onClick={() => setEditJoint({ ...j })}>Edit marking</button>
                        <span className="text-slate-700">·</span>
                        <button className="text-[10px] text-slate-400 hover:text-red-400" onClick={() => removeJoint(j)}>Remove from list</button>
                      </div>
                    </div>

                    {/* Right: admission */}
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Admission</p>
                      {admRec ? (
                        <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div><span className="text-slate-500">Admitted #:</span> <span className="text-green-400 font-semibold">{admRec.admitted_no}</span></div>
                            <div><span className="text-slate-500">By:</span> <span className="text-slate-300">{admRec.admitted_by_side}</span></div>
                            <div className="col-span-2"><span className="text-slate-500">Date:</span> <span className="text-slate-300">{fmtDate(admRec.date_admitted)}</span></div>
                          </div>
                          {admRec.notes && <p className="text-xs text-slate-500 mt-2 italic">{admRec.notes}</p>}
                          <div className="flex gap-2 mt-2">
                            <button className="text-[10px] text-slate-400 hover:text-cyan-400" onClick={() => setEditAdmit({ ...admRec })}>Edit</button>
                            <span className="text-slate-700">·</span>
                            <button className="text-[10px] text-slate-400 hover:text-red-400" onClick={() => removeAdmit(admRec, j.id)}>Remove</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <p className="text-xs text-slate-500">Not yet admitted.</p>
                          <Button size="sm" className="bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 text-xs h-7 w-fit" onClick={() => openAdmit(j)}>
                            <CheckSquare className="w-3 h-3 mr-1" /> Mark as Admitted
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-sm">
            {joints.length === 0 ? "No exhibits have been marked yet. Go to Deposition Exhibits to mark them." : "No exhibits match the current filters."}
          </div>
        )}
      </div>

      {viewFile && <FileViewerModal url={viewFile.url} title={viewFile.title} onClose={() => setViewFile(null)} />}

      {/* ── Edit Joint Dialog ── */}
      <Dialog open={!!editJoint} onOpenChange={v => !v && setEditJoint(null)}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200">
          <DialogHeader><DialogTitle>Edit Marking</DialogTitle></DialogHeader>
          {editJoint && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-slate-400 text-xs">Exhibit #</Label>
                  <Input value={editJoint.marked_no} onChange={e => setEditJoint({ ...editJoint, marked_no: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
                </div>
                <div><Label className="text-slate-400 text-xs">Marked By</Label>
                  <Select value={editJoint.marked_by_side} onValueChange={v => setEditJoint({ ...editJoint, marked_by_side: v })}>
                    <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>{["Plaintiff","Defense","Unknown"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label className="text-slate-400 text-xs">Trial Title</Label>
                <Input value={editJoint.marked_title} onChange={e => setEditJoint({ ...editJoint, marked_title: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
              </div>
              <div><Label className="text-slate-400 text-xs">Pages <span className="text-slate-600">(e.g. "3" or "1-5")</span></Label>
                <Input value={editJoint.pages || ""} onChange={e => setEditJoint({ ...editJoint, pages: e.target.value })} placeholder="All pages" className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
              </div>
              <div><Label className="text-slate-400 text-xs">Status</Label>
                <Select value={editJoint.status} onValueChange={v => setEditJoint({ ...editJoint, status: v })}>
                  <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent>{["NotUsed","Marked","Offered","Admitted","Excluded","Withdrawn"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-slate-400 text-xs">Notes</Label>
                <Textarea value={editJoint.notes || ""} onChange={e => setEditJoint({ ...editJoint, notes: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditJoint(null)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={saveJoint}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Admit Dialog ── */}
      <Dialog open={!!admitDialog} onOpenChange={v => !v && setAdmitDialog(null)}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200">
          <DialogHeader>
            <DialogTitle>Admit Exhibit</DialogTitle>
            {admitDialog && <p className="text-xs text-slate-500 mt-1">Exhibit {admitDialog.marked_no} — {admitDialog.marked_title}</p>}
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-slate-400 text-xs">Admitted #</Label>
                <Input placeholder="e.g. 12" value={admitForm.admitted_no} onChange={e => setAdmitForm({ ...admitForm, admitted_no: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
              </div>
              <div><Label className="text-slate-400 text-xs">Date Admitted</Label>
                <Input type="date" value={admitForm.date_admitted} onChange={e => setAdmitForm({ ...admitForm, date_admitted: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
              </div>
            </div>
            <div><Label className="text-slate-400 text-xs">Admitted By</Label>
              <Select value={admitForm.admitted_by_side} onValueChange={v => setAdmitForm({ ...admitForm, admitted_by_side: v })}>
                <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>{["Plaintiff","Defense","Unknown"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-slate-400 text-xs">Notes</Label>
              <Textarea value={admitForm.notes} onChange={e => setAdmitForm({ ...admitForm, notes: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdmitDialog(null)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={saveAdmit}>Admit Exhibit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Admitted Dialog ── */}
      <Dialog open={!!editAdmit} onOpenChange={v => !v && setEditAdmit(null)}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200">
          <DialogHeader><DialogTitle>Edit Admission</DialogTitle></DialogHeader>
          {editAdmit && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-slate-400 text-xs">Admitted #</Label>
                  <Input value={editAdmit.admitted_no} onChange={e => setEditAdmit({ ...editAdmit, admitted_no: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
                </div>
                <div><Label className="text-slate-400 text-xs">Date</Label>
                  <Input type="date" value={editAdmit.date_admitted || ""} onChange={e => setEditAdmit({ ...editAdmit, date_admitted: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
                </div>
              </div>
              <div><Label className="text-slate-400 text-xs">Admitted By</Label>
                <Select value={editAdmit.admitted_by_side} onValueChange={v => setEditAdmit({ ...editAdmit, admitted_by_side: v })}>
                  <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent>{["Plaintiff","Defense","Unknown"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-slate-400 text-xs">Notes</Label>
                <Textarea value={editAdmit.notes || ""} onChange={e => setEditAdmit({ ...editAdmit, notes: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAdmit(null)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={saveEditAdmit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}