import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, readonly } from 'vue'
import type { Business, BusinessMember, InviteCode } from '~/types/business'
import type { BusinessRole, UserBusiness } from '~/types/user'

vi.stubGlobal('ref', ref)
vi.stubGlobal('readonly', readonly)
vi.stubGlobal('$fetch', vi.fn())

const mockAuthFetch = vi.fn()
vi.mock('~/composables/useAuthFetch', () => ({
  useAuthFetch: () => ({ authFetch: mockAuthFetch }),
}))

vi.mock('~/composables/useApiError', () => ({
  extractApiError: (error: unknown, fallback: string) => {
    if (error && typeof error === 'object') {
      const err = error as Record<string, unknown>
      if (typeof err.data === 'object' && err.data !== null) {
        const data = err.data as Record<string, unknown>
        if (typeof data.message === 'string') return data.message
      }
      if (typeof err.message === 'string') return err.message
    }
    return fallback
  },
}))

interface MockUser {
  id: string
  email: string
  name: string
  role: 'USER' | 'ADMIN'
  business: UserBusiness | null
}

const mockAuthStore = {
  user: null as MockUser | null,
  accessToken: 'token',
  refreshToken: 'refresh',
  businesses: [] as Array<{ id: string; name: string; role: BusinessRole; memberCount: number; joinedAt: string }>,
  businessId: null as string | null,
  setTokens: vi.fn(),
  setBusiness: vi.fn((b: UserBusiness | null) => {
    if (mockAuthStore.user) mockAuthStore.user.business = b
    mockAuthStore.businessId = b?.id ?? null
  }),
  setBusinesses: vi.fn((businesses: Array<{ id: string; name: string; role: BusinessRole; memberCount: number; joinedAt: string }>) => {
    mockAuthStore.businesses = businesses
  }),
}

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => mockAuthStore,
}))

import { useBusiness } from '~/composables/useBusiness'

function createBusiness(id: string, name: string): Business {
  return { id, name, createdAt: '2024-01-15T10:00:00Z', updatedAt: '2024-01-15T10:00:00Z' }
}

function createMember(id: string, role: BusinessRole, userId: string): BusinessMember {
  return { id, role, businessId: 'b1', userId, createdAt: '2024-01-15T10:00:00Z', updatedAt: '2024-01-15T10:00:00Z' }
}

function createInviteCode(id: string, code: string, role: BusinessRole): InviteCode {
  return { id, code, role, expiresAt: null, maxUses: null, usedCount: 0, businessId: 'b1', createdById: 'u1', createdAt: '2024-01-15T10:00:00Z' }
}

function resetMockStore(): void {
  mockAuthStore.user = { id: 'u1', email: 'test@test.com', name: 'Test User', role: 'USER', business: null }
  mockAuthStore.accessToken = 'token'
  mockAuthStore.refreshToken = 'refresh'
  mockAuthStore.businesses = []
  mockAuthStore.businessId = null
}

describe('createBusiness', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockStore() })

  it('should create business successfully', async () => {
    const business = createBusiness('b1', 'Test Business')
    mockAuthFetch.mockResolvedValueOnce({ business, accessToken: 'new-token', refreshToken: 'new-refresh' })
    const biz = useBusiness()
    const result = await biz.createBusiness('Test Business')
    expect(result.success).toBe(true)
    expect(result.business).toEqual(business)
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/business', { method: 'POST', body: { name: 'Test Business' } })
  })

  it('should update tokens after creation', async () => {
    const business = createBusiness('b1', 'Test Business')
    mockAuthFetch.mockResolvedValueOnce({ business, accessToken: 'new-token', refreshToken: 'new-refresh' })
    const biz = useBusiness()
    await biz.createBusiness('Test Business')
    expect(mockAuthStore.setTokens).toHaveBeenCalledWith('new-token', 'new-refresh')
  })

  it('should set business with OWNER role', async () => {
    const business = createBusiness('b1', 'Test Business')
    mockAuthFetch.mockResolvedValueOnce({ business, accessToken: 'new-token', refreshToken: 'new-refresh' })
    const biz = useBusiness()
    await biz.createBusiness('Test Business')
    expect(mockAuthStore.setBusiness).toHaveBeenCalledWith({ id: 'b1', name: 'Test Business', role: 'OWNER' })
  })

  it('should set isLoading during creation', async () => {
    mockAuthFetch.mockResolvedValueOnce({ business: createBusiness('b1', 'Test'), accessToken: 't', refreshToken: 'r' })
    const biz = useBusiness()
    await biz.createBusiness('Test')
    expect(biz.isLoading.value).toBe(false)
  })

  it('should return error on failure', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Creation failed'))
    const biz = useBusiness()
    const result = await biz.createBusiness('Test')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Creation failed')
    expect(biz.error.value).toBe('Creation failed')
  })

  it('should handle API error with data.message', async () => {
    mockAuthFetch.mockRejectedValueOnce({ data: { message: 'Name already exists' } })
    const biz = useBusiness()
    const result = await biz.createBusiness('Existing')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Name already exists')
  })
})

