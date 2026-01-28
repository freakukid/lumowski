import type { BusinessRole } from '@prisma/client'

export interface BusinessContext {
  businessId: string | null
  businessRole: BusinessRole | null
}

/**
 * Check if user has permission to remove a member from the business.
 * OWNER can remove anyone. BOSS can only remove EMPLOYEE.
 */
export function canRemoveMember(role: BusinessRole | null, targetRole: BusinessRole): boolean {
  if (role === 'OWNER') {
    return true
  }
  if (role === 'BOSS' && targetRole === 'EMPLOYEE') {
    return true
  }
  return false
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
