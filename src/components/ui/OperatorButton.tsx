import type { ButtonHTMLAttributes, ReactNode } from "react";

type OperatorButtonVariant = "primary" | "gold" | "secondary";

type OperatorButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: OperatorButtonVariant;
};

const variantClasses: Record<OperatorButtonVariant, string> = {
  primary: "bg-[var(--operator-action)] text-[var(--operator-action-foreground)] shadow-[var(--operator-shadow-action)] hover:bg-[var(--operator-action-hover)]",
  gold: "bg-[var(--operator-accent)] text-[var(--operator-accent-foreground)] shadow-[var(--operator-shadow-action)] hover:bg-[var(--operator-accent-hover)]",
  secondary: "bg-[var(--operator-surface-subtle)] text-[var(--operator-ink-muted)] hover:bg-[var(--operator-surface-hover)]",
};

export function OperatorButton({
  children,
  className = "",
  type = "button",
  variant = "primary",
  ...props
}: OperatorButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center rounded-[var(--operator-radius-control)] px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--operator-focus)] disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
