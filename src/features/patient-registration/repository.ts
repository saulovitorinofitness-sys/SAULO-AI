import { randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";
import type { PatientListItem } from "@/features/mvp";
import { assertCpfAvailableForPerson } from "@/features/identity/cpf-ownership";
import type { ConsultationType } from "@/modules/attendance";

import type {
  ClinicalAttendanceTypeInput,
  InitialConsultationStep,
  PatientListPage,
  PatientListQuery,
  PatientPermanentRegistrationRead,
  PatientPermanentRegistrationUpdateInput,
  PatientRegistrationInput,
  PatientRegistrationResult,
  RegisteredPatientEntry,
} from "./contracts";
import {
  patientPermanentRegistrationUpdateSchema,
  PATIENT_LIST_PAGE_SIZE,
} from "./contracts";
import {
  planClinicalAttendance,
  resolvePatientClinicalStatus,
} from "./attendance-rules";
import {
  cancelledPreparedAttendanceState,
  preparedAttendanceState,
  startedAttendanceState,
} from "./attendance-state-machine";

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

function phoneSearchFilters(digits: string): Prisma.PatientWhereInput[] {
  if (!digits) return [];

  const withoutCountryCode =
    digits.startsWith("55") && digits.length >= 12
      ? digits.slice(2)
      : digits;
  const localNumberLength = withoutCountryCode.length >= 11 ? 9 : 8;
  const canSplitPhone = withoutCountryCode.length >= 10;
  const areaCode = canSplitPhone
    ? withoutCountryCode.slice(0, -localNumberLength)
    : "";
  const number = canSplitPhone
    ? withoutCountryCode.slice(-localNumberLength)
    : digits;

  return [
    {
      phones: {
        some: {
          status: "ACTIVE",
          OR: [
            { number: { contains: digits } },
            ...(canSplitPhone
              ? [
                  {
                    AND: [
                      { areaCode: { contains: areaCode } },
                      { number: { contains: number } },
                    ],
                  },
                ]
              : []),
          ],
        },
      },
    },
  ];
}

function patientListWhere(input: PatientListQuery): Prisma.PatientWhereInput {
  const term = input.query?.trim();
  const queryDigits = term?.replace(/\D/g, "") ?? "";

  return {
    deletedAt: null,
    masterRecord: { isNot: null },
    ...(input.status ? { status: input.status } : {}),
    ...(term
      ? {
          OR: [
            { clinicalCode: { contains: term.toUpperCase() } },
            {
              fullName: {
                contains: term,
                mode: "insensitive",
              },
            },
            ...(queryDigits
              ? [
                  { cpf: { contains: queryDigits } },
                  ...phoneSearchFilters(queryDigits),
                ]
              : []),
          ],
        }
      : {}),
  };
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

function permanentRegistrationSelect() {
  return {
    id: true,
    clinicalCode: true,
    fullName: true,
    birthDate: true,
    sex: true,
    email: true,
    phones: {
      where: { status: "ACTIVE", isPrimary: true },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        moduleId: true,
        type: true,
        countryCode: true,
        areaCode: true,
        number: true,
      },
    },
    address: {
      select: {
        id: true,
        moduleId: true,
        street: true,
        number: true,
        complement: true,
        neighborhood: true,
        city: true,
        state: true,
        postalCode: true,
        countryCode: true,
        status: true,
      },
    },
  } as const satisfies Prisma.PatientSelect;
}

type PermanentRegistrationRow = Prisma.PatientGetPayload<{
  select: ReturnType<typeof permanentRegistrationSelect>;
}>;

function permanentRegistrationWhere(
  patientId: string,
  patientModuleId: string,
): Prisma.PatientWhereInput {
  return {
    id: patientId,
    moduleId: patientModuleId,
    status: "ACTIVE",
    deletedAt: null,
    masterRecord: { is: { status: "ACTIVE" } },
  };
}

function permanentRegistrationRead(
  patient: PermanentRegistrationRow,
  patientModuleId: string,
): PatientPermanentRegistrationRead {
  const primaryPhone = patient.phones.find(
    (phone) => phone.moduleId === patientModuleId,
  );
  const address = patient.address?.status === "ACTIVE" &&
    patient.address.moduleId === patientModuleId
    ? patient.address
    : null;

  return {
    patientId: patient.id,
    clinicalCode: patient.clinicalCode,
    fullName: patient.fullName,
    birthDate: patient.birthDate.toISOString().slice(0, 10),
    sex: patient.sex,
    primaryPhone: primaryPhone
      ? {
          type: primaryPhone.type,
          countryCode: primaryPhone.countryCode,
          areaCode: primaryPhone.areaCode,
          number: primaryPhone.number,
        }
      : null,
    email: patient.email,
    address: address
      ? {
          street: address.street,
          number: address.number,
          complement: address.complement,
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          countryCode: address.countryCode,
        }
      : null,
  };
}

function hasAddressMutation(
  address: Record<string, string | null | undefined>,
) {
  return Object.values(address).some((value) => value !== undefined);
}

function hasAddressValue(
  address: Record<string, string | null | undefined>,
) {
  return Object.values(address).some(
    (value) => typeof value === "string" && value.length > 0,
  );
}

export const patientRegistrationRepository = {
  async ensureOpenAttendance(
    patientId: string,
    consultationType: ConsultationType,
    professionalUserId: string,
  ): Promise<{ attendanceId: string; created: boolean }> {
    return prisma.$transaction(async (transaction) => {
      const [professional, attendanceModule, masterRecord] =
        await Promise.all([
          transaction.user.findUnique({
            where: { id: professionalUserId },
            select: { id: true },
          }),
          transaction.systemModule.findFirst({
            where: { key: "ATTENDANCE", active: true },
            select: { id: true },
          }),
          transaction.masterRecord.findFirst({
            where: {
              patientId,
              status: "ACTIVE",
              patient: { deletedAt: null },
            },
            select: { id: true },
          }),
        ]);

      if (!professional) {
        throw new Error("Profissional autenticado não encontrado no banco.");
      }

      if (!attendanceModule) {
        throw new Error("Módulo obrigatório não configurado: ATTENDANCE.");
      }

      if (!masterRecord) {
        throw new Error("Prontuário Mestre ativo não encontrado para o paciente.");
      }

      const existingAttendance = await transaction.attendance.findFirst({
        where: {
          masterRecordId: masterRecord.id,
          status: { in: ["DRAFT", "IN_PROGRESS"] },
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

      if (existingAttendance) {
        return {
          attendanceId: existingAttendance.id,
          created: false,
        };
      }

      const now = new Date();
      const preparedState = preparedAttendanceState();
      const attendance = await transaction.attendance.create({
        data: {
          masterRecordId: masterRecord.id,
          professionalUserId,
          createdByUserId: professionalUserId,
          updatedByUserId: professionalUserId,
          moduleId: attendanceModule.id,
          consultationType,
          ...preparedState,
          idempotencyKey: `attendance:${consultationType}:${patientId}:${randomUUID()}`,
          receivedAt: now,
          timelineEvents: {
            create: [
              {
                moduleId: attendanceModule.id,
                actorUserId: professionalUserId,
                type: "PATIENT_RECEIVED",
                sequence: 1,
                occurredAt: now,
              },
              {
                moduleId: attendanceModule.id,
                actorUserId: professionalUserId,
                type: "CONSULTATION_TYPE_RECORDED",
                sequence: 2,
                occurredAt: now,
              },
            ],
          },
        },
        select: { id: true },
      });

      return {
        attendanceId: attendance.id,
        created: true,
      };
    });
  },

  async createClinicalAttendance(
    patientId: string,
    clinicalType: ClinicalAttendanceTypeInput,
    professionalUserId: string,
  ): Promise<{ attendanceId: string; created: boolean }> {
    return prisma.$transaction(async (transaction) => {
      const [professional, attendanceModule, masterRecord] = await Promise.all([
        transaction.user.findUnique({
          where: { id: professionalUserId, status: "ACTIVE", deletedAt: null },
          select: { id: true },
        }),
        transaction.systemModule.findFirst({
          where: { key: "ATTENDANCE", active: true },
          select: { id: true },
        }),
        transaction.masterRecord.findFirst({
          where: {
            patientId,
            status: "ACTIVE",
            patient: { deletedAt: null },
          },
          select: {
            id: true,
            attendances: {
              where: { deletedAt: null },
              orderBy: [
                { endedAt: { sort: "desc", nulls: "last" } },
                { createdAt: "desc" },
              ],
              select: {
                id: true,
                status: true,
                clinicalCycleId: true,
                clinicalCycleSequence: true,
              },
            },
          },
        }),
      ]);

      if (!professional) throw new Error("PROFESSIONAL_NOT_FOUND");
      if (!attendanceModule) throw new Error("ATTENDANCE_MODULE_NOT_FOUND");
      if (!masterRecord) throw new Error("PATIENT_NOT_FOUND");

      const plan = planClinicalAttendance(
        masterRecord.attendances,
        clinicalType,
        randomUUID(),
      );
      if (plan.openAttendanceId) {
        return { attendanceId: plan.openAttendanceId, created: false };
      }
      const consultationType = plan.consultationType;
      if (!consultationType) {
        throw new Error("INVALID_ATTENDANCE_PLAN");
      }
      const now = new Date();
      const preparedState = preparedAttendanceState();
      const attendance = await transaction.attendance.create({
        data: {
          masterRecordId: masterRecord.id,
          previousAttendanceId: plan.previousAttendanceId,
          professionalUserId,
          createdByUserId: professionalUserId,
          updatedByUserId: professionalUserId,
          moduleId: attendanceModule.id,
          consultationType,
          clinicalType,
          clinicalCycleId: plan.clinicalCycleId,
          clinicalCycleSequence: plan.clinicalCycleSequence,
          ...preparedState,
          idempotencyKey: `clinical-attendance:${patientId}:${randomUUID()}`,
          receivedAt: now,
          timelineEvents: {
            create: [
              {
                moduleId: attendanceModule.id,
                actorUserId: professionalUserId,
                type: "PATIENT_RECEIVED",
                sequence: 1,
                occurredAt: now,
              },
              {
                moduleId: attendanceModule.id,
                actorUserId: professionalUserId,
                type: "CONSULTATION_TYPE_RECORDED",
                sequence: 2,
                occurredAt: now,
                payload: { clinicalType },
              },
            ],
          },
        },
        select: { id: true },
      });

      return { attendanceId: attendance.id, created: true };
    }, { isolationLevel: "Serializable" });
  },

  async startClinicalAttendance(
    patientId: string,
    attendanceId: string,
    professionalUserId: string,
  ) {
    return prisma.$transaction(async (transaction) => {
      const attendance = await transaction.attendance.findFirst({
        where: {
          id: attendanceId,
          status: { in: ["DRAFT", "IN_PROGRESS"] },
          deletedAt: null,
          masterRecord: {
            patientId,
            status: "ACTIVE",
            patient: { deletedAt: null },
          },
        },
        select: { id: true, status: true, moduleId: true, startedAt: true },
      });
      if (!attendance) throw new Error("ATTENDANCE_NOT_FOUND");
      if (attendance.status === "IN_PROGRESS") {
        return { startedAt: attendance.startedAt?.toISOString(), reused: true } as const;
      }

      const now = new Date();
      const startedState = startedAttendanceState(attendance.status, now);
      const lastEvent = await transaction.attendanceTimelineEvent.aggregate({
        where: { attendanceId },
        _max: { sequence: true },
      });
      await transaction.attendance.update({
        where: { id: attendanceId },
        data: {
          ...startedState,
          updatedByUserId: professionalUserId,
          version: { increment: 1 },
        },
      });
      await transaction.attendanceTimelineEvent.create({
        data: {
          attendanceId,
          moduleId: attendance.moduleId,
          actorUserId: professionalUserId,
          type: "ATTENDANCE_STARTED",
          sequence: (lastEvent._max.sequence ?? 0) + 1,
          occurredAt: now,
        },
      });
      return { startedAt: now.toISOString(), reused: false } as const;
    }, { isolationLevel: "Serializable" });
  },

  async cancelPreparedAttendance(
    patientId: string,
    attendanceId: string,
    professionalUserId: string,
  ) {
    return prisma.$transaction(async (transaction) => {
      const attendance = await transaction.attendance.findFirst({
        where: {
          id: attendanceId,
          status: "DRAFT",
          startedAt: null,
          deletedAt: null,
          masterRecord: {
            patientId,
            status: "ACTIVE",
            patient: { deletedAt: null },
          },
        },
        select: {
          id: true,
          moduleId: true,
          entries: { where: { deletedAt: null }, select: { id: true }, take: 1 },
          pendingCheck: { select: { id: true } },
          clinicalSummary: { select: { id: true } },
          clinicalReasoningSession: { select: { id: true } },
          clinicalEvolutionSession: { select: { id: true } },
          scheduledReturn: { select: { id: true } },
        },
      });
      if (!attendance) throw new Error("ATTENDANCE_NOT_CANCELLABLE");
      if (
        attendance.entries.length ||
        attendance.pendingCheck ||
        attendance.clinicalSummary ||
        attendance.clinicalReasoningSession ||
        attendance.clinicalEvolutionSession ||
        attendance.scheduledReturn
      ) {
        throw new Error("ATTENDANCE_NOT_EMPTY");
      }

      const now = new Date();
      const cancelledState = cancelledPreparedAttendanceState("DRAFT", now);
      const lastEvent = await transaction.attendanceTimelineEvent.aggregate({
        where: { attendanceId },
        _max: { sequence: true },
      });
      await transaction.attendance.update({
        where: { id: attendanceId },
        data: {
          ...cancelledState,
          updatedByUserId: professionalUserId,
          version: { increment: 1 },
        },
      });
      await transaction.attendanceTimelineEvent.create({
        data: {
          attendanceId,
          moduleId: attendance.moduleId,
          actorUserId: professionalUserId,
          type: "ATTENDANCE_CANCELLED",
          sequence: (lastEvent._max.sequence ?? 0) + 1,
          occurredAt: now,
        },
      });
      return { cancelledAt: now.toISOString() } as const;
    }, { isolationLevel: "Serializable" });
  },

  async findPermanentRegistration(
    patientId: string,
    professionalUserId: string,
  ): Promise<PatientPermanentRegistrationRead | null> {
    const [professional, patientModule] = await Promise.all([
      prisma.user.findFirst({
        where: {
          id: professionalUserId,
          status: "ACTIVE",
          deletedAt: null,
        },
        select: { id: true },
      }),
      prisma.systemModule.findFirst({
        where: { key: "PATIENTS", active: true },
        select: { id: true },
      }),
    ]);

    if (!professional || !patientModule) return null;

    const patient = await prisma.patient.findFirst({
      where: permanentRegistrationWhere(patientId, patientModule.id),
      select: permanentRegistrationSelect(),
    });

    return patient
      ? permanentRegistrationRead(patient, patientModule.id)
      : null;
  },

  async updatePermanentRegistration(
    patientId: string,
    input: PatientPermanentRegistrationUpdateInput,
    professionalUserId: string,
  ): Promise<PatientPermanentRegistrationRead | null> {
    const update = patientPermanentRegistrationUpdateSchema.parse(input);

    return prisma.$transaction(async (transaction) => {
      const [professional, patientModule] = await Promise.all([
        transaction.user.findFirst({
          where: {
            id: professionalUserId,
            status: "ACTIVE",
            deletedAt: null,
          },
          select: { id: true },
        }),
        transaction.systemModule.findFirst({
          where: { key: "PATIENTS", active: true },
          select: { id: true },
        }),
      ]);

      if (!professional || !patientModule) return null;

      const patient = await transaction.patient.findFirst({
        where: permanentRegistrationWhere(patientId, patientModule.id),
        select: permanentRegistrationSelect(),
      });

      if (!patient) return null;

      const hasPatientMutation =
        update.fullName !== undefined ||
        update.birthDate !== undefined ||
        update.sex !== undefined ||
        update.email !== undefined;

      if (hasPatientMutation) {
        await transaction.patient.update({
          where: { id: patient.id },
          data: {
            ...(update.fullName !== undefined
              ? { fullName: update.fullName }
              : {}),
            ...(update.birthDate !== undefined
              ? { birthDate: optionalDate(update.birthDate) }
              : {}),
            ...(update.sex !== undefined ? { sex: update.sex } : {}),
            ...(update.email !== undefined ? { email: update.email } : {}),
            updatedByUserId: professionalUserId,
            version: { increment: 1 },
          },
        });
      }

      if (update.primaryPhone) {
        const currentPrimaryPhone = patient.phones.find(
          (phone) => phone.moduleId === patientModule.id,
        );
        if (!currentPrimaryPhone && patient.phones.length > 0) {
          throw new Error("PATIENT_PHONE_SCOPE_MISMATCH");
        }
        if (currentPrimaryPhone) {
          await transaction.patientPhone.update({
            where: { id: currentPrimaryPhone.id },
            data: {
              ...update.primaryPhone,
              updatedByUserId: professionalUserId,
              version: { increment: 1 },
            },
          });
        } else {
          await transaction.patientPhone.create({
            data: {
              patientId: patient.id,
              moduleId: patientModule.id,
              createdByUserId: professionalUserId,
              updatedByUserId: professionalUserId,
              isPrimary: true,
              ...update.primaryPhone,
            },
          });
        }
      }

      if (update.address && hasAddressMutation(update.address)) {
        if (patient.address && patient.address.moduleId !== patientModule.id) {
          throw new Error("PATIENT_ADDRESS_SCOPE_MISMATCH");
        }
        if (patient.address && patient.address.status !== "ACTIVE") {
          throw new Error("PATIENT_ADDRESS_INACTIVE");
        }

        if (patient.address || hasAddressValue(update.address)) {
          await transaction.patientAddress.upsert({
            where: { patientId: patient.id },
            update: {
              ...update.address,
              updatedByUserId: professionalUserId,
              version: { increment: 1 },
            },
            create: {
              patientId: patient.id,
              moduleId: patientModule.id,
              createdByUserId: professionalUserId,
              updatedByUserId: professionalUserId,
              ...update.address,
            },
          });
        }
      }

      const persisted = await transaction.patient.findFirst({
        where: permanentRegistrationWhere(patient.id, patientModule.id),
        select: permanentRegistrationSelect(),
      });

      if (!persisted) {
        throw new Error("PATIENT_REGISTRATION_NOT_AVAILABLE_AFTER_UPDATE");
      }

      return permanentRegistrationRead(persisted, patientModule.id);
    }, { isolationLevel: "Serializable" });
  },

  async register(
    input: PatientRegistrationInput,
    professionalUserId: string,
  ): Promise<PatientRegistrationResult> {
    return prisma.$transaction(async (transaction) => {
      if (input.cpf) await assertCpfAvailableForPerson(input.cpf, {}, transaction);
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

      const preparedState = preparedAttendanceState();
      const attendance = await transaction.attendance.create({
        data: {
          masterRecordId: masterRecord.id,
          professionalUserId,
          createdByUserId: professionalUserId,
          updatedByUserId: professionalUserId,
          moduleId: moduleIds.get("ATTENDANCE")!,
          consultationType: "INITIAL",
          clinicalType: "FIRST_CONSULTATION",
          ...preparedState,
          idempotencyKey: `patient-registration:${patient.id}`,
          receivedAt: now,
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
          nextSuggestedStepKey: "ANAMNESIS",
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
              where: {
                status: { in: ["DRAFT", "IN_PROGRESS"] },
                deletedAt: null,
              },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    if (!patient?.masterRecord) return null;

    const openAttendance = patient.masterRecord.attendances[0];
    const activeAttendance =
      openAttendance &&
      (openAttendance.status === "DRAFT" ||
        openAttendance.status === "IN_PROGRESS")
        ? {
            id: openAttendance.id,
            status: openAttendance.status,
            clinicalType: openAttendance.clinicalType ?? undefined,
            preparedAt: openAttendance.receivedAt.toISOString(),
            startedAt: openAttendance.startedAt?.toISOString(),
          }
        : undefined;
    const completedAttendance = await prisma.attendance.findFirst({
      where: {
        masterRecordId: patient.masterRecord.id,
        status: "COMPLETED",
        deletedAt: null,
        masterRecord: {
          patientId,
          patient: { deletedAt: null },
        },
      },
      orderBy: [
        { endedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
        { id: "asc" },
      ],
      select: {
        id: true,
        clinicalType: true,
        startedAt: true,
        receivedAt: true,
        endedAt: true,
      },
    });

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
      activeAttendance,
      historicalAttendance: completedAttendance
        ? {
            id: completedAttendance.id,
            status: "COMPLETED",
            clinicalType: completedAttendance.clinicalType ?? undefined,
            preparedAt: completedAttendance.receivedAt.toISOString(),
            startedAt: (
              completedAttendance.startedAt ?? completedAttendance.receivedAt
            ).toISOString(),
            endedAt: completedAttendance.endedAt?.toISOString(),
          }
        : undefined,
      canEdit: activeAttendance?.status === "IN_PROGRESS",
      steps: initialSteps(patient.masterRecord.continuity?.steps ?? []),
    };
  },

  async listPage(input: PatientListQuery = {}): Promise<PatientListPage> {
    const where = patientListWhere(input);
    const requestedPage = Math.max(1, Math.trunc(input.page ?? 1));
    const total = await prisma.patient.count({ where });
    const totalPages = Math.ceil(total / PATIENT_LIST_PAGE_SIZE);
    const page = totalPages > 0 ? Math.min(requestedPage, totalPages) : 1;
    const patients = await prisma.patient.findMany({
      where,
      include: {
        phones: {
          where: { status: "ACTIVE" },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          take: 1,
        },
        masterRecord: {
          include: {
            attendances: {
              where: { deletedAt: null },
              orderBy: { createdAt: "desc" },
            },
            appointments: {
              where: {
                origin: "CLINICAL_RETURN",
                status: { in: ["SCHEDULED", "CONFIRMED", "RESCHEDULED"] },
                deletedAt: null,
              },
              orderBy: { startsAt: "asc" },
              take: 1,
            },
          },
        },
      },
      orderBy: [
        { masterRecord: { continuity: { status: "asc" } } },
        {
          masterRecord: {
            continuity: {
              lastActivityAt: { sort: "desc", nulls: "last" },
            },
          },
        },
        { createdAt: "desc" },
        { id: "asc" },
      ],
      skip: (page - 1) * PATIENT_LIST_PAGE_SIZE,
      take: PATIENT_LIST_PAGE_SIZE,
    });

    const items = patients.flatMap((patient) => {
      if (!patient.masterRecord) return [];

      const attendances = patient.masterRecord.attendances;
      const openAttendance = attendances.find(
        (attendance) =>
          attendance.status === "DRAFT" || attendance.status === "IN_PROGRESS",
      );
      const latestStartedAttendance = attendances.find(
        (attendance) => attendance.startedAt !== null,
      );
      const nextReturn = patient.masterRecord.appointments[0];
      const clinicalStatus = resolvePatientClinicalStatus({
        attendances,
        hasScheduledReturn: Boolean(nextReturn),
      });

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
          openAttendanceId: openAttendance?.id,
          openAttendanceStatus:
            openAttendance?.status === "DRAFT" ||
            openAttendance?.status === "IN_PROGRESS"
              ? openAttendance.status
              : undefined,
          hasAttendanceHistory: attendances.length > 0,
          clinicalStatus,
          nextReturnAt: nextReturn?.startsAt.toISOString(),
          lastAttendanceAt: latestStartedAttendance
            ? latestStartedAttendance.startedAt!.toISOString()
            : undefined,
        } satisfies PatientListItem,
      ];
    });

    return {
      items,
      page,
      pageSize: PATIENT_LIST_PAGE_SIZE,
      total,
      totalPages,
    };
  },
};
