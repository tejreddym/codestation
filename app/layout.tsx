import type { Metadata } from "next";
import "./globals.css";
import { siteConfig } from "@/config/site";
import { ConverterSessionProvider } from "@/components/ConverterSession";
import { WorkbenchProvider } from "@/components/WorkbenchProvider";
import AdsterraGlobalScripts from "@/components/AdsterraGlobalScripts";
import WebMcpBridge from "@/components/WebMcpBridge";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import BannerAd from "@/components/BannerAd";

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-light.ico", media: "(prefers-color-scheme: light)" },
      { url: "/favicon-dark.ico", media: "(prefers-color-scheme: dark)" },
      { url: "/icon-light-32.png", sizes: "32x32", type: "image/png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark-32.png", sizes: "32x32", type: "image/png", media: "(prefers-color-scheme: dark)" },
    ],
    apple: [
      { url: "/brand/platform/apple-touch-icon-light-180.png", sizes: "180x180", type: "image/png" },
    ],
  },
  ...(siteConfig.origin ? { metadataBase: new URL(siteConfig.origin), alternates: { canonical: "/" }, openGraph: { title: siteConfig.name, description: siteConfig.description, url: siteConfig.origin, siteName: siteConfig.name, type: "website" as const } } : {}),
  title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  robots: siteConfig.indexing ? { index: true, follow: true } : { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Only the root theme attribute intentionally differs after the prepaint script.
  return <html lang="en" suppressHydrationWarning><head><link rel="icon" href="/favicon-light.ico" media="(prefers-color-scheme: light)" /><link rel="icon" href="/favicon-dark.ico" media="(prefers-color-scheme: dark)" /><script dangerouslySetInnerHTML={{ __html: `(() => { let saved; try { saved = window.localStorage.getItem('code-station-theme'); } catch {} const dark = saved === 'dark' || (saved !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches); document.documentElement.dataset.theme = dark ? 'dark' : 'light'; })()` }} /></head><body><AdsterraGlobalScripts /><ConverterSessionProvider><WorkbenchProvider><WebMcpBridge /><SiteHeader />
    {children}
  <SiteFooter /></WorkbenchProvider></ConverterSessionProvider></body></html>;
}
