import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Shared presentation state hook.
 *
 * Attorney (isAttorney=true): reads + writes state.
 * Jury (isAttorney=false):    reads state only.
 *
 * Single source of truth design:
 *   - Loads initial TrialSessionStates record on mount.
 *   - Subscribes to real-time changes immediately (not only after initial load).
 *   - This prevents the dual-subscription race condition that caused stale
 *     jury_can_see_proof values to leak into JuryView.
 */
export function usePresentationState(trialSessionId, isAttorney = false) {
  const [state, setState] = useState(null);
  const vpDebounceRef = useRef(null);

  useEffect(() => {
    if (!trialSessionId) return;

    // Subscribe first so we never miss an event that fires during the initial fetch.
    const unsub = base44.entities.TrialSessionStates.subscribe((event) => {
      if (event.data?.trial_session_id === trialSessionId) {
        setState(event.data);
      }
    });

    // Then load the current record.
    base44.entities.TrialSessionStates.filter({ trial_session_id: trialSessionId })
      .then((records) => {
        if (records[0]) setState(records[0]);
      })
      .catch(console.error);

    return () => unsub();
  }, [trialSessionId]);

  // ── Writer callbacks (attorney only) ─────────────────────────────────────

  const setPage = useCallback((newPage) => {
    if (!isAttorney || !state) return;
    base44.entities.TrialSessionStates.update(state.id, { proof_current_page: newPage }).catch(console.error);
  }, [state, isAttorney]);

  const setZoom = useCallback((newZoom) => {
    if (!isAttorney || !state) return;
    base44.entities.TrialSessionStates.update(state.id, { proof_zoom_level: newZoom }).catch(console.error);
  }, [state, isAttorney]);

  const setScroll = useCallback((scrollLeft, scrollTop) => {
    if (!isAttorney || !state) return;
    base44.entities.TrialSessionStates.update(state.id, {
      proof_scroll_left: scrollLeft,
      proof_scroll_top: scrollTop,
    }).catch(console.error);
  }, [state, isAttorney]);

  /**
   * Report the attorney PDF viewer's container size so the jury can render
   * an identical-sized framed viewport. Debounced to 400ms to avoid thrashing.
   */
  const setViewportSize = useCallback((w, h) => {
    if (!isAttorney || !state || !w || !h) return;
    if (vpDebounceRef.current) clearTimeout(vpDebounceRef.current);
    vpDebounceRef.current = setTimeout(() => {
      base44.entities.TrialSessionStates.update(state.id, {
        proof_viewport_width: Math.round(w),
        proof_viewport_height: Math.round(h),
      }).catch(console.error);
    }, 400);
  }, [state, isAttorney]);

  return { state, setPage, setZoom, setScroll, setViewportSize };
}