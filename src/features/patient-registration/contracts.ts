import type {
  MaritalStatus,
  PatientSex,
  PatientStatus,
  PhoneType,
} from "@/modules/patients";
import type { PatientListItem } from "@/features/mvp";
import { z } from "zod";

export const PATIENT_LIST_PAGE_SIZE = 20;

export interface PatientListQuery {
  readonly query?: string;
  readonly page?: number;
  readonly status?: PatientStatus;
}

export interface PatientListPage {
  readonly items: readonly PatientListItem[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export const CLINICAL_ATTENDANCE_TYPES = [
  "FIRST_CONSULTATION",
  "RETURN",
  "REASSESSMENT",
  "FOLLOW_UP",
  "SINGLE_CONSULTATION",
] as const;

export type ClinicalAttendanceTypeInput =
  (typeof CLINICAL_ATTENDANCE_TYPES)[number];

export const BRAZILIAN_STATE_CODES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export type BrazilianStateCode = (typeof BRAZILIAN_STATE_CODES)[number];

export interface PatientPermanentRegistrationPhone {
  readonly type: PhoneType;
  readonly countryCode: string;
  readonly areaCode: string;
  readonly number: string;
}

export interface PatientPermanentRegistrationAddress {
  readonly street: string | null;
  readonly number: string | null;
  readonly complement: string | null;
  readonly neighborhood: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly postalCode: string | null;
  readonly countryCode: string;
}

export interface PatientPermanentRegistrationRead {
  readonly patientId: string;
  readonly clinicalCode: string;
  readonly fullName: string;
  readonly birthDate: string;
  readonly sex: PatientSex;
  readonly primaryPhone: PatientPermanentRegistrationPhone | null;
  readonly email: string | null;
  readonly address: PatientPermanentRegistrationAddress | null;
}

const optionalNullableText = (maximum: number) =>
  z.union([
    z.string().trim().max(maximum).transform((value) => value || null),
    z.null(),
  ]);

const optionalNullableEmail = z.union([
  z.string()
    .trim()
    .transform((value) => value || null)
    .pipe(z.union([z.email().max(255), z.null()])),
  z.null(),
]);

const optionalNullablePostalCode = z.union([
  z.string()
    .trim()
    .transform((value) => value.replace(/\D/gu, "") || null)
    .pipe(z.union([z.string().regex(/^\d{8}$/u), z.null()])),
  z.null(),
]);

const optionalNullableBrazilianState = z.union([
  z.string()
    .trim()
    .transform((value) => value ? value.toUpperCase() : null)
    .pipe(z.union([z.enum(BRAZILIAN_STATE_CODES), z.null()])),
  z.null(),
]);

export const patientPermanentRegistrationPhoneUpdateSchema = z.object({
  type: z.enum(["MOBILE", "HOME", "WORK", "OTHER"]),
  countryCode: z.string().trim().regex(/^\d{1,3}$/u),
  areaCode: z.string().trim().transform((value) => value.replace(/\D/gu, ""))
    .pipe(z.string().regex(/^\d{2,3}$/u)),
  number: z.string().trim().transform((value) => value.replace(/\D/gu, ""))
    .pipe(z.string().regex(/^\d{8,11}$/u)),
}).strict();

export type PatientPermanentRegistrationPhoneUpdateInput = z.input<
  typeof patientPermanentRegistrationPhoneUpdateSchema
>;

export type PatientPermanentRegistrationPhoneUpdate = z.output<
  typeof patientPermanentRegistrationPhoneUpdateSchema
>;

export const patientPermanentRegistrationAddressUpdateSchema = z.object({
  street: optionalNullableText(255).optional(),
  number: optionalNullableText(30).optional(),
  complement: optionalNullableText(120).optional(),
  neighborhood: optionalNullableText(120).optional(),
  city: optionalNullableText(120).optional(),
  state: optionalNullableBrazilianState.optional(),
  postalCode: optionalNullablePostalCode.optional(),
}).strict();

export type PatientPermanentRegistrationAddressUpdateInput = z.input<
  typeof patientPermanentRegistrationAddressUpdateSchema
>;

export type PatientPermanentRegistrationAddressUpdate = z.output<
  typeof patientPermanentRegistrationAddressUpdateSchema
>;

export const patientPermanentRegistrationUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(180).optional(),
  birthDate: z.iso.date().refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date <= new Date();
  }, "Data de nascimento inválida.").optional(),
  sex: z.enum(["FEMALE", "MALE", "INTERSEX", "NOT_INFORMED"]).optional(),
  primaryPhone: patientPermanentRegistrationPhoneUpdateSchema.optional(),
  email: optionalNullableEmail.optional(),
  address: patientPermanentRegistrationAddressUpdateSchema.optional(),
}).strict();

export type PatientPermanentRegistrationUpdateInput = z.input<
  typeof patientPermanentRegistrationUpdateSchema
>;

export type PatientPermanentRegistrationUpdate = z.output<
  typeof patientPermanentRegistrationUpdateSchema
>;

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

export interface RegisteredPatientAttendance {
  readonly id: string;
  readonly status: "DRAFT" | "IN_PROGRESS" | "COMPLETED";
  readonly clinicalType?: ClinicalAttendanceTypeInput;
  readonly preparedAt: string;
  readonly startedAt?: string;
  readonly endedAt?: string;
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
  readonly activeAttendance?: RegisteredPatientAttendance;
  readonly historicalAttendance?: RegisteredPatientAttendance;
  readonly canEdit: boolean;
  readonly steps: readonly InitialConsultationStep[];
}
