"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { tools } from "@/config/tools";
import { defaultPreferences, parsePreferences, preferenceKey, type Preferences } from "@/lib/workbench/preferences";
import { useSafePathname } from "./useSafeNavigation";

type Handoff = { slug: string; text: string; token: number; from: string };
type ContextValue = { preferences: Preferences; ready: boolean; storageError: boolean; update: (patch: Partial<Preferences>) => void; toggleFavorite: (slug: string) => void; pending: Handoff | null; queueInput: (slug: string, text: string) => void; clearInput: () => void };
const valid = new Set(tools.map(tool => tool.slug));
const Context = createContext<ContextValue>({ preferences: defaultPreferences, ready: false, storageError: false, update: () => {}, toggleFavorite: () => {}, pending: null, queueInput: () => {}, clearInput: () => {} });
export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [pending, setPending] = useState<Handoff | null>(null);
  const sequence = useRef(0);
  const pathname = useSafePathname();
  useEffect(() => {
    try { setPreferences(parsePreferences(localStorage.getItem(preferenceKey), valid)); } catch { setStorageError(true); }
    setReady(true);
    const sync = (event: StorageEvent) => { if (event.key === preferenceKey) setPreferences(parsePreferences(event.newValue, valid)); };
    window.addEventListener("storage", sync); return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => { if (ready) try { localStorage.setItem(preferenceKey, JSON.stringify(preferences)); } catch { setStorageError(true); } }, [preferences, ready]);
  useEffect(() => {
    if (!ready || !preferences.rememberRecent) return;
    const slug = pathname.replace(/^\/tools\//, "");
    if (valid.has(slug)) setPreferences(current => current.recent[0] === slug ? current : { ...current, recent: [slug, ...current.recent.filter(id => id !== slug)].slice(0, 12) });
  }, [pathname, ready, preferences.rememberRecent]);
  useEffect(() => {
    if (!pending) return;
    if (pathname !== pending.from && pathname !== `/tools/${pending.slug}`) { setPending(null); return; }
    const timer = setTimeout(() => setPending(null), 60_000); return () => clearTimeout(timer);
  }, [pending, pathname]);
  const update = useCallback((patch: Partial<Preferences>) => setPreferences(current => ({ ...current, ...patch })), []);
  const toggleFavorite = useCallback((slug: string) => { if (valid.has(slug)) setPreferences(current => ({ ...current, favorites: current.favorites.includes(slug) ? current.favorites.filter(id => id !== slug) : [...current.favorites, slug].slice(-100) })); }, []);
  const queueInput = useCallback((slug: string, text: string) => { if (valid.has(slug) && text.length <= 1_000_000) setPending({ slug, text, token: ++sequence.current, from: pathname }); }, [pathname]);
  const clearInput = useCallback(() => setPending(null), []);
  return <Context.Provider value={{ preferences, ready, storageError, update, toggleFavorite, pending, queueInput, clearInput }}>{children}</Context.Provider>;
}
export function useWorkbench() { return useContext(Context); }
/** Tool adapters use their own edit/invalidation path, never DOM mutation. */
export function useToolHandoff(slug: string, apply: (text: string) => void) {
  const { pending, clearInput } = useWorkbench();
  const handler = useRef(apply); handler.current = apply;
  const applied = useRef<number | null>(null);
  useEffect(() => {
    if (pending?.slug === slug && applied.current !== pending.token) {
      applied.current = pending.token; handler.current(pending.text); clearInput();
    }
  }, [slug, pending, clearInput]);
}
