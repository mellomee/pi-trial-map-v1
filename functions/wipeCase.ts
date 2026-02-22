import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function deleteWithRetry(base44, ent, id, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await base44.asServiceRole.entities[ent].delete(id);
      return;
    } catch (e) {
      if (e.status === 429 && i < retries - 1) {
        await sleep(1000 * (i + 1));
      } else {
        throw e;
      }
    }
  }
}

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
      await deleteWithRetry(base44, ent, item.id);
      await sleep(300);
    }
    deleted[ent] = items.length;
    await sleep(200);
  }

  return Response.json({ success: true, deleted });
});