import type { BusinessRole } from '@prisma/client'

export interface BusinessContext {
  businessId: string | null
  businessRole: BusinessRole | null
}

/**
 * Check if user can edit the inventory schema (column definitions).
 * Only OWNER can modify schema to prevent accidental data structure changes.
 */
export function canEditSchema(role: BusinessRole | null): boolean {
  return role === 'OWNER'
}

/**
 * Check if user can reset inventory (delete all items and columns).
 * This is a destructive operation only available to OWNER.
 */
export function canResetInventory(role: BusinessRole | null): boolean {
  return role === 'OWNER'
}

/**
 * Check if user can access the schema settings page.
 * Only OWNER can access schema management.
 */
export function canAccessSchemaSettings(role: BusinessRole | null): boolean {
  return role === 'OWNER'
}

/**
 * Check if user can manage inventory items (create, update, delete).
 * OWNER and BOSS can manage inventory; EMPLOYEE can only view.
 */
export function canManageInventory(role: BusinessRole | null): boolean {
  return role === 'OWNER' || role === 'BOSS'
}

export function canGenerateInviteCode(role: BusinessRole | null): boolean {
  return role === 'OWNER' || role === 'BOSS'
}

export function canRemoveMember(role: BusinessRole | null, targetRole: BusinessRole): boolean {
  if (role === 'OWNER') {
    return true
  }
  if (role === 'BOSS' && targetRole === 'EMPLOYEE') {
    return true
  }
  return false
}

export function canChangeRole(role: BusinessRole | null): boolean {
  return role === 'OWNER'
}

export function canManageMembers(role: BusinessRole | null): boolean {
  return role === 'OWNER' || role === 'BOSS'
}

export function requireBusiness(businessId: string | null): asserts businessId is string {
  if (!businessId) {
    throw createError({
      statusCode: 403,
      message: 'You must belong to a business to perform this action',
    })
  }
}

export function requireRole(
  role: BusinessRole | null,
  allowedRoles: BusinessRole[],
  action: string = 'perform this action'
): void {
  if (!role || !allowedRoles.includes(role)) {
    throw createError({
      statusCode: 403,
      message: `You do not have permission to ${action}`,
    })
  }
}

export function generateInviteCodeString(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
