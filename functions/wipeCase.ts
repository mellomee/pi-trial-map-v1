import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
    let items = [];
    try {
      await sleep(600);
      items = await base44.asServiceRole.entities[ent].filter({ case_id }, null, 200);
    } catch (e) {
      // rate limit on filter - wait longer and retry once
      await sleep(3000);
      try {
        items = await base44.asServiceRole.entities[ent].filter({ case_id }, null, 200);
      } catch (_) {
        items = [];
      }
    }

    for (const item of items) {
      let success = false;
      for (let attempt = 0; attempt < 4 && !success; attempt++) {
        try {
          await base44.asServiceRole.entities[ent].delete(item.id);
          success = true;
          await sleep(400);
        } catch (e) {
          await sleep(1500 * (attempt + 1));
        }
      }
    }

    deleted[ent] = items.length;
  }

  return Response.json({ success: true, deleted });
});