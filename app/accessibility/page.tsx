import Link from "next/link";
import { InformationalPage } from "@/components/InformationalPage";
import { metadataForPage } from "@/config/site";
import { operatorMetadata } from "@/lib/legal/operator";

export const metadata = metadataForPage(
  "/accessibility",
  "Accessibility Statement",
  "Accessibility target, keyboard navigation, assistive technology support, and feedback channels for Code Station.",
);

export default function AccessibilityPage() {
  return (
    <InformationalPage
      title="Accessibility Statement"
      intro="Code Station aims to keep every developer utility usable with keyboards, screen readers, zoom, and reduced-motion preferences."
    >
      <h2>Conformance Target</h2>
      <p>
        We target <strong>WCAG 2.2 Level AA</strong> across navigation,
        contrast tokens, focus visibility, form labeling, and status
        announcements. Accessibility checks run alongside our automated unit and
        UI token audits as stations evolve.
      </p>

      <h2>Keyboard Navigation &amp; Shortcuts</h2>
      <ul>
        <li>
          <strong>Command Palette:</strong> Press <kbd>Cmd + K</kbd> (macOS) or{" "}
          <kbd>Ctrl + K</kbd> (Windows/Linux) anywhere in the app to open global
          tool, station, and action search with arrow-key selection and{" "}
          <kbd>Escape</kbd> focus restoration.
        </li>
        <li>
          <strong>Native Form Controls:</strong> Tool inputs use labeled native
          controls, explicit fieldsets, visible <code>:focus-visible</code>{" "}
          outlines, and keyboard-operable triggers for date/time pickers and
          page reordering.
        </li>
        <li>
          <strong>Live Status Announcements:</strong> Processing completions,
          copy feedback, and validation errors announce via{" "}
          <code>role=&quot;status&quot;</code>, <code>role=&quot;alert&quot;</code>,
          and <code>aria-live=&quot;polite&quot;</code> regions without stealing
          unexpected focus.
        </li>
      </ul>

      <h2>Visual Contrast &amp; Motion Preferences</h2>
      <ul>
        <li>
          <strong>Light &amp; Dark Palettes:</strong> All colors consume semantic
          CSS custom properties calibrated for readable contrast in both modes.
        </li>
        <li>
          <strong>Reduced Motion:</strong> Animations, loading bars, and the
          illustrated theme toggle respect{" "}
          <code>prefers-reduced-motion: reduce</code>.
        </li>
        <li>
          <strong>Local Processing Privacy:</strong> Accessibility preferences
          and assistive inputs never trigger server uploads or behavioral
          tracking.
        </li>
      </ul>

      <h2>Known Areas Under Active Testing</h2>
      <p>
        Some rich visual editors (such as the Video Thumbnail Canvas Overlay
        Editor and responsive narrow-viewport headers) are under ongoing
        real-browser and screen-reader acceptance audits documented in{" "}
        <code>TODO.md</code>.
      </p>

      <h2>Report an Accessibility Barrier</h2>
      <p>
        If you encounter a keyboard trap, missing label, low-contrast surface,
        or screen-reader issue, please email{" "}
        <a href={`mailto:${operatorMetadata.supportEmail}`}>
          {operatorMetadata.supportEmail}
        </a>
        , submit a note via <Link href="/contact">Contact &amp; Support</Link> or{" "}
        <Link href="/feedback">Feedback</Link>, or file an issue on{" "}
        <a
          href={operatorMetadata.github.bugReportUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        .
      </p>
    </InformationalPage>
  );
}
