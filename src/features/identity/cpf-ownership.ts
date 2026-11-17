import { createHash, createHmac } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";

type CpfLookupClient = Pick<
  Prisma.TransactionClient,
  "patient" | "employee" | "professionalServiceLegalProvider"
>;

export class CpfOwnershipError extends Error {
  readonly code = "CPF_ALREADY_ASSIGNED";

  constructor() {
    super("Este CPF já pertence a outra pessoa no sistema.");
    this.name = "CpfOwnershipError";
  }
}

export interface CpfOwnershipExclusions {
  readonly patientId?: string;
  readonly userId?: string;
  readonly employeeId?: string;
  readonly providerId?: string;
}

function cpfHash(cpf: string): string {
  const secret = process.env.PAYROLL_DATA_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 32) throw new Error("PROTECTION_KEY_UNAVAILABLE");
  const key = createHash("sha256").update(secret).digest();
  return createHmac("sha256", key).update(cpf, "utf8").digest("hex");
}

export async function assertCpfAvailableForPerson(
  value: string,
  exclusions: CpfOwnershipExclusions = {},
  client: CpfLookupClient = prisma,
): Promise<void> {
  const cpf = value.replace(/\D/gu, "");
  const hash = cpfHash(cpf);
  const [patient, employee, provider] = await Promise.all([
    client.patient.findFirst({
      where: { cpf, ...(exclusions.patientId ? { id: { not: exclusions.patientId } } : {}) },
      select: { id: true },
    }),
    client.employee.findFirst({
      where: {
        taxIdentifierHash: hash,
        ...(exclusions.employeeId ? { id: { not: exclusions.employeeId } } : {}),
        ...(exclusions.userId ? { OR: [{ userId: null }, { userId: { not: exclusions.userId } }] } : {}),
      },
      select: { id: true },
    }),
    client.professionalServiceLegalProvider.findFirst({
      where: {
        taxIdType: "CPF",
        taxIdHash: hash,
        ...(exclusions.providerId ? { id: { not: exclusions.providerId } } : {}),
        ...(exclusions.userId ? { OR: [{ userId: null }, { userId: { not: exclusions.userId } }] } : {}),
      },
      select: { id: true },
    }),
  ]);
  if (patient || employee || provider) throw new CpfOwnershipError();
}
