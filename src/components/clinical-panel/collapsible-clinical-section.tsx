import type { ReactNode } from "react";

export function CollapsibleClinicalSection({ title, children }: { title: string; children: ReactNode }) {
  return <details className="group mt-5 rounded-xl border border-slate-200 bg-[#fafcfb]"><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-black text-[#12664f]"><span>{title}</span><span aria-hidden="true" className="transition group-open:rotate-180">⌄</span></summary><div className="border-t border-slate-200 p-4">{children}</div></details>;
}
