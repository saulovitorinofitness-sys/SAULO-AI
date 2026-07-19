import type { BodyRegion, PerimetryMeasurementDefinition } from "./contracts";

export const bodyRegionLabels: Readonly<Record<BodyRegion, string>> = { TRUNK: "Tronco", UPPER_LIMBS: "Membros superiores", LOWER_LIMBS: "Membros inferiores" };

export const perimetryMeasurementDefinitions: readonly PerimetryMeasurementDefinition[] = [
  { key: "neck", label: "Pescoço", region: "TRUNK", sourceField: "neckCm" },
  { key: "shoulders", label: "Ombros", region: "TRUNK", sourceField: "shouldersCm" },
  { key: "chest", label: "Tórax", region: "TRUNK", sourceField: "chestCm" },
  { key: "waist", label: "Cintura", region: "TRUNK", sourceField: "waistCm" },
  { key: "abdomen", label: "Abdômen", region: "TRUNK", sourceField: "abdomenCm" },
  { key: "hipGlutes", label: "Quadril / glúteos", region: "TRUNK", sourceField: "hipCm" },
  { key: "rightArmRelaxed", label: "Braço direito relaxado", region: "UPPER_LIMBS", side: "RIGHT", sourceField: "rightArmCm" },
  { key: "leftArmRelaxed", label: "Braço esquerdo relaxado", region: "UPPER_LIMBS", side: "LEFT", sourceField: "leftArmCm" },
  { key: "rightArmContracted", label: "Braço direito contraído", region: "UPPER_LIMBS", side: "RIGHT" },
  { key: "leftArmContracted", label: "Braço esquerdo contraído", region: "UPPER_LIMBS", side: "LEFT" },
  { key: "rightForearm", label: "Antebraço direito", region: "UPPER_LIMBS", side: "RIGHT", sourceField: "rightForearmCm" },
  { key: "leftForearm", label: "Antebraço esquerdo", region: "UPPER_LIMBS", side: "LEFT", sourceField: "leftForearmCm" },
  { key: "rightWrist", label: "Punho direito", region: "UPPER_LIMBS", side: "RIGHT" },
  { key: "leftWrist", label: "Punho esquerdo", region: "UPPER_LIMBS", side: "LEFT" },
  { key: "rightProximalThigh", label: "Coxa proximal direita", region: "LOWER_LIMBS", side: "RIGHT" },
  { key: "leftProximalThigh", label: "Coxa proximal esquerda", region: "LOWER_LIMBS", side: "LEFT" },
  { key: "rightMedialThigh", label: "Coxa medial direita", region: "LOWER_LIMBS", side: "RIGHT", sourceField: "rightThighCm" },
  { key: "leftMedialThigh", label: "Coxa medial esquerda", region: "LOWER_LIMBS", side: "LEFT", sourceField: "leftThighCm" },
  { key: "rightCalf", label: "Panturrilha direita", region: "LOWER_LIMBS", side: "RIGHT", sourceField: "rightCalfCm" },
  { key: "leftCalf", label: "Panturrilha esquerda", region: "LOWER_LIMBS", side: "LEFT", sourceField: "leftCalfCm" },
] as const;

export const bilateralPairs = [
  ["Braços relaxados", "rightArmRelaxed", "leftArmRelaxed"],
  ["Braços contraídos", "rightArmContracted", "leftArmContracted"],
  ["Antebraços", "rightForearm", "leftForearm"],
  ["Punhos", "rightWrist", "leftWrist"],
  ["Coxas proximais", "rightProximalThigh", "leftProximalThigh"],
  ["Coxas mediais", "rightMedialThigh", "leftMedialThigh"],
  ["Panturrilhas", "rightCalf", "leftCalf"],
] as const;

