"use client";

import { useEffect, useMemo, useState } from "react";

import { Button, Card } from "@/components/ui";
import type { EnduranceRecentPerformanceReference } from "@/features/performance-endurance/endurance-workout-contracts";

const EXECUTIONS_API_PATH = "/api/performance-monitoring/executions";

export interface RunningExecutionHistoryItem {
  readonly id: string;
  readonly modality: string;
  readonly source: string;
  readonly importProvider?: string;
  readonly actualStartAt: string;
  readonly executedDurationSeconds?: number;
  readonly distanceMeters?: number;
}

export type RunningReferenceSelectionAction =
  | { readonly type: "SELECT"; readonly executionId: string }
  | { readonly type: "CANCEL" }
  | { readonly type: "USE" };

export function nextRunningReferenceCandidate(
  currentId: string | undefined,
  action: RunningReferenceSelectionAction,
) {
  if (!currentId && action.type !== "SELECT") return undefined;
  return action.type === "SELECT" ? action.executionId : undefined;
}

interface RunningExecutionHistoryProps {
  readonly masterRecordId: string;
  readonly onUseReference?: (
    reference: EnduranceRecentPerformanceReference,
  ) => void;
  readonly initialExecutions?: readonly RunningExecutionHistoryItem[];
  readonly reloadKey?: number;
  readonly compact?: boolean;
}

function validPositive(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

export function runningExecutionAverageMetrics(
  execution: RunningExecutionHistoryItem,
) {
  if (
    execution.modality !== "RUNNING" ||
    !validPositive(execution.executedDurationSeconds) ||
    !validPositive(execution.distanceMeters)
  ) {
    return undefined;
  }

  const kilometers = execution.distanceMeters / 1_000;
  return {
    paceSecondsPerKilometer: execution.executedDurationSeconds / kilometers,
    speedKilometersPerHour:
      kilometers / (execution.executedDurationSeconds / 3_600),
  };
}

export function runningReferenceFromExecution(
  execution: RunningExecutionHistoryItem,
): EnduranceRecentPerformanceReference | undefined {
  if (!runningExecutionAverageMetrics(execution)) return undefined;

  return {
    distanceMeters: execution.distanceMeters as number,
    durationSeconds: execution.executedDurationSeconds as number,
    recordedAt: execution.actualStartAt,
    sourceExecutionId: execution.id,
    source: execution.source,
    sourceProvider: execution.importProvider,
  };
}

function modalityLabel(value: string) {
  const labels: Readonly<Record<string, string>> = {
    RUNNING: "Corrida",
    CYCLING: "Ciclismo",
    STRENGTH: "Musculação",
    OTHER: "Outra modalidade",
  };
  return labels[value] ?? value;
}

function sourceLabel(source: string, provider?: string) {
  if (provider === "APPLE_HEALTH") return "Apple Health · arquivo importado";
  if (source === "FILE_IMPORT") return "Arquivo importado";
  if (source === "DEVICE") return "Dispositivo conectado";
  if (source === "MANUAL") return "Registro manual";
  return source;
}

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não disponível";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function durationLabel(value?: number) {
  if (!validPositive(value)) return "Não disponível";
  const rounded = Math.round(value);
  const hours = Math.floor(rounded / 3_600);
  const minutes = Math.floor((rounded % 3_600) / 60);
  const seconds = rounded % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function distanceLabel(value?: number) {
  if (!validPositive(value)) return "Não disponível";
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value / 1_000)} km`;
}

function paceLabel(value?: number) {
  if (!validPositive(value)) return "Não disponível";
  const rounded = Math.round(value);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")} min/km`;
}

