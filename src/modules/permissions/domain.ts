import type { BaseEntity, EntityId, ModuleKey } from "../shared";

export type AccessAction = "READ" | "CREATE" | "UPDATE" | "DELETE" | "EXPORT" | "MANAGE";
export type PermissionEffect = "ALLOW" | "DENY";

export interface ModuleDefinition extends BaseEntity {
  readonly key: ModuleKey;
  readonly name: string;
  readonly nutritionRestricted: boolean;
  readonly active: boolean;
}

export interface Role extends BaseEntity {
  readonly key: string;
  readonly name: string;
  readonly grantsAllModules: boolean;
  readonly allowsNutritionModules: boolean;
}

export interface PermissionGrant {
  readonly moduleKey: ModuleKey;
  readonly action: AccessAction;
  readonly effect: PermissionEffect;
}

export interface UserAccessPolicy {
  readonly userId: EntityId;
  readonly roleKeys: readonly string[];
  readonly overrides: readonly PermissionGrant[];
}

export interface AuthorizationRequest {
  readonly userId: EntityId;
  readonly moduleKey: ModuleKey;
  readonly action: AccessAction;
}

export interface AuthorizationService {
  can(request: AuthorizationRequest): Promise<boolean>;
}

export interface PermissionRepository {
  getUserPolicy(userId: EntityId): Promise<UserAccessPolicy>;
  listModules(): Promise<readonly ModuleDefinition[]>;
}
