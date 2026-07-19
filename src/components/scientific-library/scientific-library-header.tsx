import { Card, PageHeading, StatusBadge } from "@/components/ui";
import type { ScientificLibraryView } from "@/features/scientific-library";

const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

export function ScientificLibraryHeader({ view }: { view: ScientificLibraryView }) {
  return <><PageHeading description="Fonte oficial e compartilhada de conhecimento estruturado para os módulos autorizados do SAULO AI." eyebrow="Administração · dados demonstrativos" title="Biblioteca Científica" /><Card className="mb-6 grid gap-4 p-4 sm:grid-cols-3 md:p-5" variant="muted"><div><p className="text-xs font-bold text-[var(--muted)]">Itens disponíveis</p><p className="mt-1 text-xl font-black text-[var(--text-primary)]">{view.items.length}</p></div><div><p className="text-xs font-bold text-[var(--muted)]">Domínios</p><p className="mt-1 text-xl font-black text-[var(--text-primary)]">{view.domains.length}</p></div><div><p className="text-xs font-bold text-[var(--muted)]">Última revisão mockada</p><p className="mt-1 text-sm font-black text-[var(--text-primary)]">{formatDate(view.lastUpdatedAt)}</p><StatusBadge label="Revisão profissional" status="reviewed" /></div></Card></>;
}

