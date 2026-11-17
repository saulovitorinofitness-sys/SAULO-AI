import { Card, PageHeading } from "@/components/ui";
import type { ScientificLibraryView } from "@/features/scientific-library/contracts";

function metricValue(value: number | undefined) {
  return value === undefined ? "Não disponível" : String(value);
}

export function ScientificLibraryHeader({ view }: { view: ScientificLibraryView }) {
  const hasCompleteEditorialStatus = view.items.every(
    (item) => item.editorialStatus !== undefined,
  );
  const hasCompleteStorageKind = view.items.every(
    (item) => item.storageKind !== undefined,
  );
  const hasCompleteDataNature = view.items.every(
    (item) => item.dataNature !== undefined,
  );
  const approved = hasCompleteEditorialStatus
    ? view.items.filter((item) => item.editorialStatus === "APPROVED").length
    : undefined;
  const underReview = hasCompleteEditorialStatus
    ? view.items.filter((item) => item.editorialStatus === "UNDER_REVIEW").length
    : undefined;
  const persisted = hasCompleteStorageKind
    ? view.items.filter((item) => item.storageKind === "PERSISTED").length
    : undefined;
  const demonstrative = hasCompleteDataNature
    ? view.items.filter((item) => item.dataNature === "DEMONSTRATIVE").length
    : undefined;

  return (
    <>
      <PageHeading
        description="Catálogo interno em consolidação, com natureza e situação editorial identificadas separadamente."
        eyebrow="Administração · estruturação editorial"
        title="Biblioteca Científica"
      />
      <Card className="mb-4 p-3 sm:p-4" variant="muted">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-[var(--radius-medium)] border border-[var(--primary)] bg-[var(--brand-soft)] px-3 py-2.5">
            <p className="text-xs font-black uppercase tracking-wide text-[var(--primary-hover)]">
              Conteúdo aprovado
            </p>
            <p className="mt-1 text-2xl font-black text-[var(--primary-hover)]">
              {metricValue(approved)}
            </p>
          </div>
          <div className="rounded-[var(--radius-medium)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
            <p className="text-xs font-bold text-[var(--muted)]">Em revisão</p>
            <p className="mt-1 text-xl font-black text-[var(--text-primary)]">
              {metricValue(underReview)}
            </p>
          </div>
          <div className="rounded-[var(--radius-medium)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
            <p className="text-xs font-bold text-[var(--muted)]">
              Registros persistidos
            </p>
            <p className="mt-1 text-xl font-black text-[var(--text-primary)]">
              {metricValue(persisted)}
            </p>
          </div>
          <div className="rounded-[var(--radius-medium)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
            <p className="text-xs font-bold text-[var(--muted)]">
              Conteúdo demonstrativo
            </p>
            <p className="mt-1 text-xl font-black text-[var(--text-primary)]">
              {metricValue(demonstrative)}
            </p>
          </div>
        </div>
        <p
          className="mt-3 rounded-[var(--radius-medium)] border-l-4 border-[var(--primary)] bg-[var(--brand-soft)] px-3 py-2.5 text-sm leading-5 text-[var(--text-secondary)]"
          role="note"
        >
          A Biblioteca Científica está em estruturação editorial. Os conteúdos
          demonstrativos auxiliam na construção e nos testes do sistema, mas não
          devem ser utilizados como referência científica aprovada.
        </p>
      </Card>
    </>
  );
}
