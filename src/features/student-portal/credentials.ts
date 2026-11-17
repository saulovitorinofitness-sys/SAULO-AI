import { createHash, randomBytes, scrypt } from "node:crypto";

const SCRYPT_PARAMETERS = {
  cost: 32768,
  blockSize: 8,
  parallelization: 1,
  keyLength: 64,
  maxmem: 64 * 1024 * 1024,
  saltLength: 16,
} as const;

export function studentInvitationTokenHash(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createStudentInvitationToken() {
  return randomBytes(32).toString("base64url");
}

export function hasSecureStudentPassword(password: string) {
  return (
    password.length >= 8 &&
    password.length <= 128 &&
    /\p{Ll}/u.test(password) &&
    /\p{Lu}/u.test(password) &&
    /\p{N}/u.test(password) &&
    /[^\p{L}\p{N}\s]/u.test(password) &&
    !/[\u0000-\u001F\u007F]/u.test(password)
  );
}

export function normalizeStudentLogin(login: string) {
  const normalized = login.trim().toLocaleLowerCase("pt-BR");
  if (
    normalized.length < 3 ||
    normalized.length > 254 ||
    /[\s\u0000-\u001F\u007F]/u.test(normalized)
  ) {
    throw new Error("STUDENT_LOGIN_INVALID");
  }
  return normalized;
}

export async function createStudentCredentialHash(password: string) {
  if (!hasSecureStudentPassword(password)) {
    throw new Error("STUDENT_PASSWORD_WEAK");
  }

  const salt = randomBytes(SCRYPT_PARAMETERS.saltLength);
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      SCRYPT_PARAMETERS.keyLength,
      {
        N: SCRYPT_PARAMETERS.cost,
        r: SCRYPT_PARAMETERS.blockSize,
        p: SCRYPT_PARAMETERS.parallelization,
        maxmem: SCRYPT_PARAMETERS.maxmem,
      },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });

  return [
    "scrypt",
    "v=1",
    `N=${SCRYPT_PARAMETERS.cost},r=${SCRYPT_PARAMETERS.blockSize},p=${SCRYPT_PARAMETERS.parallelization}`,
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
}
