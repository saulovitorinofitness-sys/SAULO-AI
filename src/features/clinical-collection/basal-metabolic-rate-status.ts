import type { PatientSex } from "@/modules/patients";

export function basalMetabolicRateMissingReason(input: {
  readonly recordedValue?: number;
  readonly ageYears?: number;
  readonly sex?: PatientSex;
  readonly weightKg?: number;
  readonly heightCm?: number;
  readonly protocolDefined?: boolean;
}) {
  if (input.recordedValue && input.recordedValue > 0) return undefined;
  if (input.ageYears === undefined) {
    return "Não calculada: data de nascimento não informada.";
  }
  if (!input.sex || input.sex === "NOT_INFORMED") {
    return "Não calculada: sexo não informado.";
  }
  if (!input.weightKg || input.weightKg <= 0) {
    return "Não calculada: peso não informado na Antropometria.";
  }
  if (!input.heightCm || input.heightCm <= 0) {
    return "Não calculada: altura não informada na Antropometria.";
  }
  if (!input.protocolDefined) {
    return "Não calculada: protocolo de TMB não definido.";
  }
  return undefined;
}
