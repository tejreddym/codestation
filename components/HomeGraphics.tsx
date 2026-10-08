import styles from "@/app/Home.module.css";

/** Original, deterministic decorative vectors. No engines, requests, or animation JS. */
export function StationAssembly() {
  return <svg className={styles.assembly} viewBox="150 0 700 250" fill="none" aria-hidden="true" focusable="false">
    <ellipse cx="510" cy="222" rx="294" ry="16" fill="currentColor" opacity=".06" />
    <path d="M48 126H190M810 126H952M48 120v12m904-12v12" stroke="currentColor" opacity=".22" />
    <g className={styles.settle}>
      <g transform="translate(202 63) rotate(-8 70 70)">
        <rect x="7" y="9" width="152" height="128" rx="8" fill="#151713" />
        <rect width="152" height="128" rx="8" fill="#B9ADF2" stroke="#151713" strokeWidth="2" />
        <circle cx="112" cy="32" r="12" fill="#F6F5F1" stroke="#151713" strokeWidth="2" />
        <path d="M13 108l39-52 32 36 19-21 35 37H13Z" fill="#F6F5F1" stroke="#151713" strokeWidth="2" strokeLinejoin="round" />
      </g>
    </g>
    <g className={`${styles.settle} ${styles.delayOne}`}>
      <g transform="translate(414 25) rotate(-8 78 92)">
        <rect x="7" y="9" width="156" height="172" rx="8" fill="#151713" />
        <rect width="156" height="172" rx="8" fill="#F6F5F1" stroke="#151713" strokeWidth="2" />
        <path d="M20 30h36M20 39h21" stroke="#596153" strokeWidth="3" />
        <path d="M37 67H27v28h-8l8 8v28h10m78-64h10v28h8l-8 8v28h-10" stroke="#151713" strokeWidth="3" strokeLinejoin="round" />
        <path d="M47 75h27m9 0h18M47 92h47M47 109h18m9 0h27M47 126h36" stroke="#596153" strokeWidth="6" strokeLinecap="round" />
        <path d="M83 75h18M74 109h27" stroke="#B9ADF2" strokeWidth="6" strokeLinecap="round" />
      </g>
    </g>
    <g className={`${styles.settle} ${styles.delayTwo}`}>
      <g transform="translate(628 92) rotate(-8 78 64)">
        <rect x="7" y="9" width="166" height="112" rx="8" fill="#151713" />
        <rect width="166" height="112" rx="8" fill="#F6F5F1" stroke="#151713" strokeWidth="2" />
        <path d="M1 8a7 7 0 0 1 7-7h150a7 7 0 0 1 7 7v22H1Z" fill="#D9F975" />
        <path d="M0 30h166M0 57h166M0 84h166M45 30v82M106 30v82" stroke="#151713" strokeWidth="2" />
        <path d="M13 16h20m24 0h35m25 0h33" stroke="#151713" strokeWidth="3" />
        <rect x="112" y="63" width="46" height="15" rx="3" fill="#B9ADF2" />
      </g>
    </g>
    <g className={`${styles.settle} ${styles.brackets}`} stroke="#151713" strokeWidth="2" strokeLinejoin="round">
      <path d="M385 46l-35 8-18 65-26 19 17 17-13 62 37 6 7-25-16-4 10-45-15-15 22-14 13-43 12-3Z" fill="#737A64" transform="translate(8 8)" />
      <path d="M385 46l-35 8-18 65-26 19 17 17-13 62 37 6 7-25-16-4 10-45-15-15 22-14 13-43 12-3Z" fill="#D9F975" />
      <path d="M598 34l36 7 2 61 22 18-23 20-5 61-38 9 3-27 15-4 4-48 15-12-16-14-3-42-15-3Z" fill="#737A64" transform="translate(8 8)" />
      <path d="M598 34l36 7 2 61 22 18-23 20-5 61-38 9 3-27 15-4 4-48 15-12-16-14-3-42-15-3Z" fill="#D9F975" />
    </g>
    <g className={styles.connector}>
      <path d="M351 212c27 16 54 19 84 0l68-42c28-17 54-14 88 1" stroke="#151713" strokeWidth="14" />
      <path d="M351 210c27 16 54 19 84 0l68-42c28-17 54-14 88 1" stroke="#D9F975" strokeWidth="10" />
      <circle cx="351" cy="210" r="7" fill="#D9F975" stroke="#151713" strokeWidth="2" />
    </g>
  </svg>;
}

