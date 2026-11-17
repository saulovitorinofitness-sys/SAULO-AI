"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import type {
  IndividualIssuerConfiguration,
  IssuerAddress,
  IssuerConfigurationStatus,
  IssuerConfigurationView,
} from "@/features/financial/service-receipts/issuer-configuration";

const API_URL = "/api/financial/professional-service-receipts/issuer-configuration";

function maskDigits(value: string, pattern: "CPF" | "CNPJ" | "CEP") {
  const digits = value.replace(/\D/gu, "").slice(0, pattern === "CNPJ" ? 14 : pattern === "CPF" ? 11 : 8);
  if (pattern === "CEP") return digits.replace(/^(\d{5})(\d)/u, "$1-$2");
  if (pattern === "CPF") return digits.replace(/^(\d{3})(\d)/u, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/u, "$1.$2.$3").replace(/(\d{3})(\d{1,2})$/u, "$1-$2");
  return digits.replace(/^(\d{2})(\d)/u, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/u, "$1.$2.$3").replace(/\.(\d{3})(\d)/u, ".$1/$2").replace(/(\d{4})(\d{1,2})$/u, "$1-$2");
}

function statusLabel(status: IssuerConfigurationStatus) {
  return status === "COMPLETE" ? "Completo" : status === "INACTIVE" ? "Inativo" : "Incompleto";
}

