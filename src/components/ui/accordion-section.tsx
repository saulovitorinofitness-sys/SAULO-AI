"use client";

import type { ReactNode } from "react";

type AccordionSectionProps = {
  number?: number;
  title: string;
  description?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export function AccordionSection({
  number,
  title,
  description,
  open,
  onToggle,
  children,
}: AccordionSectionProps) {
  const formattedNumber =
    typeof number === "number"
      ? String(number).padStart(2, "0")
      : undefined;

  return (
    <section className="overflow-hidden rounded-2xl border border-[#cfe1da] bg-white shadow-[0_6px_18px_rgb(16_63_50/0.05)]">
      <button
        aria-expanded={open}
        className={[
          "flex min-h-[54px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors sm:px-5",
          open
            ? "bg-[#103f32] text-white"
            : "bg-white text-[#103f32] hover:bg-[#f3f8f6]",
        ].join(" ")}
        onClick={onToggle}
        type="button"
      >
        {formattedNumber && (
          <span
            className={[
              "flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg px-2 text-xs font-black",
              open
                ? "bg-white/10 text-white"
                : "bg-[#103f32] text-white",
            ].join(" ")}
          >
            {formattedNumber}
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-black uppercase tracking-[0.06em]">
            {title}
          </span>

          {description && (
            <span
              className={[
                "mt-0.5 block text-xs font-medium",
                open ? "text-emerald-100" : "text-slate-500",
              ].join(" ")}
            >
              {description}
            </span>
          )}
        </span>

        <span
          aria-hidden="true"
          className={[
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg font-black transition-transform duration-200",
            open
              ? "rotate-180 bg-white/10 text-white"
              : "bg-slate-100 text-[#103f32]",
          ].join(" ")}
        >
          ⌄
        </span>
      </button>

      <div
        className={[
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        ].join(" ")}
      >
        <div className="overflow-hidden">
          <div className="border-t border-[#dce9e4] p-4 sm:p-5">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}