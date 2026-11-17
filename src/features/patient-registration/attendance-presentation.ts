import type { ClinicalAttendanceTypeInput } from "./contracts";

const clinicalAttendanceTypeLabels: Readonly<
  Record<ClinicalAttendanceTypeInput, string>
> = {
  FIRST_CONSULTATION: "Primeira consulta",
  RETURN: "Retorno",
  REASSESSMENT: "Reavaliação",
  FOLLOW_UP: "Acompanhamento",
  SINGLE_CONSULTATION: "Consulta avulsa",
};

export function clinicalAttendanceTypeLabel(
  clinicalType: ClinicalAttendanceTypeInput | undefined,
) {
  return clinicalType
    ? clinicalAttendanceTypeLabels[clinicalType]
    : "Tipo não informado";
}
