import type {
  ParsedWorkoutRecord,
  WorkoutImportResult,
  WorkoutImportStore,
} from "./contracts";
import { parseAppleHealthWorkoutXml } from "./apple-health-xml";

export class WorkoutImportSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkoutImportSelectionError";
  }
}

export function previewAppleHealthWorkouts(xml: string) {
  return parseAppleHealthWorkoutXml(xml);
}

export async function importSelectedAppleHealthWorkouts(
  input: {
    readonly xml: string;
    readonly selectedIds: readonly string[];
    readonly masterRecordId: string;
    readonly importedByUserId: string;
  },
  store: WorkoutImportStore,
): Promise<WorkoutImportResult> {
  const selected = new Set(input.selectedIds);
  if (selected.size === 0) {
    throw new WorkoutImportSelectionError("Selecione ao menos um treino.");
  }

  const workouts = parseAppleHealthWorkoutXml(input.xml).filter((workout) =>
    selected.has(workout.id),
  );
  if (workouts.length !== selected.size) {
    throw new WorkoutImportSelectionError(
      "A seleção não corresponde aos treinos do arquivo.",
    );
  }
  return store.importWorkouts({
    masterRecordId: input.masterRecordId,
    importedByUserId: input.importedByUserId,
    workouts,
  });
}

export type { ParsedWorkoutRecord };
