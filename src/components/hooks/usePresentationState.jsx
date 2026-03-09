import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const THROTTLE_MS = 80;

/**
 * Shared presentation state for attorney and jury views.
 *
 * Attorney writes via setViewport({ page?, zoom?, scrollLeft?, scrollTop? }, { flush? }).
 * All viewport fields are always batched into ONE backend write per throttle window.
 * Pass { flush: true } to bypass the throttle and write immediately (gesture end, page nav).
 *
 * Jury subscribes read-only — state updates automatically via real-time subscription.
 */
export function usePresentationState(trialSessionId, isAttorney = false) {
  const [state, setState] = useState(null);

  // Always-current refs — safe to use inside throttle callbacks without stale closure issues.
  const stateRef = useRef(null);
  const pendingRef = useRef(null);   // merged entity fields waiting to be written
  const throttleTimerRef = useRef(null);

  useEffect(() => {
    if (!trialSessionId) return;
    let unsub = null;

    base44.entities.TrialSessionStates.filter({ trial_session_id: trialSessionId }).then((states) => {
      const record = states[0];
      if (!record) return;

      setState(record);
      stateRef.current = record;

      unsub = base44.entities.TrialSessionStates.subscribe((event) => {
        if (event.data?.trial_session_id === trialSessionId) {
          setState(event.data);
          stateRef.current = event.data;
        }
      });
    });

    return () => {
      if (unsub) unsub();
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
    };
  }, [trialSessionId]);

  /**
   * Single unified viewport writer.
   *
   * @param {object} fields  One or more of: { page, zoom, scrollLeft, scrollTop }
   * @param {object} options { flush: true } bypasses throttle — use at gesture end and page nav.
   *
   * All calls merge into `pendingRef` so concurrent calls from zoom+scroll never race:
   *   setViewport({ zoom: 1.5, scrollLeft: 100, scrollTop: 200 })
   *   — always goes out as a single TrialSessionStates.update({ proof_zoom_level, proof_scroll_left, proof_scroll_top })
   */
  const setViewport = useCallback((fields, { flush = false } = {}) => {
    if (!isAttorney || !stateRef.current) return;

    // Map friendly names → entity field names, merge with any pending
    const mapped = {};
    if (fields.page != null)        mapped.proof_current_page = fields.page;
    if (fields.zoom != null)        mapped.proof_zoom_level = fields.zoom;
    if (fields.scrollLeft != null)  mapped.proof_scroll_left = fields.scrollLeft;
    if (fields.scrollTop != null)   mapped.proof_scroll_top = fields.scrollTop;

    pendingRef.current = { ...(pendingRef.current || {}), ...mapped };

    if (flush) {
      // Immediate write — cancel any pending throttle timer first
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      const toWrite = pendingRef.current;
      pendingRef.current = null;
      base44.entities.TrialSessionStates.update(stateRef.current.id, toWrite).catch(console.error);
      return;
    }

    // Throttled write — one timer per window, always writes the latest merged pending
    if (throttleTimerRef.current) return;
    throttleTimerRef.current = setTimeout(() => {
      throttleTimerRef.current = null;
      if (!pendingRef.current || !stateRef.current) return;
      const toWrite = pendingRef.current;
      pendingRef.current = null;
      base44.entities.TrialSessionStates.update(stateRef.current.id, toWrite).catch(console.error);
    }, THROTTLE_MS);
  }, [isAttorney]);

  return { state, setViewport };
}