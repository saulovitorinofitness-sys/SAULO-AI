"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";

import { CheckIcon } from "@/components/ui/icons";
import { mvpService, patientSelectOptions, type PatientRegistrationDraft } from "@/features/mvp";

const inputClass = "mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#3b9b7d] focus:ring-2 focus:ring-[#3b9b7d]/15";

function Field({ label, name, required = false, hint, children }: { label: string; name: string; required?: boolean; hint?: string; children: ReactNode }) {
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <label className="block text-sm font-bold text-slate-700" htmlFor={name}>
      {label}{required ? <span aria-hidden="true" className="ml-1 text-rose-600">*</span> : null}
      {children}
      {hint ? <span className="mt-1 block text-xs font-normal text-slate-500" id={hintId}>{hint}</span> : null}
    </label>
  );
}

function FormSection({ number, title, description, children }: { number: string; title: string; description: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-[#dce5e0] bg-white p-4 shadow-[0_8px_24px_rgb(20_55_44/0.03)] sm:p-6">
      <legend className="sr-only">{title}</legend>
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#e7f2ed] text-xs font-black text-[#0a4938]">{number}</span>
        <div><h2 className="font-black text-slate-900">{title}</h2><p className="mt-1 text-sm leading-5 text-slate-500">{description}</p></div>
      </div>
      {children}
    </fieldset>
  );
}

function value(data: FormData, key: string) {
  return String(data.get(key) ?? "").trim();
}

export function PatientForm() {
  const [state, setState] = useState<"idle" | "saving" | "success" | "error">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    setState("saving");
    const data = new FormData(form);
    const preferredName = value(data, "preferredName");
    const complement = value(data, "complement");
    const validUntil = value(data, "insuranceValidUntil");
    const emergencyEmail = value(data, "emergencyEmail");
    const draft: PatientRegistrationDraft = {
      fullName: value(data, "fullName"),
      preferredName: preferredName || undefined,
      cpf: value(data, "cpf").replace(/\D/g, ""),
      sex: value(data, "sex") as PatientRegistrationDraft["sex"],
      birthDate: value(data, "birthDate"),
      email: value(data, "email"),
      maritalStatus: value(data, "maritalStatus") as PatientRegistrationDraft["maritalStatus"],
      profession: value(data, "profession"),
      address: {
        street: value(data, "street"), number: value(data, "number"), complement: complement || undefined,
        neighborhood: value(data, "neighborhood"), city: value(data, "city"), state: value(data, "addressState").toUpperCase(),
        postalCode: value(data, "postalCode").replace(/\D/g, ""), countryCode: "BR",
      },
      phone: {
        type: value(data, "phoneType") as PatientRegistrationDraft["phone"]["type"], countryCode: "55",
        areaCode: value(data, "areaCode").replace(/\D/g, ""), number: value(data, "phoneNumber").replace(/\D/g, ""), isPrimary: true,
      },
      insurance: {
        providerName: value(data, "insuranceProvider"), planName: value(data, "insurancePlan"),
        memberNumber: value(data, "insuranceMemberNumber"), validUntil: validUntil || undefined,
      },
      emergencyContact: {
        fullName: value(data, "emergencyName"), relationship: value(data, "emergencyRelationship"),
        phone: value(data, "emergencyPhone"), email: emergencyEmail || undefined, isPrimary: true,
      },
    };

    try {
      await mvpService.registerPatient(draft);
      setState("success");
      form.reset();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setState("error");
    }
  }

  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit}>
      {state === "success" ? (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
          <CheckIcon className="mt-0.5 shrink-0" />
          <div><p className="font-black">Validação concluída com sucesso.</p><p className="mt-1">O envio foi simulado e nenhum dado foi persistido, pois o endpoint de cadastro ainda não existe.</p></div>
        </div>
      ) : null}
      {state === "error" ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800" role="alert">Não foi possível validar o formulário. Tente novamente.</div> : null}

      <p className="text-xs font-semibold text-slate-500"><span className="text-rose-600">*</span> Campos obrigatórios previstos no domínio atual.</p>

      <FormSection description="Dados usados como referência única por todos os módulos autorizados." number="01" title="Identificação">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2"><Field label="Nome completo" name="fullName" required><input autoComplete="name" className={inputClass} id="fullName" name="fullName" required /></Field></div>
          <Field label="Nome preferido" name="preferredName"><input className={inputClass} id="preferredName" name="preferredName" /></Field>
          <Field hint="Somente números; validação definitiva permanece no back-end." label="CPF" name="cpf" required><input aria-describedby="cpf-hint" className={inputClass} id="cpf" inputMode="numeric" maxLength={14} name="cpf" placeholder="000.000.000-00" required /></Field>
          <Field label="Sexo" name="sex" required><select className={inputClass} defaultValue="" id="sex" name="sex" required><option disabled value="">Selecione</option>{patientSelectOptions.sexes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
          <Field label="Data de nascimento" name="birthDate" required><input autoComplete="bday" className={inputClass} id="birthDate" name="birthDate" required type="date" /></Field>
          <Field label="E-mail" name="email" required><input autoComplete="email" className={inputClass} id="email" name="email" required type="email" /></Field>
          <Field label="Estado civil" name="maritalStatus" required><select className={inputClass} defaultValue="" id="maritalStatus" name="maritalStatus" required><option disabled value="">Selecione</option>{patientSelectOptions.maritalStatuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
          <Field label="Profissão" name="profession" required><input className={inputClass} id="profession" name="profession" required /></Field>
        </div>
      </FormSection>

      <FormSection description="Endereço residencial principal vinculado ao cadastro único." number="02" title="Endereço">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="sm:col-span-2 lg:col-span-4"><Field label="Logradouro" name="street" required><input autoComplete="address-line1" className={inputClass} id="street" name="street" required /></Field></div>
          <div className="lg:col-span-2"><Field label="Número" name="number" required><input className={inputClass} id="number" name="number" required /></Field></div>
          <div className="sm:col-span-2 lg:col-span-3"><Field label="Complemento" name="complement"><input autoComplete="address-line2" className={inputClass} id="complement" name="complement" /></Field></div>
          <div className="lg:col-span-3"><Field label="Bairro" name="neighborhood" required><input className={inputClass} id="neighborhood" name="neighborhood" required /></Field></div>
          <div className="lg:col-span-3"><Field label="Cidade" name="city" required><input autoComplete="address-level2" className={inputClass} id="city" name="city" required /></Field></div>
          <div><Field label="UF" name="addressState" required><input autoComplete="address-level1" className={inputClass} id="addressState" maxLength={2} name="addressState" required /></Field></div>
          <div className="lg:col-span-2"><Field label="CEP" name="postalCode" required><input autoComplete="postal-code" className={inputClass} id="postalCode" inputMode="numeric" name="postalCode" required /></Field></div>
        </div>
      </FormSection>

      <FormSection description="Informe o telefone principal. Novos números poderão ser adicionados pela integração futura." number="03" title="Contato">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2"><Field label="Tipo" name="phoneType" required><select className={inputClass} defaultValue="MOBILE" id="phoneType" name="phoneType" required>{patientSelectOptions.phoneTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field></div>
          <Field label="DDD" name="areaCode" required><input className={inputClass} id="areaCode" inputMode="numeric" maxLength={2} name="areaCode" required /></Field>
          <div className="lg:col-span-2"><Field label="Telefone" name="phoneNumber" required><input autoComplete="tel" className={inputClass} id="phoneNumber" inputMode="tel" name="phoneNumber" required /></Field></div>
        </div>
      </FormSection>

      <FormSection description="Informações administrativas do convênio previsto no modelo do paciente." number="04" title="Convênio">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Convênio" name="insuranceProvider" required><input className={inputClass} id="insuranceProvider" name="insuranceProvider" required /></Field>
          <Field label="Plano" name="insurancePlan" required><input className={inputClass} id="insurancePlan" name="insurancePlan" required /></Field>
          <Field label="Número da carteirinha" name="insuranceMemberNumber" required><input className={inputClass} id="insuranceMemberNumber" name="insuranceMemberNumber" required /></Field>
          <Field label="Validade" name="insuranceValidUntil"><input className={inputClass} id="insuranceValidUntil" name="insuranceValidUntil" type="date" /></Field>
        </div>
      </FormSection>

      <FormSection description="Pessoa a ser acionada quando necessário durante o atendimento." number="05" title="Contato de emergência">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome completo" name="emergencyName" required><input className={inputClass} id="emergencyName" name="emergencyName" required /></Field>
          <Field label="Relação com o paciente" name="emergencyRelationship" required><input className={inputClass} id="emergencyRelationship" name="emergencyRelationship" required /></Field>
          <Field label="Telefone" name="emergencyPhone" required><input className={inputClass} id="emergencyPhone" inputMode="tel" name="emergencyPhone" required /></Field>
          <Field label="E-mail" name="emergencyEmail"><input className={inputClass} id="emergencyEmail" name="emergencyEmail" type="email" /></Field>
        </div>
      </FormSection>

      <div className="sticky bottom-16 z-10 flex flex-col-reverse gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_-8px_30px_rgb(15_23_42/0.08)] backdrop-blur sm:bottom-4 sm:flex-row sm:justify-end">
        <Link className="inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold text-slate-600 hover:bg-slate-100" href="/pacientes">Cancelar</Link>
        <button className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#12664f] px-6 text-sm font-bold text-white hover:bg-[#0a4938] disabled:cursor-wait disabled:opacity-60" disabled={state === "saving"} type="submit">{state === "saving" ? "Validando..." : "Validar cadastro"}</button>
      </div>
    </form>
  );
}
