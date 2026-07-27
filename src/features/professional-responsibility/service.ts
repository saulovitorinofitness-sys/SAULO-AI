import type { ModuleKey } from "@/modules/shared";
import { prisma } from "@/lib/database/prisma";

import type {
  AttendanceProfessionalParticipant,
  ProfessionalIdentity,
} from "./contracts";

function identity(user: {
  id: string;
  fullName: string;
  profile: {
    professionalTitle: string | null;
    professionalRegistration: string | null;
    professionalPhone: string | null;
    professionalInstagram: string | null;
  } | null;
}): ProfessionalIdentity {
  return {
    userId: user.id,
    fullName: user.fullName,
    professionalTitle: user.profile?.professionalTitle ?? undefined,
    professionalRegistration:
      user.profile?.professionalRegistration ?? undefined,
    phone: user.profile?.professionalPhone ?? undefined,
    instagram: user.profile?.professionalInstagram ?? undefined,
  };
}

const professionalSelect = {
  id: true,
  fullName: true,
  profile: {
    select: {
      professionalTitle: true,
      professionalRegistration: true,
      professionalPhone: true,
      professionalInstagram: true,
    },
  },
} as const;

export const professionalResponsibilityService = {
  async getProfessional(
    userId: string,
  ): Promise<ProfessionalIdentity | null> {
    const user = await prisma.user.findFirst({
      where: { id: userId, status: "ACTIVE", deletedAt: null },
      select: professionalSelect,
    });
    return user ? identity(user) : null;
  },

  async listAttendanceParticipants(input: {
    readonly masterRecordId: string;
    readonly attendanceId?: string;
  }): Promise<readonly AttendanceProfessionalParticipant[]> {
    const entries = await prisma.masterRecordEntry.findMany({
      where: {
        masterRecordId: input.masterRecordId,
        attendanceId: input.attendanceId,
        deletedAt: null,
        status: { not: "VOIDED" },
      },
      orderBy: { occurredAt: "asc" },
      select: {
        id: true,
        occurredAt: true,
        module: { select: { key: true, name: true } },
        updatedBy: { select: professionalSelect },
      },
    });
    const versions = entries.length
      ? await prisma.recordVersion.findMany({
          where: { entityId: { in: entries.map((entry) => entry.id) } },
          orderBy: { createdAt: "asc" },
          select: {
            createdAt: true,
            module: { select: { key: true, name: true } },
            responsible: { select: professionalSelect },
          },
        })
      : [];
    const sources = [
      ...versions.map((version) => ({
        occurredAt: version.createdAt,
        module: version.module,
        professional: version.responsible,
      })),
      ...entries
        .filter(
          (entry) =>
            entry.module.key !== "MASTER_RECORD" &&
            !versions.some(
              (version) =>
                version.module.key === entry.module.key &&
                version.responsible.id === entry.updatedBy.id,
            ),
        )
        .map((entry) => ({
          occurredAt: entry.occurredAt,
          module: entry.module,
          professional: entry.updatedBy,
        })),
    ];

    const participants = new Map<
      string,
      AttendanceProfessionalParticipant
    >();
    for (const source of sources) {
      const current = participants.get(source.professional.id);
      const moduleKey = source.module.key as ModuleKey;
      const modules = [
        ...(current?.modules ?? []),
        {
          moduleKey,
          moduleName: source.module.name,
          executedAt: source.occurredAt.toISOString(),
        },
      ].filter(
        (module, index, all) =>
          all.findIndex(
            (candidate) =>
              candidate.moduleKey === module.moduleKey,
          ) === index,
      );

      participants.set(source.professional.id, {
        ...identity(source.professional),
        modules,
      });
    }

    return [...participants.values()];
  },
};
