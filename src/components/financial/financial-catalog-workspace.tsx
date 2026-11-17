"use client";

import { Pencil, Plus, Power, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";

import {
  Badge,
  Button,
  FormField,
  Input,
  PageHeading,
  Select,
} from "@/components/ui";
import { developmentUserRequestHeaders } from "@/features/development-session";
import type {
  FinancialCatalog,
  FinancialCatalogItem,
} from "@/features/financial/contracts";

type Resource = "categories" | "cost-centers" | "accounts" | "payment-methods";

const resourceLabels: Record<Resource, { singular: string; plural: string }> = {
  categories: { singular: "categoria", plural: "Categorias" },
  "cost-centers": { singular: "centro de custo", plural: "Centros de custo" },
  accounts: { singular: "conta financeira", plural: "Contas financeiras" },
  "payment-methods": { singular: "forma de pagamento", plural: "Formas de pagamento" },
};

const accountTypeLabels = {
  CASH: "Caixa",
  BANK: "Banco",
  DIGITAL_WALLET: "Carteira digital",
  OTHER: "Outro",
} as const;

const paymentMethodTypeLabels = {
  CASH: "Dinheiro",
  PIX: "PIX",
  DEBIT_CARD: "Cartão de débito",
  CREDIT_CARD: "Cartão de crédito",
  BANK_TRANSFER: "Transferência",
  BOLETO: "Boleto",
  OTHER: "Outro",
} as const;

function itemsFor(catalog: FinancialCatalog, resource: Resource) {
  if (resource === "categories") return catalog.categories;
  if (resource === "cost-centers") return catalog.costCenters;
  if (resource === "accounts") return catalog.financialAccounts;
  return catalog.paymentMethods;
}

function typeLabel(item: FinancialCatalogItem) {
  if (item.entryType) return item.entryType === "REVENUE" ? "Receita" : "Despesa";
  if (item.accountType) return accountTypeLabels[item.accountType];
  if (item.paymentMethodType) return paymentMethodTypeLabels[item.paymentMethodType];
  return "—";
}

export function FinancialCatalogWorkspace({ catalog }: { catalog: FinancialCatalog }) {
  const router = useRouter();
  const [resource, setResource] = useState<Resource>("categories");
  const [editing, setEditing] = useState<FinancialCatalogItem>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const items = useMemo(() => itemsFor(catalog, resource), [catalog, resource]);
  const unitsById = useMemo(
    () => new Map(catalog.businessUnits.map((unit) => [unit.id, unit.name])),
    [catalog.businessUnits],
  );

  function openCreate() {
    setEditing(undefined);
    setError(undefined);
    setDialogOpen(true);
  }

  function openEdit(item: FinancialCatalogItem) {
    setEditing(item);
    setError(undefined);
    setDialogOpen(true);
  }

  async function request(url: string, init: RequestInit) {
    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...developmentUserRequestHeaders(),
        ...init.headers,
      },
    });
    const payload = (await response.json()) as { message?: string; error?: string };
    if (!response.ok) {
      throw new Error(payload.message || payload.error || "Não foi possível salvar o cadastro.");
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    const data = new FormData(event.currentTarget);
    const body: Record<string, string> = {
      code: String(data.get("code") ?? ""),
      name: String(data.get("name") ?? ""),
    };
    if (!editing) {
      const type = data.get("type");
      const businessUnitId = data.get("businessUnitId");
      if (type) body.type = String(type);
      if (businessUnitId) body.businessUnitId = String(businessUnitId);
    }
    try {
      await request(
        editing
          ? `/api/financial/catalog/${resource}/${editing.id}`
          : `/api/financial/catalog/${resource}`,
        { method: editing ? "PATCH" : "POST", body: JSON.stringify(body) },
      );
      setDialogOpen(false);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(item: FinancialCatalogItem) {
    setSaving(true);
    setError(undefined);
    try {
      await request(`/api/financial/catalog/${resource}/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
      });
      router.refresh();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Não foi possível alterar a situação.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 pt-3 sm:pt-4">
      <PageHeading
        action={<Button onClick={openCreate}><Plus aria-hidden="true" className="size-4" />Novo cadastro</Button>}
        backHref="/gestao/financeiro"
        description="Categorias, centros de custo, contas e formas de pagamento usadas nos lançamentos reais."
        eyebrow="Financeiro"
        title="Cadastros financeiros"
      />

      <nav aria-label="Tipos de cadastro financeiro" className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {(Object.keys(resourceLabels) as Resource[]).map((key) => (
          <button
            aria-current={resource === key ? "page" : undefined}
            className={`min-h-11 whitespace-nowrap rounded-lg px-4 text-sm font-black transition ${resource === key ? "bg-[#12664f] text-white" : "text-slate-600 hover:bg-slate-100"}`}
            key={key}
            onClick={() => { setResource(key); setError(undefined); }}
            type="button"
          >
            {resourceLabels[key].plural}
          </button>
        ))}
      </nav>

      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">{error}</p> : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label={resourceLabels[resource].plural}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-5">
          <div><h2 className="font-black text-slate-950">{resourceLabels[resource].plural}</h2><p className="mt-1 text-xs text-slate-500">{items.length} cadastro(s)</p></div>
          <Button onClick={openCreate} size="small" variant="outline"><Plus aria-hidden="true" className="size-4" />Adicionar</Button>
        </div>
        {items.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">Nenhum cadastro disponível.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <article className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,.35fr)_auto] sm:items-center sm:px-5" key={item.id}>
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-900">{item.name}</h3><Badge tone={item.status === "ACTIVE" ? "success" : "neutral"}>{item.status === "ACTIVE" ? "Ativo" : "Inativo"}</Badge></div><p className="mt-1 truncate text-xs font-semibold text-slate-500">{item.code}</p></div>
                <div className="text-sm"><p className="font-semibold text-slate-700">{item.businessUnitId ? unitsById.get(item.businessUnitId) : "Compartilhado"}</p><p className="mt-0.5 text-xs text-slate-500">{typeLabel(item)}</p></div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Button aria-label={`Editar ${item.name}`} onClick={() => openEdit(item)} size="small" variant="outline"><Pencil aria-hidden="true" className="size-4" />Editar</Button>
                  <Button aria-label={`${item.status === "ACTIVE" ? "Inativar" : "Ativar"} ${item.name}`} disabled={saving} onClick={() => toggleStatus(item)} size="small" variant="ghost"><Power aria-hidden="true" className="size-4" />{item.status === "ACTIVE" ? "Inativar" : "Ativar"}</Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 p-4" onMouseDown={() => !saving && setDialogOpen(false)}>
          <section aria-labelledby="catalog-dialog-title" aria-modal="true" className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Financeiro</p><h2 className="mt-1 text-xl font-black text-slate-950" id="catalog-dialog-title">{editing ? "Editar" : "Nova"} {resourceLabels[resource].singular}</h2></div><button aria-label="Fechar" className="grid size-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" onClick={() => setDialogOpen(false)} type="button"><X aria-hidden="true" className="size-5" /></button></header>
            <form className="space-y-5 p-5 sm:p-6" onSubmit={save}>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="catalog-code" label="Código" required><Input className="mt-1.5" defaultValue={editing?.code} id="catalog-code" maxLength={60} name="code" required /></FormField>
                <FormField id="catalog-name" label="Nome" required><Input className="mt-1.5" defaultValue={editing?.name} id="catalog-name" maxLength={120} name="name" required /></FormField>
                {!editing && resource === "categories" ? <FormField id="catalog-type" label="Tipo" required><Select className="mt-1.5" id="catalog-type" name="type" required><option value="REVENUE">Receita</option><option value="EXPENSE">Despesa</option></Select></FormField> : null}
                {!editing && resource === "accounts" ? <FormField id="catalog-type" label="Tipo" required><Select className="mt-1.5" id="catalog-type" name="type" required>{Object.entries(accountTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></FormField> : null}
                {!editing && resource === "payment-methods" ? <FormField id="catalog-type" label="Tipo" required><Select className="mt-1.5" id="catalog-type" name="type" required>{Object.entries(paymentMethodTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></FormField> : null}
                {!editing && resource !== "payment-methods" ? <FormField id="catalog-unit" label="Unidade" required={resource !== "categories"}><Select className="mt-1.5" id="catalog-unit" name="businessUnitId" required={resource !== "categories"}>{resource === "categories" ? <option value="">Compartilhado</option> : <option value="">Selecione</option>}{catalog.businessUnits.filter((unit) => unit.status === "ACTIVE").map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</Select></FormField> : null}
              </div>
              {editing ? <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">Tipo e unidade permanecem preservados para não invalidar lançamentos existentes.</p> : null}
              {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">{error}</p> : null}
              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end"><Button disabled={saving} onClick={() => setDialogOpen(false)} type="button" variant="outline">Cancelar</Button><Button disabled={saving} loading={saving} type="submit">Salvar cadastro</Button></div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