function StatusBadge({ status }: { status: IssuerConfigurationStatus }) {
  const color = status === "COMPLETE" ? "bg-emerald-100 text-emerald-800" : status === "INACTIVE" ? "bg-slate-200 text-slate-700" : "bg-amber-100 text-amber-800";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-black ${color}`}>{statusLabel(status)}</span>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-bold text-slate-800"><span>{label}</span>{children}{hint ? <span className="text-xs font-medium text-slate-500">{hint}</span> : null}</label>;
}

const inputClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100";

function AddressFields({ value, onChange }: { value: IssuerAddress; onChange: (value: IssuerAddress) => void }) {
  const set = (key: keyof IssuerAddress, next: string) => onChange({ ...value, [key]: next });
  return <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><legend className="mb-2 text-sm font-black text-slate-950">Endereço completo</legend>
    <Field label="CEP"><input autoComplete="postal-code" className={inputClass} inputMode="numeric" onChange={(event) => set("postalCode", maskDigits(event.target.value, "CEP"))} value={value.postalCode} /></Field>
    <Field label="Logradouro"><input autoComplete="street-address" className={`${inputClass} lg:col-span-2`} onChange={(event) => set("street", event.target.value)} value={value.street} /></Field>
    <Field label="Número"><input autoComplete="address-line2" className={inputClass} onChange={(event) => set("number", event.target.value)} value={value.number} /></Field>
    <Field label="Complemento"><input autoComplete="off" className={inputClass} onChange={(event) => set("complement", event.target.value)} value={value.complement} /></Field>
    <Field label="Bairro"><input autoComplete="address-level3" className={inputClass} onChange={(event) => set("neighborhood", event.target.value)} value={value.neighborhood} /></Field>
    <Field label="Cidade"><input autoComplete="address-level2" className={inputClass} onChange={(event) => set("city", event.target.value)} value={value.city} /></Field>
    <Field label="Estado (UF)"><input autoCapitalize="characters" autoComplete="address-level1" className={inputClass} maxLength={2} onChange={(event) => set("state", event.target.value.toUpperCase())} value={value.state} /></Field>
  </fieldset>;
}

function SectionCard({ title, description, status, children }: { title: string; description: string; status: IssuerConfigurationStatus; children: ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby={`section-${title.replace(/\s/gu, "-")}`}>
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5"><div><h2 className="text-lg font-black text-slate-950" id={`section-${title.replace(/\s/gu, "-")}`}>{title}</h2><p className="mt-1 text-sm text-slate-600">{description}</p></div><StatusBadge status={status} /></header>
    <div className="p-4 sm:p-5">{children}</div>
  </section>;
}

function SaveBar({ active, saving, onActive }: { active: boolean; saving: boolean; onActive: (value: boolean) => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4"><label className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-slate-800"><input checked={active} className="size-4 accent-emerald-700" onChange={(event) => onActive(event.target.checked)} type="checkbox" />Situação ativa</label><button className="min-h-11 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60" disabled={saving} type="submit">{saving ? "Salvando…" : "Salvar rascunho"}</button></div>;
}

function RegistrationFields({ council, configured, masked, category, state, status, onChange }: {
  council: "CRN" | "CREF"; configured: boolean; masked: string | null; category: string; state: string; status: "ACTIVE" | "INACTIVE";
  onChange: (value: { number: string; category: string; state: string; status: "ACTIVE" | "INACTIVE" }) => void;
}) {
  const [number, setNumber] = useState("");
  const [nextCategory, setCategory] = useState(category);
  const [nextState, setState] = useState(state);
  const [nextStatus, setStatus] = useState(status);
  const publish = (next: Partial<{ number: string; category: string; state: string; status: "ACTIVE" | "INACTIVE" }>) => {
    const value = { number, category: nextCategory, state: nextState, status: nextStatus, ...next };
    onChange(value);
  };
  return <fieldset className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-4"><legend className="px-1 text-sm font-black text-slate-950">{council}</legend>
    <Field label="Número" hint={configured ? `Salvo: ${masked ?? "oculto"}. Preencha somente para substituir.` : undefined}><input autoComplete="off" className={inputClass} onChange={(event) => { setNumber(event.target.value); publish({ number: event.target.value }); }} placeholder={configured ? "Novo número" : "Número do registro"} value={number} /></Field>
    <Field label="Categoria"><input autoComplete="off" className={inputClass} onChange={(event) => { setCategory(event.target.value); publish({ category: event.target.value }); }} value={nextCategory} /></Field>
    <Field label="UF"><input autoCapitalize="characters" autoComplete="off" className={inputClass} maxLength={2} onChange={(event) => { const next = event.target.value.toUpperCase(); setState(next); publish({ state: next }); }} value={nextState} /></Field>
    <Field label="Situação"><select className={inputClass} onChange={(event) => { const next = event.target.value as "ACTIVE" | "INACTIVE"; setStatus(next); publish({ status: next }); }} value={nextStatus}><option value="ACTIVE">Ativo</option><option value="INACTIVE">Inativo</option></select></Field>
  </fieldset>;
}

export function IssuerConfigurationWorkspace() {
  const [configuration, setConfiguration] = useState<IssuerConfigurationView | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [academyDocument, setAcademyDocument] = useState("");
  const [personalDocuments, setPersonalDocuments] = useState({ SAULO: "", MARIA: "" });
  const [registrations, setRegistrations] = useState<Record<string, { number: string; category: string; state: string; status: "ACTIVE" | "INACTIVE" }>>({});
  const [sensitiveReset, setSensitiveReset] = useState(0);

  useEffect(() => {
    void fetch(API_URL, { credentials: "same-origin", cache: "no-store" }).then(async (response) => {
      const payload = await response.json() as { configuration?: IssuerConfigurationView; message?: string };
      if (!response.ok || !payload.configuration) throw new Error(payload.message ?? "Não foi possível carregar a configuração.");
      setConfiguration(payload.configuration);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Não foi possível carregar a configuração.")).finally(() => setLoading(false));
  }, []);

  async function save(section: string, payload: unknown) {
    setSaving(section); setError(""); setMessage("");
    try {
      const response = await fetch(API_URL, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json() as { configuration?: IssuerConfigurationView; message?: string };
      if (!response.ok || !body.configuration) throw new Error(body.message ?? "Não foi possível salvar a configuração.");
      setConfiguration(body.configuration);
      setAcademyDocument(""); setPersonalDocuments({ SAULO: "", MARIA: "" }); setRegistrations({}); setSensitiveReset((current) => current + 1);
      setMessage("Configuração salva com segurança.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar a configuração.");
    } finally { setSaving(null); }
  }

  if (loading) return <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600" role="status">Carregando configuração dos emissores…</p>;
  if (!configuration) return <p className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-800" role="alert">{error || "Configuração indisponível."}</p>;

  const updateIndividual = (section: "SAULO" | "MARIA", value: IndividualIssuerConfiguration) => setConfiguration({ ...configuration, [section.toLowerCase()]: value });
  const individualForm = (section: "SAULO" | "MARIA", value: IndividualIssuerConfiguration) => {
    const registration = (council: "CRN" | "CREF") => value.registrations.find((item) => item.council === council)!;
    const registrationPayload = (council: "CRN" | "CREF") => {
      const draft = registrations[`${section}:${council}`];
      return draft?.number ? draft : { status: draft?.status ?? registration(council).status };
    };
    const submit = (event: FormEvent) => {
      event.preventDefault();
      void save(section, { section, fullName: value.fullName, cpf: personalDocuments[section] || undefined, address: value.address, active: value.active, ...(section === "SAULO" ? { crn: registrationPayload("CRN") } : {}), cref: registrationPayload("CREF") });
    };
    return <SectionCard description="Vinculado ao usuário real já existente; nenhum novo usuário ou funcionário será criado." status={value.status} title={section === "SAULO" ? "Saulo Xavier Vitorino" : "Maria de Lourdes Gomes"}><form className="grid gap-4" onSubmit={submit}>
      <p className={`rounded-lg px-3 py-2 text-xs font-bold ${value.userLinked ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{value.userLinked ? "Usuário real vinculado" : "Usuário real não encontrado"}</p>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Nome completo"><input autoComplete="name" className={inputClass} onChange={(event) => updateIndividual(section, { ...value, fullName: event.target.value })} value={value.fullName} /></Field><Field label="CPF" hint={value.cpf.configured ? `Salvo: ${value.cpf.masked}. Preencha somente para substituir.` : "Ainda não configurado."}><input autoComplete="off" className={inputClass} inputMode="numeric" onChange={(event) => setPersonalDocuments({ ...personalDocuments, [section]: maskDigits(event.target.value, "CPF") })} placeholder={value.cpf.configured ? "Novo CPF" : "CPF"} value={personalDocuments[section]} /></Field></div>
      <AddressFields onChange={(address) => updateIndividual(section, { ...value, address })} value={value.address} />
      {section === "SAULO" ? <RegistrationFields key={`${section}-CRN-${sensitiveReset}`} {...registration("CRN")} onChange={(next) => setRegistrations({ ...registrations, [`${section}:CRN`]: next })} /> : null}
      <RegistrationFields key={`${section}-CREF-${sensitiveReset}`} {...registration("CREF")} onChange={(next) => setRegistrations({ ...registrations, [`${section}:CREF`]: next })} />
      <SaveBar active={value.active} onActive={(active) => updateIndividual(section, { ...value, active })} saving={saving === section} />
    </form></SectionCard>;
  };

  return <div className="grid gap-4">
    <div aria-live="polite">{message ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{message}</p> : null}{error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800" role="alert">{error}</p> : null}</div>
    <SectionCard description="Dados legais usados quando a Academia é a emissora do recibo." status={configuration.academy.status} title="Academia Saulo Fitness"><form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void save("ACADEMY", { section: "ACADEMY", legalName: configuration.academy.legalName, tradeName: configuration.academy.tradeName, cnpj: academyDocument || undefined, address: configuration.academy.address, active: configuration.academy.active }); }}>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Tipo de pessoa"><input className={inputClass} disabled value="Pessoa jurídica" /></Field><Field label="CNPJ" hint={configuration.academy.cnpj.configured ? `Salvo: ${configuration.academy.cnpj.masked}. Preencha somente para substituir.` : "Ainda não configurado."}><input autoComplete="off" className={inputClass} inputMode="numeric" onChange={(event) => setAcademyDocument(maskDigits(event.target.value, "CNPJ"))} placeholder={configuration.academy.cnpj.configured ? "Novo CNPJ" : "CNPJ"} value={academyDocument} /></Field><Field label="Razão social"><input className={inputClass} onChange={(event) => setConfiguration({ ...configuration, academy: { ...configuration.academy, legalName: event.target.value } })} value={configuration.academy.legalName} /></Field><Field label="Nome fantasia"><input className={inputClass} onChange={(event) => setConfiguration({ ...configuration, academy: { ...configuration.academy, tradeName: event.target.value } })} value={configuration.academy.tradeName} /></Field></div>
      <AddressFields onChange={(address) => setConfiguration({ ...configuration, academy: { ...configuration.academy, address } })} value={configuration.academy.address} />
      <SaveBar active={configuration.academy.active} onActive={(active) => setConfiguration({ ...configuration, academy: { ...configuration.academy, active } })} saving={saving === "ACADEMY"} />
    </form></SectionCard>
    <SectionCard description="Unidade comercial vinculada obrigatoriamente à Academia Saulo Fitness." status={configuration.clinic.status} title="Clínica SV"><form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void save("CLINIC", { section: "CLINIC", commercialName: configuration.clinic.commercialName, internalCode: configuration.clinic.internalCode, active: configuration.clinic.active }); }}>
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900">Utiliza os dados legais e o CNPJ da Academia Saulo Fitness</p>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Nome comercial"><input className={inputClass} onChange={(event) => setConfiguration({ ...configuration, clinic: { ...configuration.clinic, commercialName: event.target.value } })} value={configuration.clinic.commercialName} /></Field><Field label="Código interno da unidade"><input className={inputClass} disabled value={configuration.clinic.internalCode} /></Field></div>
      <SaveBar active={configuration.clinic.active} onActive={(active) => setConfiguration({ ...configuration, clinic: { ...configuration.clinic, active } })} saving={saving === "CLINIC"} />
    </form></SectionCard>
    {individualForm("SAULO", configuration.saulo)}
    {individualForm("MARIA", configuration.maria)}
    <p className="text-xs text-slate-500">Rascunhos incompletos podem ser salvos. A emissão fica bloqueada até o emissor aparecer como Completo e ativo.</p>
  </div>;
}
