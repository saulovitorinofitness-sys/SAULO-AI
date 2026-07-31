import { Badge, Card, SectionHeader } from "@/components/ui";
import {
  PRESCRIPTION_ACTION_LABELS,
  type PrescriptionHistoryEntry,
} from "@/features/meal-plan";

function value(value: string | null) {
  return value || "Não se aplica";
}

export function PrescriptionHistory({
  entries,
}: {
  entries: readonly PrescriptionHistoryEntry[];
}) {
  return (
    <section
      aria-labelledby="prescription-history-title"
      className="space-y-4"
    >
      <SectionHeader
        description="Registro técnico interno do prontuário. Estas informações não são incluídas automaticamente no PDF do paciente."
        eyebrow="Auditoria clínica"
        title="Histórico da Prescrição"
      />
      {entries.length ? (
        <ol className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Card className="p-0">
                <details>
                  <summary className="flex cursor-pointer list-none flex-col gap-2 rounded-2xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] sm:flex-row sm:items-center sm:justify-between">
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone="info">
                        {PRESCRIPTION_ACTION_LABELS[entry.type]}
                      </Badge>
                      <span className="text-sm font-black">
                        {entry.professionalName}
                      </span>
                    </span>
                    <time
                      className="text-xs font-semibold text-[var(--muted)]"
                      dateTime={entry.occurredAt}
                    >
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "medium",
                      }).format(new Date(entry.occurredAt))}
                    </time>
                  </summary>
                  <div className="grid gap-4 border-t border-[var(--line)] p-4 text-sm md:grid-cols-2">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-[var(--muted)]">
                        Valor anterior
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">
                        {value(entry.previousValue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-[var(--muted)]">
                        Valor atual
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">
                        {value(entry.currentValue)}
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-xs font-black uppercase tracking-wide text-[var(--muted)]">
                        Justificativa clínica
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">
                        {entry.clinicalJustification ||
                          "Nenhuma observação clínica informada."}
                      </p>
                    </div>
                  </div>
                </details>
              </Card>
            </li>
          ))}
        </ol>
      ) : (
        <Card className="p-6 text-center">
          <p className="font-black">Nenhuma alteração registrada.</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            O histórico será criado automaticamente após a primeira alteração
            salva na prescrição.
          </p>
        </Card>
      )}
    </section>
  );
}

