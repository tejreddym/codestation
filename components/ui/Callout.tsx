import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import styles from "./ui.module.css";
import { cx } from "./cx";

export type CalloutKind = "error" | "warning" | "info" | "success" | "neutral";

const kindClasses: Record<CalloutKind, string | false> = {
  error: styles.calloutError,
  warning: styles.calloutWarning,
  info: styles.calloutInfo,
  success: styles.calloutSuccess,
  neutral: false,
};

type CalloutProps = HTMLAttributes<HTMLParagraphElement> & {
  kind?: CalloutKind;
  children: ReactNode;
};

export const Callout = forwardRef<HTMLParagraphElement, CalloutProps>(function Callout(
  { kind = "neutral", className, children, ...props },
  ref,
) {
  return (
    <p
      {...props}
      ref={ref}
      role={kind === "error" ? "alert" : "status"}
      className={cx(styles.callout, kindClasses[kind], className)}
    >
      {children}
    </p>
  );
});
