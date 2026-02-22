import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const ENTITIES = [
  "DepoClips", "QuestionLinks", "Questions", "AdmittedExhibits",
  "JointExhibits", "ExhibitLinks", "DepositionTranscripts", "DepositionExhibits",
  "Depositions", "BattleCards", "TrialPoints", "Parties",
  "MasterExhibits", "ChatMessages", "ImportRuns"
];

async function safeFilter(base44, ent, case_id) {
  const all = [];
  let skip = 0;
  const limit = 200;
  while (true) {
    let batch = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        batch = await base44.asServiceRole.entities[ent].filter({ case_id }, null, limit, skip);
        break;
      } catch (e) {
        if (e.status === 429) {
          await sleep(2000 * (attempt + 1));
        } else {
          return all;
        }
      }
    }
    all.push(...batch);
    if (batch.length < limit) break;
    skip += limit;
  }
  return all;
}

async function safeDelete(base44, ent, id) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await base44.asServiceRole.entities[ent].delete(id);
      return true;
    } catch (e) {
      if (e.status === 429) {
        await sleep(2000 * (attempt + 1));
      } else {
        return false;
      }
    }
  }
  return false;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { case_id, entity_index = 0 } = body;
  if (!case_id) return Response.json({ error: "case_id required" }, { status: 400 });

  // Process one entity at a time per call to avoid timeouts
  const ent = ENTITIES[entity_index];
  if (!ent) {
    return Response.json({ success: true, done: true, message: "All entities wiped." });
  }

  const items = await safeFilter(base44, ent, case_id);
  
  for (const item of items) {
    await safeDelete(base44, ent, item.id);
    await sleep(250);
  }

  const next = entity_index + 1;
  return Response.json({
    success: true,
    done: next >= ENTITIES.length,
    entity: ent,
    deleted: items.length,
    next_index: next,
    total: ENTITIES.length
  });
});