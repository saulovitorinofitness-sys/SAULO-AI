import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";

import type {
  AppointmentDraft,
  AppointmentUpdate,
  ClinicalAppointmentView,
  SchedulingProfessionalOption,
} from "./contracts";

type Transaction = Prisma.TransactionClient;

function auditJson(value: string | null) {
  return value ?? Prisma.JsonNull;
}

const appointmentInclude = {
  masterRecord: {
    select: {
      patient: {
        select: {
          id: true,
          clinicalCode: true,
          fullName: true,
        },
      },
    },
  },
  professional: {
    select: {
      id: true,
      fullName: true,
    },
  },
  attendance: {
    select: { id: true },
  },
} as const;

const schedulingProfessionalWhere = {
  status: "ACTIVE",
  deletedAt: null,
  AND: [
    {
      OR: [
        {
          roles: {
            some: { role: { grantsAllModules: true } },
          },
        },
        {
          roles: {
            some: {
              role: {
                permissions: {
                  some: {
                    module: { key: "SCHEDULING", active: true },
                    action: "READ",
                    effect: "ALLOW",
                  },
                },
              },
            },
          },
        },
        {
          permissionOverrides: {
            some: {
              module: { key: "SCHEDULING", active: true },
              action: "READ",
              effect: "ALLOW",
            },
          },
        },
      ],
    },
    {
      permissionOverrides: {
        none: {
          module: { key: "SCHEDULING" },
          action: "READ",
          effect: "DENY",
        },
      },
    },
  ],
} as const satisfies Prisma.UserWhereInput;

export class SchedulingError extends Error {
  constructor(
    readonly code:
      | "APPOINTMENT_NOT_FOUND"
      | "CONFLICT"
      | "INVALID_IDENTITY"
      | "INVALID_PERIOD"
      | "MASTER_RECORD_NOT_FOUND"
      | "PROFESSIONAL_NOT_ALLOWED"
      | "VERSION_CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "SchedulingError";
  }
}

function toView(appointment: {
  id: string;
  masterRecordId: string | null;
  startsAt: Date;
  endsAt: Date;
  status: ClinicalAppointmentView["status"];
  notes: string | null;
  contactName: string | null;
  contactPhone: string | null;
  version: number;
  clinicalType: ClinicalAppointmentView["clinicalType"] | null;
  origin: "MANUAL" | "CLINICAL_RETURN";
  sourceAttendanceId: string | null;
  masterRecord: {
    patient: {
      id: string;
      clinicalCode: string;
      fullName: string;
    };
  } | null;
  professional: {
    id: string;
    fullName: string;
  };
  attendance: { id: string } | null;
}): ClinicalAppointmentView {
  const base = {
    id: appointment.id,
    professional: appointment.professional,
    startsAt: appointment.startsAt.toISOString(),
    endsAt: appointment.endsAt.toISOString(),
    status: appointment.status,
    notes: appointment.notes ?? undefined,
    version: appointment.version,
    attendanceId: appointment.attendance?.id,
    clinicalType: appointment.clinicalType ?? undefined,
    origin: appointment.origin,
    sourceAttendanceId: appointment.sourceAttendanceId ?? undefined,
  };

  if (appointment.masterRecord) {
    return {
      ...base,
      masterRecordId: appointment.masterRecordId as string,
      patient: {
        id: appointment.masterRecord.patient.id,
        code: appointment.masterRecord.patient.clinicalCode,
        fullName: appointment.masterRecord.patient.fullName,
      },
    };
  }

  if (appointment.contactName && appointment.contactPhone) {
    return {
      ...base,
      contactName: appointment.contactName,
      contactPhone: appointment.contactPhone,
    };
  }

  throw new SchedulingError(
    "INVALID_IDENTITY",
    "O agendamento não possui uma identificação válida.",
  );
}

function resolveIdentity(input: AppointmentDraft) {
  if (input.masterRecordId) {
    return {
      masterRecordId: input.masterRecordId,
      contactName: null,
      contactPhone: null,
    } as const;
  }

  const contactName = input.contactName?.trim();
  const contactPhone = input.contactPhone?.trim();
  if (!contactName || !contactPhone) {
    throw new SchedulingError(
      "INVALID_IDENTITY",
      "Informe um paciente cadastrado ou o nome e telefone do novo contato.",
    );
  }

  return { masterRecordId: null, contactName, contactPhone } as const;
}

function parsePeriod(input: AppointmentDraft) {
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);

  if (
    !Number.isFinite(startsAt.getTime()) ||
    !Number.isFinite(endsAt.getTime()) ||
    startsAt >= endsAt
  ) {
    throw new SchedulingError(
      "INVALID_PERIOD",
      "O horário final deve ser posterior ao horário inicial.",
    );
  }

  return { startsAt, endsAt };
}

