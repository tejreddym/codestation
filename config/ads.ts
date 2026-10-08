const ENABLED_VALUE = "true";

export const adsterraScripts = {
  socialBar: {
    id: "adsterra-social-bar",
    src: "https://bauval.org/14/63bf50be8c148bc60eb10a44e5ad23b3",
    envKey: "NEXT_PUBLIC_ADS_SOCIAL_BAR_ENABLED",
  },
  popunder: {
    id: "adsterra-popunder",
    src: "https://abscloud.org/1/e03072b30061fdd916e81456aa8185bf",
    envKey: "NEXT_PUBLIC_ADS_POPUNDER_ENABLED",
  },
  native: {
    id: "adsterra-native-banner",
    src: "https://bauval.org/21/14efe1c7efaabb7ed1d8cdc2a828d40d",
    containerId: "container-14efe1c7efaabb7ed1d8cdc2a828d40d",
    envKey: "NEXT_PUBLIC_ADS_NATIVE_ENABLED",
  },
} as const;

type AdsterraFormat = keyof typeof adsterraScripts;

/** Ads are opt-in and can only be enabled by exact production environment values. */
export function isAdsterraFormatEnabled(format: AdsterraFormat): boolean {
  // Keep each public environment variable as a direct property access. Next.js
  // replaces direct NEXT_PUBLIC_* references at build time; a computed
  // process.env lookup would not be bundled into client components reliably.
  const formatEnabled = format === "socialBar"
    ? process.env.NEXT_PUBLIC_ADS_SOCIAL_BAR_ENABLED === ENABLED_VALUE
    : format === "popunder"
      ? process.env.NEXT_PUBLIC_ADS_POPUNDER_ENABLED === ENABLED_VALUE
      : process.env.NEXT_PUBLIC_ADS_NATIVE_ENABLED === ENABLED_VALUE;

  return process.env.NODE_ENV === "production"
    && process.env.NEXT_PUBLIC_ADS_ENABLED === ENABLED_VALUE
    && formatEnabled;
}
