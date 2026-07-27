"use client";

import Link from "next/link";
import {
  useDeferredValue,
  useMemo,
  useState,
} from "react";

import { Badge } from "@/components/ui/badge";
import {
  Button,
  ButtonLink,
} from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowIcon,
  PlusIcon,
  SearchIcon,
} from "@/components/ui/icons";
import { PageState } from "@/components/ui/page-state";
import type {
  PatientListItem,
  PatientWorkflowStatus,
} from "@/features/mvp";
import { patientSelectOptions } from "@/features/mvp";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const workflowLabels: Readonly<
  Record<PatientWorkflowStatus, string>
> = {
  NOT_STARTED: "Não iniciado",
  IN_PROGRESS: "Em andamento",
  WAITING_PROFESSIONAL: "Aguardando profissional",
  PENDING_REVIEW: "Aguardando revisão",
  COMPLETED: "Concluído",
};

const workflowStyles: Readonly<
  Record<PatientWorkflowStatus, string>
> = {
  NOT_STARTED:
    "border-slate-200 bg-slate-100 text-slate-700",
  IN_PROGRESS:
    "border-emerald-200 bg-emerald-100 text-emerald-800",
  WAITING_PROFESSIONAL:
    "border-amber-200 bg-amber-100 text-amber-800",
  PENDING_REVIEW:
    "border-sky-200 bg-sky-100 text-sky-800",
  COMPLETED:
    "border-emerald-300 bg-emerald-600 text-white",
};

