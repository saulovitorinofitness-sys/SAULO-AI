"use client";

import type { NutritionFollowUpView } from "@/features/nutrition-follow-up/service";

export type PerformanceSelectionRecord = {
  readonly selectionId: string;
  readonly recordId: string;
  readonly kind: "prescription" | "scheduled" | "execution";
  readonly occurredAt: string;
  readonly label: string;
  readonly status: string;
};

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export function performanceSelectionRecords(
  performance: NutritionFollowUpView["performance"],
) {
  return [
    ...performance.prescriptions.map((record): PerformanceSelectionRecord => ({
      selectionId: `prescription:${record.id}`,
      recordId: record.id,
      kind: "prescription",
      occurredAt: record.occurredAt,
      label: `Prescrição · ${record.title}`,
      status: record.status === "FINALIZED" ? "Finalizada" : "Rascunho",
    })),
    ...performance.scheduledSessions.map((record): PerformanceSelectionRecord => ({
      selectionId: `scheduled:${record.id}`,
      recordId: record.id,
      kind: "scheduled",
      occurredAt: record.scheduledStartAt,
      label: `Sessão programada · ${record.title}`,
      status: record.status,
    })),
    ...performance.executions.map((record): PerformanceSelectionRecord => ({
      selectionId: `execution:${record.id}`,
      recordId: record.id,
      kind: "execution",
      occurredAt: record.actualStartAt,
      label: `Execução · ${record.modality}`,
      status: record.status,
    })),
  ].sort((left, right) =>
    left.occurredAt.localeCompare(right.occurredAt) ||
    left.selectionId.localeCompare(right.selectionId),
  );
}

export function initialPerformanceSelection(
  records: readonly PerformanceSelectionRecord[],
) {
  if (records.length <= 2) return records.map((record) => record.selectionId);
  return [records[0].selectionId, records.at(-1)!.selectionId];
}

export function PerformanceComparisonSelector({
  records,
  selectedIds,
  onChange,
}: {
  records: readonly PerformanceSelectionRecord[];
  selectedIds: readonly string[];
  onChange: (ids: readonly string[]) => void;
}) {
  const selected = new Set(selectedIds);

  function toggle(selectionId: string, checked: boolean) {
    const next = checked
      ? new Set([...selectedIds, selectionId])
      : new Set(selectedIds.filter((id) => id !== selectionId));
    onChange(
      records
        .filter((record) => next.has(record.selectionId))
        .map((record) => record.selectionId),
    );
  }

  return (
    <section aria-labelledby="performance-selector-title" className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-sm font-black text-slate-950" id="performance-selector-title">Registros de Performance usados no comparativo</h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">Selecione prescrições, sessões programadas e execuções reais. A seleção não altera nenhum registro.</p>
        </div>
        <div aria-label="Atalhos de seleção de Performance" className="flex flex-wrap gap-2" role="group">
          <button className="min-h-10 rounded-xl border border-emerald-300 bg-white px-3 text-xs font-black text-emerald-900 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" onClick={() => onChange(initialPerformanceSelection(records))} type="button">Primeiro e último</button>
          <button className="min-h-10 rounded-xl border border-emerald-300 bg-white px-3 text-xs font-black text-emerald-900 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" onClick={() => onChange(records.map((record) => record.selectionId))} type="button">Todos</button>
          <button className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500" onClick={() => onChange([])} type="button">Limpar seleção</button>
        </div>
      </div>

      {records.length ? (
        <fieldset className="mt-4">
          <legend className="sr-only">Registros de Performance</legend>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {records.map((record) => {
              const isSelected = selected.has(record.selectionId);
              return (
                <label className={`cursor-pointer rounded-xl border p-3 transition focus-within:ring-2 focus-within:ring-emerald-600 ${isSelected ? "border-emerald-700 bg-white shadow-sm" : "border-slate-200 bg-slate-50/80 hover:border-emerald-300"}`} key={record.selectionId}>
                  <span className="flex items-start gap-3">
                    <input checked={isSelected} className="mt-0.5 size-4 shrink-0 accent-emerald-700" onChange={(event) => toggle(record.selectionId, event.target.checked)} type="checkbox" />
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-slate-950">{dateTimeFormatter.format(new Date(record.occurredAt))}</span>
                      <span className="mt-1 block text-xs font-semibold text-slate-600">{record.label}</span>
                      <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-800">{record.status}</span>
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">Nenhum registro de Performance está disponível para seleção.</p>
      )}
    </section>
  );
}
