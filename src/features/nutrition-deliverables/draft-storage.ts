"use client";

import type { NutritionDeliverableDraft } from "./contracts";

function key(patientId: string, attendanceId: string) {
  return `saulo-ai:nutrition-deliverable-draft:${patientId}:${attendanceId}`;
}

function isDraft(value: unknown): value is NutritionDeliverableDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<NutritionDeliverableDraft>;
  return Boolean(
    candidate.deliverableId &&
      candidate.patientId &&
      candidate.attendanceId &&
      candidate.cover &&
      candidate.clinicalDiagnosis &&
      candidate.shoppingList &&
      Array.isArray(candidate.optionalSectionOrder),
  );
}

export const nutritionDeliverableDraftStorage = {
  read(patientId: string, attendanceId: string) {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(key(patientId, attendanceId));
      if (!raw) return null;
      const value: unknown = JSON.parse(raw);
      return isDraft(value) &&
        value.patientId === patientId &&
        value.attendanceId === attendanceId
        ? value
        : null;
    } catch {
      return null;
    }
  },

  save(draft: NutritionDeliverableDraft) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      key(draft.patientId, draft.attendanceId),
      JSON.stringify(draft),
    );
  },
};
