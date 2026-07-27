import type { Metadata } from "next";
import Link from "next/link";

import { PatientList } from "@/components/patients/patient-list";
import { PlusIcon } from "@/components/ui/icons";
import { PageHeading } from "@/components/ui/page-heading";
import { PageState } from "@/components/ui/page-state";
import { canAccess, mvpService } from "@/features/mvp";
import { patientRegistrationRepository } from "@/features/patient-registration";

export const metadata: Metadata = { title: "Pacientes" };

function resolveInternalReturnTo(value?: string | string[]) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return undefined;
  }

  try {
    const internalOrigin = "https://sistema-sv.internal";
    const url = new URL(value, internalOrigin);

    if (url.origin !== internalOrigin) {
      return undefined;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return undefined;
  }
}

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const query = await searchParams;
  const returnTo = resolveInternalReturnTo(query.returnTo);
  const [access, patients] = await Promise.all([
    mvpService.getSession(),
    patientRegistrationRepository.list(),
  ]);

  if (!canAccess(access, "PATIENTS", "READ")) {
    return <PageState description="Seu perfil não possui acesso à lista de pacientes. Solicite a revisão das permissões ao administrador." title="Acesso não permitido" tone="blocked" />;
  }

  return (
    <>
      <PageHeading
        action={
          returnTo || canAccess(access, "PATIENTS", "CREATE") ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {returnTo ? (
                <Link
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                  href={returnTo}
                >
                  Voltar para Clínica SV
                </Link>
              ) : null}

              {canAccess(access, "PATIENTS", "CREATE") ? (
                <Link
                  className="hidden min-h-11 items-center gap-2 rounded-xl bg-[#12664f] px-4 text-sm font-bold text-white hover:bg-[#0a4938] sm:inline-flex"
                  href="/pacientes/novo"
                >
                  <PlusIcon className="size-4" />
                  Novo paciente
                </Link>
              ) : null}
            </div>
          ) : null
        }
        description="Localize um cadastro único e retome o cuidado do ponto certo."
        eyebrow="Cadastro compartilhado"
        title="Pacientes"
      />
      {patients.length === 0 ? <PageState description="Quando o primeiro cadastro for integrado, ele aparecerá aqui." title="Nenhum paciente cadastrado" /> : <PatientList patients={patients} returnTo={returnTo} />}
    </>
  );
}
