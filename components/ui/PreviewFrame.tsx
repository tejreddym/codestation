import type { CSSProperties } from "react";
import styles from "./ui.module.css";
import { cx } from "./cx";

type PreviewFrameProps = {
  title: string;
  src?: string;
  srcDoc?: string;
  sandbox?: string;
  height?: number;
  className?: string;
};

/** Standard frame around an iframe. Attributes are passed through verbatim. */
export function PreviewFrame({ title, src, srcDoc, sandbox, height = 360, className }: PreviewFrameProps) {
  const style: CSSProperties = { minHeight: height };
  return (
    <div className={cx(styles.previewFrame, className)} style={style}>
      <iframe title={title} src={src} srcDoc={srcDoc} sandbox={sandbox} style={style} />
    </div>
  );
}
