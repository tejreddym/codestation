"use client";
import { usePathname, useRouter } from "next/navigation";
const fallback = { push: (_href: string) => {}, replace: (_href: string) => {}, back: () => {} };
/** Direct component tests and SSR snapshots do not mount Next's router context. */
export function useSafeRouter() { try { return useRouter(); } catch { return fallback; } }
export function useSafePathname() { try { return usePathname() ?? ""; } catch { return ""; } }
