import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Shared presentation state for attorney and jury views.
 * Attorney writes to this state (page, zoom); jury reads from it.
 * Both stay perfectly in sync via real-time subscription.
 */
export function usePresentationState(trialSessionId, isAttorney = false) {
  const [state, setState] = useState(null);
  const [unsubscribe, setUnsubscribe] = useState(null);

  // Subscribe to real-time changes
  useEffect(() => {
    if (!trialSessionId) return;

    let unsub = null;
    base44.entities.TrialSessionStates.filter({ trial_session_id: trialSessionId }).then((states) => {
      const stateRecord = states[0];
      if (stateRecord) {
        setState(stateRecord);
        // Subscribe to all future changes
        unsub = base44.entities.TrialSessionStates.subscribe((event) => {
          if (event.data?.trial_session_id === trialSessionId) {
            setState(event.data);
          }
        });
        setUnsubscribe(() => unsub);
      }
    });

    return () => {
      if (unsub) unsub();
    };
  }, [trialSessionId]);

  // Attorney only: update page (immediate, reliable)
  const setPage = useCallback((newPage) => {
    if (!isAttorney || !state) return;
    base44.entities.TrialSessionStates.update(state.id, { proof_current_page: newPage }).catch(console.error);
  }, [state, isAttorney]);

  // Attorney only: update zoom (throttled by caller for gesture smoothness)
  const setZoom = useCallback((newZoom) => {
    if (!isAttorney || !state) return;
    base44.entities.TrialSessionStates.update(state.id, { proof_zoom_level: newZoom }).catch(console.error);
  }, [state, isAttorney]);

  return { state, setPage, setZoom };
}