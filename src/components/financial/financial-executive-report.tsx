"use client";

import { ArrowLeft, Download, Presentation, Printer } from "lucide-react";
import { useState } from "react";

import { Button, ButtonLink } from "@/components/ui";
import type {
  FinancialEntryView,
} from "@/features/financial/contracts";
import type { FinancialExecutiveReportView } from "@/features/financial/executive-report";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const date = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

const month = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function money(value: string) {
  return currency.format(Number(value));
}

function formatDate(value: string) {
  return date.format(new Date(`${value}T00:00:00.000Z`));
}

function formatEmission(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function Metric({ label, value, tone = "neutral" }: {
  readonly label: string;
  readonly value: string;
  readonly tone?: "positive" | "negative" | "neutral" | "warning";
}) {
  const tones = {
    positive: "border-[#c9ddd3] bg-[#edf6f1] text-[#173c30]",
    negative: "border-[#efd1d6] bg-[#fff3f4] text-[#692b37]",
    warning: "border-[#eadfbd] bg-[#fff9e9] text-[#6b531d]",
    neutral: "border-[#d8e4dc] bg-[#f7faf8] text-[#243b33]",
  };
  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-[0_5px_16px_rgba(23,60,48,0.045)] ${tones[tone]}`}>
      <dt className="text-[11px] font-black uppercase tracking-[0.1em] opacity-70">{label}</dt>
      <dd className="mt-2 text-xl font-black tabular-nums">{money(value)}</dd>
    </div>
  );
}

function AgendaCards({ kind, agenda }: {
  readonly kind: "PAYABLE" | "RECEIVABLE";
  readonly agenda: FinancialExecutiveReportView["payables"] | FinancialExecutiveReportView["receivables"];
}) {
  const values = kind === "PAYABLE"
    ? [
        ["Vencidas", (agenda as FinancialExecutiveReportView["payables"]).totals.overdue],
        ["Vencem hoje", (agenda as FinancialExecutiveReportView["payables"]).totals.today],
        ["Próximos 7 dias", (agenda as FinancialExecutiveReportView["payables"]).totals.next7Days],
        ["Próximos 30 dias", (agenda as FinancialExecutiveReportView["payables"]).totals.next30Days],
      ]
    : [
        ["Vencidas", (agenda as FinancialExecutiveReportView["receivables"]).buckets.overdue.amount],
        ["Vencem hoje", (agenda as FinancialExecutiveReportView["receivables"]).buckets.today.amount],
        ["Próximos 7 dias", (agenda as FinancialExecutiveReportView["receivables"]).buckets.next7Days.amount],
        ["Próximos 30 dias", (agenda as FinancialExecutiveReportView["receivables"]).buckets.next30Days.amount],
      ];
  return (
    <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {values.map(([label, value]) => (
        <div className="rounded-xl border border-[#d8e4dc] bg-[#f7faf8] px-3 py-2.5 shadow-[0_4px_14px_rgba(23,60,48,0.035)]" key={label}>
          <dt className="text-[10px] font-black uppercase tracking-[0.08em] text-[#718079]">{label}</dt>
          <dd className="mt-1 text-base font-black tabular-nums text-[#243b33]">{money(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function PendingTable({ entries, emptyMessage }: {
  readonly entries: readonly FinancialEntryView[];
  readonly emptyMessage: string;
}) {
  if (!entries.length) {
    return <p className="mt-2.5 rounded-xl border border-dashed border-slate-300 px-4 py-4 text-center text-sm text-slate-500">{emptyMessage}</p>;
  }
  return (
    <div className="mt-2.5 overflow-hidden rounded-xl border border-slate-200">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            <th className="px-3 py-2 font-black">Vencimento</th>
            <th className="px-3 py-2 font-black">Descrição</th>
            <th className="hidden px-3 py-2 font-black sm:table-cell">Unidade</th>
            <th className="px-3 py-2 text-right font-black">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr className="border-t border-slate-200" key={entry.id}>
              <td className="whitespace-nowrap px-3 py-2 font-semibold">{formatDate(entry.dueDate)}</td>
              <td className="px-3 py-2"><span className="font-bold text-slate-900">{entry.description}</span><span className="mt-0.5 block text-[10px] text-slate-500">{entry.financialCategory.name}</span></td>
              <td className="hidden px-3 py-2 sm:table-cell">{entry.businessUnit.name}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-black tabular-nums">{money(entry.remainingAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FinancialExecutiveReport({ view }: {
  readonly view: FinancialExecutiveReportView;
}) {
  const [isGeneratingPresentation, setIsGeneratingPresentation] = useState(false);
  const [presentationError, setPresentationError] = useState<string>();
  const dre = view.dre?.availability === "AVAILABLE" ? view.dre : undefined;
  const cashResultTone = Number(view.summary.realizedBalance) >= 0 ? "positive" : "negative";

  async function handlePresentation() {
    setIsGeneratingPresentation(true);
    setPresentationError(undefined);
    try {
      const { downloadFinancialExecutivePresentation } = await import(
        "@/features/financial/executive-report/presentation"
      );
      await downloadFinancialExecutivePresentation(view);
    } catch {
      setPresentationError("Não foi possível gerar a apresentação. Tente novamente.");
    } finally {
      setIsGeneratingPresentation(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <ButtonLink href="/gestao/financeiro" variant="outline"><ArrowLeft aria-hidden="true" className="size-4" />Voltar ao Financeiro</ButtonLink>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex flex-wrap gap-2">
            <Button disabled={!view.presentation.pptxAvailable} loading={isGeneratingPresentation} onClick={handlePresentation} variant="outline"><Presentation aria-hidden="true" className="size-4" />Gerar apresentação</Button>
            <Button onClick={() => window.print()}><Printer aria-hidden="true" className="size-4" />Imprimir</Button>
            <Button onClick={() => window.print()} variant="outline"><Download aria-hidden="true" className="size-4" />Salvar em PDF</Button>
          </div>
          {presentationError ? <p aria-live="polite" className="text-xs font-semibold text-red-700">{presentationError}</p> : null}
        </div>
      </div>

      <article className="mx-auto max-w-[1120px] overflow-hidden rounded-3xl border border-[#d8e4dc] bg-[#fffefb] text-[#20312b] shadow-[0_18px_50px_rgba(15,23,42,0.12)] print:max-w-none print:rounded-none print:border-0 print:shadow-none" id="financial-executive-report">
        <header className="border-b-2 border-[#17644c] bg-[#fffefb] px-6 py-5 sm:px-8">
          <div className="flex items-start justify-between gap-5">
            <div className="flex min-w-0 items-center gap-3">
              <div aria-label="Símbolo do Sistema Integrado SV" className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#17644c] text-sm font-black tracking-[0.08em] text-[#e2c675] shadow-[0_7px_20px_rgba(23,100,76,0.16)]">
                SV
              </div>
              <div className="min-w-0">
                <p className="text-base font-black text-[#173c30]">Centro de Gestão SV</p>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#60746d]">Sistema Integrado SV</p>
              </div>
            </div>
            <p className="max-w-[42%] text-right text-[10px] font-medium leading-4 text-[#60746d]">Emitido em {formatEmission(view.issuedAt)}</p>
          </div>

          <div className="mt-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#a17d2e]">Entregável profissional</p>
            <h1 className="mt-1.5 text-[27px] font-black leading-tight tracking-tight text-[#173c30]">Relatório Executivo Financeiro</h1>
          </div>

          <dl className="mt-3 grid gap-x-5 gap-y-2.5 border-t border-[#dfe7e3] pt-3 text-sm sm:grid-cols-3">
            <div><dt className="text-[9px] font-black uppercase tracking-[0.14em] text-[#718079]">Unidade</dt><dd className="mt-1 font-black text-[#243b33]">{view.unit.name}</dd></div>
            <div><dt className="text-[9px] font-black uppercase tracking-[0.14em] text-[#718079]">Período analisado</dt><dd className="mt-1 font-black capitalize text-[#243b33]">{view.period.label}</dd></div>
            <div><dt className="text-[9px] font-black uppercase tracking-[0.14em] text-[#718079]">Emissão</dt><dd className="mt-1 font-black text-[#243b33]">{formatEmission(view.issuedAt)}</dd></div>
          </dl>
        </header>

        <div className="space-y-5 p-5 sm:p-6">
          {!view.hasData ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center">
              <p className="font-black text-slate-900">Sem dados no período</p>
              <p className="mt-1 text-sm text-slate-500">Nenhum valor foi inventado para preencher este relatório.</p>
            </div>
          ) : null}

          <section className="print-report-block" aria-labelledby="cash-summary-title">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#a17d2e]">Movimentação realizada — Caixa</p>
            <h2 className="mt-1 text-xl font-black text-[#173c30]" id="cash-summary-title">Resumo executivo</h2>
            <dl className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <Metric label="Receitas realizadas" tone="positive" value={view.summary.totalReceived} />
              <Metric label="Despesas realizadas" tone="negative" value={view.summary.totalPaid} />
              <Metric label="Resultado realizado" tone={cashResultTone} value={view.summary.realizedBalance} />
              <Metric label="A receber" value={view.summary.openReceivable} />
              <Metric label="A pagar" tone="warning" value={view.summary.openPayable} />
              <Metric label="Vencidos" tone="warning" value={view.summary.overdueTotal} />
              {view.unit.code === "ACADEMIA" || view.unit.code === "ALL" ? <Metric label="Retiradas do proprietário" value={view.summary.ownerWithdrawalPaid} /> : null}
              <Metric label="Total disponível" tone="positive" value={view.summary.totalAvailable} />
            </dl>
          </section>

          {dre ? (
            <section className="print-report-block rounded-2xl border border-sky-200 bg-sky-50/60 p-4" aria-labelledby="dre-summary-title">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-700">Dados gerenciais — DRE</p>
              <h2 className="mt-1 text-xl font-black text-slate-950" id="dre-summary-title">DRE NextFit da Academia</h2>
              <p className="mt-1 text-xs text-slate-600">Fotografia gerencial independente do caixa · {dre.exercise.firstClosedCompetence} a {dre.exercise.lastClosedCompetence}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-5">
                <Metric label="Receita bruta DRE" value={dre.indicators.grossRevenue.amount} />
                <Metric label="Receita líquida DRE" value={dre.indicators.netRevenue.amount} />
                <Metric label="Despesas DRE" value={dre.indicators.expenses.amount} />
                <Metric label="Lucro/Prejuízo final" tone={Number(dre.indicators.finalResult.amount) >= 0 ? "positive" : "negative"} value={dre.indicators.finalResult.amount} />
                <div className="rounded-2xl border border-sky-200 bg-white px-4 py-3"><dt className="text-[11px] font-black uppercase tracking-[0.1em] text-sky-700">Margem</dt><dd className="mt-2 text-xl font-black text-slate-950">{dre.indicators.margin.percentage === undefined ? "Sem dados" : `${dre.indicators.margin.percentage.toLocaleString("pt-BR")}%`}</dd></div>
              </dl>
            </section>
          ) : view.unit.code === "ACADEMIA" ? (
            <section className="print-report-block rounded-2xl border border-dashed border-sky-200 bg-sky-50/50 p-4"><p className="text-xs font-black uppercase tracking-[0.16em] text-sky-700">Dados gerenciais — DRE</p><p className="mt-1.5 text-sm font-semibold text-slate-600">Sem DRE válida aplicável ao período selecionado.</p></section>
          ) : null}

          <section className="print-report-block" aria-labelledby="balances-title">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#a17d2e]">Saldos por conta</p>
            <h2 className="mt-1 text-xl font-black text-[#173c30]" id="balances-title">Saldo realizado no SAULO-AI</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Calculado com base nas movimentações registradas/importadas. Não representa conciliação bancária oficial.</p>
            {view.summary.accountBalances.length ? (
              <dl className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                {view.summary.accountBalances.map((account) => <Metric key={account.financialAccount.id} label={account.financialAccount.name} value={account.realizedBalance} />)}
                <Metric label="Total disponível" tone="positive" value={view.summary.totalAvailable} />
              </dl>
            ) : <p className="mt-2.5 rounded-xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">Sem dados no período</p>}
          </section>

          <section className="print-report-block" aria-labelledby="payables-title">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#a17d2e]">Agenda financeira</p>
            <h2 className="mt-1 text-xl font-black text-[#173c30]" id="payables-title">Contas a Pagar</h2>
            <div className="mt-3"><AgendaCards agenda={view.payables} kind="PAYABLE" /></div>
            <PendingTable emptyMessage="Sem contas a pagar aplicáveis." entries={view.priorityPayables} />
          </section>

          <section className="print-report-block" aria-labelledby="receivables-title">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#a17d2e]">Agenda financeira</p>
            <h2 className="mt-1 text-xl font-black text-[#173c30]" id="receivables-title">Contas a Receber</h2>
            <div className="mt-3"><AgendaCards agenda={view.receivables} kind="RECEIVABLE" /></div>
            <PendingTable emptyMessage="Sem contas a receber aplicáveis." entries={view.priorityReceivables} />
          </section>

          <section className="print-report-block" aria-labelledby="evolution-title">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#a17d2e]">Evolução</p>
            <h2 className="mt-1 text-xl font-black text-[#173c30]" id="evolution-title">Movimentação realizada mensal</h2>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full border-collapse text-sm"><thead className="bg-slate-100 text-slate-600"><tr><th className="px-3 py-2 text-left font-black">Mês</th><th className="px-3 py-2 text-right font-black">Entradas</th><th className="px-3 py-2 text-right font-black">Saídas</th><th className="px-3 py-2 text-right font-black">Resultado</th></tr></thead><tbody>{view.evolution.map((item) => <tr className="border-t border-slate-200" key={item.competence}><td className="px-3 py-2 font-bold capitalize">{month.format(new Date(`${item.competence}-01T00:00:00.000Z`))}</td><td className="px-3 py-2 text-right tabular-nums">{money(item.totalReceived)}</td><td className="px-3 py-2 text-right tabular-nums">{money(item.totalPaid)}</td><td className="px-3 py-2 text-right font-black tabular-nums">{money(item.realizedBalance)}</td></tr>)}</tbody></table>
            </div>
          </section>

          <section className="print-report-block rounded-2xl border border-[#c9ddd3] bg-[#edf6f1] p-4" aria-labelledby="reading-title">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#a17d2e]">Leitura do período</p>
            <h2 className="mt-1 text-xl font-black text-[#173c30]" id="reading-title">Síntese determinística</h2>
            <ul className="mt-2.5 space-y-1.5 text-sm leading-6 text-[#40564e]">{view.reading.map((item) => <li className="flex gap-2" key={item}><span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-[#17644c]" />{item}</li>)}</ul>
          </section>

          <footer className="border-t border-[#d9e3de] pt-3">
            <div className="flex items-end justify-between gap-4 text-[9px] leading-4 text-[#60746d]">
              <p className="font-black text-[#23483b]">Centro de Gestão SV · Sistema Integrado SV</p>
              <p className="max-w-[62%] text-right">Relatório de representação dos dados financeiros existentes no SAULO-AI. A impressão não cria nem altera lançamentos, liquidações ou snapshots.</p>
            </div>
          </footer>
        </div>
      </article>
    </div>
  );
}
