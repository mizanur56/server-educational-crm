import type { DataScope, OverrideEffect } from '../../lib/prisma-client.ts'
import { ROLE_DEFAULTS, SCOPE_RESOURCES, permissionKey } from './permission-catalog.ts'

export type PermissionGrant = {
  resource: string
  action: string
}

export type ScopeMap = Record<string, DataScope>

export function toPermissionKey(item: PermissionGrant) {
  return permissionKey(item.resource, item.action)
}

export function mergePermissions(
  rolePermissions: PermissionGrant[],
  overrides: Array<PermissionGrant & { effect: OverrideEffect }>,
) {
  const allowed = new Set(rolePermissions.map(toPermissionKey))

  for (const override of overrides) {
    const key = toPermissionKey(override)
    if (override.effect === 'ALLOW') {
      allowed.add(key)
    } else {
      allowed.delete(key)
    }
  }

  return [...allowed]
}

export function defaultScopesForRole(roleKey: string): ScopeMap {
  const defaults = ROLE_DEFAULTS[roleKey]?.scopes
  return {
    lead: defaults?.lead ?? 'OWN',
    document: defaults?.document ?? defaults?.lead ?? 'OWN',
    employee_performance: defaults?.employee_performance ?? defaults?.lead ?? 'OWN',
  }
}

export function mergeScopes(roleKey: string, stored: Array<{ resource: string; scope: DataScope }>): ScopeMap {
  const merged = defaultScopesForRole(roleKey)

  for (const row of stored) {
    merged[row.resource] = row.scope
  }

  if (!stored.some((row) => row.resource === 'document')) {
    merged.document = merged.lead
  }

  if (!stored.some((row) => row.resource === 'employee_performance')) {
    merged.employee_performance = merged.lead
  }

  return merged
}

export function hasPermission(permissions: string[], required: string | string[]) {
  const needed = Array.isArray(required) ? required : [required]
  return needed.some((item) => permissions.includes(item))
}

export function canReceiveLeadAssignment(status: string) {
  return status === 'ACTIVE'
}

export const SCOPE_RESOURCE_LIST = SCOPE_RESOURCES