export function DataPreview() {
  return <svg viewBox="0 0 460 200" fill="none" aria-hidden="true" focusable="false">
    <g transform="rotate(-6 100 98)"><rect x="20" y="54" width="165" height="86" rx="5" fill="#30372A" stroke="#717B65" /><text x="36" y="87" fill="#F6F5F1" fontFamily="monospace" fontSize="12">{'{"idea":"build",'}</text><text x="36" y="108" fill="#F6F5F1" fontFamily="monospace" fontSize="12">{'"ready":true}'}</text></g>
    <path d="M190 98h45m-12-12 13 12-13 12" stroke="#D9F975" strokeWidth="2" />
    <g transform="rotate(4 335 100)"><rect x="259" y="24" width="169" height="155" rx="5" fill="#D9F975" /><rect x="251" y="16" width="169" height="155" rx="5" fill="#F6F5F1" stroke="#151713" strokeWidth="2" /><text x="270" y="48" fill="#151713" fontFamily="monospace" fontSize="14"><tspan x="270">{'{'}</tspan><tspan x="282" dy="28">{'"idea": "build",'}</tspan><tspan x="282" dy="28">{'"ready": true'}</tspan><tspan x="270" dy="28">{'}'}</tspan></text></g>
  </svg>;
}

export function ImagePreview() {
  return <svg viewBox="0 0 280 200" fill="none" aria-hidden="true" focusable="false">
    <g transform="rotate(-10 99 100)"><rect x="27" y="24" width="125" height="137" rx="5" fill="#F6F5F1" stroke="#151713" strokeWidth="2" /><path d="M39 116l35-57 27 35 16-21 23 43Z" fill="#B9ADF2" stroke="#151713" strokeWidth="2" /><circle cx="119" cy="49" r="11" fill="#D9F975" stroke="#151713" strokeWidth="2" /><text x="40" y="146" fill="#151713" fontFamily="monospace" fontSize="13">PNG</text></g>
    <g transform="rotate(8 188 112)"><rect x="125" y="48" width="124" height="136" rx="5" fill="#D9F975" stroke="#151713" strokeWidth="2" /><path d="M137 139l35-57 27 35 16-21 22 43Z" fill="#151713" /><circle cx="217" cy="74" r="11" fill="#F6F5F1" stroke="#151713" strokeWidth="2" /><text x="139" y="169" fill="#151713" fontFamily="monospace" fontSize="13">WEBP ↗</text></g>
  </svg>;
}

export function ColorPreview() {
  return <svg viewBox="0 0 280 200" fill="none" aria-hidden="true" focusable="false">
    <g transform="rotate(-16 135 97)"><rect x="51" y="41" width="164" height="95" rx="6" fill="#B9ADF2" stroke="#151713" strokeWidth="2" /></g>
    <g transform="rotate(-5 142 104)"><rect x="59" y="55" width="164" height="95" rx="6" fill="#151713" stroke="#151713" strokeWidth="2" /></g>
    <g transform="rotate(7 148 115)"><rect x="67" y="70" width="164" height="95" rx="6" fill="#D9F975" stroke="#151713" strokeWidth="2" /><path d="M67 124h164" stroke="#151713" strokeWidth="2" /><text x="81" y="149" fill="#151713" fontFamily="monospace" fontSize="14">#D9F975</text><circle cx="212" cy="143" r="6" stroke="#151713" strokeWidth="2" /></g>
  </svg>;
}
