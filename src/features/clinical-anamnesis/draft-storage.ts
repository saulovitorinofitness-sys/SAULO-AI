import type { ClinicalAnamnesisData } from "./contracts";
import { validateClinicalAnamnesisData } from "./validation";

export interface StoredClinicalAnamnesisDraft {
  readonly schemaVersion: 1;
  readonly savedAt: string;
  readonly data: ClinicalAnamnesisData;
}

export function clinicalAnamnesisDraftStorageKey(
  patientId: string,
  attendanceId?: string,
) {
  return `saulo-ai:clinical-anamnesis-draft:v1:${encodeURIComponent(patientId)}:${encodeURIComponent(attendanceId ?? "no-attendance")}`;
}

export function serializeClinicalAnamnesisDraft(data: ClinicalAnamnesisData) {
  return JSON.stringify({
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    data,
  } satisfies StoredClinicalAnamnesisDraft);
}

export function parseClinicalAnamnesisDraft(
  raw: string,
): StoredClinicalAnamnesisDraft | null {
  if (!raw || raw.length > 1_000_000) return null;
  try {
    const candidate: unknown = JSON.parse(raw);
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return null;
    }
    const source = candidate as Record<string, unknown>;
    const validation = validateClinicalAnamnesisData(source.data);
    if (
      source.schemaVersion !== 1 ||
      typeof source.savedAt !== "string" ||
      Number.isNaN(Date.parse(source.savedAt)) ||
      !validation.success
    ) {
      return null;
    }
    return {
      schemaVersion: 1,
      savedAt: source.savedAt,
      data: validation.data,
    };
  } catch {
    return null;
  }
}
