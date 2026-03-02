import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Backfill ProofItems with witness_id based on their source (DepoClip or ExhibitExtract).
 * Also updates ProofItems created going forward to auto-capture witness_id.
 * 
 * This is an admin-only function. Run in dry-run mode first to see what will change.
 * mode: 'dryrun' | 'live'
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { mode = 'dryrun', caseId } = await req.json();

    if (!caseId) {
      return Response.json({ error: 'caseId is required' }, { status: 400 });
    }

    const report = {
      mode,
      caseId,
      timestamp: new Date().toISOString(),
      summary: {},
      updates: [],
      errors: [],
    };

    // Fetch all ProofItems for this case
    const proofItems = await base44.asServiceRole.entities.ProofItems.filter({ case_id: caseId });

    for (const proofItem of proofItems) {
      try {
        // Skip if witness_id already exists
        if (proofItem.witness_id) {
          continue;
        }

        let witnessId = null;

        // Resolve witness_id based on source type
        if (proofItem.type === 'depoClip') {
          const depoClip = await base44.asServiceRole.entities.DepoClips.filter({ id: proofItem.source_id });
          if (depoClip.length > 0 && depoClip[0].deposition_id) {
            // Get deposition to find witness
            const depo = await base44.asServiceRole.entities.Depositions.filter({ id: depoClip[0].deposition_id });
            if (depo.length > 0 && depo[0].party_id) {
              witnessId = depo[0].party_id;
            }
          }
        } else if (proofItem.type === 'extract') {
          const extract = await base44.asServiceRole.entities.ExhibitExtracts.filter({ id: proofItem.source_id });
          if (extract.length > 0 && extract[0].source_depo_exhibit_id) {
            const depoExhibit = await base44.asServiceRole.entities.DepositionExhibits.filter({ 
              id: extract[0].source_depo_exhibit_id 
            });
            if (depoExhibit.length > 0 && depoExhibit[0].deponent_party_id) {
              witnessId = depoExhibit[0].deponent_party_id;
            }
          }
        }

        if (witnessId) {
          if (mode === 'dryrun') {
            report.updates.push({
              proofItemId: proofItem.id,
              type: proofItem.type,
              sourceId: proofItem.source_id,
              witnessId,
              label: proofItem.label,
            });
          } else {
            await base44.asServiceRole.entities.ProofItems.update(proofItem.id, { witness_id: witnessId });
            report.updates.push({
              proofItemId: proofItem.id,
              type: proofItem.type,
              witnessId,
              status: 'updated',
            });
          }
        }
      } catch (err) {
        report.errors.push({
          proofItemId: proofItem.id,
          error: err.message,
        });
      }
    }

    report.summary = {
      totalProofItems: proofItems.length,
      itemsWithWitness: proofItems.filter(p => p.witness_id).length,
      itemsToUpdate: report.updates.length,
      errors: report.errors.length,
      mode,
    };

    return Response.json(report, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});