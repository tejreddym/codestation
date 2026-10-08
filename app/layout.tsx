import type { Metadata } from "next";
import "./globals.css";
import { siteConfig } from "@/config/site";
import { ConverterSessionProvider } from "@/components/ConverterSession";
import { WorkbenchProvider } from "@/components/WorkbenchProvider";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = { manifest: "/manifest.webmanifest", ...(siteConfig.origin ? { metadataBase: new URL(siteConfig.origin), alternates: { canonical: "/" }, openGraph: { title: siteConfig.name, description: siteConfig.description, url: siteConfig.origin, siteName: siteConfig.name, type: "website" as const } } : {}), title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` }, description: siteConfig.description, robots: siteConfig.indexing ? { index: true, follow: true } : { index: false, follow: false } };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Only the root theme attribute intentionally differs after the prepaint script.
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `(() => { let saved; try { saved = window.localStorage.getItem('code-station-theme'); } catch {} const dark = saved === 'dark' || (saved !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches); document.documentElement.dataset.theme = dark ? 'dark' : 'light'; })()` }} /></head><body><ConverterSessionProvider><WorkbenchProvider><SiteHeader />{children}<SiteFooter /></WorkbenchProvider></ConverterSessionProvider></body></html>;
}
