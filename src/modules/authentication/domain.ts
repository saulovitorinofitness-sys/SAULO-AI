import type { BaseEntity, EntityId, ISODateTime } from "../shared";

export type IdentityProvider = "CREDENTIALS" | "OIDC";

export interface AuthIdentity extends BaseEntity {
  readonly userId: EntityId;
  readonly provider: IdentityProvider;
  readonly providerSubject: string;
}

export interface AuthSession extends BaseEntity {
  readonly userId: EntityId;
  readonly expiresAt: ISODateTime;
  readonly revokedAt?: ISODateTime;
}

export interface AuthenticationRepository {
  findIdentity(provider: IdentityProvider, subject: string): Promise<AuthIdentity | null>;
  findSessionByTokenHash(tokenHash: string): Promise<AuthSession | null>;
}
