import Link from "next/link";

export interface PatientBreadcrumbItem {
  readonly label: string;
  readonly href?: string;
}

export function PatientBreadcrumb({ items }: { items: readonly PatientBreadcrumbItem[] }) {
  return (
    <nav aria-label="Navegação contextual" className="mb-5 overflow-hidden">
      <ol className="flex min-w-0 items-center gap-1.5 overflow-x-auto text-xs font-bold text-slate-500 no-scrollbar">
        {items.map((item, index) => <li className="flex shrink-0 items-center gap-1.5" key={`${item.label}-${index}`}>{index ? <span aria-hidden="true" className="text-slate-300">›</span> : null}{item.href ? <Link className="rounded-[var(--radius-small)] px-1 py-1 text-[var(--primary)] hover:bg-[var(--secondary)]" href={item.href}>{item.label}</Link> : <span aria-current="page" className="max-w-44 truncate px-1 py-1 text-[var(--text-secondary)] sm:max-w-none">{item.label}</span>}</li>)}
      </ol>
    </nav>
  );
}
