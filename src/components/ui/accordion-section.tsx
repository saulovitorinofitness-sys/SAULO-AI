"use client";

import type { ReactNode } from "react";

type AccordionTheme = "green" | "blue";

type AccordionSectionProps = {
  number?: number;
  title: string;
  description?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  theme?: AccordionTheme;
};

const themeClasses: Record<
  AccordionTheme,
  {
    section: string;
    openButton: string;
    closedButton: string;
    openNumber: string;
    closedNumber: string;
    openDescription: string;
    openToggle: string;
    closedToggle: string;
    contentBorder: string;
  }
> = {
  green: {
    section:
      "border-[#cfe1da] shadow-[0_6px_18px_rgb(16_63_50/0.05)]",
    openButton: "bg-[#103f32] text-white",
    closedButton:
      "bg-white text-[#103f32] hover:bg-[#f3f8f6]",
    openNumber: "bg-white/10 text-white",
    closedNumber: "bg-[#103f32] text-white",
    openDescription: "text-emerald-100",
    openToggle: "rotate-180 bg-white/10 text-white",
    closedToggle: "bg-slate-100 text-[#103f32]",
    contentBorder: "border-[#dce9e4]",
  },
  blue: {
    section:
      "border-blue-200 shadow-[0_6px_18px_rgb(23_104_166/0.08)]",
    openButton:
      "bg-gradient-to-r from-[#0f4c81] via-[#1768a6] to-[#2386c8] text-white",
    closedButton:
      "bg-white text-[#0f4c81] hover:bg-blue-50",
    openNumber: "bg-white/15 text-white",
    closedNumber: "bg-[#1768a6] text-white",
    openDescription: "text-blue-100",
    openToggle: "rotate-180 bg-white/15 text-white",
    closedToggle: "bg-blue-50 text-[#1768a6]",
    contentBorder: "border-blue-100",
  },
};

export function AccordionSection({
  number,
  title,
  description,
  open,
  onToggle,
  children,
  theme = "green",
}: AccordionSectionProps) {
  const formattedNumber =
    typeof number === "number"
      ? String(number).padStart(2, "0")
      : undefined;

  const palette = themeClasses[theme];

  return (
    <section
      className={[
        "overflow-hidden rounded-2xl border bg-white",
        palette.section,
      ].join(" ")}
    >
      <button
        aria-expanded={open}
        className={[
          "flex min-h-[54px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors sm:px-5",
          open ? palette.openButton : palette.closedButton,
        ].join(" ")}
        onClick={onToggle}
        type="button"
      >
        {formattedNumber && (
          <span
            className={[
              "flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg px-2 text-xs font-black",
              open ? palette.openNumber : palette.closedNumber,
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
                open
                  ? palette.openDescription
                  : "text-slate-500",
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
            open ? palette.openToggle : palette.closedToggle,
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
          <div
            className={[
              "border-t p-4 sm:p-5",
              palette.contentBorder,
            ].join(" ")}
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
