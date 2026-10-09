import Script from "next/script";
import { adsterraScripts, isAdsterraFormatEnabled } from "@/config/ads";

/** Loads the enabled Adsterra formats once from the persistent root layout. */
export default function AdsterraGlobalScripts() {
  return (
    <>
      {isAdsterraFormatEnabled("socialBar") && (
        <Script
          id={adsterraScripts.socialBar.id}
          src={adsterraScripts.socialBar.src}
          strategy="afterInteractive"
          data-cfasync="false"
        />
      )}
    </>
  );
}
