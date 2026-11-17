import type { NutritionFollowUpView } from "@/features/nutrition-follow-up/service";

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeZone: "UTC",
});

const modalityLabels: Readonly<Record<string, string>> = {
  STRENGTH: "Força",
  RUNNING: "Corrida",
  CYCLING: "Ciclismo",
  OTHER: "Outra modalidade",
};

function durationLabel(seconds?: number) {
  if (seconds === undefined) return "Não registrada";
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

function dateLabel(value?: string) {
  if (!value) return "Não informada";
  return dateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

export function PerformanceComparisonPanel({
  performance,
}: {
  performance: NutritionFollowUpView["performance"];
}) {
  const scheduledById = new Map(
    performance.scheduledSessions.map((session) => [session.id, session] as const),
  );
  const hasAnyRecord =
    performance.prescriptions.length > 0 ||
    performance.scheduledSessions.length > 0 ||
    performance.executions.length > 0;

  if (!hasAnyRecord) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-lg font-black text-amber-950">Performance sem histórico suficiente</h2>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          Não há prescrições, sessões programadas ou execuções na seleção atual. Nenhum resultado de Performance foi estimado ou criado.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Indicadores de Performance registrados">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500">Prescrições</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{performance.prescriptions.length}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500">Sessões programadas</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{performance.scheduledSessions.length}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500">Execuções registradas</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{performance.executions.length}</p>
        </article>
      </section>

      <section aria-labelledby="performance-prescriptions-title" className="space-y-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">Prescrição</p>
          <h2 className="mt-1 text-xl font-black text-slate-950" id="performance-prescriptions-title">Planos registrados</h2>
        </div>
        {performance.prescriptions.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {performance.prescriptions.map((prescription) => (
              <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" key={prescription.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-black text-slate-950">{prescription.title}</h3>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-black ${prescription.status === "FINALIZED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
                    {prescription.status === "FINALIZED" ? "Finalizada" : "Rascunho"}
                  </span>
                </div>
                <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <div><dt className="text-slate-500">Registrada em</dt><dd className="font-bold text-slate-800">{dateTimeFormatter.format(new Date(prescription.occurredAt))}</dd></div>
                  <div><dt className="text-slate-500">Vigência</dt><dd className="font-bold text-slate-800">{dateLabel(prescription.validFrom)} → {dateLabel(prescription.validUntil)}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">Nenhuma prescrição registrada.</p>
        )}
      </section>

      <section aria-labelledby="performance-scheduled-title" className="space-y-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">Planejamento</p>
          <h2 className="mt-1 text-xl font-black text-slate-950" id="performance-scheduled-title">Sessões programadas</h2>
        </div>
        {performance.scheduledSessions.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {performance.scheduledSessions.map((session) => (
              <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" key={session.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-black text-slate-950">{session.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">{dateTimeFormatter.format(new Date(session.scheduledStartAt))}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-800">{session.status}</span>
                </div>
                <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                  <div><dt className="text-slate-500">Modalidade</dt><dd className="font-black text-slate-900">{modalityLabels[session.modality] ?? session.modality}</dd></div>
                  <div><dt className="text-slate-500">Duração planejada</dt><dd className="font-black text-slate-900">{durationLabel(session.plannedDurationSeconds)}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">Nenhuma sessão programada selecionada.</p>
        )}
      </section>

      <section aria-labelledby="performance-executions-title" className="space-y-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-700">Execução</p>
          <h2 className="mt-1 text-xl font-black text-slate-950" id="performance-executions-title">Treinos efetivamente registrados</h2>
          <p className="mt-1 text-sm text-slate-600">Uma execução só é associada à prescrição quando existe vínculo explícito de sessão ou plano.</p>
        </div>
        {performance.executions.length ? (
          <div className="space-y-3">
            {performance.executions.map((execution) => {
              const scheduled = execution.scheduledSessionId
                ? scheduledById.get(execution.scheduledSessionId)
                : undefined;
              const explicitlyLinked = Boolean(
                scheduled || execution.workoutPlanEntryId || execution.sessionId,
              );
              return (
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" key={execution.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-black text-slate-950">{modalityLabels[execution.modality] ?? execution.modality}</h3>
                      <p className="mt-1 text-xs text-slate-500">{dateTimeFormatter.format(new Date(execution.actualStartAt))}</p>
                    </div>
                    <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-black text-sky-900">{execution.status}</span>
                  </div>
                  <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <div><dt className="text-slate-500">Duração executada</dt><dd className="font-black text-slate-900">{durationLabel(execution.executedDurationSeconds)}</dd></div>
                    <div><dt className="text-slate-500">PSE/RPE</dt><dd className="font-black text-slate-900">{execution.executedRpe ?? "Não registrada"}</dd></div>
                    <div><dt className="text-slate-500">Origem</dt><dd className="font-black text-slate-900">{execution.source}</dd></div>
                    <div><dt className="text-slate-500">Vínculo</dt><dd className="font-black text-slate-900">{explicitlyLinked ? scheduled?.title ?? "Plano/sessão vinculada" : "Execução espontânea"}</dd></div>
                  </dl>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Há dados de planejamento, mas nenhuma execução de treino foi registrada. Prescrição não foi tratada como resultado executado.</p>
        )}
      </section>
    </div>
  );
}
