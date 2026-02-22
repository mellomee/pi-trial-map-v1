import React, { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search, Plus, Pencil, Trash2, ExternalLink, Upload,
  Tag, CheckSquare, ChevronDown, Filter, X
} from "lucide-react";
import { format } from "date-fns";

const sideColors = {
  Plaintiff: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Defense: "bg-red-500/20 text-red-400 border-red-500/30",
  Independent: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Unknown: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

const EMPTY_MASTER = { master_title: "", master_description: "", provided_by_side: "Unknown", file_url: "", notes: "" };

export default function Exhibits() {
  const { activeCase } = useActiveCase();

  // Data
  const [masters, setMasters] = useState([]);
  const [joints, setJoints] = useState([]);
  const [admitted, setAdmitted] = useState([]);
  const [depoExhibits, setDepoExhibits] = useState([]);
  const [links, setLinks] = useState([]);
  const [parties, setParties] = useState([]);

  // UI state
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // all | unmarked | marked | admitted
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [uploading, setUploading] = useState(false);

  // Dialogs
  const [editMaster, setEditMaster] = useState(null);
  const [markDialog, setMarkDialog] = useState(false); // for marking selected exhibits
  const [markForm, setMarkForm] = useState({ marked_no: "", marked_title: "", marked_by_side: "Plaintiff", status: "Marked", notes: "" });
  const [admitDialog, setAdmitDialog] = useState(null); // joint exhibit being admitted
  const [admitForm, setAdmitForm] = useState({ admitted_no: "", admitted_by_side: "Plaintiff", date_admitted: new Date().toISOString().split("T")[0], notes: "" });
  const [editJointDialog, setEditJointDialog] = useState(null);
  const [editAdmitDialog, setEditAdmitDialog] = useState(null);

  const load = async () => {
    if (!activeCase) return;
    const cid = activeCase.id;
    const [me, jo, ad, de, el, pa] = await Promise.all([
      base44.entities.MasterExhibits.filter({ case_id: cid }),
      base44.entities.JointExhibits.filter({ case_id: cid }),
      base44.entities.AdmittedExhibits.filter({ case_id: cid }),
      base44.entities.DepositionExhibits.filter({ case_id: cid }),
      base44.entities.ExhibitLinks.filter({ case_id: cid }),
      base44.entities.Parties.filter({ case_id: cid }),
    ]);
    setMasters(me);
    setJoints(jo);
    setAdmitted(ad);
    setDepoExhibits(de);
    setLinks(el);
    setParties(pa);
  };

  useEffect(() => { load(); }, [activeCase]);

  // Derived lookups
  const jointByMasterId = {};
  joints.forEach(j => { jointByMasterId[j.master_exhibit_id] = j; });

  const admittedByJointId = {};
  admitted.forEach(a => { admittedByJointId[a.joint_exhibit_id] = a; });

  const getLinkedDepos = (masterId) =>
    links.filter(l => l.master_exhibit_id === masterId).map(l => {
      const de = depoExhibits.find(d => d.id === l.deposition_exhibit_id);
      const party = parties.find(p => p.id === l.deponent_party_id);
      return { ...l, depoExhibit: de, party };
    });

  // Filter
  const filtered = masters.filter(ex => {
    const joint = jointByMasterId[ex.id];
    const admittedRec = joint ? admittedByJointId[joint.id] : null;
    const matchSearch = !search || ex.master_title?.toLowerCase().includes(search.toLowerCase());
    let matchStatus = true;
    if (filterStatus === "unmarked") matchStatus = !joint;
    if (filterStatus === "marked") matchStatus = !!joint && !admittedRec;
    if (filterStatus === "admitted") matchStatus = !!admittedRec;
    return matchSearch && matchStatus;
  });

  // Selection
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(e => e.id)));
  };
  const clearSelection = () => setSelectedIds(new Set());

  // Save master exhibit
  const saveMaster = async () => {
    const data = { ...editMaster, case_id: activeCase.id };
    if (editMaster.id) await base44.entities.MasterExhibits.update(editMaster.id, data);
    else await base44.entities.MasterExhibits.create(data);
    setEditMaster(null);
    load();
  };

  const deleteMaster = async (id) => {
    if (!confirm("Delete this exhibit from the master library?")) return;
    await base44.entities.MasterExhibits.delete(id);
    load();
  };

  const handleFileUpload = async (file) => {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setEditMaster(prev => ({ ...prev, file_url }));
    setUploading(false);
  };

  // Mark selected exhibits as joint
  const openMarkDialog = () => {
    if (selectedIds.size === 0) return;
    const firstSelected = masters.find(m => m.id === [...selectedIds][0]);
    setMarkForm({
      marked_no: "",
      marked_title: firstSelected?.master_title || "",
      marked_by_side: "Plaintiff",
      status: "Marked",
      notes: ""
    });
    setMarkDialog(true);
  };

  const saveMarkExhibits = async () => {
    for (const masterId of selectedIds) {
      // Skip if already marked
      if (jointByMasterId[masterId]) continue;
      const master = masters.find(m => m.id === masterId);
      await base44.entities.JointExhibits.create({
        case_id: activeCase.id,
        master_exhibit_id: masterId,
        marked_no: markForm.marked_no,
        marked_title: markForm.marked_title || master?.master_title || "",
        marked_by_side: markForm.marked_by_side,
        status: markForm.status,
        notes: markForm.notes,
      });
    }
    setMarkDialog(false);
    clearSelection();
    load();
  };

  // Edit joint exhibit inline
  const saveJoint = async () => {
    const data = { ...editJointDialog };
    await base44.entities.JointExhibits.update(data.id, data);
    setEditJointDialog(null);
    load();
  };

  const removeJoint = async (jointId) => {
    if (!confirm("Remove marking from this exhibit?")) return;
    await base44.entities.JointExhibits.delete(jointId);
    load();
  };

  // Admit exhibit
  const openAdmitDialog = (joint) => {
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
    await base44.entities.AdmittedExhibits.update(editAdmitDialog.id, editAdmitDialog);
    setEditAdmitDialog(null);
    load();
  };

  const removeAdmit = async (admitId, jointId) => {
    if (!confirm("Remove admission record?")) return;
    await base44.entities.AdmittedExhibits.delete(admitId);
    await base44.entities.JointExhibits.update(jointId, { status: "Marked" });
    load();
  };

  const fmtDate = (d) => { try { return format(new Date(d), "MMM d, yyyy"); } catch { return d; } };

  if (!activeCase) return <div className="p-8 text-slate-400">No active case selected.</div>;

  const unmarkedCount = masters.filter(m => !jointByMasterId[m.id]).length;
  const markedCount = joints.filter(j => !admittedByJointId[j.id]).length;
  const admittedCount = admitted.length;

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Exhibits</h1>
          <div className="flex gap-3 mt-1 text-xs text-slate-500">
            <span>{masters.length} total</span>
            <span className="text-slate-600">·</span>
            <span className="text-cyan-400">{markedCount} marked</span>
            <span className="text-slate-600">·</span>
            <span className="text-green-400">{admittedCount} admitted</span>
          </div>
        </div>
        <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => setEditMaster({ ...EMPTY_MASTER })}>
          <Plus className="w-4 h-4 mr-2" /> Add Exhibit
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <Input placeholder="Search exhibits..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-[#131a2e] border-[#1e2a45] text-slate-200" />
        </div>

        {/* Status filter pills */}
        <div className="flex gap-1">
          {[
            { val: "all", label: "All" },
            { val: "unmarked", label: `Unmarked (${unmarkedCount})` },
            { val: "marked", label: `Marked (${markedCount})` },
            { val: "admitted", label: `Admitted (${admittedCount})` },
          ].map(f => (
            <button key={f.val} onClick={() => setFilterStatus(f.val)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterStatus === f.val ? "bg-cyan-600 text-white" : "bg-[#131a2e] text-slate-400 hover:text-slate-200 border border-[#1e2a45]"}`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Selection actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-slate-400">{selectedIds.size} selected</span>
            <Button size="sm" className="h-7 bg-cyan-600 hover:bg-cyan-700 text-xs" onClick={openMarkDialog}>
              <Tag className="w-3 h-3 mr-1" /> Mark as Joint
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400" onClick={clearSelection}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Select all row */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 mb-1 text-xs text-slate-500">
          <Checkbox
            checked={selectedIds.size === filtered.length && filtered.length > 0}
            onCheckedChange={toggleSelectAll}
            className="border-slate-600"
          />
          <span>Select all ({filtered.length})</span>
        </div>
      )}

      {/* Exhibit rows */}
      <div className="space-y-1">
        {filtered.map(ex => {
          const joint = jointByMasterId[ex.id];
          const admittedRec = joint ? admittedByJointId[joint.id] : null;
          const linkedDepos = getLinkedDepos(ex.id);
          const isSelected = selectedIds.has(ex.id);

          return (
            <Accordion key={ex.id} type="single" collapsible>
              <AccordionItem value={ex.id} className={`rounded-lg border transition-colors ${isSelected ? "border-cyan-500/50 bg-cyan-500/5" : "border-[#1e2a45] bg-[#131a2e]"}`}>
                <div className="flex items-center gap-2 px-3 py-0.5">
                  {/* Checkbox */}
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(ex.id)}
                    className="border-slate-600 flex-shrink-0"
                    onClick={e => e.stopPropagation()}
                  />

                  {/* Main accordion trigger row */}
                  <AccordionTrigger className="flex-1 py-3 hover:no-underline [&>svg]:hidden">
                    <div className="flex items-center gap-3 flex-1 text-left w-full">
                      {/* Title + side badge */}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-white font-medium truncate block">{ex.master_title}</span>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <Badge className={`text-[10px] border ${sideColors[ex.provided_by_side]}`}>{ex.provided_by_side}</Badge>
                          {ex.file_url && <Badge variant="outline" className="text-green-400 border-green-500/30 text-[10px]">File</Badge>}
                          {linkedDepos.length > 0 && <Badge variant="outline" className="text-slate-500 border-slate-600 text-[10px]">{linkedDepos.length} depo refs</Badge>}
                        </div>
                      </div>

                      {/* Status chips */}
                      <div className="flex items-center gap-2 flex-shrink-0 pr-2">
                        {joint ? (
                          <div className="flex items-center gap-1.5">
                            <div className="text-right">
                              <span className="text-[10px] text-slate-500 block">Marked</span>
                              <span className="text-xs font-semibold text-cyan-400">Exhibit {joint.marked_no}</span>
                            </div>
                            {admittedRec ? (
                              <div className="text-right ml-3">
                                <span className="text-[10px] text-slate-500 block">Admitted</span>
                                <span className="text-xs font-semibold text-green-400">#{admittedRec.admitted_no} · {fmtDate(admittedRec.date_admitted)}</span>
                              </div>
                            ) : (
                              <button
                                className="ml-3 text-[10px] px-2 py-0.5 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-colors"
                                onClick={e => { e.stopPropagation(); openAdmitDialog(joint); }}
                              >
                                + Admit
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-600 italic">Unmarked</span>
                        )}
                        <ChevronDown className="w-4 h-4 text-slate-500 transition-transform duration-200 accordion-chevron" />
                      </div>
                    </div>
                  </AccordionTrigger>
                </div>

                {/* Expanded content */}
                <AccordionContent className="px-4 pb-4 pt-0 border-t border-[#1e2a45]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
                    {/* Left: Master exhibit details */}
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Exhibit Details</p>
                      {ex.master_description && <p className="text-xs text-slate-400 mb-2">{ex.master_description}</p>}
                      {ex.notes && <p className="text-xs text-slate-500 mb-2 italic">{ex.notes}</p>}
                      {ex.file_url && (
                        <a href={ex.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:underline flex items-center gap-1 mb-2">
                          <ExternalLink className="w-3 h-3" /> View File
                        </a>
                      )}
                      {linkedDepos.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Depo References</p>
                          {linkedDepos.map((ld, i) => (
                            <p key={i} className="text-xs text-slate-400 ml-1">
                              {ld.party ? `${ld.party.first_name} ${ld.party.last_name}` : "Unknown"}: Exh {ld.depoExhibit?.depo_exhibit_no} — {ld.source_cite && <span className="text-slate-500">p.{ld.source_cite}</span>}
                            </p>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 mt-3">
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400 hover:text-cyan-400" onClick={() => setEditMaster({ ...ex })}>
                          <Pencil className="w-3 h-3 mr-1" /> Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400 hover:text-red-400" onClick={() => deleteMaster(ex.id)}>
                          <Trash2 className="w-3 h-3 mr-1" /> Delete
                        </Button>
                      </div>
                    </div>

                    {/* Right: Joint + Admitted info */}
                    <div>
                      {joint ? (
                        <>
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Marked Exhibit</p>
                          <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-3 mb-3">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div><span className="text-slate-500">Number:</span> <span className="text-cyan-400 font-semibold">Exhibit {joint.marked_no}</span></div>
                              <div><span className="text-slate-500">Marked By:</span> <span className="text-slate-300">{joint.marked_by_side}</span></div>
                              <div><span className="text-slate-500">Status:</span> <span className="text-slate-300">{joint.status}</span></div>
                              {joint.marked_title !== ex.master_title && <div className="col-span-2"><span className="text-slate-500">Trial Title:</span> <span className="text-slate-300">{joint.marked_title}</span></div>}
                            </div>
                            {joint.notes && <p className="text-xs text-slate-500 mt-2 italic">{joint.notes}</p>}
                            <div className="flex gap-2 mt-2">
                              <button className="text-[10px] text-slate-400 hover:text-cyan-400" onClick={() => setEditJointDialog({ ...joint })}>Edit marking</button>
                              <span className="text-slate-700">·</span>
                              <button className="text-[10px] text-slate-400 hover:text-red-400" onClick={() => removeJoint(joint.id)}>Remove marking</button>
                            </div>
                          </div>

                          {admittedRec ? (
                            <>
                              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Admitted</p>
                              <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div><span className="text-slate-500">Admitted #:</span> <span className="text-green-400 font-semibold">{admittedRec.admitted_no}</span></div>
                                  <div><span className="text-slate-500">By:</span> <span className="text-slate-300">{admittedRec.admitted_by_side}</span></div>
                                  <div><span className="text-slate-500">Date:</span> <span className="text-slate-300">{fmtDate(admittedRec.date_admitted)}</span></div>
                                </div>
                                {admittedRec.notes && <p className="text-xs text-slate-500 mt-2 italic">{admittedRec.notes}</p>}
                                <div className="flex gap-2 mt-2">
                                  <button className="text-[10px] text-slate-400 hover:text-cyan-400" onClick={() => setEditAdmitDialog({ ...admittedRec })}>Edit</button>
                                  <span className="text-slate-700">·</span>
                                  <button className="text-[10px] text-slate-400 hover:text-red-400" onClick={() => removeAdmit(admittedRec.id, joint.id)}>Remove</button>
                                </div>
                              </div>
                            </>
                          ) : (
                            <Button size="sm" className="bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 text-xs h-7" onClick={() => openAdmitDialog(joint)}>
                              <CheckSquare className="w-3 h-3 mr-1" /> Mark as Admitted
                            </Button>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-start gap-2">
                          <p className="text-xs text-slate-500">Not yet marked as a joint exhibit.</p>
                          <Button size="sm" className="bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 text-xs h-7" onClick={() => { setSelectedIds(new Set([ex.id])); openMarkDialog(); }}>
                            <Tag className="w-3 h-3 mr-1" /> Mark as Joint
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
          <div className="text-center py-12 text-slate-500 text-sm">No exhibits found.</div>
        )}
      </div>

      {/* ── Add/Edit Master Exhibit Dialog ── */}
      <Dialog open={!!editMaster} onOpenChange={v => !v && setEditMaster(null)}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200">
          <DialogHeader><DialogTitle>{editMaster?.id ? "Edit" : "Add"} Exhibit</DialogTitle></DialogHeader>
          {editMaster && (
            <div className="space-y-3">
              <div><Label className="text-slate-400 text-xs">Title</Label>
                <Input value={editMaster.master_title} onChange={e => setEditMaster({ ...editMaster, master_title: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
              </div>
              <div><Label className="text-slate-400 text-xs">Description</Label>
                <Textarea value={editMaster.master_description || ""} onChange={e => setEditMaster({ ...editMaster, master_description: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} />
              </div>
              <div><Label className="text-slate-400 text-xs">Side</Label>
                <Select value={editMaster.provided_by_side} onValueChange={v => setEditMaster({ ...editMaster, provided_by_side: v })}>
                  <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent>{["Plaintiff","Defense","Independent","Unknown"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-slate-400 text-xs">File</Label>
                <div className="flex gap-2">
                  <Input value={editMaster.file_url || ""} onChange={e => setEditMaster({ ...editMaster, file_url: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200 flex-1" placeholder="URL or upload" />
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" className="border-slate-600" disabled={uploading} asChild>
                      <span><Upload className="w-3 h-3 mr-1" />{uploading ? "..." : "Upload"}</span>
                    </Button>
                    <input type="file" className="hidden" onChange={e => e.target.files[0] && handleFileUpload(e.target.files[0])} />
                  </label>
                </div>
              </div>
              <div><Label className="text-slate-400 text-xs">Notes</Label>
                <Textarea value={editMaster.notes || ""} onChange={e => setEditMaster({ ...editMaster, notes: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMaster(null)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={saveMaster}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Mark as Joint Dialog ── */}
      <Dialog open={markDialog} onOpenChange={v => !v && setMarkDialog(false)}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200">
          <DialogHeader>
            <DialogTitle>Mark as Joint Exhibit</DialogTitle>
            <p className="text-xs text-slate-500 mt-1">{selectedIds.size} exhibit(s) selected</p>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-slate-400 text-xs">Exhibit Number</Label>
                <Input placeholder="e.g. 5" value={markForm.marked_no} onChange={e => setMarkForm({ ...markForm, marked_no: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
              </div>
              <div><Label className="text-slate-400 text-xs">Marked By</Label>
                <Select value={markForm.marked_by_side} onValueChange={v => setMarkForm({ ...markForm, marked_by_side: v })}>
                  <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent>{["Plaintiff","Defense","Unknown"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-slate-400 text-xs">Trial Title (optional)</Label>
              <Input placeholder="Leave blank to use exhibit title" value={markForm.marked_title} onChange={e => setMarkForm({ ...markForm, marked_title: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
            </div>
            <div><Label className="text-slate-400 text-xs">Status</Label>
              <Select value={markForm.status} onValueChange={v => setMarkForm({ ...markForm, status: v })}>
                <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>{["Marked","Offered","Admitted","Excluded","Withdrawn"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-slate-400 text-xs">Notes</Label>
              <Textarea value={markForm.notes} onChange={e => setMarkForm({ ...markForm, notes: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkDialog(false)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={saveMarkExhibits}>Mark Exhibits</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Joint Exhibit Dialog ── */}
      <Dialog open={!!editJointDialog} onOpenChange={v => !v && setEditJointDialog(null)}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200">
          <DialogHeader><DialogTitle>Edit Marking</DialogTitle></DialogHeader>
          {editJointDialog && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-slate-400 text-xs">Exhibit Number</Label>
                  <Input value={editJointDialog.marked_no} onChange={e => setEditJointDialog({ ...editJointDialog, marked_no: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
                </div>
                <div><Label className="text-slate-400 text-xs">Marked By</Label>
                  <Select value={editJointDialog.marked_by_side} onValueChange={v => setEditJointDialog({ ...editJointDialog, marked_by_side: v })}>
                    <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>{["Plaintiff","Defense","Unknown"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label className="text-slate-400 text-xs">Trial Title</Label>
                <Input value={editJointDialog.marked_title} onChange={e => setEditJointDialog({ ...editJointDialog, marked_title: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
              </div>
              <div><Label className="text-slate-400 text-xs">Status</Label>
                <Select value={editJointDialog.status} onValueChange={v => setEditJointDialog({ ...editJointDialog, status: v })}>
                  <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent>{["NotUsed","Marked","Offered","Admitted","Excluded","Withdrawn"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-slate-400 text-xs">Notes</Label>
                <Textarea value={editJointDialog.notes || ""} onChange={e => setEditJointDialog({ ...editJointDialog, notes: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditJointDialog(null)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={saveJoint}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Admit Exhibit Dialog ── */}
      <Dialog open={!!admitDialog} onOpenChange={v => !v && setAdmitDialog(null)}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200">
          <DialogHeader>
            <DialogTitle>Admit Exhibit</DialogTitle>
            {admitDialog && <p className="text-xs text-slate-500 mt-1">Exhibit {admitDialog.marked_no} — {admitDialog.marked_title}</p>}
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-slate-400 text-xs">Admitted Number</Label>
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
      <Dialog open={!!editAdmitDialog} onOpenChange={v => !v && setEditAdmitDialog(null)}>
        <DialogContent className="bg-[#131a2e] border-[#1e2a45] text-slate-200">
          <DialogHeader><DialogTitle>Edit Admission</DialogTitle></DialogHeader>
          {editAdmitDialog && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-slate-400 text-xs">Admitted Number</Label>
                  <Input value={editAdmitDialog.admitted_no} onChange={e => setEditAdmitDialog({ ...editAdmitDialog, admitted_no: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
                </div>
                <div><Label className="text-slate-400 text-xs">Date Admitted</Label>
                  <Input type="date" value={editAdmitDialog.date_admitted || ""} onChange={e => setEditAdmitDialog({ ...editAdmitDialog, date_admitted: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" />
                </div>
              </div>
              <div><Label className="text-slate-400 text-xs">Admitted By</Label>
                <Select value={editAdmitDialog.admitted_by_side} onValueChange={v => setEditAdmitDialog({ ...editAdmitDialog, admitted_by_side: v })}>
                  <SelectTrigger className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent>{["Plaintiff","Defense","Unknown"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-slate-400 text-xs">Notes</Label>
                <Textarea value={editAdmitDialog.notes || ""} onChange={e => setEditAdmitDialog({ ...editAdmitDialog, notes: e.target.value })} className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200" rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAdmitDialog(null)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={saveEditAdmit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}