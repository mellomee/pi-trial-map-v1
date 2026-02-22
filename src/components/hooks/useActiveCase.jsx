import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";

let cachedCase = null;
let cachedSettingsId = null;
const listeners = new Set();

function notify() {
  listeners.forEach(fn => fn(cachedCase));
}

export default function useActiveCase() {
  const [activeCase, setActiveCase] = useState(cachedCase);
  const [loading, setLoading] = useState(!cachedCase);

  useEffect(() => {
    const handler = (c) => setActiveCase(c);
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const settings = await base44.entities.AppSettings.list();
    if (settings.length === 0) {
      cachedCase = null;
      cachedSettingsId = null;
      setActiveCase(null);
      setLoading(false);
      notify();
      return null;
    }
    cachedSettingsId = settings[0].id;
    const caseId = settings[0].active_case_id;
    if (!caseId) {
      cachedCase = null;
      setActiveCase(null);
      setLoading(false);
      notify();
      return null;
    }
    const cases = await base44.entities.Cases.filter({ id: caseId });
    cachedCase = cases.length ? cases[0] : null;
    setActiveCase(cachedCase);
    setLoading(false);
    notify();
    return cachedCase;
  }, []);

  const switchCase = useCallback(async (caseId) => {
    if (cachedSettingsId) {
      await base44.entities.AppSettings.update(cachedSettingsId, { active_case_id: caseId });
    } else {
      await base44.entities.AppSettings.create({ active_case_id: caseId });
    }
    await refresh();
  }, [refresh]);

  useEffect(() => {
    if (!cachedCase) refresh();
  }, [refresh]);

  return { activeCase, loading, refresh, switchCase, settingsId: cachedSettingsId };
}