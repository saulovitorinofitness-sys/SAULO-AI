import type { HTMLAttributes } from "react";

export type CardVariant = "default" | "elevated" | "interactive" | "outlined" | "muted" | "success" | "warning" | "danger" | "info";
const variants: Readonly<Record<CardVariant, string>> = {
  default: "border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-subtle)]",
  elevated: "border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-elevated)]",
  interactive: "border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-subtle)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)]",
  outlined: "border-[var(--line-strong)] bg-[var(--surface)]",
  muted: "border-[var(--line)] bg-[var(--surface-elevated)]",
  success: "border-emerald-200 bg-emerald-50",
  warning: "border-amber-200 bg-amber-50",
  danger: "border-rose-200 bg-rose-50",
  info: "border-sky-200 bg-sky-50",
};

export function Card({ variant = "default", className = "", ...props }: HTMLAttributes<HTMLElement> & { variant?: CardVariant }) { return <section className={`rounded-[var(--radius-large)] border ${variants[variant]} ${className}`} {...props} />; }
export function CardHeader({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={`mb-4 ${className}`} {...props} />; }
export function CardTitle({ className = "", ...props }: HTMLAttributes<HTMLHeadingElement>) { return <h2 className={`text-[length:var(--font-card-title)] font-black text-[var(--text-primary)] ${className}`} {...props} />; }
export function CardDescription({ className = "", ...props }: HTMLAttributes<HTMLParagraphElement>) { return <p className={`mt-1 text-[length:var(--font-body-small)] leading-5 text-[var(--muted)] ${className}`} {...props} />; }
export function CardContent({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={className} {...props} />; }
export function CardFooter({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={`mt-4 ${className}`} {...props} />; }
