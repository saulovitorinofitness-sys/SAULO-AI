import type { ReactNode } from "react";
import { fieldControlStyles } from "@/components/ui/form";

export function ClinicalField({ id, label, required = false, hint, children }: { id: string; label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-bold text-slate-700" htmlFor={id}>
      {label}{required ? <span aria-hidden="true" className="ml-1 text-rose-600">*</span> : null}
      {children}
      {hint ? <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">{hint}</span> : null}
    </label>
  );
}

export const clinicalInputClass = `mt-1.5 ${fieldControlStyles} invalid:border-rose-500 invalid:ring-2 invalid:ring-rose-500/15`;
