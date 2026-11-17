import type { StructuredEnduranceSession } from "@/features/performance-endurance/endurance-workout-contracts";
import {
  RUNNING_WEEKDAYS,
  RUNNING_WEEKDAY_SHORT_LABELS,
  buildRunningWeekGrid,
  runningBlockSequence,
  runningBlockSequenceLines,
  runningIntensityPresentation,
  runningSessionGridTotalLines,
} from "@/features/performance-endurance/running-week-presentation";
import type { WorkoutPlanEnduranceModality } from "@/features/performance-endurance/workout-contracts";

const toneClasses = {
  NEUTRAL: "border-slate-300 bg-slate-50 text-slate-700",
  Z1: "border-sky-300 bg-sky-50 text-sky-950",
  Z2: "border-emerald-300 bg-emerald-50 text-emerald-950",
  Z3: "border-amber-300 bg-amber-50 text-amber-950",
  Z4: "border-orange-300 bg-orange-50 text-orange-950",
  Z5: "border-rose-300 bg-rose-50 text-rose-950",
} as const;

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function periodLabel(startDate: string, endDate: string) {
  return `${dateLabel(startDate)}–${dateLabel(endDate)}`;
}

function SessionSummary({
  active,
  onSelect,
  preserveLegacyQualitativePresentation,
  running,
  session,
}: {
  readonly active: boolean;
  readonly onSelect?: (sessionId: string) => void;
  readonly preserveLegacyQualitativePresentation?: boolean;
  readonly running: WorkoutPlanEnduranceModality<"RUNNING">;
  readonly session: StructuredEnduranceSession;
}) {
  const intensity = runningIntensityPresentation(
    session,
    running.configuration.zoneProfile,
    { preserveLegacyQualitativePresentation },
  );
  const content = (
    <>
      <span className="block min-w-0 whitespace-pre-wrap break-words font-black leading-tight text-slate-950">
        {session.title}
      </span>
      <span
        aria-label={runningBlockSequence(session)}
        className="running-session-sequence mt-1.5 block min-w-0 space-y-1 whitespace-pre-wrap break-words text-xs leading-[1.35] text-slate-700 print:text-[9pt]"
      >
        {runningBlockSequenceLines(session).map((line) => (
          <span className="block border-l-2 border-slate-200 pl-1.5" key={line}>
            {line}
          </span>
        ))}
      </span>
      <span
        className={`running-session-intensity running-intensity-${intensity.tone} mt-2 block min-w-0 whitespace-pre-wrap break-words rounded-md border px-2 py-1 text-xs font-black leading-4 print:text-[9pt] ${toneClasses[intensity.tone]}`}
      >
        {intensity.label}
        {intensity.guidance ? (
          <span className="mt-0.5 block font-normal">{intensity.guidance}</span>
        ) : null}
      </span>
      <span className="running-session-totals mt-1.5 block space-y-0.5 text-xs font-bold leading-4 text-slate-700 print:text-[9pt]">
        {runningSessionGridTotalLines(session).map((line) => (
          <span className="block" key={line}>{line}</span>
        ))}
      </span>
    </>
  );

  return onSelect ? (
    <button
      aria-pressed={active}
      className={`running-session-summary min-w-0 w-full whitespace-pre-wrap break-words rounded-lg border p-2.5 text-left transition ${active ? "border-sky-700 bg-sky-50 ring-2 ring-sky-200" : "border-slate-200 bg-white hover:border-sky-400"}`}
      onClick={() => onSelect(session.id)}
      type="button"
    >
      {content}
    </button>
  ) : (
    <article className="running-session-summary min-w-0 whitespace-pre-wrap break-words rounded-lg border border-slate-300 bg-white p-2.5">
      {content}
    </article>
  );
}

