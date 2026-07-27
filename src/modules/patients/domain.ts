import type { AuditableRecord, EntityId, ISODate, PageRequest, PageResult } from "../shared";

export type PatientStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";
export type PatientDataStatus = "ACTIVE" | "ARCHIVED";
export type PatientSex = "FEMALE" | "MALE" | "INTERSEX" | "NOT_INFORMED";
export type MaritalStatus = "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED" | "SEPARATED" | "DOMESTIC_PARTNERSHIP" | "NOT_INFORMED";
export type PhoneType = "MOBILE" | "HOME" | "WORK" | "OTHER";

export interface Patient extends AuditableRecord {
  readonly clinicalCode: string;
  readonly fullName: string;
  readonly preferredName?: string;
  readonly cpf?: string;
  readonly sex: PatientSex;
  readonly birthDate: ISODate;
  readonly email?: string;
  readonly maritalStatus?: MaritalStatus;
  readonly profession?: string;
  readonly observations?: string;
  readonly status: PatientStatus;
  readonly registeredByUserId: EntityId;
}

export interface PatientAddress extends AuditableRecord {
  readonly patientId: EntityId;
  readonly street?: string;
  readonly number?: string;
  readonly complement?: string;
  readonly neighborhood?: string;
  readonly city?: string;
  readonly state?: string;
  readonly postalCode?: string;
  readonly countryCode: string;
  readonly status: PatientDataStatus;
}

export interface PatientPhone extends AuditableRecord {
  readonly patientId: EntityId;
  readonly type: PhoneType;
  readonly countryCode: string;
  readonly areaCode: string;
  readonly number: string;
  readonly isPrimary: boolean;
  readonly status: PatientDataStatus;
}

export interface PatientInsurance extends AuditableRecord {
  readonly patientId: EntityId;
  readonly providerName?: string;
  readonly planName?: string;
  readonly memberNumber?: string;
  readonly validUntil?: ISODate;
  readonly status: PatientDataStatus;
}

export interface EmergencyContact extends AuditableRecord {
  readonly patientId: EntityId;
  readonly fullName?: string;
  readonly relationship?: string;
  readonly phone?: string;
  readonly email?: string;
  readonly isPrimary: boolean;
  readonly status: PatientDataStatus;
}

export interface PatientAggregate {
  readonly patient: Patient;
  readonly address?: PatientAddress;
  readonly phones: readonly [PatientPhone, ...PatientPhone[]];
  readonly insurance?: PatientInsurance;
  readonly emergencyContacts: readonly EmergencyContact[];
  readonly masterRecordId: EntityId;
}

export interface PatientRepository {
  register(aggregate: PatientAggregate): Promise<PatientAggregate>;
  findById(id: EntityId): Promise<Patient | null>;
  findAggregateById(id: EntityId): Promise<PatientAggregate | null>;
  list(page: PageRequest): Promise<PageResult<Patient>>;
}
