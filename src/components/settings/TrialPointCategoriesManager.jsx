import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, GripVertical, Pencil, Check, X } from "lucide-react";

export default function TrialPointCategoriesManager({ caseId }) {
  const [cats, setCats] = useState([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  const load = async () => {
    const data = await base44.entities.TrialPointCategories.filter({ case_id: caseId });
    setCats(data.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)));
  };

  useEffect(() => { if (caseId) load(); }, [caseId]);

  const add = async () => {
    if (!newName.trim()) return;
    await base44.entities.TrialPointCategories.create({ case_id: caseId, name: newName.trim(), order_index: cats.length });
    setNewName("");
    load();
  };

  const remove = async (id) => {
    if (!confirm("Delete this category? Trial points using it will become uncategorized.")) return;
    await base44.entities.TrialPointCategories.delete(id);
    load();
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditingName(c.name);
  };

  const saveEdit = async (id) => {
    if (!editingName.trim()) return;
    await base44.entities.TrialPointCategories.update(id, { name: editingName.trim() });
    setEditingId(null);
    load();
  };

  const cancelEdit = () => setEditingId(null);

  return (
    <Card className="bg-[#131a2e] border-[#1e2a45]">
      <CardHeader>
        <CardTitle className="text-white text-base">Trial Point Categories</CardTitle>
        <p className="text-xs text-slate-500">Define custom categories to group trial points.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && add()}
            placeholder="New category name..."
            className="bg-[#0a0f1e] border-[#1e2a45] text-slate-200"
          />
          <Button className="bg-cyan-600 hover:bg-cyan-700 flex-shrink-0" onClick={add}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {cats.length === 0 && <p className="text-xs text-slate-500">No categories yet.</p>}
        <div className="space-y-1">
          {cats.map(c => (
            <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded border border-[#1e2a45] bg-[#0a0f1e]">
              <GripVertical className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
              {editingId === c.id ? (
                <>
                  <Input
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveEdit(c.id); if (e.key === "Escape") cancelEdit(); }}
                    className="flex-1 bg-[#131a2e] border-[#1e2a45] text-slate-200 h-7 text-sm"
                    autoFocus
                  />
                  <button onClick={() => saveEdit(c.id)} className="text-green-400 hover:text-green-300">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={cancelEdit} className="text-slate-500 hover:text-slate-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-slate-200">{c.name}</span>
                  <button onClick={() => startEdit(c)} className="text-slate-500 hover:text-cyan-400">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => remove(c.id)} className="text-slate-500 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}