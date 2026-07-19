import type { ReactNode } from "react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export function SectionCard({ title, description, children, collapsible = false, defaultOpen = true }: { title: string; description?: string; children: ReactNode; collapsible?: boolean; defaultOpen?: boolean }) {
  if (collapsible) {
    return (
      <details className="group rounded-[var(--radius-large)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-subtle)]" open={defaultOpen}>
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 sm:px-5">
          <span><span className="block text-sm font-black text-slate-900">{title}</span>{description ? <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span> : null}</span>
          <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 transition group-open:rotate-180">⌄</span>
        </summary>
        <div className="border-t border-slate-100 p-4 sm:p-5">{children}</div>
      </details>
    );
  }
  return (
    <Card className="p-4 sm:p-5">
      <header className="mb-5"><CardTitle className="text-sm">{title}</CardTitle>{description ? <CardDescription>{description}</CardDescription> : null}</header>
      {children}
    </Card>
  );
}
