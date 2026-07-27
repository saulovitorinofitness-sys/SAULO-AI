import { prisma } from "@/lib/database/prisma";
import type { PatientListItem } from "@/features/mvp";

import type {
  InitialConsultationStep,
  PatientRegistrationInput,
  PatientRegistrationResult,
  RegisteredPatientEntry,
} from "./contracts";

const REQUIRED_MODULE_KEYS = [
  "PATIENTS",
  "MASTER_RECORD",
  "ATTENDANCE",
  "NUTRITION_STRATEGY",
  "MEAL_PLAN",
  "DELIVERABLES",
] as const;

type RequiredModuleKey = (typeof REQUIRED_MODULE_KEYS)[number];

function optionalDate(value?: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

function calculateAge(birthDate: Date) {
  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDifference = today.getUTCMonth() - birthDate.getUTCMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getUTCDate() < birthDate.getUTCDate())
  ) {
    age -= 1;
  }

  return age;
}

function phoneLabel(
  phone:
    | {
        countryCode: string;
        areaCode: string;
        number: string;
      }
    | undefined,
) {
  if (!phone) return "";

  const prefix = phone.countryCode === "55" ? "" : `+${phone.countryCode} `;
  const localNumber =
    phone.number.length === 9
      ? `${phone.number.slice(0, 5)}-${phone.number.slice(5)}`
      : phone.number.length === 8
        ? `${phone.number.slice(0, 4)}-${phone.number.slice(4)}`
        : phone.number;

  return `${prefix}(${phone.areaCode}) ${localNumber}`;
}

function moduleMap(
  modules: readonly {
    id: string;
    key: string;
  }[],
) {
  const ids = new Map(modules.map((module) => [module.key, module.id]));

  for (const key of REQUIRED_MODULE_KEYS) {
    if (!ids.has(key)) {
      throw new Error(`Módulo obrigatório não configurado: ${key}.`);
    }
  }

  return ids as Map<RequiredModuleKey, string>;
}

function initialSteps(
  steps: readonly {
    key: string;
    title: string;
    status: string;
  }[],
): readonly InitialConsultationStep[] {
  const expected = [
    ["PATIENT_REGISTRATION", "Cadastro"],
    ["ASSESSMENT", "Avaliação"],
    ["NUTRITION_STRATEGY", "Estratégia nutricional"],
    ["MEAL_PLAN", "Plano alimentar"],
    ["DELIVERABLES", "Entregáveis"],
    ["FINALIZATION", "Finalização"],
  ] as const;

  return expected.map(([key, label]) => {
    const persisted = steps.find((step) => step.key === key);

    return {
      key,
      label,
      status: persisted?.status === "COMPLETED" ? "COMPLETED" : "PENDING",
    };
  });
}

