import { base44 } from '@/api/base44Client';

export async function resolveProofItem(proofItem) {
  if (!proofItem || !proofItem.type || !proofItem.source_id) {
    return null;
  }

  try {
    switch (proofItem.type) {
      case 'depoClip': {
        const clips = await base44.entities.DepoClips.filter({ id: proofItem.source_id });
        return clips.length > 0 ? { ...clips[0], proofType: 'depoClip' } : null;
      }
      case 'extract': {
        const extracts = await base44.entities.ExhibitExtracts.filter({ id: proofItem.source_id });
        return extracts.length > 0 ? { ...extracts[0], proofType: 'extract' } : null;
      }
      case 'callout': {
        const callouts = await base44.entities.Callouts.filter({ id: proofItem.source_id });
        return callouts.length > 0 ? { ...callouts[0], proofType: 'callout' } : null;
      }
      case 'highlight': {
        const highlights = await base44.entities.Highlights.filter({ id: proofItem.source_id });
        return highlights.length > 0 ? { ...highlights[0], proofType: 'highlight' } : null;
      }
      default:
        return null;
    }
  } catch (error) {
    console.error(`Error resolving proof item ${proofItem.id}:`, error);
    return null;
  }
}

export function getProofItemLabel(proofItem) {
  return proofItem?.label || `${proofItem?.type} - ${proofItem?.source_id?.slice(0, 8)}`;
}

export function getProofTypeIcon(type) {
  const icons = {
    depoClip: '🎤',
    extract: '📄',
    callout: '📍',
    highlight: '🖍️',
  };
  return icons[type] || '📋';
}