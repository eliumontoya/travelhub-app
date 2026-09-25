import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type SurfaceVariant = "card" | "panel" | "subtle";

type OperatorSurfaceProps<T extends ElementType = "div"> = {
  as?: T;
  children: ReactNode;
  className?: string;
  variant?: SurfaceVariant;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

const surfaceClasses: Record<SurfaceVariant, string> = {
  card: "rounded-[var(--operator-radius-card)] border border-[var(--operator-border)] bg-[var(--operator-surface)] shadow-[var(--operator-shadow-card)]",
  panel: "rounded-[var(--operator-radius-panel)] border border-[var(--operator-border)] bg-[var(--operator-surface-raised)] shadow-[var(--operator-shadow-panel)]",
  subtle: "rounded-[var(--operator-radius-card)] border border-[var(--operator-border-subtle)] bg-[var(--operator-surface-subtle)]",
};

export function OperatorSurface<T extends ElementType = "div">({
  as,
  children,
  className = "",
  variant = "card",
  ...props
}: OperatorSurfaceProps<T>) {
  const Component = as ?? "div";

  return (
    <Component className={`${surfaceClasses[variant]} ${className}`} {...props}>
      {children}
    </Component>
  );
}
