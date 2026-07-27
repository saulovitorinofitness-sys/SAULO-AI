import Link from "next/link";

import { Badge } from "@/components/ui";
import {
  MASTER_RECORD_CATEGORY_LABELS,
  MASTER_RECORD_CATEGORY_ORDER,
  resolveMasterRecordModules,
  type MasterRecordModuleId,
} from "@/features/master-record-navigation";
import type { PatientHubView } from "@/features/patient-hub";

export type MasterRecordTab = MasterRecordModuleId;

export function MasterRecordTabs({
  hub,
  active,
}: {
  hub: PatientHubView;
  active: MasterRecordModuleId;
}) {
  const modules = resolveMasterRecordModules({
    ...hub,
    patientId: hub.header.patientId,
  });

  return (
    <section
      aria-labelledby="master-record-modules-title"
      className="space-y-4"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
            Acessos organizados
          </p>

          <h2
            id="master-record-modules-title"
            className="mt-1 text-2xl font-black tracking-tight text-slate-950"
          >
            Módulos do Prontuário
          </h2>

          <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-slate-600">
            Acesse os módulos clínicos, avaliações, decisões e recursos
            disponíveis para este paciente.
          </p>
        </div>

        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-emerald-600" />

          <span className="text-xs font-black uppercase tracking-[0.1em] text-emerald-800">
            Prontuário integrado
          </span>
        </div>
      </div>

      <nav
        aria-label="Módulos do Prontuário Mestre"
        className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3"
      >
        {MASTER_RECORD_CATEGORY_ORDER.map((category) => {
          const items = modules.filter(
            (module) => module.visible && module.category === category,
          );

          if (!items.length) return null;

          return (
            <details
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-emerald-200 hover:shadow-md"
              key={category}
              open
            >
              <summary className="cursor-pointer list-none border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-5 py-4 focus-visible:outline-none">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
                      Categoria
                    </p>

                    <h3 className="mt-1 text-base font-black text-slate-950">
                      {MASTER_RECORD_CATEGORY_LABELS[category]}
                    </h3>
                  </div>

                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg font-bold text-slate-600 transition group-open:rotate-180"
                  >
                    ⌄
                  </span>
                </div>
              </summary>

              <div className="grid gap-3 p-4">
                {items.map((item) =>
                  item.href ? (
                    <Link
                      aria-current={active === item.id ? "page" : undefined}
                      className={[
                        "group/item flex min-h-20 items-center justify-between gap-4 rounded-xl border px-4 py-4 transition-all",
                        active === item.id
                          ? "border-emerald-700 bg-emerald-700 text-white shadow-md ring-2 ring-emerald-200"
                          : "border-slate-200 bg-slate-50 text-slate-800 hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-950",
                      ].join(" ")}
                      href={item.href}
                      key={item.id}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-black leading-5">
                          {item.label}
                        </p>

                        <p
                          className={[
                            "mt-1 text-xs font-medium",
                            active === item.id
                              ? "text-emerald-100"
                              : "text-slate-500 group-hover/item:text-emerald-800",
                          ].join(" ")}
                        >
                          Abrir módulo do prontuário
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {item.id === "PERFORMANCE_ENDURANCE" ? (
                          <Badge tone="info">Atleta</Badge>
                        ) : null}

                        <span
                          aria-hidden="true"
                          className={[
                            "flex h-9 w-9 items-center justify-center rounded-lg border text-base font-bold",
                            active === item.id
                              ? "border-white/20 bg-white/10 text-white"
                              : "border-slate-200 bg-white text-slate-600 group-hover/item:border-emerald-300 group-hover/item:text-emerald-800",
                          ].join(" ")}
                        >
                          →
                        </span>
                      </div>
                    </Link>
                  ) : (
                    <div
                      aria-disabled="true"
                      className="flex min-h-20 items-center justify-between gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4"
                      key={item.id}
                      title={item.blockedReason}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-600">
                          {item.label}
                        </p>

                        <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
                          {item.blockedReason}
                        </p>
                      </div>

                      <Badge
                        tone={
                          item.status === "future" ? "neutral" : "warning"
                        }
                      >
                        {item.status === "future" ? "Futuro" : "Bloqueado"}
                      </Badge>

                      <span className="sr-only">
                        . {item.blockedReason}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </details>
          );
        })}
      </nav>
    </section>
  );
}