import Script from "next/script";
import { adsterraScripts, isAdsterraFormatEnabled } from "@/config/ads";

type NativeAdProps = {
  className?: string;
};

/** Renders the opt-in Adsterra Native Banner without affecting the page when disabled. */
export default function NativeAd({ className }: NativeAdProps) {
  if (!isAdsterraFormatEnabled("native")) return null;

  const { native } = adsterraScripts;

  return (
    <aside className={className} aria-label="Advertisement">
      <Script
        id={native.id}
        src={native.src}
        strategy="afterInteractive"
        data-cfasync="false"
      />
      <div id={native.containerId} />
    </aside>
  );
}