export function RunningWeekGrid({
  activeSessionId,
  onSelectSession,
  preserveLegacyQualitativePresentation,
  running,
}: {
  readonly activeSessionId?: string;
  readonly onSelectSession?: (sessionId: string) => void;
  readonly preserveLegacyQualitativePresentation?: boolean;
  readonly printMode?: boolean;
  readonly running: WorkoutPlanEnduranceModality<"RUNNING">;
}) {
  const rows = buildRunningWeekGrid(running);
  const intensityTones = running.configuration.zoneProfile
    ? (["NEUTRAL", "Z1", "Z2", "Z3", "Z4", "Z5"] as const)
    : (["NEUTRAL"] as const);

  return (
    <section aria-label="Planejamento semanal da Corrida" className="running-week-grid space-y-3">
      <div className="border-l-4 border-slate-400 bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-700 print:text-[8pt]">
        <p>
          <span className="font-black text-slate-950">Legenda dos resumos:</span>{" "}
          Aquec. = aquecimento · Prep. = preparação · Recup. = recuperação · Final = volta à calma.
        </p>
        <p>
          Em intervalados, a recuperação ocorre somente entre tiros, salvo quando “inclui recuperação final” estiver indicado.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-700 print:text-[8pt]">
        <span className="mr-1 font-black text-slate-950">Legenda de intensidade:</span>
        {intensityTones.map((tone) => (
          <span
            className={`running-intensity-${tone} rounded-md border px-2 py-1 ${toneClasses[tone]}`}
            key={tone}
          >
            {tone === "NEUTRAL" ? "A definir" : `${tone} individual`}
          </span>
        ))}
        {!running.configuration.zoneProfile ? (
          <span className="font-normal">Sem zonas individuais configuradas.</span>
        ) : null}
        <span className="font-normal">Códigos e contornos permanecem legíveis sem cor.</span>
      </div>

      <div className="min-w-0 space-y-3 pb-2">
        <div className="min-w-0">
          <div className="running-week-header hidden border-b-2 border-slate-800 bg-slate-100 text-[11px] font-black uppercase tracking-wide text-slate-700 md:grid md:grid-cols-[7rem_repeat(7,minmax(0,1fr))] print:grid print:grid-cols-[17mm_repeat(7,minmax(0,1fr))] print:text-[8.5pt]">
            <div className="p-2">Ciclo</div>
            {RUNNING_WEEKDAYS.map((weekday) => (
              <div className="border-l border-slate-300 p-2 text-center" key={weekday}>
                {RUNNING_WEEKDAY_SHORT_LABELS[weekday]}
              </div>
            ))}
          </div>
          <div>
            {rows.map((row) => {
              const rowHasSessions = row.cells.some(
                (cell) => cell.sessions.length > 0,
              );
              return (
                <div
                  className={`running-week-row ${rowHasSessions ? "running-week-row-has-sessions print:break-inside-avoid" : "print:break-inside-auto"} grid min-w-0 grid-cols-1 border-b border-slate-300 md:grid-cols-[7rem_repeat(7,minmax(0,1fr))] print:grid-cols-[17mm_repeat(7,minmax(0,1fr))]`}
                  key={row.startDate}
                >
                <div className="bg-slate-100 p-2 text-xs md:block print:text-[8pt]">
                  <p className="font-black text-slate-950">Semana {row.weekNumber}</p>
                  <p className="mt-1 text-slate-600">{periodLabel(row.startDate, row.endDate)}</p>
                </div>
                {row.cells.map((cell) => (
                  <div
                    className={`${rowHasSessions ? "md:min-h-36" : "md:min-h-20"} grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-2 border-t border-slate-200 p-2 md:block md:border-l md:border-t-0 md:p-1.5 print:block print:min-h-0 print:border-l print:border-t-0 print:p-1 ${cell.inCyclePeriod ? "bg-white" : "bg-slate-100/80 text-slate-400"}`}
                    key={cell.date}
                  >
                    <p className="text-[10px] font-black text-slate-500 md:mb-1 print:mb-1 print:text-[7.5pt]">
                      {dateLabel(cell.date)}
                    </p>
                    {cell.sessions.length ? (
                      <div className="min-w-0 space-y-1.5">
                        {!cell.inCyclePeriod ? (
                          <p className="text-[9px] font-black uppercase tracking-wide text-slate-500">
                            Fora do período do ciclo
                          </p>
                        ) : null}
                        {cell.sessions.map((session) => (
                          <SessionSummary
                            active={activeSessionId === session.id}
                            key={session.id}
                            onSelect={onSelectSession}
                            preserveLegacyQualitativePresentation={preserveLegacyQualitativePresentation}
                            running={running}
                            session={session}
                          />
                        ))}
                      </div>
                    ) : cell.inCyclePeriod ? (
                      <p className="rounded-md border border-dashed border-slate-300 px-2 py-2 text-center text-[10px] font-bold text-slate-400 print:text-[8pt]">
                        A planejar
                      </p>
                    ) : (
                      <p className="rounded-md border border-slate-200 bg-slate-100 px-1 py-1.5 text-center text-[9px] font-bold text-slate-500 print:text-[7pt]">
                        Fora do período
                      </p>
                    )}
                  </div>
                ))}
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
