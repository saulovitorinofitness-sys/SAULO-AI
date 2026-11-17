import type { StudentPortalContext } from "./contracts";

export class StudentPortalAccessError extends Error {
  constructor(readonly reason: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND") {
    super(`STUDENT_PORTAL_${reason}`);
  }
}

export function assertStudentResourceOwnership(
  context: StudentPortalContext,
  resourceMasterRecordId: string,
) {
  if (context.masterRecordId !== resourceMasterRecordId) {
    throw new StudentPortalAccessError("NOT_FOUND");
  }
}
