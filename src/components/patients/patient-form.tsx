"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { CheckIcon } from "@/components/ui/icons";
import type {
  PatientRegistrationInput,
  PatientRegistrationResult,
} from "@/features/patient-registration";
import { patientSelectOptions } from "@/features/mvp";

const inputClass =
  "mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#3b9b7d] focus:ring-2 focus:ring-[#3b9b7d]/15 disabled:bg-slate-50 disabled:text-slate-500";

function Field({
  label,
  name,
  required = false,
  hint,
  children,
}: {
  label: string;
  name: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  const hintId = hint ? `${name}-hint` : undefined;

  return (
    <label className="block text-sm font-bold text-slate-700" htmlFor={name}>
      {label}
      {required ? (
        <span aria-hidden="true" className="ml-1 text-rose-600">
          *
        </span>
      ) : null}
      {children}
      {hint ? (
        <span
          className="mt-1 block text-xs font-normal text-slate-500"
          id={hintId}
        >
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="rounded-2xl border border-[#dce5e0] bg-white p-4 shadow-[0_8px_24px_rgb(20_55_44/0.03)] sm:p-6">
      <legend className="sr-only">{title}</legend>
      <div className="mb-5">
        <h2 className="font-black text-slate-900">{title}</h2>
        <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
      </div>
      {children}
    </fieldset>
  );
}

function value(data: FormData, key: string) {
  return String(data.get(key) ?? "").trim();
}

function optionalValue(data: FormData, key: string) {
  return value(data, key) || undefined;
}

function digits(data: FormData, key: string) {
  return value(data, key).replace(/\D/g, "");
}

function hasAnyValue(values: readonly (string | undefined)[]) {
  return values.some(Boolean);
}

export function PatientForm() {
  const router = useRouter();
  const submittingRef = useRef(false);
  const [state, setState] = useState<"idle" | "saving" | "success" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [createdClinicalCode, setCreatedClinicalCode] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submittingRef.current) return;

    const form = event.currentTarget;

    if (!form.reportValidity()) return;

    submittingRef.current = true;
    setState("saving");
    setErrorMessage("");

    const data = new FormData(form);
    const cpf = digits(data, "cpf") || undefined;
    const postalCode = digits(data, "postalCode") || undefined;
    const address = {
      street: optionalValue(data, "street"),
      number: optionalValue(data, "number"),
      complement: optionalValue(data, "complement"),
      neighborhood: optionalValue(data, "neighborhood"),
      city: optionalValue(data, "city"),
      state: optionalValue(data, "addressState")?.toUpperCase(),
      postalCode,
      countryCode: "BR",
    };
    const insurance = {
      providerName: optionalValue(data, "insuranceProvider"),
      planName: optionalValue(data, "insurancePlan"),
      memberNumber: optionalValue(data, "insuranceMemberNumber"),
      validUntil: optionalValue(data, "insuranceValidUntil"),
    };
    const emergencyContact = {
      fullName: optionalValue(data, "emergencyName"),
      relationship: optionalValue(data, "emergencyRelationship"),
      phone: optionalValue(data, "emergencyPhone"),
      email: optionalValue(data, "emergencyEmail"),
    };

    const draft: PatientRegistrationInput = {
      fullName: value(data, "fullName"),
      birthDate: value(data, "birthDate"),
      sex: value(data, "sex") as PatientRegistrationInput["sex"],
      phone: {
        type: value(data, "phoneType") as PatientRegistrationInput["phone"]["type"],
        countryCode: "55",
        areaCode: digits(data, "areaCode"),
        number: digits(data, "phoneNumber"),
      },
      preferredName: optionalValue(data, "preferredName"),
      cpf,
      email: optionalValue(data, "email"),
      maritalStatus:
        (optionalValue(
          data,
          "maritalStatus",
        ) as PatientRegistrationInput["maritalStatus"]) ?? undefined,
      profession: optionalValue(data, "profession"),
      observations: optionalValue(data, "observations"),
      address: hasAnyValue([
        address.street,
        address.number,
        address.complement,
        address.neighborhood,
        address.city,
        address.state,
        address.postalCode,
      ])
        ? address
        : undefined,
      insurance: hasAnyValue([
        insurance.providerName,
        insurance.planName,
        insurance.memberNumber,
        insurance.validUntil,
      ])
        ? insurance
        : undefined,
      emergencyContact: hasAnyValue([
        emergencyContact.fullName,
        emergencyContact.relationship,
        emergencyContact.phone,
        emergencyContact.email,
      ])
        ? emergencyContact
        : undefined,
    };

    try {
      const response = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const result = (await response.json()) as
        | PatientRegistrationResult
        | { message?: string };

      if (!response.ok || !("patientId" in result)) {
        throw new Error(
          "message" in result && result.message
            ? result.message
            : "Não foi possível cadastrar o paciente.",
        );
      }

      setCreatedClinicalCode(result.clinicalCode);
      setState("success");

      await new Promise((resolve) => window.setTimeout(resolve, 650));
      router.replace(`/pacientes/${result.patientId}/continuar`);
    } catch (error) {
      submittingRef.current = false;
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível cadastrar o paciente. Tente novamente.",
      );
      setState("error");
    }
  }

  const saving = state === "saving" || state === "success";

  return (
    <form
      aria-busy={saving}
      className="space-y-4"
      noValidate
      onSubmit={handleSubmit}
    >
      <div aria-live="polite">
        {state === "success" ? (
          <div
            className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
            role="status"
          >
            <CheckIcon className="mt-0.5 shrink-0" />
            <div>
              <p className="font-black">
                Paciente {createdClinicalCode} cadastrado com sucesso.
              </p>
              <p className="mt-1">Abrindo o prontuário e a consulta inicial.</p>
            </div>
          </div>
        ) : null}

        {state === "error" ? (
          <div
            className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800"
            role="alert"
          >
            {errorMessage}
          </div>
        ) : null}
      </div>

      <p className="text-xs font-semibold text-slate-500">
        <span className="text-rose-600">*</span> Nome, nascimento, sexo e
        telefone são suficientes para iniciar.
      </p>

      <FormSection
        description="Informe os dados essenciais para criar o prontuário e iniciar a consulta."
        title="Dados obrigatórios"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Nome completo" name="fullName" required>
              <input
                autoComplete="name"
                className={inputClass}
                disabled={saving}
                id="fullName"
                name="fullName"
                required
              />
            </Field>
          </div>

          <Field label="Data de nascimento" name="birthDate" required>
            <input
              autoComplete="bday"
              className={inputClass}
              disabled={saving}
              id="birthDate"
              max={new Date().toISOString().slice(0, 10)}
              name="birthDate"
              required
              type="date"
            />
          </Field>

          <Field label="Sexo" name="sex" required>
            <select
              className={inputClass}
              defaultValue=""
              disabled={saving}
              id="sex"
              name="sex"
              required
            >
              <option disabled value="">
                Selecione
              </option>
              {patientSelectOptions.sexes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Tipo de telefone" name="phoneType" required>
            <select
              className={inputClass}
              defaultValue="MOBILE"
              disabled={saving}
              id="phoneType"
              name="phoneType"
              required
            >
              {patientSelectOptions.phoneTypes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-[88px_1fr] gap-3">
            <Field label="DDD" name="areaCode" required>
              <input
                className={inputClass}
                disabled={saving}
                id="areaCode"
                inputMode="numeric"
                maxLength={3}
                name="areaCode"
                pattern="\d{2,3}"
                required
              />
            </Field>

            <Field label="Telefone" name="phoneNumber" required>
              <input
                autoComplete="tel"
                className={inputClass}
                disabled={saving}
                id="phoneNumber"
                inputMode="tel"
                name="phoneNumber"
                pattern="[\d\s()+-]{8,20}"
                required
              />
            </Field>
          </div>
        </div>
      </FormSection>

      <details className="group overflow-hidden rounded-2xl border border-[#dce5e0] bg-white shadow-[0_8px_24px_rgb(20_55_44/0.03)]">
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 sm:px-6">
          <div>
            <h2 className="font-black text-slate-900">
              Informações complementares
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Opcionais; podem ser preenchidas posteriormente.
            </p>
          </div>
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 font-black text-slate-600 transition group-open:rotate-180"
          >
            ⌄
          </span>
        </summary>

        <div className="space-y-7 border-t border-slate-100 p-4 sm:p-6">
          <fieldset>
            <legend className="mb-4 text-sm font-black text-emerald-900">
              Identificação complementar
            </legend>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome preferido" name="preferredName">
                <input
                  className={inputClass}
                  disabled={saving}
                  id="preferredName"
                  name="preferredName"
                />
              </Field>
              <Field
                hint="Informe 11 números, caso preenchido."
                label="CPF"
                name="cpf"
              >
                <input
                  aria-describedby="cpf-hint"
                  className={inputClass}
                  disabled={saving}
                  id="cpf"
                  inputMode="numeric"
                  maxLength={14}
                  name="cpf"
                  pattern="[\d.-]{11,14}"
                  placeholder="000.000.000-00"
                />
              </Field>
              <Field label="E-mail" name="email">
                <input
                  autoComplete="email"
                  className={inputClass}
                  disabled={saving}
                  id="email"
                  name="email"
                  type="email"
                />
              </Field>
              <Field label="Estado civil" name="maritalStatus">
                <select
                  className={inputClass}
                  defaultValue=""
                  disabled={saving}
                  id="maritalStatus"
                  name="maritalStatus"
                >
                  <option value="">Não informado</option>
                  {patientSelectOptions.maritalStatuses.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Profissão" name="profession">
                <input
                  className={inputClass}
                  disabled={saving}
                  id="profession"
                  name="profession"
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Observações" name="observations">
                  <textarea
                    className={`${inputClass} min-h-24 py-3`}
                    disabled={saving}
                    id="observations"
                    maxLength={4000}
                    name="observations"
                  />
                </Field>
              </div>
            </div>
          </fieldset>

          <fieldset className="border-t border-slate-100 pt-6">
            <legend className="mb-4 text-sm font-black text-emerald-900">
              Endereço
            </legend>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <div className="sm:col-span-2 lg:col-span-4">
                <Field label="Logradouro" name="street">
                  <input
                    autoComplete="address-line1"
                    className={inputClass}
                    disabled={saving}
                    id="street"
                    name="street"
                  />
                </Field>
              </div>
              <div className="lg:col-span-2">
                <Field label="Número" name="number">
                  <input
                    className={inputClass}
                    disabled={saving}
                    id="number"
                    name="number"
                  />
                </Field>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <Field label="Complemento" name="complement">
                  <input
                    autoComplete="address-line2"
                    className={inputClass}
                    disabled={saving}
                    id="complement"
                    name="complement"
                  />
                </Field>
              </div>
              <div className="lg:col-span-3">
                <Field label="Bairro" name="neighborhood">
                  <input
                    className={inputClass}
                    disabled={saving}
                    id="neighborhood"
                    name="neighborhood"
                  />
                </Field>
              </div>
              <div className="lg:col-span-3">
                <Field label="Cidade" name="city">
                  <input
                    autoComplete="address-level2"
                    className={inputClass}
                    disabled={saving}
                    id="city"
                    name="city"
                  />
                </Field>
              </div>
              <Field label="UF" name="addressState">
                <input
                  autoComplete="address-level1"
                  className={inputClass}
                  disabled={saving}
                  id="addressState"
                  maxLength={2}
                  name="addressState"
                />
              </Field>
              <div className="lg:col-span-2">
                <Field label="CEP" name="postalCode">
                  <input
                    autoComplete="postal-code"
                    className={inputClass}
                    disabled={saving}
                    id="postalCode"
                    inputMode="numeric"
                    name="postalCode"
                    pattern="[\d-]{8,9}"
                  />
                </Field>
              </div>
            </div>
          </fieldset>

          <fieldset className="border-t border-slate-100 pt-6">
            <legend className="mb-4 text-sm font-black text-emerald-900">
              Convênio
            </legend>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Convênio" name="insuranceProvider">
                <input
                  className={inputClass}
                  disabled={saving}
                  id="insuranceProvider"
                  name="insuranceProvider"
                />
              </Field>
              <Field label="Plano" name="insurancePlan">
                <input
                  className={inputClass}
                  disabled={saving}
                  id="insurancePlan"
                  name="insurancePlan"
                />
              </Field>
              <Field label="Matrícula ou carteirinha" name="insuranceMemberNumber">
                <input
                  className={inputClass}
                  disabled={saving}
                  id="insuranceMemberNumber"
                  name="insuranceMemberNumber"
                />
              </Field>
              <Field label="Validade" name="insuranceValidUntil">
                <input
                  className={inputClass}
                  disabled={saving}
                  id="insuranceValidUntil"
                  name="insuranceValidUntil"
                  type="date"
                />
              </Field>
            </div>
          </fieldset>

          <fieldset className="border-t border-slate-100 pt-6">
            <legend className="mb-4 text-sm font-black text-emerald-900">
              Contato de emergência
            </legend>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome completo" name="emergencyName">
                <input
                  className={inputClass}
                  disabled={saving}
                  id="emergencyName"
                  name="emergencyName"
                />
              </Field>
              <Field label="Relação com o paciente" name="emergencyRelationship">
                <input
                  className={inputClass}
                  disabled={saving}
                  id="emergencyRelationship"
                  name="emergencyRelationship"
                />
              </Field>
              <Field label="Telefone" name="emergencyPhone">
                <input
                  className={inputClass}
                  disabled={saving}
                  id="emergencyPhone"
                  inputMode="tel"
                  name="emergencyPhone"
                />
              </Field>
              <Field label="E-mail" name="emergencyEmail">
                <input
                  className={inputClass}
                  disabled={saving}
                  id="emergencyEmail"
                  name="emergencyEmail"
                  type="email"
                />
              </Field>
            </div>
          </fieldset>
        </div>
      </details>

      <div className="sticky bottom-16 z-10 flex flex-col-reverse gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_-8px_30px_rgb(15_23_42/0.08)] backdrop-blur sm:bottom-4 sm:flex-row sm:justify-end">
        <Link
          aria-disabled={saving}
          className="inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold text-slate-600 hover:bg-slate-100 aria-disabled:pointer-events-none aria-disabled:opacity-50"
          href="/pacientes"
        >
          Cancelar
        </Link>
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#12664f] px-6 text-sm font-bold text-white hover:bg-[#0a4938] disabled:cursor-wait disabled:opacity-60"
          disabled={saving}
          type="submit"
        >
          {saving ? "Salvando paciente..." : "Salvar paciente"}
        </button>
      </div>
    </form>
  );
}
