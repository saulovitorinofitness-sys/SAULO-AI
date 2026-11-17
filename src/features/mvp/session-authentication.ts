export type SessionAuthenticationReason = "MISSING" | "INVALID" | "EXPIRED";
export const SESSION_COOKIE_NAME = "saulo-ai-session";

export class SessionAuthenticationError extends Error {
  constructor(readonly reason: SessionAuthenticationReason) {
    super(reason === "MISSING" ? "Autenticação obrigatória."
      : reason === "EXPIRED" ? "Sessão expirada."
        : "Sessão inválida ou revogada.");
    this.name = "SessionAuthenticationError";
  }
}

export interface PersistedSessionState {
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly user: { readonly status: string; readonly deletedAt: Date | null };
}

export function requireSessionToken(token: string | null | undefined): string {
  const normalized = token?.trim();
  if (!normalized) throw new SessionAuthenticationError("MISSING");
  return normalized;
}

export function requireActiveSession<T extends PersistedSessionState>(
  session: T | null,
  now = new Date(),
): T {
  if (!session || session.revokedAt || session.user.status !== "ACTIVE" || session.user.deletedAt) {
    throw new SessionAuthenticationError("INVALID");
  }
  if (session.expiresAt.getTime() <= now.getTime()) {
    throw new SessionAuthenticationError("EXPIRED");
  }
  return session;
}

export function isSessionAuthenticationError(error: unknown): error is SessionAuthenticationError {
  return error instanceof SessionAuthenticationError;
}
