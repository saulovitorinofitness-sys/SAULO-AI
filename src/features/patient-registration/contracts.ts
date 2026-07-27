import type {
  MaritalStatus,
  PatientSex,
  PhoneType,
} from "@/modules/patients";

export interface PatientRegistrationInput {
  readonly fullName: string;
  readonly birthDate: string;
  readonly sex: PatientSex;
  readonly phone: {
    readonly type: PhoneType;
    readonly countryCode: string;
    readonly areaCode: string;
    readonly number: string;
  };
  readonly preferredName?: string;
  readonly cpf?: string;
  readonly email?: string;
  readonly maritalStatus?: MaritalStatus;
  readonly profession?: string;
  readonly observations?: string;
  readonly address?: {
    readonly street?: string;
    readonly number?: string;
    readonly complement?: string;
    readonly neighborhood?: string;
    readonly city?: string;
    readonly state?: string;
    readonly postalCode?: string;
    readonly countryCode: string;
  };
  readonly insurance?: {
    readonly providerName?: string;
    readonly planName?: string;
    readonly memberNumber?: string;
    readonly validUntil?: string;
  };
  readonly emergencyContact?: {
    readonly fullName?: string;
    readonly relationship?: string;
    readonly phone?: string;
    readonly email?: string;
  };
}

export interface PatientRegistrationResult {
  readonly patientId: string;
  readonly clinicalCode: string;
  readonly masterRecordId: string;
  readonly attendanceId: string;
  readonly createdAt: string;
}

export type InitialConsultationStepStatus = "COMPLETED" | "PENDING";

export interface InitialConsultationStep {
  readonly key:
    | "PATIENT_REGISTRATION"
    | "ASSESSMENT"
    | "NUTRITION_STRATEGY"
    | "MEAL_PLAN"
    | "DELIVERABLES"
    | "FINALIZATION";
  readonly label: string;
  readonly status: InitialConsultationStepStatus;
}

export interface RegisteredPatientEntry {
  readonly patientId: string;
  readonly clinicalCode: string;
  readonly fullName: string;
  readonly preferredName?: string;
  readonly birthDate: string;
  readonly age: number;
  readonly sex: PatientSex;
  readonly phone: string;
  readonly masterRecordId: string;
  readonly attendanceId: string;
  readonly attendanceStartedAt: string;
  readonly steps: readonly InitialConsultationStep[];
}