async function schedulingModuleId(transaction: Transaction) {
  const schedulingModule = await transaction.systemModule.findFirst({
    where: { key: "SCHEDULING", active: true },
    select: { id: true },
  });

  if (!schedulingModule) {
    throw new SchedulingError(
      "PROFESSIONAL_NOT_ALLOWED",
      "O módulo de Agenda não está disponível.",
    );
  }

  return schedulingModule.id;
}

async function validateReferences(
  transaction: Transaction,
  input: AppointmentDraft,
  identity: ReturnType<typeof resolveIdentity>,
) {
  const [masterRecord, professional] = await Promise.all([
    identity.masterRecordId
      ? transaction.masterRecord.findFirst({
          where: {
            id: identity.masterRecordId,
            status: "ACTIVE",
            patient: { deletedAt: null },
          },
          select: { id: true },
        })
      : Promise.resolve(null),
    transaction.user.findFirst({
      where: {
        id: input.professionalUserId,
        ...schedulingProfessionalWhere,
      },
      select: { id: true },
    }),
  ]);

  if (identity.masterRecordId && !masterRecord) {
    throw new SchedulingError(
      "MASTER_RECORD_NOT_FOUND",
      "O Prontuário Mestre ativo do paciente não foi encontrado.",
    );
  }

  if (!professional) {
    throw new SchedulingError(
      "PROFESSIONAL_NOT_ALLOWED",
      "O profissional selecionado não está autorizado para a Agenda.",
    );
  }
}

async function assertNoConflict(
  transaction: Transaction,
  input: {
    professionalUserId: string;
    startsAt: Date;
    endsAt: Date;
    excludeId?: string;
  },
) {
  const conflict = await transaction.appointment.findFirst({
    where: {
      id: input.excludeId ? { not: input.excludeId } : undefined,
      professionalUserId: input.professionalUserId,
      deletedAt: null,
      status: { in: ["SCHEDULED", "CONFIRMED"] },
      startsAt: { lt: input.endsAt },
      endsAt: { gt: input.startsAt },
    },
    select: { id: true },
  });

  if (conflict) {
    throw new SchedulingError(
      "CONFLICT",
      "O profissional já possui um agendamento nesse horário.",
    );
  }
}

