import type { ReactNode } from "react";

import type { ProfessionalAudit } from "@/features/clinical-collection";
import { CompletionBadge } from "@/components/clinical-collection/completion-badge";
import { SectionAuditInfo } from "./section-audit-info";

export function ClinicalSummaryCard({ title, status, audit, children, className = "" }: { title: string; status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"; audit?: ProfessionalAudit; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-[#dce5e0] bg-white p-4 shadow-[0_8px_24px_rgb(20_55_44/0.03)] sm:p-5 ${className}`}>
      <header className="mb-5 flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-base font-black text-slate-900">{title}</h2><div className="mt-1"><SectionAuditInfo audit={audit} /></div></div><CompletionBadge status={status} /></header>
      {children}
    </section>
  );
}
