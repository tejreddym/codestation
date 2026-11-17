import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./ui.module.css";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const variants: Record<ButtonVariant, string | false> = {
  primary: styles.primary,
  secondary: false,
  ghost: styles.ghost,
  danger: styles.danger,
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

/** Native button. Never wraps children in another focusable element. */
export function Button({ variant = "secondary", size = "md", type = "button", className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={cx(styles.button, variants[variant], size === "sm" && styles.small, className)}
    />
  );
}

type IconButtonProps = Omit<ButtonProps, "aria-label"> & {
  label: string;
  children: ReactNode;
};

export function IconButton({ label, className, ...props }: IconButtonProps) {
  return <Button {...props} aria-label={label} className={cx(styles.iconButton, className)} />;
}

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function ButtonLink({ variant = "secondary", size = "md", className, children, ...props }: ButtonLinkProps) {
  return (
    <a {...props} className={cx(styles.button, variants[variant], size === "sm" && styles.small, className)}>
      {children}
    </a>
  );
}