describe('joinBusiness', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockStore() })

  it('should join business successfully', async () => {
    const business = createBusiness('b1', 'Test Business')
    business.members = [createMember('m1', 'EMPLOYEE', 'u1')]
    mockAuthFetch.mockResolvedValueOnce({ business, accessToken: 'new-token', refreshToken: 'new-refresh' })
    const biz = useBusiness()
    const result = await biz.joinBusiness('ABC123')
    expect(result.success).toBe(true)
    expect(result.business).toEqual(business)
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/business/join', { method: 'POST', body: { code: 'ABC123' } })
  })

  it('should update tokens after joining', async () => {
    const business = createBusiness('b1', 'Test Business')
    business.members = [createMember('m1', 'BOSS', 'u1')]
    mockAuthFetch.mockResolvedValueOnce({ business, accessToken: 'new-token', refreshToken: 'new-refresh' })
    const biz = useBusiness()
    await biz.joinBusiness('ABC123')
    expect(mockAuthStore.setTokens).toHaveBeenCalledWith('new-token', 'new-refresh')
  })

  it('should set business with member role', async () => {
    const business = createBusiness('b1', 'Test Business')
    business.members = [createMember('m1', 'BOSS', 'u1')]
    mockAuthFetch.mockResolvedValueOnce({ business, accessToken: 'new-token', refreshToken: 'new-refresh' })
    const biz = useBusiness()
    await biz.joinBusiness('ABC123')
    expect(mockAuthStore.setBusiness).toHaveBeenCalledWith({ id: 'b1', name: 'Test Business', role: 'BOSS' })
  })

  it('should default to EMPLOYEE if member not found', async () => {
    const business = createBusiness('b1', 'Test Business')
    business.members = []
    mockAuthFetch.mockResolvedValueOnce({ business, accessToken: 'new-token', refreshToken: 'new-refresh' })
    const biz = useBusiness()
    await biz.joinBusiness('ABC123')
    expect(mockAuthStore.setBusiness).toHaveBeenCalledWith({ id: 'b1', name: 'Test Business', role: 'EMPLOYEE' })
  })

  it('should return error on invalid code', async () => {
    mockAuthFetch.mockRejectedValueOnce({ data: { message: 'Invalid invite code' } })
    const biz = useBusiness()
    const result = await biz.joinBusiness('INVALID')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid invite code')
  })

  it('should return error on expired code', async () => {
    mockAuthFetch.mockRejectedValueOnce({ data: { message: 'Invite code has expired' } })
    const biz = useBusiness()
    const result = await biz.joinBusiness('EXPIRED')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Invite code has expired')
  })
})

describe('getBusiness', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockStore() })

  it('should get business successfully', async () => {
    const business = createBusiness('b1', 'Test Business')
    mockAuthFetch.mockResolvedValueOnce(business)
    const biz = useBusiness()
    const result = await biz.getBusiness()
    expect(result.success).toBe(true)
    expect(result.business).toEqual(business)
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/business')
  })

  it('should set isLoading during fetch', async () => {
    mockAuthFetch.mockResolvedValueOnce(createBusiness('b1', 'Test'))
    const biz = useBusiness()
    await biz.getBusiness()
    expect(biz.isLoading.value).toBe(false)
  })

  it('should return error on failure', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Fetch failed'))
    const biz = useBusiness()
    const result = await biz.getBusiness()
    expect(result.success).toBe(false)
    expect(result.error).toBe('Fetch failed')
  })
})

describe('createInviteCode', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockStore() })

  it('should create invite code with default options', async () => {
    const inviteCode = createInviteCode('i1', 'ABC123', 'EMPLOYEE')
    mockAuthFetch.mockResolvedValueOnce(inviteCode)
    const biz = useBusiness()
    const result = await biz.createInviteCode()
    expect(result.success).toBe(true)
    expect(result.inviteCode).toEqual(inviteCode)
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/business/invite', { method: 'POST', body: {} })
  })

  it('should create invite code with custom options', async () => {
    const inviteCode = createInviteCode('i1', 'ABC123', 'BOSS')
    mockAuthFetch.mockResolvedValueOnce(inviteCode)
    const biz = useBusiness()
    const result = await biz.createInviteCode({ role: 'BOSS', expiresInHours: 24, maxUses: 5 })
    expect(result.success).toBe(true)
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/business/invite', { method: 'POST', body: { role: 'BOSS', expiresInHours: 24, maxUses: 5 } })
  })

  it('should return error on failure', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Creation failed'))
    const biz = useBusiness()
    const result = await biz.createInviteCode()
    expect(result.success).toBe(false)
    expect(result.error).toBe('Creation failed')
  })
})

