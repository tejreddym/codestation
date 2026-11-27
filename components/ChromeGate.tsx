"use client";

import type { ReactNode } from "react";
import { useSafePathname } from "./useSafeNavigation";

/** Hides global site chrome (header, footer, ad scripts) on chromeless `/embed/*` routes. */
export default function ChromeGate({ children }: { children: ReactNode }) {
  const pathname = useSafePathname();
  if (pathname === "/embed" || pathname.startsWith("/embed/")) {
    return null;
  }
  return <>{children}</>;
}
