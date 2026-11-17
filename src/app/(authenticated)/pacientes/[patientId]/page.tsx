import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PatientNavigation } from "@/components/master-record/patient-navigation";
import { ClinicalFlowNavigation } from "@/components/nutrition-clinical-flow/clinical-flow-navigation";
import { InitialConsultationProgress } from "@/components/patients/initial-consultation-progress";
import { NewAttendanceDialog } from "@/components/patients/new-attendance-dialog";
import { PageState } from "@/components/ui/page-state";
import {
  CLINICAL_COLLECTION_SCENARIO_KEYS,
  type ClinicalCollectionScenarioKey,
} from "@/features/clinical-collection";
import { canAccess, mvpService } from "@/features/mvp";
import { DEMO_PATIENT_ID } from "@/features/mvp/mock-data";
import { nutritionClinicalFlowRepository } from "@/features/nutrition-clinical-flow/repository";
import {
  isVisibleNutritionClinicalFlowStep,
  NUTRITION_CLINICAL_FLOW_CLOSURE_STEP_IDS,
} from "@/features/nutrition-clinical-flow/flow";
import { patientHubService } from "@/features/patient-hub";
import { patientRegistrationRepository } from "@/features/patient-registration";

export const metadata: Metadata = { title: "Prontuário Mestre" };

const PatientHubLazy = dynamic(
  () =>
    import("@/components/patient-hub/patient-hub").then(
      (module) => module.PatientHub,
    ),
  {
    loading: () => (
      <PageState
        description="Carregando o painel central do paciente."
        title="Prontuário Mestre"
      />
    ),
  },
);

export default async function MasterRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{ scenario?: string; registered?: string }>;
}) {
  const [{ patientId }, query] = await Promise.all([params, searchParams]);
  const access = await mvpService.getSession();

  if (!canAccess(access, "MASTER_RECORD", "READ")) {
    return (
      <PageState
        description="Seu perfil não possui acesso ao Prontuário Mestre."
        title="Acesso não permitido"
        tone="blocked"
      />
    );
  }

  if (patientId !== DEMO_PATIENT_ID) {
    if (query.scenario) {
      redirect(
        `/pacientes/${patientId}${query.registered === "1" ? "?registered=1" : ""}`,
      );
    }
    const patient = await patientRegistrationRepository.findEntry(patientId);
    if (!patient) notFound();
    const selectedAttendance =
      patient.activeAttendance ?? patient.historicalAttendance;
    const flow = selectedAttendance
      ? await nutritionClinicalFlowRepository.getFlow({
          patientId,
          attendanceId: selectedAttendance.id,
        })
      : null;

    if (patient.activeAttendance?.status === "IN_PROGRESS" && flow) {
      const isReturnAttendance =
        patient.activeAttendance.clinicalType === "RETURN";
      const applicableNavigationFlow = isReturnAttendance
        ? flow.flow.filter((step) => step.id !== "PATIENT_REGISTRATION")
        : flow.flow;
      const activeNavigationStep = isReturnAttendance
        ? applicableNavigationFlow.find(
            (step) => step.id === flow.resumeStep.id,
          ) ?? applicableNavigationFlow[0]
        : flow.flow.find((step) => step.id === "PATIENT_REGISTRATION");

      if (!activeNavigationStep) notFound();

      return (
        <ClinicalFlowNavigation
          activeStep={activeNavigationStep.id}
          flow={applicableNavigationFlow}
          patient={{
            id: patientId,
            name: patient.fullName,
            code: patient.clinicalCode,
          }}
        >
          <InitialConsultationProgress
            flow={flow.flow}
            patient={patient}
            registered={query.registered === "1"}
          />
        </ClinicalFlowNavigation>
      );
    }

    return (
      <div className="space-y-5">
        {canAccess(access, "PATIENTS", "UPDATE") ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
            <h2 className="text-lg font-black text-slate-900">
              Portal do Aluno
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              Gere o convite individual e controle quais conteÃºdos finalizados
              estÃ£o liberados para este aluno.
            </p>
            <Link
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              href={`/pacientes/${patientId}/portal-aluno`}
            >
              Gerenciar Portal do Aluno
            </Link>
          </section>
        ) : null}
        <InitialConsultationProgress
          patient={patient}
          registered={query.registered === "1"}
        />
        {patient.historicalAttendance && !patient.activeAttendance ? (
          <section aria-labelledby="historical-attendance-title" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <h2 className="text-lg font-black text-slate-900" id="historical-attendance-title">
              Visualização histórica
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Atendimento concluído. As etapas abaixo são exibidas somente para consulta.
            </p>
            {flow ? (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {flow.flow
                  .filter(
                    (step) =>
                      isVisibleNutritionClinicalFlowStep(step) &&
                      (step.id === "FINALIZE_ATTENDANCE" ||
                        NUTRITION_CLINICAL_FLOW_CLOSURE_STEP_IDS.some(
                          (clinicalStepId) => clinicalStepId === step.id,
                        )),
                  )
                  .map((step) => (
                  <li className="rounded-xl border border-slate-200 p-3 text-sm" key={step.id}>
                    <span className="font-bold text-slate-900">{step.title}</span>
                    <span className="ml-2 text-slate-600">
                      {step.status === "COMPLETED"
                        ? "Concluída"
                        : step.status === "SKIPPED"
                          ? "Não realizada"
                          : "Não concluída"}
                    </span>
                  </li>
                  ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-600">
                As etapas deste atendimento não estão disponíveis para exibição.
              </p>
            )}
          </section>
        ) : null}
        {!patient.activeAttendance && canAccess(access, "ATTENDANCE", "CREATE") ? (
          <NewAttendanceDialog
            hasHistory={Boolean(patient.historicalAttendance)}
            patientId={patientId}
            patientName={patient.fullName}
          />
        ) : null}
      </div>
    );
  }

  const scenario = CLINICAL_COLLECTION_SCENARIO_KEYS.includes(
    query.scenario as ClinicalCollectionScenarioKey,
  )
    ? (query.scenario as ClinicalCollectionScenarioKey)
    : "complete";
  const hub = await patientHubService.get({ patientId, scenario });

  if (!hub) notFound();

  return (
    <>
      <PatientNavigation currentModule="SUMMARY" initialHub={hub} />
      <PatientHubLazy initialHub={hub} />
    </>
  );
}