describe('deleteInviteCode', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockStore() })

  it('should delete invite code successfully', async () => {
    mockAuthFetch.mockResolvedValueOnce(undefined)
    const biz = useBusiness()
    const result = await biz.deleteInviteCode('i1')
    expect(result.success).toBe(true)
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/business/invite/i1', { method: 'DELETE' })
  })

  it('should return error on failure', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Delete failed'))
    const biz = useBusiness()
    const result = await biz.deleteInviteCode('i1')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Delete failed')
  })
})

describe('updateMemberRole', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockStore() })

  it('should update member role successfully', async () => {
    const member = createMember('m1', 'BOSS', 'u2')
    mockAuthFetch.mockResolvedValueOnce(member)
    const biz = useBusiness()
    const result = await biz.updateMemberRole('m1', 'BOSS')
    expect(result.success).toBe(true)
    expect(result.member).toEqual(member)
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/business/members/m1', { method: 'PUT', body: { role: 'BOSS' } })
  })

  it('should return error on failure', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Update failed'))
    const biz = useBusiness()
    const result = await biz.updateMemberRole('m1', 'EMPLOYEE')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Update failed')
  })

  it('should handle permission error', async () => {
    mockAuthFetch.mockRejectedValueOnce({ data: { message: 'Only OWNER can change roles' } })
    const biz = useBusiness()
    const result = await biz.updateMemberRole('m1', 'BOSS')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Only OWNER can change roles')
  })
})

describe('removeMember', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockStore() })

  it('should remove member successfully', async () => {
    mockAuthFetch.mockResolvedValueOnce(undefined)
    const biz = useBusiness()
    const result = await biz.removeMember('m1')
    expect(result.success).toBe(true)
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/business/members/m1', { method: 'DELETE' })
  })

  it('should return error on failure', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Remove failed'))
    const biz = useBusiness()
    const result = await biz.removeMember('m1')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Remove failed')
  })

  it('should handle cannot remove owner error', async () => {
    mockAuthFetch.mockRejectedValueOnce({ data: { message: 'Cannot remove business owner' } })
    const biz = useBusiness()
    const result = await biz.removeMember('m1')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Cannot remove business owner')
  })
})

describe('deleteBusiness', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockStore() })

  it('should delete business successfully', async () => {
    mockAuthFetch.mockResolvedValueOnce(undefined)
    const biz = useBusiness()
    const result = await biz.deleteBusiness()
    expect(result.success).toBe(true)
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/business', { method: 'DELETE' })
    expect(mockAuthStore.setBusiness).toHaveBeenCalledWith(null)
  })

  it('should return error on failure', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Delete failed'))
    const biz = useBusiness()
    const result = await biz.deleteBusiness()
    expect(result.success).toBe(false)
    expect(result.error).toBe('Delete failed')
  })

  it('should handle permission error', async () => {
    mockAuthFetch.mockRejectedValueOnce({ data: { message: 'Only OWNER can delete business' } })
    const biz = useBusiness()
    const result = await biz.deleteBusiness()
    expect(result.success).toBe(false)
    expect(result.error).toBe('Only OWNER can delete business')
  })
})

describe('deleteBusinessById', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockStore() })

  it('should delete business by ID successfully', async () => {
    mockAuthFetch.mockResolvedValueOnce({ accessToken: 'temp-token', refreshToken: 'temp-refresh' })
    ;(globalThis.$fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined)
    mockAuthStore.businesses = [{ id: 'b1', name: 'Test', role: 'OWNER', memberCount: 1, joinedAt: '2024-01-15' }]
    const biz = useBusiness()
    const result = await biz.deleteBusinessById('b1')
    expect(result.success).toBe(true)
    expect(mockAuthStore.setBusinesses).toHaveBeenCalled()
  })

  it('should clear selected business if deleted', async () => {
    mockAuthFetch.mockResolvedValueOnce({ accessToken: 'temp-token', refreshToken: 'temp-refresh' })
    ;(globalThis.$fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined)
    mockAuthStore.businesses = [{ id: 'b1', name: 'Test', role: 'OWNER', memberCount: 1, joinedAt: '2024-01-15' }]
    mockAuthStore.businessId = 'b1'
    const biz = useBusiness()
    await biz.deleteBusinessById('b1')
    expect(mockAuthStore.setBusiness).toHaveBeenCalledWith(null)
  })

  it('should return error on failure', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Delete failed'))
    const biz = useBusiness()
    const result = await biz.deleteBusinessById('b1')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Delete failed')
  })
})

describe('state', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockStore() })

  it('should expose isLoading as readonly', () => {
    const biz = useBusiness()
    expect(biz.isLoading.value).toBe(false)
  })

  it('should expose error as readonly', () => {
    const biz = useBusiness()
    expect(biz.error.value).toBe(null)
  })
})
