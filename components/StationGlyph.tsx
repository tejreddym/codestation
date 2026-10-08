import StationMark from "./StationMark";

/** Decorative counterpart to the homepage assembly. No controls or external assets. */
export default function StationGlyph({ category }: { category: string }) {
  return <div className="station-glyph" aria-hidden="true">
    <svg viewBox="0 0 280 180" focusable="false">
      <path d="M43 34H22v112h21M237 34h21v112h-21" fill="none" stroke="currentColor" strokeWidth="5" />
      <path d="M55 148H225" fill="none" stroke="currentColor" strokeWidth="1" opacity=".25" />
      <rect x="67" y="43" width="126" height="105" rx="9" fill="#B9ADF2" stroke="#151713" strokeWidth="1.5" transform="rotate(-12 130 94)" />
      <rect x="89" y="32" width="126" height="105" rx="9" fill="#F6F5F1" stroke="#151713" strokeWidth="1.5" transform="rotate(8 152 84)" />
      <path d="M179 125h50v-21" fill="none" stroke="#D9F975" strokeWidth="12" strokeLinejoin="round" />
      <path d="m220 109 9-9 9 9" fill="none" stroke="#151713" strokeWidth="2" />
    </svg>
    <span className="station-glyph-symbol"><StationMark large label={category} /></span>
  </div>;
}
