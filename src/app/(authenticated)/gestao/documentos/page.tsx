import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { managementDocumentsRepository } from "@/features/financial/management-documents/repository";
import { mvpService } from "@/features/mvp";
import { BUILT_IN_IDS } from "@/modules/permissions";

export const metadata: Metadata = { title: "Documentos da Gestão | Clínica SV" };

type SearchValue = string | string[] | undefined;
type SearchParams = {
  unidade?: SearchValue;
  funcionario?: SearchValue;
  competencia?: SearchValue;
  numero?: SearchValue;
  status?: SearchValue;
  pagina?: SearchValue;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const month = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const control = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900";
const stateLabels = {
  DEMONSTRATIVE_AVAILABLE: "Pagamento não confirmado",
  PAYMENT_CONFIRMED: "Pagamento confirmado",
  VOIDED: "Recibo cancelado",
  LEGACY_UNCONFIRMED: "Legado · pagamento não confirmado",
  CASH_AWAITING_SIGNATURE: "Aguardando assinatura manual",
  BANK_PROVEN: "Pagamento comprovado",
  SIGNED: "Assinado",
} as const;
const kindLabels = {
  DEMONSTRATIVE: "Demonstrativo de pagamento",
  LEGACY_DEMONSTRATIVE: "Demonstrativo legado",
  SALARY_RECEIPT: "Recibo de pagamento salarial",
} as const;

function one(value: SearchValue) {
  return typeof value === "string" ? value : "";
}

function pageHref(query: SearchParams, page: number) {
  const params = new URLSearchParams();
  for (const key of ["unidade", "funcionario", "competencia", "numero", "status"] as const) {
    const value = one(query[key]);
    if (value) params.set(key, value);
  }
  params.set("pagina", String(page));
  return `/gestao/documentos?${params}`;
}

export default async function ManagementDocumentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await mvpService.getSession();
  if (session.user?.id !== BUILT_IN_IDS.users.sauloXavierVitorino) notFound();

  const query = await searchParams;
  const unitId = one(query.unidade);
  const competenceValue = one(query.competencia);
  const status = one(query.status);
  const pageValue = Number(one(query.pagina));
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const validCompetence = /^\d{4}-(0[1-9]|1[0-2])$/.test(competenceValue);
  const validStates = new Set(["DEMONSTRATIVE_AVAILABLE", "LEGACY_UNCONFIRMED", "PAYMENT_CONFIRMED", "CASH_AWAITING_SIGNATURE", "BANK_PROVEN", "SIGNED", "VOIDED"]);
  const invalidFilter = (unitId !== "" && !uuid.test(unitId)) ||
    (competenceValue !== "" && !validCompetence) ||
    (status !== "" && !validStates.has(status));
  const [units, result] = await Promise.all([
    managementDocumentsRepository.listUnits(),
    invalidFilter ? Promise.resolve({ items: [], total: 0, page, pageSize: 20, totalPages: 0 }) : managementDocumentsRepository.list({
      businessUnitId: unitId || undefined,
      employee: one(query.funcionario),
      competence: validCompetence ? new Date(`${competenceValue}-01T00:00:00.000Z`) : undefined,
      receiptNumber: one(query.numero),
      state: status && validStates.has(status) ? status as keyof typeof stateLabels : undefined,
      page,
    }),
  ]);
  return (
    <div className="space-y-6">
      <header><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">GESTÃO</p><h1 className="mt-1 text-3xl font-black text-slate-950">Documentos da Gestão</h1><p className="mt-2 text-sm text-slate-600">Demonstrativos e recibos salariais persistidos. A consulta não confirma pagamentos nem emite documentos.</p></header>
      <form action="/gestao/documentos" className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-5">
        <label className="text-sm font-bold text-slate-700">Unidade<select className={`mt-1 ${control}`} defaultValue={unitId} name="unidade"><option value="">Todas</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
        <label className="text-sm font-bold text-slate-700">Funcionário ou matrícula<input className={`mt-1 ${control}`} defaultValue={one(query.funcionario)} name="funcionario" type="search" /></label>
        <label className="text-sm font-bold text-slate-700">Competência<input className={`mt-1 ${control}`} defaultValue={competenceValue} name="competencia" type="month" /></label>
        <label className="text-sm font-bold text-slate-700">Número do documento<input className={`mt-1 ${control}`} defaultValue={one(query.numero)} name="numero" type="search" /></label>
        <label className="text-sm font-bold text-slate-700">Situação<select className={`mt-1 ${control}`} defaultValue={status} name="status"><option value="">Todas</option>{Object.entries(stateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button className="min-h-11 rounded-xl bg-emerald-800 px-5 text-sm font-bold text-white xl:col-span-5 xl:justify-self-start" type="submit">Filtrar</button>
      </form>
      <p className="text-sm font-semibold text-slate-700">{result.total} {result.total === 1 ? "resultado" : "resultados"}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {result.items.map((document) => {
          const demonstrative = document.documentKind === "DEMONSTRATIVE";
          const href = demonstrative
            ? `/gestao/documentos/demonstrativos/${encodeURIComponent(document.id)}`
            : `/gestao/documentos/recibos-pagamento/${encodeURIComponent(document.id)}`;
          return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={`${document.documentKind}-${document.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-black text-slate-950">{kindLabels[document.documentKind]}</h2><p className="mt-1 text-sm font-semibold text-emerald-800">{document.documentNumber} · Versão {document.version}</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">{stateLabels[document.documentState]}</span></div>
            {document.documentKind === "LEGACY_DEMONSTRATIVE" ? <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">Demonstrativo legado — pagamento não confirmado pelo sistema</p> : null}
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Funcionário</dt><dd className="font-semibold text-slate-900">{document.employeeName}</dd></div><div><dt className="text-slate-500">Matrícula</dt><dd className="font-semibold text-slate-900">{document.employmentCode}</dd></div><div><dt className="text-slate-500">Unidade</dt><dd className="font-semibold text-slate-900">{document.businessUnitName}</dd></div><div><dt className="text-slate-500">Competência</dt><dd className="font-semibold capitalize text-slate-900">{month.format(document.competence)}</dd></div><div><dt className="text-slate-500">Data de emissão</dt><dd className="font-semibold text-slate-900">{date.format(document.issuedAt)}</dd></div>{document.issuerName ? <div><dt className="text-slate-500">Emissor</dt><dd className="font-semibold text-slate-900">{document.issuerName}</dd></div> : null}</dl>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-700 px-4 text-center text-sm font-bold text-emerald-800 hover:bg-emerald-50" href={href}>Visualizar</Link>
              <Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-800 px-4 text-center text-sm font-bold text-white hover:bg-emerald-900" href={`${href}?print=1&intent=PRINT`}>Imprimir</Link>
              <Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-700 px-4 text-center text-sm font-bold text-emerald-800 hover:bg-emerald-50" href={`${href}?print=1&intent=SAVE_PDF`}>Salvar em PDF</Link>
            </div>
          </article>;
        })}
      </div>
      {result.items.length === 0 ? <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Nenhum documento corresponde aos filtros.</p> : null}
      {result.totalPages > 1 ? <nav aria-label="Paginação dos documentos" className="flex items-center justify-between gap-3 text-sm"><span>Página {result.page} de {result.totalPages}</span><div className="flex gap-2">{result.page > 1 ? <Link className="rounded-lg border px-3 py-2" href={pageHref(query, result.page - 1)}>Anterior</Link> : null}{result.page < result.totalPages ? <Link className="rounded-lg border px-3 py-2" href={pageHref(query, result.page + 1)}>Próxima</Link> : null}</div></nav> : null}
    </div>
  );
}
