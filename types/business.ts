import type { BusinessRole } from './user'

/**
 * Business entity representing a company or organization.
 */
export interface Business {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  members?: BusinessMember[]
  inviteCodes?: InviteCode[]
}

/**
 * Represents a user's membership in a business with their assigned role.
 */
export interface BusinessMember {
  id: string
  role: BusinessRole
  businessId: string
  userId: string
  createdAt: string
  updatedAt: string
  user?: {
    id: string
    name: string
    email: string
  }
}

/**
 * Invite code for joining a business.
 */
export interface InviteCode {
  id: string
  code: string
  role: BusinessRole
  expiresAt: string | null
  maxUses: number | null
  usedCount: number
  businessId: string
  createdById: string
  createdAt: string
  createdBy?: {
    id: string
    name: string
  }
}
