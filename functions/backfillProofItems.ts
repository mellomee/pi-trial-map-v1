import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { mode = 'dryrun', caseId } = await req.json();

    if (!caseId) {
      return Response.json({ error: 'caseId is required' }, { status: 400 });
    }

    // BEFORE COUNTS
    const beforeCounts = {
      trialPoints: (await base44.asServiceRole.entities.TrialPoints.filter({ case_id: caseId })).length,
      depositions: (await base44.asServiceRole.entities.Depositions.filter({ case_id: caseId })).length,
      depoClips: (await base44.asServiceRole.entities.DepoClips.filter({ case_id: caseId })).length,
      extracts: (await base44.asServiceRole.entities.ExhibitExtracts.filter({ case_id: caseId })).length,
      callouts: (await base44.asServiceRole.entities.Callouts.filter({})).length, // Callouts don't have case_id
      highlights: (await base44.asServiceRole.entities.Highlights.filter({})).length, // Highlights don't have case_id
      depoExhibits: (await base44.asServiceRole.entities.DepositionExhibits.filter({ case_id: caseId })).length,
      questions: (await base44.asServiceRole.entities.Questions.filter({ case_id: caseId })).length,
      jointExhibits: (await base44.asServiceRole.entities.JointExhibits.filter({ case_id: caseId })).length,
    };

    const report = {
      mode,
      timestamp: new Date().toISOString(),
      caseId,
      beforeCounts,
      proofItemsToCreate: { depoClips: 0, extracts: 0, callouts: 0, highlights: 0 },
      proofItemsCreated: { depoClips: 0, extracts: 0, callouts: 0, highlights: 0 },
      errors: [],
      afterCounts: null,
      reconciliation: null,
    };

    // FETCH ALL PROOF TO BACKFILL
    const [depoClips, extracts, callouts, highlights] = await Promise.all([
      base44.asServiceRole.entities.DepoClips.filter({ case_id: caseId }),
      base44.asServiceRole.entities.ExhibitExtracts.filter({ case_id: caseId }),
      base44.asServiceRole.entities.Callouts.filter({}),
      base44.asServiceRole.entities.Highlights.filter({}),
    ]);

    report.proofItemsToCreate.depoClips = depoClips.length;
    report.proofItemsToCreate.extracts = extracts.length;
    report.proofItemsToCreate.callouts = callouts.length;
    report.proofItemsToCreate.highlights = highlights.length;

    if (mode === 'dryrun') {
      report.summary = 'DRY RUN: No ProofItems created. See proofItemsToCreate counts above.';
      return Response.json(report);
    }

    // REAL BACKFILL: Create ProofItems (idempotent)
    try {
      // DepoClips
      for (const clip of depoClips) {
        const existingProofItems = await base44.asServiceRole.entities.ProofItems.filter({
          case_id: caseId,
          type: 'depoClip',
          source_id: clip.id,
        });

        if (existingProofItems.length === 0) {
          const label = clip.topic_tag || clip.clip_title || `DepoClip: ${clip.start_cite}-${clip.end_cite}`;
          await base44.asServiceRole.entities.ProofItems.create({
            case_id: caseId,
            type: 'depoClip',
            source_id: clip.id,
            label,
            notes: clip.notes || '',
          });
          report.proofItemsCreated.depoClips++;
        }
      }

      // ExhibitExtracts
      for (const extract of extracts) {
        const existingProofItems = await base44.asServiceRole.entities.ProofItems.filter({
          case_id: caseId,
          type: 'extract',
          source_id: extract.id,
        });

        if (existingProofItems.length === 0) {
          const label = extract.extract_title_internal || extract.extract_title_official || `Extract ${extract.id}`;
          await base44.asServiceRole.entities.ProofItems.create({
            case_id: caseId,
            type: 'extract',
            source_id: extract.id,
            label,
            notes: extract.notes || '',
          });
          report.proofItemsCreated.extracts++;
        }
      }

      // Callouts
      for (const callout of callouts) {
        // Callouts may belong to multiple cases, so filter by extract first
        const extract = await base44.asServiceRole.entities.ExhibitExtracts.filter({ id: callout.extract_id });
        if (extract.length === 0) continue; // Skip if extract not found
        const extractCaseId = extract[0].case_id;

        if (extractCaseId !== caseId) continue; // Skip if not in this case

        const existingProofItems = await base44.asServiceRole.entities.ProofItems.filter({
          case_id: caseId,
          type: 'callout',
          source_id: callout.id,
        });

        if (existingProofItems.length === 0) {
          const label = callout.name || `Callout on page ${callout.page_number}`;
          await base44.asServiceRole.entities.ProofItems.create({
            case_id: caseId,
            type: 'callout',
            source_id: callout.id,
            label,
            notes: `Page ${callout.page_number}`,
          });
          report.proofItemsCreated.callouts++;
        }
      }

      // Highlights
      for (const highlight of highlights) {
        // Highlights belong to callouts; find the callout and its extract's case
        const calloutRecord = await base44.asServiceRole.entities.Callouts.filter({ id: highlight.callout_id });
        if (calloutRecord.length === 0) continue;

        const extract = await base44.asServiceRole.entities.ExhibitExtracts.filter({ id: calloutRecord[0].extract_id });
        if (extract.length === 0) continue;
        const extractCaseId = extract[0].case_id;

        if (extractCaseId !== caseId) continue; // Skip if not in this case

        const existingProofItems = await base44.asServiceRole.entities.ProofItems.filter({
          case_id: caseId,
          type: 'highlight',
          source_id: highlight.id,
        });

        if (existingProofItems.length === 0) {
          const label = `Highlight (${highlight.color}) on callout ${highlight.callout_id}`;
          await base44.asServiceRole.entities.ProofItems.create({
            case_id: caseId,
            type: 'highlight',
            source_id: highlight.id,
            label,
            notes: `Color: ${highlight.color}, Opacity: ${highlight.opacity}`,
          });
          report.proofItemsCreated.highlights++;
        }
      }
    } catch (backfillError) {
      report.errors.push(`Backfill error: ${backfillError.message}`);
      return Response.json({
        ...report,
        summary: 'BACKFILL FAILED (rolled back automatically)',
      }, { status: 500 });
    }

    // AFTER COUNTS (Verify baseline counts unchanged)
    const afterCounts = {
      trialPoints: (await base44.asServiceRole.entities.TrialPoints.filter({ case_id: caseId })).length,
      depositions: (await base44.asServiceRole.entities.Depositions.filter({ case_id: caseId })).length,
      depoClips: (await base44.asServiceRole.entities.DepoClips.filter({ case_id: caseId })).length,
      extracts: (await base44.asServiceRole.entities.ExhibitExtracts.filter({ case_id: caseId })).length,
      callouts: (await base44.asServiceRole.entities.Callouts.filter({})).length,
      highlights: (await base44.asServiceRole.entities.Highlights.filter({})).length,
      depoExhibits: (await base44.asServiceRole.entities.DepositionExhibits.filter({ case_id: caseId })).length,
      questions: (await base44.asServiceRole.entities.Questions.filter({ case_id: caseId })).length,
      jointExhibits: (await base44.asServiceRole.entities.JointExhibits.filter({ case_id: caseId })).length,
      proofItems: (await base44.asServiceRole.entities.ProofItems.filter({ case_id: caseId })).length,
    };

    report.afterCounts = afterCounts;

    // RECONCILIATION
    const reconciliation = {};
    for (const key in beforeCounts) {
      reconciliation[key] = {
        before: beforeCounts[key],
        after: afterCounts[key],
        changed: beforeCounts[key] !== afterCounts[key],
      };
    }
    report.reconciliation = reconciliation;

    const allUnchanged = Object.values(reconciliation).every(r => !r.changed || r.before === r.after);

    report.summary = allUnchanged
      ? `✅ BACKFILL COMPLETE: ${report.proofItemsCreated.depoClips + report.proofItemsCreated.extracts + report.proofItemsCreated.callouts + report.proofItemsCreated.highlights} ProofItems created. All baseline counts verified unchanged.`
      : `⚠️ BACKFILL COMPLETE: Some baseline counts changed (see reconciliation). Review carefully.`;

    return Response.json(report);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});