function speedLabel(value?: number) {
  if (!validPositive(value)) return "Não disponível";
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value)} km/h`;
}

export function RunningExecutionHistory({
  masterRecordId,
  onUseReference,
  initialExecutions,
  reloadKey = 0,
  compact = false,
}: RunningExecutionHistoryProps) {
  const [fetchedExecutions, setFetchedExecutions] = useState<
    readonly RunningExecutionHistoryItem[]
  >([]);
  const [candidateId, setCandidateId] = useState<string>();
  const [loading, setLoading] = useState(initialExecutions === undefined);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (initialExecutions !== undefined) return;

    const controller = new AbortController();
    const now = new Date();
    const from = new Date(now);
    from.setUTCFullYear(from.getUTCFullYear() - 5);
    const to = new Date(now);
    to.setUTCDate(to.getUTCDate() + 1);
    const query = new URLSearchParams({
      masterRecordId,
      from: from.toISOString(),
      to: to.toISOString(),
    });

    fetch(`${EXECUTIONS_API_PATH}?${query.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          executions?: readonly RunningExecutionHistoryItem[];
          message?: string;
        };
        if (!response.ok) {
          throw new Error(payload.message ?? "Não foi possível consultar o histórico.");
        }
        setError("");
        setFetchedExecutions(payload.executions ?? []);
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Não foi possível consultar o histórico.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [initialExecutions, masterRecordId, reloadKey, retryKey]);

  const importedExecutions = useMemo(
    () =>
      (initialExecutions ?? fetchedExecutions)
        .filter((execution) => execution.source === "FILE_IMPORT")
        .toSorted((left, right) =>
          right.actualStartAt.localeCompare(left.actualStartAt),
        ),
    [fetchedExecutions, initialExecutions],
  );
  const candidate = importedExecutions.find(
    (execution) => execution.id === candidateId,
  );
  const candidateReference = candidate
    ? runningReferenceFromExecution(candidate)
    : undefined;

  return (
    <Card className={compact ? "p-4" : "p-5 md:p-6"} variant="outlined">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--primary)]">
          Execuções importadas
        </p>
        <h3 className="mt-1 text-lg font-black text-[var(--text-primary)]">
          Histórico de Performance
        </h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Ritmo e velocidade são calculados com a duração total importada. Eles não representam necessariamente tempo em movimento.
        </p>
      </div>

      {loading ? (
        <p aria-live="polite" className="mt-4 text-sm text-[var(--muted)]">
          Carregando histórico…
        </p>
      ) : null}
      {error ? (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
          <p className="font-bold">{error}</p>
          <Button
            className="mt-3"
            onClick={() => {
              setError("");
              setLoading(true);
              setRetryKey((current) => current + 1);
            }}
            type="button"
            variant="outline"
          >
            Tentar novamente
          </Button>
        </div>
      ) : null}
      {!loading && !error && importedExecutions.length === 0 ? (
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-[var(--muted)]">
          Nenhuma execução importada encontrada nos últimos cinco anos.
        </p>
      ) : null}

      {importedExecutions.length > 0 ? (
        <div className="mt-4 space-y-3">
          {importedExecutions.map((execution) => {
            const averages = runningExecutionAverageMetrics(execution);
            const canUse = Boolean(averages && onUseReference);
            const selected = candidateId === execution.id;
            return (
              <article
                className={`rounded-xl border p-4 ${selected ? "border-emerald-500 bg-emerald-50/60" : "border-[var(--line)] bg-white"}`}
                key={execution.id}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <dl className="grid flex-1 gap-x-5 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
                    <div><dt className="text-xs font-bold text-[var(--muted)]">Data</dt><dd className="font-black text-[var(--text-primary)]">{dateLabel(execution.actualStartAt)}</dd></div>
                    <div><dt className="text-xs font-bold text-[var(--muted)]">Modalidade</dt><dd className="font-black text-[var(--text-primary)]">{modalityLabel(execution.modality)}</dd></div>
                    <div><dt className="text-xs font-bold text-[var(--muted)]">Origem</dt><dd className="font-black text-[var(--text-primary)]">{sourceLabel(execution.source, execution.importProvider)}</dd></div>
                    <div><dt className="text-xs font-bold text-[var(--muted)]">Duração importada</dt><dd className="font-black text-[var(--text-primary)]">{durationLabel(execution.executedDurationSeconds)}</dd></div>
                    <div><dt className="text-xs font-bold text-[var(--muted)]">Distância importada</dt><dd className="font-black text-[var(--text-primary)]">{distanceLabel(execution.distanceMeters)}</dd></div>
                    <div><dt className="text-xs font-bold text-[var(--muted)]">Ritmo médio calculado</dt><dd className="font-black text-[var(--text-primary)]">{paceLabel(averages?.paceSecondsPerKilometer)}</dd></div>
                    <div><dt className="text-xs font-bold text-[var(--muted)]">Velocidade média calculada</dt><dd className="font-black text-[var(--text-primary)]">{speedLabel(averages?.speedKilometersPerHour)}</dd></div>
                  </dl>
                  {onUseReference ? (
                    <Button
                      disabled={!canUse}
                      onClick={() =>
                        setCandidateId((current) =>
                          nextRunningReferenceCandidate(current, {
                            type: "SELECT",
                            executionId: execution.id,
                          }),
                        )
                      }
                      type="button"
                      variant={selected ? "secondary" : "outline"}
                    >
                      {selected ? "Selecionada" : "Selecionar"}
                    </Button>
                  ) : null}
                </div>
                {onUseReference && execution.modality === "RUNNING" && !averages ? (
                  <p className="mt-3 text-xs font-bold text-amber-800">
                    Esta execução não pode ser usada como referência porque duração ou distância não está disponível.
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      {candidate && candidateReference && onUseReference ? (
        <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
          <p className="font-black text-emerald-950">Execução selecionada</p>
          <p className="mt-1 text-sm text-emerald-900">
            Nenhuma referência foi alterada. Confirme explicitamente para usar esta execução como desempenho registrado atual.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                onUseReference(candidateReference);
                setCandidateId((current) =>
                  nextRunningReferenceCandidate(current, { type: "USE" }),
                );
              }}
              type="button"
            >
              Usar como referência
            </Button>
            <Button
              onClick={() =>
                setCandidateId((current) =>
                  nextRunningReferenceCandidate(current, { type: "CANCEL" }),
                )
              }
              type="button"
              variant="outline"
            >
              Cancelar seleção
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
