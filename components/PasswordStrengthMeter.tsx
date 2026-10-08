"use client";

type Props = { length: number; alphabetSize: number };

/** Entropy of an independently and uniformly generated password, not a human-password score. */
export default function PasswordStrengthMeter({ length, alphabetSize }: Props) {
  const bits = Number.isFinite(length) && Number.isFinite(alphabetSize) && length > 0 && alphabetSize > 0
    ? length * Math.log2(alphabetSize) : 0;
  const percent = Math.min(100, (bits / 128) * 100);
  const label = bits < 40 ? "Low" : bits < 60 ? "Moderate" : bits < 80 ? "Strong" : "Very strong";
  return <div className="password-meter" aria-label={`Estimated entropy: ${bits.toFixed(1)} bits. ${label}.`}>
    <div className="muted">Estimated entropy: <strong>{bits.toFixed(1)} bits</strong> ({label})</div>
    <div role="progressbar" aria-valuemin={0} aria-valuemax={128} aria-valuenow={Math.min(128, bits)} aria-label="Estimated entropy" style={{ height: 8, background: "var(--border, #ddd)", borderRadius: 4, marginTop: 6 }}>
      <div style={{ width: `${percent}%`, height: "100%", background: "var(--accent, #2563eb)", borderRadius: 4 }} />
    </div>
    <small className="muted">Assumes uniform random generation; this is not a measure of human password strength.</small>
  </div>;
}
