import { Bike, Dumbbell, Leaf, PersonStanding, type LucideIcon } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { InstitutionalDocumentIdentity } from "@/components/documents/institutional-document-identity";
import { RunnerIcon } from "@/components/icons/runner-icon";

type DeliverableTheme = "nutrition" | "assessments" | "performance";
type PerformanceDocumentModality = "running" | "bike" | "strength";

const performanceModalityIcons = {
  running: RunnerIcon,
  bike: Bike,
  strength: Dumbbell,
} as const satisfies Record<PerformanceDocumentModality, ComponentType<SVGProps<SVGSVGElement>>>;

const themes = {
  nutrition: {
    eyebrow: "text-[#a07e2c]",
    title: "text-[#183f31]",
    description: "text-[#607269]",
    icon: Leaf,
    iconColor: "text-[#80a17c]/85",
  },
  assessments: {
    eyebrow: "text-sky-200",
    title: "text-white",
    description: "text-sky-100",
    icon: PersonStanding,
    iconColor: "text-sky-200/85",
  },
  performance: {
    eyebrow: "text-[#d8bd78]",
    title: "text-white",
    description: "text-[#cbdad4]",
    icon: Dumbbell,
    iconColor: "text-[#d8bd78]",
  },
} as const satisfies Record<DeliverableTheme, {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
}>;

export function DeliverableDocumentHeader({
  theme,
  eyebrow,
  title,
  description,
  performanceModality,
}: {
  readonly theme: DeliverableTheme;
  readonly eyebrow: string;
  readonly title: string;
  readonly description?: string;
  readonly performanceModality?: PerformanceDocumentModality;
}) {
  const colors = themes[theme];
  const Icon = theme === "performance" && performanceModality
    ? performanceModalityIcons[performanceModality]
    : colors.icon;
  const nutrition = theme === "nutrition";

  return (
    <div className="min-w-0">
      {nutrition ? (
        <style>{`
          #nutrition-deliverable-report .report-cover > div[aria-hidden="true"] { display: none !important; }
        `}</style>
      ) : null}
      <div className="flex items-start justify-between gap-4">
        <InstitutionalDocumentIdentity
          className="max-w-[155mm]"
          compact
          tone={nutrition ? "default" : "inverse"}
        />
        <Icon aria-hidden="true" className={`pointer-events-none size-10 shrink-0 border-0 bg-transparent fill-none shadow-none ring-0 sm:size-16 print:size-16 ${colors.iconColor}`} strokeWidth={1.75} />
      </div>
      <div className="mt-5 min-w-0 text-center">
        <p className={`text-xs font-black uppercase tracking-[0.2em] ${colors.eyebrow}`}>
          {eyebrow}
        </p>
        <h1 className={`mt-2 text-3xl font-black leading-[1.08] tracking-tight sm:text-4xl ${colors.title}`}>
          {title}
        </h1>
        {description ? (
          <p className={`mx-auto mt-3 max-w-2xl text-sm leading-6 ${colors.description}`}>
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
