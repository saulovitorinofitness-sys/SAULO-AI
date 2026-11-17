import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

export type IssuerConfigurationStatus = "COMPLETE" | "INCOMPLETE" | "INACTIVE";
export type IssuerSection = "ACADEMY" | "CLINIC" | "SAULO" | "MARIA";
export type RegistrationStatus = "ACTIVE" | "INACTIVE";

export interface IssuerAddress {
  readonly postalCode: string;
  readonly street: string;
  readonly number: string;
  readonly complement: string;
  readonly neighborhood: string;
  readonly city: string;
  readonly state: string;
}

export interface MaskedDocument {
  readonly configured: boolean;
  readonly masked: string | null;
}

export interface MaskedProfessionalRegistration extends MaskedDocument {
  readonly council: "CRN" | "CREF";
  readonly category: string;
  readonly state: string;
  readonly status: RegistrationStatus;
}

export interface AcademyIssuerConfiguration {
  readonly section: "ACADEMY";
  readonly personType: "Pessoa jurídica";
  readonly legalName: string;
  readonly tradeName: string;
  readonly cnpj: MaskedDocument;
  readonly address: IssuerAddress;
  readonly active: boolean;
  readonly status: IssuerConfigurationStatus;
}

export interface ClinicIssuerConfiguration {
  readonly section: "CLINIC";
  readonly commercialName: string;
  readonly internalCode: string;
  readonly academyLinked: boolean;
  readonly active: boolean;
  readonly status: IssuerConfigurationStatus;
}

export interface IndividualIssuerConfiguration {
  readonly section: "SAULO" | "MARIA";
  readonly userId: string;
  readonly userLinked: boolean;
  readonly fullName: string;
  readonly cpf: MaskedDocument;
  readonly address: IssuerAddress;
  readonly active: boolean;
  readonly registrations: readonly MaskedProfessionalRegistration[];
  readonly status: IssuerConfigurationStatus;
}

export interface IssuerConfigurationView {
  readonly academy: AcademyIssuerConfiguration;
  readonly clinic: ClinicIssuerConfiguration;
  readonly saulo: IndividualIssuerConfiguration;
  readonly maria: IndividualIssuerConfiguration;
}

export interface RegistrationDraft {
  readonly number?: string;
  readonly category?: string;
  readonly state?: string;
  readonly status: RegistrationStatus;
}

export type SaveIssuerConfigurationInput =
  | {
    readonly section: "ACADEMY";
    readonly legalName: string;
    readonly tradeName: string;
    readonly cnpj?: string;
    readonly address: IssuerAddress;
    readonly active: boolean;
  }
  | {
    readonly section: "CLINIC";
    readonly commercialName: string;
    readonly internalCode: string;
    readonly active: boolean;
  }
  | {
    readonly section: "SAULO";
    readonly fullName: string;
    readonly cpf?: string;
    readonly address: IssuerAddress;
    readonly active: boolean;
    readonly crn?: RegistrationDraft;
    readonly cref?: RegistrationDraft;
  }
  | {
    readonly section: "MARIA";
    readonly fullName: string;
    readonly cpf?: string;
    readonly address: IssuerAddress;
    readonly active: boolean;
    readonly cref?: RegistrationDraft;
  };

export interface ProtectedValue {
  readonly encrypted: string;
  readonly hash: string;
}

const STATES = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

function protectionKey(): Buffer {
  const secret = process.env.PAYROLL_DATA_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 32) throw new Error("PROTECTION_KEY_UNAVAILABLE");
  return createHash("sha256").update(secret).digest();
}

export function protectIssuerValue(value: string): ProtectedValue {
  const normalized = value.trim();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", protectionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  return {
    encrypted: ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(":"),
    hash: createHmac("sha256", protectionKey()).update(normalized).digest("hex"),
  };
}

export function revealIssuerValue(encrypted: string | null | undefined): string | null {
  if (!encrypted) return null;
  try {
    const [version, iv, tag, ciphertext] = encrypted.split(":");
    if (version !== "v1" || !iv || !tag || !ciphertext) return null;
    const decipher = createDecipheriv("aes-256-gcm", protectionKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/gu, "");
}

function repeatedDigits(value: string): boolean {
  return /^(\d)\1+$/u.test(value);
}

function validCpfDigits(value: string): boolean {
  if (value.length !== 11 || repeatedDigits(value)) return false;
  const digits = [...value].map(Number);
  const check = (length: number) => {
    const sum = digits.slice(0, length).reduce((total, digit, index) => total + digit * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return (remainder === 10 ? 0 : remainder) === digits[length];
  };
  return check(9) && check(10);
}

function validCnpjDigits(value: string): boolean {
  if (value.length !== 14 || repeatedDigits(value)) return false;
  const digits = [...value].map(Number);
  const check = (length: 12 | 13) => {
    const weights = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const remainder = digits.slice(0, length).reduce((sum, digit, index) => sum + digit * weights[index]!, 0) % 11;
    return (remainder < 2 ? 0 : 11 - remainder) === digits[length];
  };
  return check(12) && check(13);
}

export function isValidCpf(value: string): boolean {
  return validCpfDigits(onlyDigits(value));
}

export function isValidCnpj(value: string): boolean {
  return validCnpjDigits(onlyDigits(value));
}

export function isValidPostalCode(value: string): boolean {
  return onlyDigits(value).length === 8;
}

export function isValidState(value: string): boolean {
  return STATES.has(value.trim().toUpperCase());
}

export function isValidRegistration(draft: RegistrationDraft): boolean {
  const number = draft.number?.trim() ?? "";
  const category = draft.category?.trim() ?? "";
  return /^[A-Z0-9./-]{2,40}$/iu.test(number)
    && /^[A-Z0-9 .-]{1,30}$/iu.test(category)
    && isValidState(draft.state ?? "");
}

export function registrationPlaintext(draft: RegistrationDraft): string {
  return JSON.stringify({ number: draft.number?.trim(), category: draft.category?.trim() });
}

export function parseRegistrationPlaintext(value: string | null): { number: string; category: string } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { number?: unknown; category?: unknown };
    return typeof parsed.number === "string" && typeof parsed.category === "string"
      ? { number: parsed.number, category: parsed.category }
      : null;
  } catch {
    return null;
  }
}

export function maskCpf(value: string | null): string | null {
  if (!value) return null;
  const digits = onlyDigits(value);
  return digits.length === 11 ? `***.***.***-${digits.slice(-2)}` : null;
}

export function maskCnpj(value: string | null): string | null {
  if (!value) return null;
  const digits = onlyDigits(value);
  return digits.length === 14 ? `**.***.***/****-${digits.slice(-2)}` : null;
}

export function maskRegistration(value: string | null): string | null {
  if (!value) return null;
  return `••••${value.slice(-2)}`;
}

export function emptyAddress(): IssuerAddress {
  return { postalCode: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "" };
}

export function completeAddress(address: IssuerAddress): boolean {
  return isValidPostalCode(address.postalCode) && isValidState(address.state)
    && [address.street, address.number, address.neighborhood, address.city].every((value) => value.trim().length > 0);
}

export function formattedAddress(address: IssuerAddress): string {
  return [
    `${address.street}, ${address.number}`,
    address.complement,
    address.neighborhood,
    `${address.city}/${address.state}`,
    `CEP ${address.postalCode}`,
  ].filter((part) => part.trim().length > 0).join(" · ");
}
