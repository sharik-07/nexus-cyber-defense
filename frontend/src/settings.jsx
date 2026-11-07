import { createContext, useCallback, useContext, useMemo, useState } from "react";

const KEY = "nexus.settings.v1";
export const REFRESH_CHOICES = [1, 2, 3, 5, 10, 30];
const DEFAULTS = { refresh: 3, animations: true, matrix: false };

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      refresh: REFRESH_CHOICES.includes(raw.refresh) ? raw.refresh : DEFAULTS.refresh,
      animations: typeof raw.animations === "boolean" ? raw.animations : DEFAULTS.animations,
      matrix: typeof raw.matrix === "boolean" ? raw.matrix : DEFAULTS.matrix,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

const Ctx = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(load);
  const update = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);
  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSettings = () => useContext(Ctx);