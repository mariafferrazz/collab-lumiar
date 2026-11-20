import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

export const AUTH_ROLES = {
  customer: "CUSTOMER",
  admin: "ADMIN",
} as const;

export type AuthRole = (typeof AUTH_ROLES)[keyof typeof AUTH_ROLES];

const statement = {
  ...defaultStatements,
  profile: ["read", "update"],
  address: ["create", "read", "update", "delete"],
  catalog: ["create", "read", "update", "delete", "publish"],
} as const;

export const authAccessControl = createAccessControl(statement);

export const customerRole = authAccessControl.newRole({
  profile: ["read", "update"],
  address: ["create", "read", "update", "delete"],
});

export const administratorRole = authAccessControl.newRole({
  ...adminAc.statements,
  profile: ["read", "update"],
  address: ["create", "read", "update", "delete"],
  catalog: ["create", "read", "update", "delete", "publish"],
});

export function readAuthRoles(value: string | null | undefined): AuthRole[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((role) => role.trim())
    .filter((role): role is AuthRole =>
      Object.values(AUTH_ROLES).includes(role as AuthRole),
    );
}

export function hasAdminRole(value: string | null | undefined): boolean {
  return readAuthRoles(value).includes(AUTH_ROLES.admin);
}
