"use client";
import { createContext, useContext, useMemo, useRef, type ReactNode } from "react";

export type ConverterSource = { family: string; format: string; value: unknown; metadata?: Record<string, unknown>; version: number };
type SessionApi = { get: (family: string) => ConverterSource | undefined; set: (source: Omit<ConverterSource, "version">) => void; clear: (family?: string) => void };
const Context = createContext<SessionApi | null>(null);
const fallbackStore = new Map<string, ConverterSource>();
const fallbackApi: SessionApi = { get: family => fallbackStore.get(family), set: source => { const previous = fallbackStore.get(source.family); fallbackStore.set(source.family, { ...source, version: (previous?.version ?? 0) + 1 }); }, clear: family => { if (family) fallbackStore.delete(family); else fallbackStore.clear(); } };
export function ConverterSessionProvider({ children }: { children: ReactNode }) {
  const store = useRef(new Map<string, ConverterSource>());
  const api = useMemo<SessionApi>(() => ({
    get: family => store.current.get(family),
    set: source => { const previous = store.current.get(source.family); store.current.set(source.family, { ...source, version: (previous?.version ?? 0) + 1 }); },
    clear: family => { if (family) store.current.delete(family); else store.current.clear(); },
  }), []);
  return <Context.Provider value={api}>{children}</Context.Provider>;
}
/** Standalone jsdom/component consumers get an isolated fallback; the app root always supplies the provider. */
export function useConverterSession() { return useContext(Context) ?? fallbackApi; }
