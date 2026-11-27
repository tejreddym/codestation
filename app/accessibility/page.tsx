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
        We target <strong>WCAG 2.1 / 2.2 Level AA</strong> across navigation,
        contrast tokens, heading hierarchy, ARIA labeling, focus visibility, and
        status announcements. Automated <code>@axe-core/playwright</code> audits
        run in continuous verification across core homepage, tool, station, Pro,
        support, and embed routes in both light and dark themes.
      </p>

      <h2>Keyboard Navigation, Focus Traps &amp; Shortcuts</h2>
      <ul>
        <li>
          <strong>Command Palette:</strong> Press <kbd>Cmd + K</kbd> (macOS) or{" "}
          <kbd>Ctrl + K</kbd> (Windows/Linux) anywhere in the app to open global
          tool, station, and action search with arrow-key selection, full modal
          <kbd>Tab</kbd> focus trapping, and <kbd>Escape</kbd> focus restoration.
        </li>
        <li>
          <strong>Modal Dialogs:</strong> The Command Palette (<kbd>Cmd/Ctrl + K</kbd>),
          Keyboard Shortcuts cheat sheet (<kbd>?</kbd>), and Embed Snippet
          generator wrap <kbd>Tab</kbd> / <kbd>Shift + Tab</kbd> focus inside
          the active dialog and return focus to the invoking trigger when closed.
        </li>
        <li>
          <strong>Native Form Controls:</strong> Tool inputs use labeled native
          controls, explicit fieldsets, visible <code>:focus-visible</code>{" "}
          outlines across buttons, links, inputs, selects, and summaries, plus
          accessible names matching visible button text.
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