function normalize(value: string) {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function patientSelectionHref(
  patientId: string,
  returnTo?: string,
) {
  if (!returnTo) {
    return `/clinica?patientId=${encodeURIComponent(patientId)}`;
  }

  const url = new URL(
    returnTo,
    "https://sistema-sv.internal",
  );
  url.searchParams.set("patientId", patientId);

  return `${url.pathname}${url.search}${url.hash}`;
}

function resolveWorkflowStatus(
  item: PatientListItem,
): PatientWorkflowStatus {
  if (item.workflowStatus) {
    return item.workflowStatus;
  }

  const percentage = item.completionPercentage ?? 0;

  if (percentage >= 100) {
    return "COMPLETED";
  }

  if (!item.lastAttendanceAt) {
    return "NOT_STARTED";
  }

  if (item.nextPendingStep) {
    return "IN_PROGRESS";
  }

  return "PENDING_REVIEW";
}

function OperationalInformation({
  label,
  value,
  highlighted = false,
}: {
  label: string;
  value: string;
  highlighted?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>

      <p
        className={[
          "mt-1.5 text-sm font-bold leading-5",
          highlighted
            ? "text-emerald-800"
            : "text-slate-800",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

export function PatientList({
  patients,
  returnTo,
}: {
  patients: readonly PatientListItem[];
  returnTo?: string;
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const term = normalize(deferredQuery.trim());
    const digits = deferredQuery.replace(/\D/g, "");

    if (!term) {
      return patients;
    }

    return patients.filter(
      ({ patient, code, primaryPhone }) => {
        return (
          normalize(patient.fullName).includes(term) ||
          normalize(code).includes(term) ||
          (digits.length > 0 &&
            ((patient.cpf?.includes(digits) ?? false) ||
              primaryPhone
                .replace(/\D/g, "")
                .includes(digits)))
        );
      },
    );
  }, [deferredQuery, patients]);

  return (
    <>
      <Card className="mb-5 p-3 sm:p-4">
        <label
          className="sr-only"
          htmlFor="patient-search"
        >
          Pesquisar pacientes
        </label>

        <div className="flex items-center gap-3 rounded-[var(--radius-medium)] border border-[var(--line)] bg-[var(--surface-elevated)] px-3.5 focus-within:border-[var(--focus)] focus-within:ring-2 focus-within:ring-[var(--focus)]/15">
          <SearchIcon className="shrink-0 text-slate-400" />

          <input
            className="min-h-12 w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            id="patient-search"
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder="Nome, CPF, telefone ou código do paciente"
            type="search"
            value={query}
          />

          {query ? (
            <Button
              onClick={() => setQuery("")}
              size="small"
              type="button"
              variant="link"
            >
              Limpar
            </Button>
          ) : null}
        </div>
      </Card>

      <div className="mb-4 flex items-center justify-between px-1">
        <p
          aria-live="polite"
          className="text-sm font-semibold text-slate-600"
        >
          {filtered.length}{" "}
          {filtered.length === 1
            ? "paciente"
            : "pacientes"}
        </p>

        <p className="hidden text-xs text-slate-400 sm:block">
          Acompanhamento integrado do atendimento
        </p>
      </div>

      {filtered.length === 0 ? (
        <PageState
          action={
            <Button
              onClick={() => setQuery("")}
              size="small"
              type="button"
              variant="link"
            >
              Limpar pesquisa
            </Button>
          }
          description="Tente outro nome, CPF, telefone ou código. Nenhum cadastro novo será criado automaticamente."
          title="Nenhum paciente encontrado"
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((item) => {
            const completionPercentage = Math.min(
              100,
              Math.max(
                0,
                item.completionPercentage ?? 0,
              ),
            );

            const workflowStatus =
              resolveWorkflowStatus(item);

            const currentStep =
              item.currentStep ??
              item.nextPendingStep ??
              (workflowStatus === "COMPLETED"
                ? "Atendimento concluído"
                : "Revisar dados compartilhados");

            const responsibleName =
              item.currentResponsibleName ??
              "Responsável ainda não definido";

            const nextStep =
              item.nextStep ??
              (workflowStatus === "COMPLETED"
                ? "Nenhuma etapa pendente"
                : "Próxima etapa ainda não definida");

            const pendingStepsLabel =
              typeof item.pendingStepsCount === "number"
                ? item.pendingStepsCount === 1
                  ? "1 etapa pendente"
                  : `${item.pendingStepsCount} etapas pendentes`
                : workflowStatus === "COMPLETED"
                  ? "Nenhuma pendência"
                  : "Quantidade ainda não calculada";

            return (
              <Card
                className="group overflow-hidden border-slate-200 p-0 transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"
                key={item.patient.id}
                variant="interactive"
              >
                <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50 via-white to-white p-4 sm:p-5">
                  <div className="flex items-start gap-3.5">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-sm font-black text-emerald-800 shadow-sm">
                      {item.patient.fullName
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-black text-slate-950 sm:text-lg">
                          {item.patient.fullName}
                        </h2>

                        <Badge
                          tone={
                            item.patient.status ===
                            "ACTIVE"
                              ? "success"
                              : "neutral"
                          }
                        >
                          {
                            patientSelectOptions.statuses[
                              item.patient.status
                            ]
                          }
                        </Badge>
                      </div>

                      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">
                        {item.code} · {item.age} anos
                      </p>
                    </div>

                    <span
                      className={[
                        "shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em]",
                        workflowStyles[workflowStatus],
                      ].join(" ")}
                    >
                      {workflowLabels[workflowStatus]}
                    </span>
                  </div>
                </div>

                <div className="p-4 sm:p-5">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                          Progresso do atendimento
                        </p>

                        <p className="mt-1 text-xs font-medium text-slate-500">
                          Prontuário e etapas clínicas
                        </p>
                      </div>

                      <span className="text-lg font-black text-emerald-700">
                        {completionPercentage}%
                      </span>
                    </div>

                    <div
                      aria-label={`Atendimento ${completionPercentage}% concluído`}
                      aria-valuemax={100}
                      aria-valuemin={0}
                      aria-valuenow={
                        completionPercentage
                      }
                      className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200"
                      role="progressbar"
                    >
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                        style={{
                          width: `${completionPercentage}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                      Etapa atual
                    </p>

                    <p className="mt-2 text-base font-black text-emerald-950">
                      {currentStep}
                    </p>

                    <div className="mt-3 flex items-center gap-2 border-t border-emerald-200 pt-3">
                      <span className="text-xs font-semibold text-emerald-700">
                        Responsável atual:
                      </span>

                      <span className="text-xs font-black text-emerald-950">
                        {responsibleName}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <OperationalInformation
                      highlighted
                      label="Próxima etapa"
                      value={nextStep}
                    />

                    <OperationalInformation
                      label="Pendências"
                      value={pendingStepsLabel}
                    />
                  </div>

                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                      <dt className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Objetivo clínico
                      </dt>

                      <dd
                        className={[
                          "mt-1.5 text-sm font-bold leading-5",
                          item.mainObjective
                            ? "text-slate-800"
                            : "text-amber-700",
                        ].join(" ")}
                      >
                        {item.mainObjective ??
                          "Definir objetivo na primeira consulta"}
                      </dd>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                      <dt className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Último atendimento
                      </dt>

                      <dd
                        className={[
                          "mt-1.5 text-sm font-bold leading-5",
                          item.lastAttendanceAt
                            ? "text-slate-800"
                            : "text-amber-700",
                        ].join(" ")}
                      >
                        {item.lastAttendanceAt
                          ? dateFormatter.format(
                              new Date(
                                item.lastAttendanceAt,
                              ),
                            )
                          : "Primeiro atendimento pendente"}
                      </dd>
                    </div>
                  </dl>

                  {item.workflowUpdatedAt ? (
                    <p className="mt-3 text-right text-[11px] font-medium text-slate-400">
                      Fluxo atualizado em{" "}
                      {dateTimeFormatter.format(
                        new Date(
                          item.workflowUpdatedAt,
                        ),
                      )}
                    </p>
                  ) : null}

                  <div className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row">
                    <ButtonLink
                      className="flex-1"
                      href={patientSelectionHref(
                        item.patient.id,
                        returnTo,
                      )}
                      variant="secondary"
                    >
                      Selecionar para atendimento
                      <ArrowIcon className="size-4" />
                    </ButtonLink>

                    <Link
                      className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      href={`/pacientes/${item.patient.id}`}
                    >
                      Abrir prontuário
                    </Link>

                    <ButtonLink
                      className="flex-1"
                      href={
                        item.openAttendanceId
                          ? `/pacientes/${item.patient.id}/atendimentos/${item.openAttendanceId}/coleta`
                          : `/pacientes/${item.patient.id}/continuar`
                      }
                    >
                      Continuar atendimento
                      <ArrowIcon className="size-4" />
                    </ButtonLink>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ButtonLink
        aria-label="Novo paciente"
        className="fixed bottom-20 right-4 z-10 size-14 rounded-full p-0 shadow-lg sm:hidden"
        href="/pacientes/novo"
        size="icon"
      >
        <PlusIcon />
      </ButtonLink>
    </>
  );
}
