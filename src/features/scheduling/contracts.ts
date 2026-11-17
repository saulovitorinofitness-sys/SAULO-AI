import type { AppointmentStatus } from "@/modules/scheduling";

export const APPOINTMENT_STATUSES = [
  "SCHEDULED",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "RESCHEDULED",
] as const satisfies readonly AppointmentStatus[];

export const APPOINTMENT_STATUS_LABELS: Readonly<
  Record<AppointmentStatus, string>
> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  COMPLETED: "Realizado",
  CANCELLED: "Cancelado",
  NO_SHOW: "Falta",
  RESCHEDULED: "Reagendado",
};

interface ClinicalAppointmentBase {
  readonly id: string;
  readonly professional: {
    readonly id: string;
    readonly fullName: string;
  };
  readonly startsAt: string;
  readonly endsAt: string;
  readonly status: AppointmentStatus;
  readonly notes?: string;
  readonly version: number;
  readonly attendanceId?: string;
  readonly clinicalType?:
    | "FIRST_CONSULTATION"
    | "RETURN"
    | "REASSESSMENT"
    | "FOLLOW_UP"
    | "SINGLE_CONSULTATION";
  readonly origin?: "MANUAL" | "CLINICAL_RETURN";
  readonly sourceAttendanceId?: string;
}

interface RegisteredPatientAppointmentIdentity {
  readonly masterRecordId: string;
  readonly patient: {
    readonly id: string;
    readonly code: string;
    readonly fullName: string;
  };
  readonly contactName?: never;
  readonly contactPhone?: never;
}

interface NewContactAppointmentIdentity {
  readonly masterRecordId?: never;
  readonly patient?: never;
  readonly contactName: string;
  readonly contactPhone: string;
}

export type ClinicalAppointmentView = ClinicalAppointmentBase &
  (RegisteredPatientAppointmentIdentity | NewContactAppointmentIdentity);

export interface SchedulingProfessionalOption {
  readonly id: string;
  readonly fullName: string;
  readonly professionalTitle?: string;
  readonly professionalRegistration?: string;
}

interface AppointmentDetails {
  readonly professionalUserId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly status: AppointmentStatus;
  readonly notes?: string;
  readonly clinicalType?: ClinicalAppointmentBase["clinicalType"];
  readonly origin?: ClinicalAppointmentBase["origin"];
  readonly sourceAttendanceId?: string;
  readonly deduplicationKey?: string;
  readonly estimatedDurationMinutes?: number;
}

export type AppointmentIdentityInput =
  | {
      readonly masterRecordId: string;
      readonly contactName?: never;
      readonly contactPhone?: never;
    }
  | {
      readonly masterRecordId?: never;
      readonly contactName: string;
      readonly contactPhone: string;
    };

export type AppointmentDraft = AppointmentDetails & AppointmentIdentityInput;

export type AppointmentUpdate = AppointmentDraft & {
  readonly version: number;
};