export const schedulingRepository = {
  async listForDay(
    startsAt: Date,
    endsAt: Date,
  ): Promise<readonly ClinicalAppointmentView[]> {
    const appointments = await prisma.appointment.findMany({
      where: {
        deletedAt: null,
        startsAt: { gte: startsAt, lt: endsAt },
      },
      include: appointmentInclude,
      orderBy: [
        { startsAt: "asc" },
        { professional: { fullName: "asc" } },
        { masterRecord: { patient: { fullName: "asc" } } },
      ],
    });

    return appointments.map(toView);
  },

  async listProfessionals(): Promise<
    readonly SchedulingProfessionalOption[]
  > {
    const professionals = await prisma.user.findMany({
      where: schedulingProfessionalWhere,
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        profile: {
          select: {
            professionalTitle: true,
            professionalRegistration: true,
          },
        },
      },
    });

    return professionals.map((professional) => ({
      id: professional.id,
      fullName: professional.fullName,
      professionalTitle:
        professional.profile?.professionalTitle ?? undefined,
      professionalRegistration:
        professional.profile?.professionalRegistration ?? undefined,
    }));
  },

  async create(
    input: AppointmentDraft,
    actorUserId: string,
  ): Promise<ClinicalAppointmentView> {
    const { startsAt, endsAt } = parsePeriod(input);
    const identity = resolveIdentity(input);

    return prisma.$transaction(async (transaction) => {
      await validateReferences(transaction, input, identity);
      await assertNoConflict(transaction, {
        professionalUserId: input.professionalUserId,
        startsAt,
        endsAt,
      });
      const moduleId = await schedulingModuleId(transaction);
      const appointment = await transaction.appointment.create({
        data: {
          masterRecordId: identity.masterRecordId,
          contactName: identity.contactName,
          contactPhone: identity.contactPhone,
          professionalUserId: input.professionalUserId,
          createdByUserId: actorUserId,
          updatedByUserId: actorUserId,
          moduleId,
          startsAt,
          endsAt,
          status: input.status,
          notes: input.notes,
          clinicalType: input.clinicalType,
          origin: input.origin,
          sourceAttendanceId: input.sourceAttendanceId,
          deduplicationKey: input.deduplicationKey,
          estimatedDurationMinutes: input.estimatedDurationMinutes,
        },
        include: appointmentInclude,
      });

      await transaction.auditEvent.create({
        data: {
          entityType: "Appointment",
          entityId: appointment.id,
          moduleId,
          action: "CREATE",
          createdByUserId: actorUserId,
          changedByUserId: actorUserId,
          reason: "Criação de agendamento clínico.",
          changes: {
            create: [
              ...(identity.masterRecordId
                ? [
                    {
                      fieldPath: "masterRecordId",
                      newValue: identity.masterRecordId,
                    },
                  ]
                : [
                    {
                      fieldPath: "contactName",
                      newValue: auditJson(identity.contactName),
                    },
                    {
                      fieldPath: "contactPhone",
                      newValue: auditJson(identity.contactPhone),
                    },
                  ]),
              {
                fieldPath: "professionalUserId",
                newValue: input.professionalUserId,
              },
              { fieldPath: "startsAt", newValue: startsAt.toISOString() },
              { fieldPath: "endsAt", newValue: endsAt.toISOString() },
              { fieldPath: "status", newValue: input.status },
              ...(input.notes
                ? [{ fieldPath: "notes", newValue: input.notes }]
                : []),
            ],
          },
        },
      });

      return toView(appointment);
    });
  },

  async update(
    appointmentId: string,
    input: AppointmentUpdate,
    actorUserId: string,
  ): Promise<ClinicalAppointmentView> {
    const { startsAt, endsAt } = parsePeriod(input);
    const identity = resolveIdentity(input);

    return prisma.$transaction(async (transaction) => {
      const current = await transaction.appointment.findFirst({
        where: { id: appointmentId, deletedAt: null },
      });

      if (!current) {
        throw new SchedulingError(
          "APPOINTMENT_NOT_FOUND",
          "O agendamento não foi encontrado.",
        );
      }

      if (current.version !== input.version) {
        throw new SchedulingError(
          "VERSION_CONFLICT",
          "O agendamento foi alterado por outra operação. Atualize a agenda.",
        );
      }

      await validateReferences(transaction, input, identity);
      if (["SCHEDULED", "CONFIRMED", "RESCHEDULED"].includes(input.status)) {
        await assertNoConflict(transaction, {
          professionalUserId: input.professionalUserId,
          startsAt,
          endsAt,
          excludeId: appointmentId,
        });
      }
      const moduleId = await schedulingModuleId(transaction);
      const appointment = await transaction.appointment.update({
        where: { id: appointmentId, version: input.version },
        data: {
          masterRecordId: identity.masterRecordId,
          contactName: identity.contactName,
          contactPhone: identity.contactPhone,
          professionalUserId: input.professionalUserId,
          updatedByUserId: actorUserId,
          startsAt,
          endsAt,
          status:
            current.origin === "CLINICAL_RETURN" &&
            input.status !== "CANCELLED" &&
            input.status !== "COMPLETED" &&
            input.status !== "NO_SHOW" &&
            (current.startsAt.getTime() !== startsAt.getTime() ||
              current.endsAt.getTime() !== endsAt.getTime())
              ? "RESCHEDULED"
              : input.status,
          notes: input.notes,
          version: { increment: 1 },
        },
        include: appointmentInclude,
      });

      const statusChanged = current.status !== input.status;
      await transaction.auditEvent.create({
        data: {
          entityType: "Appointment",
          entityId: appointment.id,
          moduleId,
          action: statusChanged ? "STATUS_CHANGE" : "UPDATE",
          createdByUserId: current.createdByUserId,
          changedByUserId: actorUserId,
          reason: statusChanged
            ? "Alteração do status do agendamento clínico."
            : "Atualização do agendamento clínico.",
          changes: {
            create: [
              ...(current.masterRecordId !== identity.masterRecordId
                ? [
                    {
                      fieldPath: "masterRecordId",
                      previousValue: auditJson(current.masterRecordId),
                      newValue: auditJson(identity.masterRecordId),
                    },
                  ]
                : []),
              ...(current.contactName !== identity.contactName
                ? [
                    {
                      fieldPath: "contactName",
                      previousValue: auditJson(current.contactName),
                      newValue: auditJson(identity.contactName),
                    },
                  ]
                : []),
              ...(current.contactPhone !== identity.contactPhone
                ? [
                    {
                      fieldPath: "contactPhone",
                      previousValue: auditJson(current.contactPhone),
                      newValue: auditJson(identity.contactPhone),
                    },
                  ]
                : []),
              ...(current.professionalUserId !== input.professionalUserId
                ? [
                    {
                      fieldPath: "professionalUserId",
                      previousValue: current.professionalUserId,
                      newValue: input.professionalUserId,
                    },
                  ]
                : []),
              ...(current.startsAt.getTime() !== startsAt.getTime()
                ? [
                    {
                      fieldPath: "startsAt",
                      previousValue: current.startsAt.toISOString(),
                      newValue: startsAt.toISOString(),
                    },
                  ]
                : []),
              ...(current.endsAt.getTime() !== endsAt.getTime()
                ? [
                    {
                      fieldPath: "endsAt",
                      previousValue: current.endsAt.toISOString(),
                      newValue: endsAt.toISOString(),
                    },
                  ]
                : []),
              ...(statusChanged
                ? [
                    {
                      fieldPath: "status",
                      previousValue: current.status,
                      newValue: input.status,
                    },
                  ]
                : []),
              ...((current.notes ?? "") !== (input.notes ?? "")
                ? [
                    {
                      fieldPath: "notes",
                      previousValue: current.notes ?? "",
                      newValue: input.notes ?? "",
                    },
                  ]
                : []),
            ],
          },
        },
      });

      return toView(appointment);
    });
  },
};
