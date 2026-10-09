"use client";

import { isAdsterraFormatEnabled } from "@/config/ads";

type BannerSize = "leaderboard" | "rectangle";

const bannerConfigs = {
  leaderboard: {
    key: "e181c2c213942a8b6c314200c2611ac1",
    width: 728,
    height: 90,
    src: "https://bauval.org/22/e181c2c213942a8b6c314200c2611ac1",
  },
  rectangle: {
    key: "476e6a1e9f68a0220b1444e9dd495cff",
    width: 300,
    height: 250,
    src: "https://bauval.org/22/476e6a1e9f68a0220b1444e9dd495cff",
  },
} as const;

export default function BannerAd({ size, className }: { size: BannerSize; className?: string }) {
  if (!isAdsterraFormatEnabled("banner")) return null;

  const config = bannerConfigs[size];
  const srcDocHtml = `<!DOCTYPE html><html><head><style>body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; overflow: hidden; background: transparent; }</style></head><body><script type="text/javascript">atOptions = { 'key' : '${config.key}', 'format' : 'iframe', 'height' : ${config.height}, 'width' : ${config.width}, 'params' : {} };</script><script type="text/javascript" src="${config.src}"></script></body></html>`;

  return (
    <aside className={`ad-banner ad-banner--${size} ${className ?? ""}`} aria-label="Advertisement" style={{ display: 'flex', justifyContent: 'center' }}>
      <iframe
        srcDoc={srcDocHtml}
        width={config.width}
        height={config.height}
        style={{ border: "none", overflow: "hidden", display: "block", maxWidth: "100%" }}
        scrolling="no"
        title="Advertisement"
      />
    </aside>
  );
}