export const patientRegistrationRepository = {
  async register(
    input: PatientRegistrationInput,
    professionalUserId: string,
  ): Promise<PatientRegistrationResult> {
    return prisma.$transaction(async (transaction) => {
      const [professional, modules] = await Promise.all([
        transaction.user.findUnique({
          where: { id: professionalUserId },
          select: { id: true },
        }),
        transaction.systemModule.findMany({
          where: { key: { in: [...REQUIRED_MODULE_KEYS] }, active: true },
          select: { id: true, key: true },
        }),
      ]);

      if (!professional) {
        throw new Error("Profissional autenticado não encontrado no banco.");
      }

      const moduleIds = moduleMap(modules);
      const now = new Date();
      const [sequence] = await transaction.$queryRaw<
        { nextValue: bigint }[]
      >`SELECT nextval('"Patient_clinicalCode_seq"') AS "nextValue"`;

      if (!sequence) {
        throw new Error("Não foi possível gerar o código clínico do paciente.");
      }

      const numericCode = Number(sequence.nextValue);

      if (!Number.isSafeInteger(numericCode) || numericCode > 999999) {
        throw new Error("A sequência de códigos clínicos SV atingiu o limite.");
      }

      const clinicalCode = `SV${String(numericCode).padStart(6, "0")}`;

      const patient = await transaction.patient.create({
        data: {
          clinicalCode,
          fullName: input.fullName,
          preferredName: input.preferredName,
          cpf: input.cpf,
          sex: input.sex,
          birthDate: optionalDate(input.birthDate)!,
          email: input.email,
          maritalStatus: input.maritalStatus,
          profession: input.profession,
          observations: input.observations,
          moduleId: moduleIds.get("PATIENTS")!,
          registeredByUserId: professionalUserId,
          updatedByUserId: professionalUserId,
          phones: {
            create: {
              type: input.phone.type,
              countryCode: input.phone.countryCode,
              areaCode: input.phone.areaCode,
              number: input.phone.number,
              isPrimary: true,
              moduleId: moduleIds.get("PATIENTS")!,
              createdByUserId: professionalUserId,
              updatedByUserId: professionalUserId,
            },
          },
          address: input.address
            ? {
                create: {
                  ...input.address,
                  moduleId: moduleIds.get("PATIENTS")!,
                  createdByUserId: professionalUserId,
                  updatedByUserId: professionalUserId,
                },
              }
            : undefined,
          insurance: input.insurance
            ? {
                create: {
                  ...input.insurance,
                  validUntil: optionalDate(input.insurance.validUntil),
                  moduleId: moduleIds.get("PATIENTS")!,
                  createdByUserId: professionalUserId,
                  updatedByUserId: professionalUserId,
                },
              }
            : undefined,
          emergencyContacts: input.emergencyContact
            ? {
                create: {
                  ...input.emergencyContact,
                  isPrimary: true,
                  moduleId: moduleIds.get("PATIENTS")!,
                  createdByUserId: professionalUserId,
                  updatedByUserId: professionalUserId,
                },
              }
            : undefined,
        },
        select: { id: true, clinicalCode: true, createdAt: true },
      });

      const masterRecord = await transaction.masterRecord.create({
        data: {
          patientId: patient.id,
          moduleId: moduleIds.get("MASTER_RECORD")!,
          responsibleUserId: professionalUserId,
          createdByUserId: professionalUserId,
          updatedByUserId: professionalUserId,
        },
        select: { id: true },
      });

      const attendance = await transaction.attendance.create({
        data: {
          masterRecordId: masterRecord.id,
          professionalUserId,
          createdByUserId: professionalUserId,
          updatedByUserId: professionalUserId,
          moduleId: moduleIds.get("ATTENDANCE")!,
          consultationType: "INITIAL",
          currentStage: "IN_PROGRESS",
          idempotencyKey: `patient-registration:${patient.id}`,
          status: "IN_PROGRESS",
          receivedAt: now,
          startedAt: now,
          timelineEvents: {
            create: [
              {
                moduleId: moduleIds.get("ATTENDANCE")!,
                actorUserId: professionalUserId,
                type: "PATIENT_RECEIVED",
                sequence: 1,
                occurredAt: now,
              },
              {
                moduleId: moduleIds.get("MASTER_RECORD")!,
                actorUserId: professionalUserId,
                type: "MASTER_RECORD_LOADED",
                sequence: 2,
                occurredAt: now,
              },
              {
                moduleId: moduleIds.get("ATTENDANCE")!,
                actorUserId: professionalUserId,
                type: "CONSULTATION_TYPE_RECORDED",
                sequence: 3,
                occurredAt: now,
              },
              {
                moduleId: moduleIds.get("ATTENDANCE")!,
                actorUserId: professionalUserId,
                type: "ATTENDANCE_STARTED",
                sequence: 4,
                occurredAt: now,
              },
            ],
          },
        },
        select: { id: true },
      });

      await transaction.masterRecordContinuity.create({
        data: {
          masterRecordId: masterRecord.id,
          moduleId: moduleIds.get("MASTER_RECORD")!,
          lastCompletedStepKey: "PATIENT_REGISTRATION",
          responsibleUserId: professionalUserId,
          lastActivityAt: now,
          nextSuggestedStepKey: "ASSESSMENT",
          suggestionSource: "WORKFLOW",
          createdByUserId: professionalUserId,
          updatedByUserId: professionalUserId,
          steps: {
            create: [
              {
                key: "PATIENT_REGISTRATION",
                title: "Cadastro",
                status: "COMPLETED",
                sortOrder: 1,
                moduleId: moduleIds.get("PATIENTS")!,
                responsibleUserId: professionalUserId,
                completedByUserId: professionalUserId,
                completedAt: now,
                createdByUserId: professionalUserId,
                updatedByUserId: professionalUserId,
              },
              {
                key: "ASSESSMENT",
                title: "Avaliação",
                sortOrder: 2,
                moduleId: moduleIds.get("MASTER_RECORD")!,
                responsibleUserId: professionalUserId,
                createdByUserId: professionalUserId,
                updatedByUserId: professionalUserId,
              },
              {
                key: "NUTRITION_STRATEGY",
                title: "Estratégia nutricional",
                sortOrder: 3,
                moduleId: moduleIds.get("NUTRITION_STRATEGY")!,
                responsibleUserId: professionalUserId,
                createdByUserId: professionalUserId,
                updatedByUserId: professionalUserId,
              },
              {
                key: "MEAL_PLAN",
                title: "Plano alimentar",
                sortOrder: 4,
                moduleId: moduleIds.get("MEAL_PLAN")!,
                responsibleUserId: professionalUserId,
                createdByUserId: professionalUserId,
                updatedByUserId: professionalUserId,
              },
              {
                key: "DELIVERABLES",
                title: "Entregáveis",
                sortOrder: 5,
                moduleId: moduleIds.get("DELIVERABLES")!,
                responsibleUserId: professionalUserId,
                createdByUserId: professionalUserId,
                updatedByUserId: professionalUserId,
              },
              {
                key: "FINALIZATION",
                title: "Finalização",
                sortOrder: 6,
                moduleId: moduleIds.get("ATTENDANCE")!,
                responsibleUserId: professionalUserId,
                createdByUserId: professionalUserId,
                updatedByUserId: professionalUserId,
              },
            ],
          },
        },
      });

      await transaction.auditEvent.create({
        data: {
          entityType: "Patient",
          entityId: patient.id,
          moduleId: moduleIds.get("PATIENTS")!,
          action: "CREATE",
          createdByUserId: professionalUserId,
          changedByUserId: professionalUserId,
          reason: "Cadastro real de paciente e abertura da consulta inicial.",
          changes: {
            create: [
              {
                fieldPath: "clinicalCode",
                newValue: patient.clinicalCode,
              },
              {
                fieldPath: "status",
                newValue: "ACTIVE",
              },
              {
                fieldPath: "masterRecord",
                newValue: masterRecord.id,
              },
              {
                fieldPath: "initialAttendance",
                newValue: attendance.id,
              },
            ],
          },
        },
      });

      return {
        patientId: patient.id,
        clinicalCode: patient.clinicalCode,
        masterRecordId: masterRecord.id,
        attendanceId: attendance.id,
        createdAt: patient.createdAt.toISOString(),
      };
    });
  },

  async findEntry(patientId: string): Promise<RegisteredPatientEntry | null> {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId, deletedAt: null },
      include: {
        phones: {
          where: { status: "ACTIVE" },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          take: 1,
        },
        masterRecord: {
          include: {
            continuity: {
              include: { steps: { orderBy: { sortOrder: "asc" } } },
            },
            attendances: {
              where: { status: { in: ["DRAFT", "IN_PROGRESS"] } },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    const attendance = patient?.masterRecord?.attendances[0];

    if (!patient?.masterRecord || !attendance) return null;

    return {
      patientId: patient.id,
      clinicalCode: patient.clinicalCode,
      fullName: patient.fullName,
      preferredName: patient.preferredName ?? undefined,
      birthDate: patient.birthDate.toISOString().slice(0, 10),
      age: calculateAge(patient.birthDate),
      sex: patient.sex,
      phone: phoneLabel(patient.phones[0]),
      masterRecordId: patient.masterRecord.id,
      attendanceId: attendance.id,
      attendanceStartedAt: (
        attendance.startedAt ?? attendance.receivedAt
      ).toISOString(),
      steps: initialSteps(patient.masterRecord.continuity?.steps ?? []),
    };
  },

  async list(query?: string): Promise<readonly PatientListItem[]> {
    const term = query?.trim();
    const queryDigits = term?.replace(/\D/g, "") ?? "";

    const patients = await prisma.patient.findMany({
      where: {
        deletedAt: null,
        ...(term
          ? {
              OR: [
                { clinicalCode: { contains: term.toUpperCase() } },
                {
                  fullName: {
                    contains: term,
                    mode: "insensitive" as const,
                  },
                },
                ...(queryDigits
                  ? [
                      { cpf: { contains: queryDigits } },
                      {
                        phones: {
                          some: {
                            status: "ACTIVE" as const,
                            OR: [
                              { number: { contains: queryDigits } },
                              { areaCode: { contains: queryDigits } },
                            ],
                          },
                        },
                      },
                    ]
                  : []),
              ],
            }
          : {}),
      },
      include: {
        phones: {
          where: { status: "ACTIVE" },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          take: 1,
        },
        masterRecord: {
          include: {
            continuity: {
              include: {
                responsible: {
                  select: { fullName: true },
                },
                steps: {
                  where: { status: { not: "COMPLETED" } },
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
            attendances: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return patients.flatMap((patient) => {
      if (!patient.masterRecord) return [];

      const attendance = patient.masterRecord.attendances[0];
      const pending = patient.masterRecord.continuity?.steps ?? [];

      return [
        {
          patient: {
            id: patient.id,
            fullName: patient.fullName,
            cpf: patient.cpf ?? undefined,
            status: patient.status,
          },
          code: patient.clinicalCode,
          age: calculateAge(patient.birthDate),
          primaryPhone: phoneLabel(patient.phones[0]),
          masterRecordId: patient.masterRecord.id,
          openAttendanceId:
            attendance?.status === "DRAFT" ||
            attendance?.status === "IN_PROGRESS"
              ? attendance.id
              : undefined,
          lastAttendanceAt: attendance?.createdAt.toISOString(),
          completionPercentage: Math.round(((6 - pending.length) / 6) * 100),
          currentStep: pending[0]?.title ?? "Atendimento concluído",
          currentResponsibleName:
            patient.masterRecord.continuity?.responsible?.fullName,
          nextStep: pending[1]?.title ?? "Finalizar atendimento",
          workflowStatus: pending.length ? "IN_PROGRESS" : "COMPLETED",
          pendingStepsCount: pending.length,
          workflowUpdatedAt: patient.masterRecord.updatedAt.toISOString(),
        } satisfies PatientListItem,
      ];
    });
  },
};
