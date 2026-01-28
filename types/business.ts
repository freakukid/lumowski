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
 * Roles that can be assigned via invite codes.
 * OWNER role is never assignable via invite - it's only set when creating a business.
 */
export type InviteRole = 'BOSS' | 'EMPLOYEE'

/**
 * Invite code for joining a business.
 */
export interface InviteCode {
  id: string
  code: string
  role: InviteRole
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

/**
 * Business settings for tax and receipt customization.
 */
export interface BusinessSettings {
  id: string
  taxRate: number
  taxName: string
  receiptHeader: string | null
  receiptFooter: string | null
  logoUrl: string | null
  logoPublicId: string | null
  // Thermal printer configuration
  thermalPrinterEnabled: boolean
  thermalPrinterType: string | null
  thermalPrinterAddress: string | null
  thermalPrinterPort: number | null
  thermalPrinterWidth: number | null
  businessId: string
  createdAt: string
  updatedAt: string
}

/**
 * Payload for updating business settings.
 */
export interface BusinessSettingsUpdate {
  taxRate?: number
  taxName?: string
  receiptHeader?: string | null
  receiptFooter?: string | null
  // Thermal printer configuration
  thermalPrinterEnabled?: boolean
  thermalPrinterType?: string | null
  thermalPrinterAddress?: string | null
  thermalPrinterPort?: number | null
  thermalPrinterWidth?: number | null
}

/**
 * Request payload for uploading a business logo.
 */
export interface LogoUploadRequest {
  /** Base64 data URL of the image (e.g., 'data:image/png;base64,...') */
  image: string
}

/**
 * Response from logo upload/delete operations.
 */
export interface LogoUploadResponse {
  logoUrl: string | null
  logoPublicId: string | null
}
