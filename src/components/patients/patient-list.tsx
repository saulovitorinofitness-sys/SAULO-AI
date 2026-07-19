"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";
import { PageState } from "@/components/ui/page-state";
import type { PatientListItem } from "@/features/mvp";
import { patientSelectOptions } from "@/features/mvp";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function normalize(value: string) {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function StatusItem({
  available,
  label,
}: {
  available: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
      <span className="text-xs font-semibold text-slate-600">{label}</span>

      <span
        className={
          available
            ? "rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700"
            : "rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700"
        }
      >
        {available ? "Registrado" : "Pendente"}
      </span>
    </div>
  );
}

export function PatientList({
  patients,
}: {
  patients: readonly PatientListItem[];
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const term = normalize(deferredQuery.trim());
    const digits = deferredQuery.replace(/\D/g, "");

    if (!term) return patients;

    return patients.filter(({ patient, code, primaryPhone }) => {
      return (
        normalize(patient.fullName).includes(term) ||
        normalize(code).includes(term) ||
        (digits.length > 0 &&
          (patient.cpf.includes(digits) ||
            primaryPhone.replace(/\D/g, "").includes(digits)))
      );
    });
  }, [deferredQuery, patients]);

  return (
    <>
      <Card className="mb-5 p-3 sm:p-4">
        <label className="sr-only" htmlFor="patient-search">
          Pesquisar pacientes
        </label>

        <div className="flex items-center gap-3 rounded-[var(--radius-medium)] border border-[var(--line)] bg-[var(--surface-elevated)] px-3.5 focus-within:border-[var(--focus)] focus-within:ring-2 focus-within:ring-[var(--focus)]/15">
          <SearchIcon className="shrink-0 text-slate-400" />

          <input
            className="min-h-12 w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            id="patient-search"
            onChange={(event) => setQuery(event.target.value)}
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

      <div className="mb-3 flex items-center justify-between px-1">
        <p
          aria-live="polite"
          className="text-sm font-semibold text-slate-600"
        >
          {filtered.length}{" "}
          {filtered.length === 1 ? "paciente" : "pacientes"}
        </p>

        <p className="hidden text-xs text-slate-400 sm:block">
          Busca local no conjunto demonstrativo
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
            const hasObjective = Boolean(item.mainObjective);
            const hasAttendance = Boolean(item.lastAttendanceAt);
            const hasPendingStep = Boolean(item.nextPendingStep);

            const completionPercentage = Math.min(
  100,
  Math.max(0, item.completionPercentage ?? 0),
);

            return (
              <Card
                className="group overflow-hidden p-0"
                key={item.patient.id}
                variant="interactive"
              >
                <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 to-white p-4 sm:p-5">
                  <div className="flex items-start gap-3.5">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--secondary)] text-sm font-black text-[var(--primary-hover)] shadow-sm">
                      {item.patient.fullName.slice(0, 2).toUpperCase()}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-black text-slate-900 sm:text-lg">
                          {item.patient.fullName}
                        </h2>

                        <Badge
                          tone={
                            item.patient.status === "ACTIVE"
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
                  </div>
                </div>

                <div className="p-4 sm:p-5">
                  <div className="mb-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
  <div className="mb-2 flex items-center justify-between gap-3">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
      Preenchimento do prontuário
    </p>

    <span className="text-sm font-black text-emerald-700">
      {completionPercentage}%
    </span>
  </div>

  <div
    aria-label={`Prontuário ${completionPercentage}% preenchido`}
    aria-valuemax={100}
    aria-valuemin={0}
    aria-valuenow={completionPercentage}
    className="h-2.5 overflow-hidden rounded-full bg-slate-200"
    role="progressbar"
  >
    <div
      className="h-full rounded-full bg-emerald-600 transition-all duration-500"
      style={{ width: `${completionPercentage}%` }}
    />
  </div>
</div>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-semibold text-slate-400">
                        Objetivo clinico
                      </dt>
                      <dd
  className={
    item.mainObjective
      ? "mt-1 text-sm font-bold text-slate-800"
      : "mt-1 text-sm font-bold text-amber-700"
  }
>
                        {item.mainObjective ?? "⚠ Definir objetivo na primeira consulta"}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs font-semibold text-slate-400">
                        Último atendimento
                      </dt>
                      <dd
  className={
    item.lastAttendanceAt
      ? "mt-1 text-sm font-bold text-slate-800"
      : "mt-1 text-sm font-bold text-amber-700"
  }
>
  {item.lastAttendanceAt
    ? dateFormatter.format(
        new Date(item.lastAttendanceAt),
      )
    : "⚠ Primeiro atendimento pendente"}
</dd>
                    </div>
                  </dl>

                  <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                      Próxima etapa
                    </p>

                    <p className="mt-1 text-sm font-bold text-[#285f4f]">
                      {item.nextPendingStep ??
                        "Nenhuma etapa indicada"}
                    </p>
                  </div>

                  <div className="mt-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-black text-slate-800">
                        Situação do acompanhamento
                      </h3>

                      <span className="text-xs font-semibold text-slate-400">
                        Visão rápida
                      </span>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3">
                      <StatusItem
                        available={hasObjective}
                        label="Objetivo"
                      />

                      <StatusItem
                        available={hasAttendance}
                        label="Atendimento"
                      />

                      <StatusItem
                        available={hasPendingStep}
                        label="Próxima etapa"
                      />
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row">
                    <Link
                      className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      href={`/pacientes/${item.patient.id}`}
                    >
                      Abrir prontuário
                    </Link>

                    <ButtonLink
                      className="flex-1"
                      href={`/pacientes/${item.patient.id}/continuar`}
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