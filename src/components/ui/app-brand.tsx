import type { CSSProperties } from "react";

import { BRAND_IDENTITIES, getBrandIdentity, type BrandContext } from "@/config/branding";

export type AppBrandVariant = "full" | "compact" | "sidebar" | "header" | "footer";

const variantStyles: Readonly<Record<AppBrandVariant, { wrapper: string; mark: string; name: string; subtitle: string }>> = {
  full: { wrapper: "inline-flex items-center gap-3", mark: "size-12 rounded-2xl text-base", name: "text-lg", subtitle: "text-[11px]" },
  compact: { wrapper: "inline-flex items-center", mark: "size-10 rounded-xl text-sm", name: "sr-only", subtitle: "sr-only" },
  sidebar: { wrapper: "inline-flex items-center gap-3", mark: "size-10 rounded-xl text-sm", name: "text-base", subtitle: "text-[10px]" },
  header: { wrapper: "inline-flex items-center gap-3", mark: "size-10 rounded-xl text-sm", name: "text-base", subtitle: "text-[10px]" },
  footer: { wrapper: "inline-flex items-center gap-2", mark: "size-8 rounded-lg text-xs", name: "text-sm", subtitle: "text-[10px]" },
};

export function AppBrand({ context, variant = "full", className = "" }: { context: BrandContext; variant?: AppBrandVariant; className?: string }) {
  const identity = getBrandIdentity(context);
  const platform = BRAND_IDENTITIES.platform;
  const styles = variantStyles[variant];
  const logoSource = variant === "compact" ? identity.logoCompactPath ?? identity.logoPath : identity.logoPath;
  const markStyle = logoSource ? { backgroundImage: `url(${logoSource})` } satisfies CSSProperties : undefined;
  const accessibleLabel = `${identity.displayName}${identity.subtitle ? `, ${identity.subtitle}` : ""}${identity.isProvisional ? ", identidade provisória" : ""}`;

  return <span aria-label={accessibleLabel} className={`${styles.wrapper} ${className}`} data-brand-context={context} data-brand-provisional={identity.isProvisional || undefined}>
    <span aria-hidden="true" className={`grid shrink-0 place-items-center bg-[#12664f] bg-contain bg-center bg-no-repeat font-black tracking-tight text-white shadow-sm ${styles.mark}`} style={markStyle}>{logoSource ? null : identity.shortName}</span>
    {variant !== "compact" ? <span className="min-w-0"><span className={`block truncate font-black tracking-tight text-[#183029] ${styles.name}`}>{identity.displayName}</span>{identity.subtitle ? <span className={`block truncate font-bold uppercase tracking-[0.16em] text-[#71827b] ${styles.subtitle}`}>{identity.subtitle}</span> : null}{context !== "platform" && (variant === "full" || variant === "sidebar" || variant === "footer") ? <span className="mt-0.5 block truncate text-[9px] font-semibold tracking-wide text-slate-400">Tecnologia {platform.displayName}</span> : null}</span> : null}
  </span>;
}
