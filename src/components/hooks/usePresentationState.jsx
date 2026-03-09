import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Shared presentation state for attorney and jury views.
 *
 * Attorney (isAttorney=true): reads + writes via setPage/setZoom/setScroll/setViewportSize
 * Jury  (isAttorney=false): reads only — all setters are no-ops
 *
 * The hook loads initial state from the DB AND subscribes to real-time changes.
 * These are independent so no change is ever missed.
 */
export function usePresentationState(trialSessionId, isAttorney = false) {
  const [state, setState] = useState(null);

  useEffect(() => {
    if (!trialSessionId) return;

    // Load initial state (independent of subscription — avoids missing state on first load)
    base44.entities.TrialSessionStates.filter({ trial_session_id: trialSessionId })
      .then((states) => { if (states[0]) setState(states[0]); })
      .catch(console.error);

    // Subscribe to all future changes
    const unsub = base44.entities.TrialSessionStates.subscribe((event) => {
      if (event.data?.trial_session_id === trialSessionId) {
        setState(event.data);
      }
    });

    return () => unsub();
  }, [trialSessionId]);

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
   * Write the attorney's usable PDF viewport dimensions so the jury
   * can build a matching proportional frame.
   * Call this from a ResizeObserver on the attorney's PDF container div.
   */
  const setViewportSize = useCallback((width, height) => {
    if (!isAttorney || !state) return;
    base44.entities.TrialSessionStates.update(state.id, {
      attorney_viewport_width: width,
      attorney_viewport_height: height,
    }).catch(console.error);
  }, [state, isAttorney]);

  return { state, setPage, setZoom, setScroll, setViewportSize };
}