import type { ModuleKey } from "@/modules/shared";

export interface ProfessionalIdentity {
  readonly userId: string;
  readonly fullName: string;
  readonly professionalTitle?: string;
  readonly professionalRegistration?: string;
  readonly phone?: string;
  readonly instagram?: string;
}

export interface ExecutedProfessionalModule {
  readonly moduleKey: ModuleKey;
  readonly moduleName: string;
  readonly executedAt: string;
}

export interface AttendanceProfessionalParticipant
  extends ProfessionalIdentity {
  readonly modules: readonly ExecutedProfessionalModule[];
}
