"use client";

import Link from "next/link";

import { PatientBreadcrumb } from "@/components/attendance/patient-breadcrumb";
import { ButtonLink } from "@/components/ui";
import type { MasterRecordModuleId } from "@/features/master-record-navigation/contracts";
import type { PatientHubView } from "@/features/patient-hub/contracts";

export type PatientNavigationModule = MasterRecordModuleId;

type NavigationItem = {
  label: string;
  href: string;
  moduleKeys: string[];
};

export function PatientNavigation({
  initialHub,
  patientContext,
  currentModule,
}: {
  initialHub?: PatientHubView;
  patientContext?: {
    readonly patientId: string;
    readonly fullName: string;
    readonly scenario: PatientHubView["scenario"];
  };
  currentModule: PatientNavigationModule;
}) {
  const navigationContext = initialHub
    ? {
        patientId: initialHub.header.patientId,
        fullName: initialHub.header.fullName,
        scenario: initialHub.scenario,
      }
    : patientContext;
  if (!navigationContext) return null;
  const patientId = navigationContext.patientId;
  const scenarioQuery = `?scenario=${navigationContext.scenario}`;
  const currentModuleKey = String(currentModule).toUpperCase();

  const recordHref = `/pacientes/${patientId}${scenarioQuery}`;

  const navigationItems: NavigationItem[] = [
    {
      label: "Prontuário",
      href: recordHref,
      moduleKeys: ["SUMMARY", "MASTER_RECORD"],
    },
    {
      label: "Anamnese",
      href: `/pacientes/${patientId}/anamnese${scenarioQuery}`,
      moduleKeys: ["ANAMNESIS", "ANAMNESE"],
    },
    {
      label: "Antropometria",
      href: `/pacientes/${patientId}/antropometria${scenarioQuery}`,
      moduleKeys: ["ANTHROPOMETRY", "ANTROPOMETRIA"],
    },
    {
      label: "Evolução e comparativos",
      href: `/pacientes/${patientId}/evolucao-avaliacoes${scenarioQuery}`,
      moduleKeys: ["EVOLUTION", "EVOLUCAO_AVALIACOES"],
    },
    {
      label: "Exames",
      href: `/pacientes/${patientId}/exames${scenarioQuery}`,
      moduleKeys: ["LABORATORY_EXAMS", "EXAMS", "EXAMES"],
    },
    {
      label: "Motor Clínico",
      href: `/pacientes/${patientId}/motor-clinico${scenarioQuery}`,
      moduleKeys: [
        "CLINICAL_ENGINE",
        "CLINICAL_DECISION",
        "MOTOR_CLINICO",
      ],
    },
    {
      label: "Estratégia Nutricional",
      href: `/pacientes/${patientId}/estrategia-nutricional${scenarioQuery}`,
      moduleKeys: [
        "NUTRITION_STRATEGY",
        "ESTRATEGIA_NUTRICIONAL",
      ],
    },
    {
      label: "Plano Alimentar",
      href: `/pacientes/${patientId}/plano-alimentar${scenarioQuery}`,
      moduleKeys: ["MEAL_PLAN", "PLANO_ALIMENTAR"],
    },
  ];

  const currentItem =
    navigationItems.find((item) =>
      item.moduleKeys.includes(currentModuleKey),
    ) ?? navigationItems[0];

  return (
    <section
      aria-label="Navegação do paciente"
      className="mb-6 space-y-4"
    >
      <PatientBreadcrumb
        items={[
          {
            label: "Pacientes",
            href: "/pacientes",
          },
          {
            label: navigationContext.fullName,
            href: recordHref,
          },
        ]}
      />

      <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 px-5 py-5 text-white sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-xl shadow-sm">
                🧭
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">
                  Navegação clínica
                </p>

                <h2 className="mt-1 text-xl font-bold text-white">
                  Fluxo do Atendimento
                </h2>

                <p className="mt-1 max-w-2xl text-sm leading-5 text-emerald-100">
                  Visualize o percurso do paciente e acesse diretamente
                  qualquer etapa do atendimento.
                </p>
              </div>
            </div>

            {currentModuleKey !== "SUMMARY" && (
              <ButtonLink
                href={recordHref}
                size="small"
                variant="outline"
              >
                ← Voltar ao Prontuário
              </ButtonLink>
            )}
          </div>
        </div>

        <div className="space-y-6 p-5 sm:p-6">
          <div className="grid gap-5 xl:grid-cols-[0.8fr_2fr_0.9fr_1.4fr]">
            <section aria-label="Prontuário">
              <div className="mb-3 flex items-center gap-2 border-b-2 border-emerald-600 pb-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-sm">
                  📋
                </span>

                <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">
                  Prontuário
                </p>
              </div>

              <div className="grid gap-2">
                {navigationItems
                  .filter((item) => item.label === "Prontuário")
                  .map((item) => {
                    const isActive =
                      item.moduleKeys.includes(currentModuleKey);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={[
                          "flex min-h-16 items-center justify-center rounded-xl border px-4 py-3 text-center text-sm font-bold transition-all",
                          isActive
                            ? "border-emerald-700 bg-emerald-700 text-white shadow-md ring-2 ring-emerald-200"
                            : "border-slate-200 bg-slate-50 text-slate-800 shadow-sm hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-900",
                        ].join(" ")}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
              </div>
            </section>

            <section aria-label="Coleta de dados">
              <div className="mb-3 flex items-center gap-2 border-b-2 border-sky-600 pb-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-sm">
                  🩺
                </span>

                <p className="text-xs font-bold uppercase tracking-[0.12em] text-sky-800">
                  Coleta de dados
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {navigationItems
                  .filter((item) =>
                    [
                      "Anamnese",
                      "Antropometria",
                      "Evolução e comparativos",
                      "Exames",
                    ].includes(item.label),
                  )
                  .map((item) => {
                    const isActive =
                      item.moduleKeys.includes(currentModuleKey);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={[
                          "flex min-h-16 items-center justify-center rounded-xl border px-3 py-3 text-center text-sm font-bold transition-all",
                          isActive
                            ? "border-sky-700 bg-sky-700 text-white shadow-md ring-2 ring-sky-200"
                            : "border-slate-200 bg-slate-50 text-slate-800 shadow-sm hover:-translate-y-0.5 hover:border-sky-400 hover:bg-sky-50 hover:text-sky-950",
                        ].join(" ")}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
              </div>
            </section>

            <section aria-label="Decisão clínica">
              <div className="mb-3 flex items-center gap-2 border-b-2 border-violet-600 pb-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-sm">
                  🧠
                </span>

                <p className="text-xs font-bold uppercase tracking-[0.12em] text-violet-800">
                  Decisão clínica
                </p>
              </div>

              <div className="grid gap-2">
                {navigationItems
                  .filter((item) => item.label === "Motor Clínico")
                  .map((item) => {
                    const isActive =
                      item.moduleKeys.includes(currentModuleKey);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={[
                          "flex min-h-16 items-center justify-center rounded-xl border px-4 py-3 text-center text-sm font-bold transition-all",
                          isActive
                            ? "border-violet-700 bg-violet-700 text-white shadow-md ring-2 ring-violet-200"
                            : "border-slate-200 bg-slate-50 text-slate-800 shadow-sm hover:-translate-y-0.5 hover:border-violet-400 hover:bg-violet-50 hover:text-violet-950",
                        ].join(" ")}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
              </div>
            </section>

            <section aria-label="Nutrição">
              <div className="mb-3 flex items-center gap-2 border-b-2 border-amber-500 pb-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-sm">
                  🥗
                </span>

                <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-800">
                  Nutrição
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {navigationItems
                  .filter((item) =>
                    [
                      "Estratégia Nutricional",
                      "Plano Alimentar",
                    ].includes(item.label),
                  )
                  .map((item) => {
                    const isActive =
                      item.moduleKeys.includes(currentModuleKey);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={[
                          "flex min-h-16 items-center justify-center rounded-xl border px-3 py-3 text-center text-sm font-bold leading-5 transition-all",
                          isActive
                            ? "border-emerald-800 bg-emerald-800 text-white shadow-md ring-2 ring-emerald-200"
                            : "border-slate-200 bg-slate-50 text-slate-800 shadow-sm hover:-translate-y-0.5 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-950",
                        ].join(" ")}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-slate-700">
              Etapa atual:
              <span className="ml-2 font-bold text-emerald-800">
                {currentItem.label}
              </span>
            </p>

            <p className="text-xs font-medium text-slate-500">
              Selecione uma etapa para navegar pelo atendimento.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
