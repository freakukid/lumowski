/**
 * Role within a business.
 * - OWNER: Full access, can delete business, manage schema, all permissions
 * - BOSS: Can manage inventory and members (except change roles)
 * - EMPLOYEE: Read-only access to inventory
 */
export type BusinessRole = 'OWNER' | 'BOSS' | 'EMPLOYEE'

/**
 * Simplified business info attached to user context.
 * Contains only the essential fields needed for authorization.
 */
export interface UserBusiness {
  id: string
  name: string
  role: BusinessRole
}
