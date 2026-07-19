import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive" | "link";
export type ButtonSize = "small" | "medium" | "large" | "icon";

const variants: Readonly<Record<ButtonVariant, string>> = {
  primary: "border-transparent bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]",
  secondary: "border-transparent bg-[var(--secondary)] text-[var(--primary-hover)] hover:bg-[#d8ebe3]",
  outline: "border-[var(--line-strong)] bg-[var(--surface)] text-[var(--primary-hover)] hover:bg-[var(--surface-elevated)]",
  ghost: "border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]",
  destructive: "border-transparent bg-[var(--danger)] text-white hover:brightness-90",
  link: "border-transparent bg-transparent p-0 text-[var(--primary)] underline-offset-4 hover:underline",
};
const sizes: Readonly<Record<ButtonSize, string>> = {
  small: "min-h-9 px-3 text-xs",
  medium: "min-h-11 px-4 text-sm",
  large: "min-h-12 px-5 text-sm",
  icon: "size-11 p-0",
};

export function buttonStyles({ variant = "primary", size = "medium", fullWidth = false }: { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean } = {}) {
  return `inline-flex items-center justify-center gap-2 rounded-[var(--radius-medium)] border font-black transition duration-[var(--transition-fast)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55 ${variants[variant]} ${sizes[size]} ${fullWidth ? "w-full" : ""}`;
}

export function Button({ variant, size, loading = false, className = "", children, disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean }) {
  return <button aria-busy={loading || undefined} className={`${buttonStyles({ variant, size })} ${className}`} disabled={disabled || loading} {...props}>{loading ? <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" /> : null}{children}</button>;
}

export function ButtonLink({ href, variant, size, fullWidth, className = "", children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean; children: ReactNode }) {
  return <Link className={`${buttonStyles({ variant, size, fullWidth })} ${className}`} href={href} {...props}>{children}</Link>;
}

export function IconButton({ "aria-label": ariaLabel, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { "aria-label": string }) {
  return <Button aria-label={ariaLabel} size="icon" variant="outline" {...props} />;
}
