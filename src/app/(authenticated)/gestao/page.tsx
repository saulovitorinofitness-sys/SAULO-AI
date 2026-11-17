import { ArrowRight, Building2, WalletCards } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Card, PageHeading } from "@/components/ui";
import { financialService } from "@/features/financial";

export const metadata: Metadata = {
  title: "Visão Geral | Centro de Gestão SV",
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default async function ManagementOverviewPage() {
  const [catalog, summary] = await Promise.all([
    financialService.catalog(),
    financialService.summarize(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeading
        description="Administração integrada da Academia Saulo Fitness e Clínica SV."
        eyebrow="Centro de Gestão SV"
        title="Visão Geral"
      />

      <section aria-labelledby="management-units-title">
        <h2 className="text-lg font-black text-slate-950" id="management-units-title">
          Unidades empresariais
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {catalog.businessUnits.map((unit) => (
            <Card className="flex items-center gap-4 p-5" key={unit.id}>
              <span className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                <Building2 aria-hidden="true" className="size-5" />
              </span>
              <div>
                <p className="font-black text-slate-950">{unit.name}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                  {unit.code} · {unit.status === "ACTIVE" ? "Ativa" : "Inativa"}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <Link
        className="group block rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm transition hover:border-emerald-400 hover:shadow-md sm:p-6"
        href="/gestao/financeiro"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <WalletCards aria-hidden="true" className="size-6" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Financeiro</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Operação financeira diária</h2>
              <p className="mt-2 text-sm text-slate-600">
                Saldo realizado consolidado: {money.format(Number(summary.realizedBalance))}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 text-sm font-black text-emerald-700">
            Abrir Financeiro
            <ArrowRight aria-hidden="true" className="size-4 transition group-hover:translate-x-1" />
          </span>
        </div>
      </Link>
    </div>
  );
}
