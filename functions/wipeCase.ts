import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { case_id } = await req.json();
  if (!case_id) return Response.json({ error: "case_id required" }, { status: 400 });

  const entities = [
    "DepoClips", "QuestionLinks", "Questions", "AdmittedExhibits",
    "JointExhibits", "ExhibitLinks", "DepositionTranscripts", "DepositionExhibits",
    "Depositions", "BattleCards", "TrialPoints", "Parties",
    "MasterExhibits", "ChatMessages", "ImportRuns"
  ];

  const deleted = {};
  for (const ent of entities) {
    const items = await base44.asServiceRole.entities[ent].filter({ case_id });
    for (const item of items) {
      await base44.asServiceRole.entities[ent].delete(item.id);
    }
    deleted[ent] = items.length;
    await new Promise(r => setTimeout(r, 100));
  }

  return Response.json({ success: true, deleted });
});