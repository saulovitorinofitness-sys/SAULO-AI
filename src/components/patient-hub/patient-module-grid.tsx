import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  PatientHubModuleCard,
  PatientHubModuleStatus,
} from "@/features/patient-hub";

const labels: Readonly<Record<PatientHubModuleStatus, string>> = {
  NOT_STARTED: "Não iniciado",
  IN_PROGRESS: "Em preenchimento",
  COMPLETED: "Concluído",
  REVIEWED: "Revisado",
  PENDING: "Pendente",
  BLOCKED: "Bloqueado",
  UNAVAILABLE: "Indisponível",
};

const tones: Readonly<
  Record<
    PatientHubModuleStatus,
    "success" | "warning" | "info" | "neutral"
  >
> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  REVIEWED: "info",
  PENDING: "warning",
  BLOCKED: "neutral",
  UNAVAILABLE: "neutral",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function getStatusLabel(status: PatientHubModuleStatus) {
  return labels[status];
}

function ModuleCard({
  module,
}: {
  module: PatientHubModuleCard;
}) {
  const isAvailable = Boolean(module.href);

  return (
    <Card
      className={[
        "group relative flex h-full min-h-[285px] flex-col overflow-hidden rounded-2xl border p-0 transition-all duration-200",
        isAvailable
          ? "border-slate-200 bg-white shadow-sm hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg"
          : "border-slate-200 bg-slate-50 shadow-none",
      ].join(" ")}
      variant={isAvailable ? "interactive" : "muted"}
    >
      <div
        className={[
          "h-1.5 w-full",
          isAvailable
            ? "bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-500"
            : "bg-slate-300",
        ].join(" ")}
      />

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
              Módulo clínico
            </p>

            <h3 className="mt-2 text-xl font-black leading-tight text-slate-950">
              {module.name}
            </h3>
          </div>

          <Badge tone={tones[module.status]}>
            {getStatusLabel(module.status)}
          </Badge>
        </div>

        <p className="mt-4 text-sm font-medium leading-6 text-slate-600">
          {module.description}
        </p>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="space-y-2.5 text-xs text-slate-600">
            {module.updatedAt ? (
              <div className="flex items-start justify-between gap-3">
                <span className="font-bold text-slate-500">
                  Atualizado
                </span>

                <span className="text-right font-semibold text-slate-800">
                  {dateFormatter.format(new Date(module.updatedAt))}
                </span>
              </div>
            ) : null}

            {module.professionalName ? (
              <div className="flex items-start justify-between gap-3">
                <span className="font-bold text-slate-500">
                  Responsável
                </span>

                <span className="text-right font-semibold text-slate-800">
                  {module.professionalName}
                </span>
              </div>
            ) : null}

            {module.pendingCount ? (
              <div className="flex items-start justify-between gap-3">
                <span className="font-bold text-slate-500">
                  Pendências
                </span>

                <span className="text-right font-black text-amber-700">
                  {module.pendingCount}
                </span>
              </div>
            ) : null}

            {!module.updatedAt &&
            !module.professionalName &&
            !module.pendingCount ? (
              <p className="font-medium leading-5 text-slate-500">
                Nenhuma informação adicional registrada neste módulo.
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-auto pt-5">
          {module.href ? (
            <ButtonLink
              className="w-full justify-center"
              href={module.href}
              variant="primary"
            >
              Abrir módulo
              <span aria-hidden="true" className="ml-2">
                →
              </span>
            </ButtonLink>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-100 px-4 py-3 text-center text-xs font-bold leading-5 text-slate-500">
              {module.blockedReason ?? "Módulo indisponível"}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export function PatientModuleGrid({
  modules,
}: {
  modules: readonly PatientHubModuleCard[];
}) {
 const visibleModules = modules.filter(
  (module) => module.visible && module.name !== "Atendimentos",
);
  const availableModules = visibleModules.filter(
    (module) => module.href,
  ).length;

  return (
    <section
      aria-labelledby="patient-modules-title"
      className="space-y-5"
    >
      <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 px-5 py-5 text-white sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">
                Acessos organizados
              </p>

              <h2
                id="patient-modules-title"
                className="mt-1 text-2xl font-black tracking-tight text-white"
              >
                Módulos do Prontuário
              </h2>

              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-emerald-100">
                Acesse avaliações, dados clínicos, decisões e prescrições
                disponíveis para este paciente.
              </p>
            </div>

            <div className="flex w-fit items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xl">
                📂
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200">
                  Disponíveis
                </p>

                <p className="text-lg font-black text-white">
                  {availableModules} de {visibleModules.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {visibleModules.map((module) => (
          <ModuleCard
            key={module.id}
            module={module}
          />
        ))}
      </div>
    </section>
  );
}