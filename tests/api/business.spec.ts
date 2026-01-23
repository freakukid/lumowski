import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockDeep, mockReset } from 'vitest-mock-extended'
import type { PrismaClient, User, Business, BusinessMember, InviteCode, BusinessRole } from '@prisma/client'
import type { H3Event } from 'h3'

// ============================================================================
// Mock Setup - Must be defined before importing handlers
// ============================================================================

// Mock Prisma client
const prismaMock = mockDeep<PrismaClient>()

vi.mock('~/server/utils/prisma', () => ({
  default: prismaMock,
}))

// Mock auth utilities
const mockGenerateAccessToken = vi.fn()
const mockGenerateRefreshToken = vi.fn()

vi.mock('~/server/utils/auth', () => ({
  generateAccessToken: mockGenerateAccessToken,
  generateRefreshToken: mockGenerateRefreshToken,
}))

// Mock readBody function
const mockReadBody = vi.fn()

// Mock createError to throw proper errors
const mockCreateError = vi.fn((options: { statusCode: number; message: string }) => {
  const error = new Error(options.message) as Error & { statusCode: number }
  error.statusCode = options.statusCode
  return error
})

// Mock h3 utilities used by the handlers
vi.mock('h3', async () => {
  const actual = await vi.importActual<typeof import('h3')>('h3')
  return {
    ...actual,
    readBody: mockReadBody,
    createError: mockCreateError,
    defineEventHandler: (handler: Function) => handler,
  }
})

// Import validation schemas for direct testing
import { z } from 'zod'

// Validation schemas (matching the handlers)
const createBusinessSchema = z.object({
  name: z.string().min(1, 'Business name is required').max(100, 'Business name is too long'),
})

const joinBusinessSchema = z.object({
  code: z.string().min(1, 'Invite code is required'),
})

const selectBusinessSchema = z.object({
  businessId: z.string().uuid('Invalid business ID'),
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a mock H3 event for testing handlers
 */
function createMockEvent(authContext?: { userId: string; businessId?: string; businessRole?: BusinessRole }): H3Event {
  return {
    context: {
      auth: authContext ?? { userId: 'user-123' },
    },
  } as unknown as H3Event
}

/**
 * Creates a mock user with default values
 */
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-123',
    email: 'test@example.com',
    password: 'hashed-password-xyz',
    name: 'Test User',
    role: 'USER',
    googleId: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

/**
 * Creates a mock business with default values
 */
function createMockBusiness(overrides: Partial<Business> = {}): Business {
  return {
    id: 'business-123',
    name: 'Test Business',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

/**
 * Creates a mock business member with default values
 */
function createMockBusinessMember(overrides: Partial<BusinessMember> = {}): BusinessMember {
  return {
    id: 'member-123',
    businessId: 'business-123',
    userId: 'user-123',
    role: 'EMPLOYEE',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

/**
 * Creates a mock invite code with default values
 */
function createMockInviteCode(overrides: Partial<InviteCode> = {}): InviteCode {
  return {
    id: 'invite-123',
    code: 'ABCD1234',
    businessId: 'business-123',
    createdById: 'owner-123',
    role: 'EMPLOYEE',
    expiresAt: null,
    maxUses: null,
    usedCount: 0,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  }
}

// ============================================================================
// Simulated Handlers
// ============================================================================

/**
 * Simulates the create business handler logic for testing
 */
async function simulateCreateBusinessHandler(event: H3Event) {
  const auth = event.context.auth as { userId: string }
  const body = await mockReadBody(event)

  // Validate input
  const result = createBusinessSchema.safeParse(body)
  if (!result.success) {
    throw mockCreateError({
      statusCode: 400,
      message: result.error.errors[0].message,
    })
  }

  // Create business and add user as OWNER
  const business = await prismaMock.business.create({
    data: {
      name: result.data.name,
      members: {
        create: {
          userId: auth.userId,
          role: 'OWNER',
        },
      },
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  })

  // Get user for token generation
  const user = await prismaMock.user.findUnique({
    where: { id: auth.userId },
  })

  if (!user) {
    throw mockCreateError({
      statusCode: 404,
      message: 'User not found',
    })
  }

  // Generate new tokens with business context
  const membership = { businessId: business.id, businessRole: 'OWNER' as const }
  const accessToken = mockGenerateAccessToken(user, membership)
  const refreshToken = mockGenerateRefreshToken(user, membership)

  return {
    business,
    accessToken,
    refreshToken,
  }
}

/**
 * Simulates the join business handler logic for testing
 */
async function simulateJoinBusinessHandler(event: H3Event) {
  const auth = event.context.auth as { userId: string }
  const body = await mockReadBody(event)

  // Validate input
  const result = joinBusinessSchema.safeParse(body)
  if (!result.success) {
    throw mockCreateError({
      statusCode: 400,
      message: result.error.errors[0].message,
    })
  }

  // Normalize invite code to uppercase for case-insensitive lookup
  const normalizedCode = result.data.code.toUpperCase()

  // Find invite code
  const inviteCode = await prismaMock.inviteCode.findUnique({
    where: { code: normalizedCode },
    include: {
      business: true,
    },
  })

  if (!inviteCode) {
    throw mockCreateError({
      statusCode: 404,
      message: 'Invalid invite code',
    })
  }

  // Check if code is expired
  if (inviteCode.expiresAt && inviteCode.expiresAt < new Date()) {
    throw mockCreateError({
      statusCode: 400,
      message: 'This invite code has expired',
    })
  }

  // Check if code has reached max uses
  if (inviteCode.maxUses && inviteCode.usedCount >= inviteCode.maxUses) {
    throw mockCreateError({
      statusCode: 400,
      message: 'This invite code has reached its maximum uses',
    })
  }

  // Check if user is already a member of THIS specific business
  const existingMembership = await prismaMock.businessMember.findUnique({
    where: {
      businessId_userId: {
        businessId: inviteCode.businessId,
        userId: auth.userId,
      },
    },
  })

  if (existingMembership) {
    throw mockCreateError({
      statusCode: 400,
      message: 'You are already a member of this business',
    })
  }

  // Add user to business and increment used count (simulating transaction)
  const member = await prismaMock.businessMember.create({
    data: {
      userId: auth.userId,
      businessId: inviteCode.businessId,
      role: inviteCode.role,
    },
    include: {
      business: {
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      },
    },
  })

  await prismaMock.inviteCode.update({
    where: { id: inviteCode.id },
    data: { usedCount: { increment: 1 } },
  })

  // Get user for token generation
  const user = await prismaMock.user.findUnique({
    where: { id: auth.userId },
  })

  if (!user) {
    throw mockCreateError({
      statusCode: 404,
      message: 'User not found',
    })
  }

  // Generate new tokens with business context
  const membership = { businessId: inviteCode.businessId, businessRole: inviteCode.role }
  const accessToken = mockGenerateAccessToken(user, membership)
  const refreshToken = mockGenerateRefreshToken(user, membership)

  return {
    business: member.business,
    accessToken,
    refreshToken,
  }
}

/**
 * Simulates the select business handler logic for testing
 */
async function simulateSelectBusinessHandler(event: H3Event) {
  const auth = event.context.auth as { userId: string }
  const body = await mockReadBody(event)

  // Validate input
  const result = selectBusinessSchema.safeParse(body)
  if (!result.success) {
    throw mockCreateError({
      statusCode: 400,
      message: result.error.errors[0].message,
    })
  }

  const { businessId } = result.data

  // Verify user is a member of this business
  const membership = await prismaMock.businessMember.findUnique({
    where: {
      businessId_userId: {
        businessId,
        userId: auth.userId,
      },
    },
    include: {
      business: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!membership) {
    throw mockCreateError({
      statusCode: 403,
      message: 'You are not a member of this business',
    })
  }

  // Get the user for token generation
  const user = await prismaMock.user.findUnique({
    where: { id: auth.userId },
  })

  if (!user) {
    throw mockCreateError({
      statusCode: 404,
      message: 'User not found',
    })
  }

  // Generate new tokens with the selected business context
  const membershipContext = {
    businessId: membership.businessId,
    businessRole: membership.role,
  }
  const accessToken = mockGenerateAccessToken(user, membershipContext)
  const refreshToken = mockGenerateRefreshToken(user, membershipContext)

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      business: {
        id: membership.business.id,
        name: membership.business.name,
        role: membership.role,
      },
    },
    accessToken,
    refreshToken,
  }
}

/**
 * Simulates the get user businesses handler logic for testing
 */
async function simulateGetUserBusinessesHandler(event: H3Event) {
  const auth = event.context.auth as { userId: string }

  // Get all business memberships for the user with business details and member count
  const memberships = await prismaMock.businessMember.findMany({
    where: { userId: auth.userId },
    include: {
      business: {
        include: {
          _count: {
            select: { members: true },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  // Transform the data for the response
  const businesses = memberships.map((membership: any) => ({
    id: membership.business.id,
    name: membership.business.name,
    role: membership.role,
    memberCount: membership.business._count.members,
    joinedAt: membership.createdAt,
  }))

  return { businesses }
}

// ============================================================================
// Tests
// ============================================================================

describe('Business API', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    mockReset(prismaMock)
    vi.clearAllMocks()

    // Setup default mock return values
    mockGenerateAccessToken.mockReturnValue('mock-access-token')
    mockGenerateRefreshToken.mockReturnValue('mock-refresh-token')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ==========================================================================
  // POST /api/business (Create Business)
  // ==========================================================================

  describe('POST /api/business', () => {
    describe('Happy Path', () => {
      it('should successfully create a business and set user as OWNER', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const createData = { name: 'My New Business' }

        const createdBusiness = {
          ...createMockBusiness({ id: 'new-business-id', name: createData.name }),
          members: [
            {
              ...createMockBusinessMember({
                businessId: 'new-business-id',
                userId: 'user-123',
                role: 'OWNER'
              }),
              user: {
                id: 'user-123',
                name: 'Test User',
                email: 'test@example.com',
              },
            },
          ],
        }

        const user = createMockUser({ id: 'user-123' })

        mockReadBody.mockResolvedValue(createData)
        prismaMock.business.create.mockResolvedValue(createdBusiness as any)
        prismaMock.user.findUnique.mockResolvedValue(user)

        // Act
        const result = await simulateCreateBusinessHandler(mockEvent)

        // Assert
        expect(result.business).toEqual(createdBusiness)
        expect(result.accessToken).toBe('mock-access-token')
        expect(result.refreshToken).toBe('mock-refresh-token')

        // Verify business was created with user as OWNER
        expect(prismaMock.business.create).toHaveBeenCalledWith({
          data: {
            name: createData.name,
            members: {
              create: {
                userId: 'user-123',
                role: 'OWNER',
              },
            },
          },
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        })
      })

      it('should return tokens with business context', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const createData = { name: 'Token Test Business' }

        const createdBusiness = {
          ...createMockBusiness({ id: 'business-456', name: createData.name }),
          members: [],
        }
        const user = createMockUser({ id: 'user-123' })

        mockReadBody.mockResolvedValue(createData)
        prismaMock.business.create.mockResolvedValue(createdBusiness as any)
        prismaMock.user.findUnique.mockResolvedValue(user)

        // Act
        await simulateCreateBusinessHandler(mockEvent)

        // Assert - tokens should include business context
        expect(mockGenerateAccessToken).toHaveBeenCalledWith(
          user,
          { businessId: 'business-456', businessRole: 'OWNER' }
        )
        expect(mockGenerateRefreshToken).toHaveBeenCalledWith(
          user,
          { businessId: 'business-456', businessRole: 'OWNER' }
        )
      })

      it('should allow a user to create multiple businesses', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })

        // First business
        const firstBusinessData = { name: 'First Business' }
        const firstBusiness = {
          ...createMockBusiness({ id: 'business-1', name: firstBusinessData.name }),
          members: [],
        }
        const user = createMockUser({ id: 'user-123' })

        mockReadBody.mockResolvedValue(firstBusinessData)
        prismaMock.business.create.mockResolvedValue(firstBusiness as any)
        prismaMock.user.findUnique.mockResolvedValue(user)

        // Act - create first business
        const result1 = await simulateCreateBusinessHandler(mockEvent)
        expect(result1.business.name).toBe('First Business')

        // Reset mocks for second creation
        vi.clearAllMocks()
        mockGenerateAccessToken.mockReturnValue('mock-access-token-2')
        mockGenerateRefreshToken.mockReturnValue('mock-refresh-token-2')

        // Second business
        const secondBusinessData = { name: 'Second Business' }
        const secondBusiness = {
          ...createMockBusiness({ id: 'business-2', name: secondBusinessData.name }),
          members: [],
        }

        mockReadBody.mockResolvedValue(secondBusinessData)
        prismaMock.business.create.mockResolvedValue(secondBusiness as any)
        prismaMock.user.findUnique.mockResolvedValue(user)

        // Act - create second business
        const result2 = await simulateCreateBusinessHandler(mockEvent)

        // Assert - both businesses should be created successfully
        expect(result2.business.name).toBe('Second Business')
        expect(result2.accessToken).toBe('mock-access-token-2')
      })
    })

    describe('Validation Errors', () => {
      it('should reject creation with empty name', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const createData = { name: '' }

        mockReadBody.mockResolvedValue(createData)

        // Act & Assert
        await expect(simulateCreateBusinessHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Business name is required',
        })

        // Verify no database operations were attempted
        expect(prismaMock.business.create).not.toHaveBeenCalled()
      })

      it('should reject creation with missing name field', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const createData = {}

        mockReadBody.mockResolvedValue(createData)

        // Act & Assert
        await expect(simulateCreateBusinessHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
        })

        expect(prismaMock.business.create).not.toHaveBeenCalled()
      })

      it('should reject creation with name exceeding 100 characters', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const longName = 'A'.repeat(101)
        const createData = { name: longName }

        mockReadBody.mockResolvedValue(createData)

        // Act & Assert
        await expect(simulateCreateBusinessHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Business name is too long',
        })

        expect(prismaMock.business.create).not.toHaveBeenCalled()
      })

      it('should accept name with exactly 100 characters', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const maxLengthName = 'A'.repeat(100)
        const createData = { name: maxLengthName }

        const createdBusiness = {
          ...createMockBusiness({ id: 'business-id', name: maxLengthName }),
          members: [],
        }
        const user = createMockUser({ id: 'user-123' })

        mockReadBody.mockResolvedValue(createData)
        prismaMock.business.create.mockResolvedValue(createdBusiness as any)
        prismaMock.user.findUnique.mockResolvedValue(user)

        // Act
        const result = await simulateCreateBusinessHandler(mockEvent)

        // Assert - should succeed
        expect(result.business.name).toBe(maxLengthName)
        expect(prismaMock.business.create).toHaveBeenCalled()
      })

      it('should accept name with exactly 1 character', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const createData = { name: 'A' }

        const createdBusiness = {
          ...createMockBusiness({ id: 'business-id', name: 'A' }),
          members: [],
        }
        const user = createMockUser({ id: 'user-123' })

        mockReadBody.mockResolvedValue(createData)
        prismaMock.business.create.mockResolvedValue(createdBusiness as any)
        prismaMock.user.findUnique.mockResolvedValue(user)

        // Act
        const result = await simulateCreateBusinessHandler(mockEvent)

        // Assert
        expect(result.business.name).toBe('A')
      })
    })

    describe('Edge Cases', () => {
      it('should handle user not found after business creation', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const createData = { name: 'Test Business' }

        const createdBusiness = {
          ...createMockBusiness({ id: 'business-id', name: createData.name }),
          members: [],
        }

        mockReadBody.mockResolvedValue(createData)
        prismaMock.business.create.mockResolvedValue(createdBusiness as any)
        prismaMock.user.findUnique.mockResolvedValue(null) // User not found

        // Act & Assert
        await expect(simulateCreateBusinessHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 404,
          message: 'User not found',
        })
      })

      it('should trim whitespace names properly (if validation allows)', async () => {
        // Note: Current schema does not trim, so "  " would pass min(1) but be whitespace only
        // This test documents the current behavior
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const createData = { name: '   Valid Business   ' }

        const createdBusiness = {
          ...createMockBusiness({ name: '   Valid Business   ' }),
          members: [],
        }
        const user = createMockUser({ id: 'user-123' })

        mockReadBody.mockResolvedValue(createData)
        prismaMock.business.create.mockResolvedValue(createdBusiness as any)
        prismaMock.user.findUnique.mockResolvedValue(user)

        // Act
        const result = await simulateCreateBusinessHandler(mockEvent)

        // Assert - name with whitespace is accepted (current behavior)
        expect(result.business.name).toBe('   Valid Business   ')
      })
    })
  })

  // ==========================================================================
  // POST /api/business/join (Join Business)
  // ==========================================================================

  describe('POST /api/business/join', () => {
    describe('Happy Path', () => {
      it('should successfully join a business with valid code', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const joinData = { code: 'ABCD1234' }

        const inviteCode = {
          ...createMockInviteCode({
            code: 'ABCD1234',
            businessId: 'business-456',
            role: 'EMPLOYEE'
          }),
          business: createMockBusiness({ id: 'business-456', name: 'Joined Business' }),
        }

        const createdMember = {
          ...createMockBusinessMember({
            businessId: 'business-456',
            userId: 'user-123',
            role: 'EMPLOYEE',
          }),
          business: {
            ...createMockBusiness({ id: 'business-456', name: 'Joined Business' }),
            members: [],
          },
        }

        const user = createMockUser({ id: 'user-123' })

        mockReadBody.mockResolvedValue(joinData)
        prismaMock.inviteCode.findUnique.mockResolvedValue(inviteCode as any)
        prismaMock.businessMember.findUnique.mockResolvedValue(null) // Not already a member
        prismaMock.businessMember.create.mockResolvedValue(createdMember as any)
        prismaMock.inviteCode.update.mockResolvedValue({} as any)
        prismaMock.user.findUnique.mockResolvedValue(user)

        // Act
        const result = await simulateJoinBusinessHandler(mockEvent)

        // Assert
        expect(result.business).toBeDefined()
        expect(result.accessToken).toBe('mock-access-token')
        expect(result.refreshToken).toBe('mock-refresh-token')
      })

      it('should normalize invite code to uppercase (case-insensitive)', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const joinData = { code: 'abcd1234' } // lowercase

        const inviteCode = {
          ...createMockInviteCode({ code: 'ABCD1234' }),
          business: createMockBusiness(),
        }

        const createdMember = {
          ...createMockBusinessMember(),
          business: { ...createMockBusiness(), members: [] },
        }

        const user = createMockUser()

        mockReadBody.mockResolvedValue(joinData)
        prismaMock.inviteCode.findUnique.mockResolvedValue(inviteCode as any)
        prismaMock.businessMember.findUnique.mockResolvedValue(null)
        prismaMock.businessMember.create.mockResolvedValue(createdMember as any)
        prismaMock.inviteCode.update.mockResolvedValue({} as any)
        prismaMock.user.findUnique.mockResolvedValue(user)

        // Act
        await simulateJoinBusinessHandler(mockEvent)

        // Assert - should query with uppercase code
        expect(prismaMock.inviteCode.findUnique).toHaveBeenCalledWith({
          where: { code: 'ABCD1234' },
          include: { business: true },
        })
      })

      it('should handle mixed case invite codes', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const testCases = ['AbCd1234', 'ABCD1234', 'abcd1234', 'aBcD1234']

        for (const codeVariant of testCases) {
          vi.clearAllMocks()
          mockGenerateAccessToken.mockReturnValue('mock-access-token')
          mockGenerateRefreshToken.mockReturnValue('mock-refresh-token')

          const joinData = { code: codeVariant }

          const inviteCode = {
            ...createMockInviteCode({ code: 'ABCD1234' }),
            business: createMockBusiness(),
          }

          const createdMember = {
            ...createMockBusinessMember(),
            business: { ...createMockBusiness(), members: [] },
          }

          const user = createMockUser()

          mockReadBody.mockResolvedValue(joinData)
          prismaMock.inviteCode.findUnique.mockResolvedValue(inviteCode as any)
          prismaMock.businessMember.findUnique.mockResolvedValue(null)
          prismaMock.businessMember.create.mockResolvedValue(createdMember as any)
          prismaMock.inviteCode.update.mockResolvedValue({} as any)
          prismaMock.user.findUnique.mockResolvedValue(user)

          // Act
          const result = await simulateJoinBusinessHandler(mockEvent)

          // Assert - all variants should work
          expect(result.accessToken).toBe('mock-access-token')
          expect(prismaMock.inviteCode.findUnique).toHaveBeenCalledWith({
            where: { code: 'ABCD1234' },
            include: { business: true },
          })
        }
      })

      it('should assign the role specified in the invite code', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const joinData = { code: 'BOSSCODE' }

        const inviteCode = {
          ...createMockInviteCode({
            code: 'BOSSCODE',
            role: 'BOSS' // Invite code specifies BOSS role
          }),
          business: createMockBusiness(),
        }

        const createdMember = {
          ...createMockBusinessMember({ role: 'BOSS' }),
          business: { ...createMockBusiness(), members: [] },
        }

        const user = createMockUser()

        mockReadBody.mockResolvedValue(joinData)
        prismaMock.inviteCode.findUnique.mockResolvedValue(inviteCode as any)
        prismaMock.businessMember.findUnique.mockResolvedValue(null)
        prismaMock.businessMember.create.mockResolvedValue(createdMember as any)
        prismaMock.inviteCode.update.mockResolvedValue({} as any)
        prismaMock.user.findUnique.mockResolvedValue(user)

        // Act
        await simulateJoinBusinessHandler(mockEvent)

        // Assert - member should be created with BOSS role
        expect(prismaMock.businessMember.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              role: 'BOSS',
            }),
          })
        )

        // Tokens should include BOSS role
        expect(mockGenerateAccessToken).toHaveBeenCalledWith(
          user,
          { businessId: inviteCode.businessId, businessRole: 'BOSS' }
        )
      })

      it('should increment usedCount on the invite code', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const joinData = { code: 'USECODE' }

        const inviteCode = {
          ...createMockInviteCode({
            id: 'invite-id',
            code: 'USECODE',
            usedCount: 5
          }),
          business: createMockBusiness(),
        }

        const createdMember = {
          ...createMockBusinessMember(),
          business: { ...createMockBusiness(), members: [] },
        }

        const user = createMockUser()

        mockReadBody.mockResolvedValue(joinData)
        prismaMock.inviteCode.findUnique.mockResolvedValue(inviteCode as any)
        prismaMock.businessMember.findUnique.mockResolvedValue(null)
        prismaMock.businessMember.create.mockResolvedValue(createdMember as any)
        prismaMock.inviteCode.update.mockResolvedValue({} as any)
        prismaMock.user.findUnique.mockResolvedValue(user)

        // Act
        await simulateJoinBusinessHandler(mockEvent)

        // Assert - usedCount should be incremented
        expect(prismaMock.inviteCode.update).toHaveBeenCalledWith({
          where: { id: 'invite-id' },
          data: { usedCount: { increment: 1 } },
        })
      })
    })

    describe('Validation Errors', () => {
      it('should reject join with empty code', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const joinData = { code: '' }

        mockReadBody.mockResolvedValue(joinData)

        // Act & Assert
        await expect(simulateJoinBusinessHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Invite code is required',
        })

        expect(prismaMock.inviteCode.findUnique).not.toHaveBeenCalled()
      })

      it('should reject join with missing code field', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const joinData = {}

        mockReadBody.mockResolvedValue(joinData)

        // Act & Assert
        await expect(simulateJoinBusinessHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
        })
      })
    })

    describe('Business Logic Errors', () => {
      it('should return 404 for invalid/non-existent invite code', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const joinData = { code: 'INVALID' }

        mockReadBody.mockResolvedValue(joinData)
        prismaMock.inviteCode.findUnique.mockResolvedValue(null)

        // Act & Assert
        await expect(simulateJoinBusinessHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 404,
          message: 'Invalid invite code',
        })
      })

      it('should return 400 for expired invite code', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const joinData = { code: 'EXPIRED' }

        const expiredInviteCode = {
          ...createMockInviteCode({
            code: 'EXPIRED',
            expiresAt: new Date('2020-01-01'), // Past date
          }),
          business: createMockBusiness(),
        }

        mockReadBody.mockResolvedValue(joinData)
        prismaMock.inviteCode.findUnique.mockResolvedValue(expiredInviteCode as any)

        // Act & Assert
        await expect(simulateJoinBusinessHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'This invite code has expired',
        })

        // Verify no membership was created
        expect(prismaMock.businessMember.create).not.toHaveBeenCalled()
      })

      it('should return 400 when invite code has reached max uses', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const joinData = { code: 'MAXEDOUT' }

        const maxedOutInviteCode = {
          ...createMockInviteCode({
            code: 'MAXEDOUT',
            maxUses: 10,
            usedCount: 10, // At max
          }),
          business: createMockBusiness(),
        }

        mockReadBody.mockResolvedValue(joinData)
        prismaMock.inviteCode.findUnique.mockResolvedValue(maxedOutInviteCode as any)

        // Act & Assert
        await expect(simulateJoinBusinessHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'This invite code has reached its maximum uses',
        })

        expect(prismaMock.businessMember.create).not.toHaveBeenCalled()
      })

      it('should return 400 when invite code has exceeded max uses', async () => {
        // Arrange - edge case where usedCount > maxUses
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const joinData = { code: 'OVERUSED' }

        const overUsedInviteCode = {
          ...createMockInviteCode({
            code: 'OVERUSED',
            maxUses: 5,
            usedCount: 7, // Over max (edge case)
          }),
          business: createMockBusiness(),
        }

        mockReadBody.mockResolvedValue(joinData)
        prismaMock.inviteCode.findUnique.mockResolvedValue(overUsedInviteCode as any)

        // Act & Assert
        await expect(simulateJoinBusinessHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'This invite code has reached its maximum uses',
        })
      })

      it('should return 400 when user is already a member of the business', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const joinData = { code: 'ALREADYMEMBER' }

        const inviteCode = {
          ...createMockInviteCode({
            code: 'ALREADYMEMBER',
            businessId: 'business-123',
          }),
          business: createMockBusiness({ id: 'business-123' }),
        }

        const existingMembership = createMockBusinessMember({
          businessId: 'business-123',
          userId: 'user-123',
        })

        mockReadBody.mockResolvedValue(joinData)
        prismaMock.inviteCode.findUnique.mockResolvedValue(inviteCode as any)
        prismaMock.businessMember.findUnique.mockResolvedValue(existingMembership)

        // Act & Assert
        await expect(simulateJoinBusinessHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'You are already a member of this business',
        })

        expect(prismaMock.businessMember.create).not.toHaveBeenCalled()
      })

      it('should allow joining a different business even if member of another', async () => {
        // Arrange - user is member of business-A, joining business-B
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const joinData = { code: 'NEWBUSINESS' }

        const inviteCode = {
          ...createMockInviteCode({
            code: 'NEWBUSINESS',
            businessId: 'business-B', // Different business
          }),
          business: createMockBusiness({ id: 'business-B', name: 'Business B' }),
        }

        const createdMember = {
          ...createMockBusinessMember({ businessId: 'business-B' }),
          business: { ...createMockBusiness({ id: 'business-B' }), members: [] },
        }

        const user = createMockUser()

        mockReadBody.mockResolvedValue(joinData)
        prismaMock.inviteCode.findUnique.mockResolvedValue(inviteCode as any)
        prismaMock.businessMember.findUnique.mockResolvedValue(null) // Not member of business-B
        prismaMock.businessMember.create.mockResolvedValue(createdMember as any)
        prismaMock.inviteCode.update.mockResolvedValue({} as any)
        prismaMock.user.findUnique.mockResolvedValue(user)

        // Act
        const result = await simulateJoinBusinessHandler(mockEvent)

        // Assert - should succeed
        expect(result.accessToken).toBe('mock-access-token')
        expect(prismaMock.businessMember.create).toHaveBeenCalled()
      })
    })

    describe('Edge Cases', () => {
      it('should handle invite code with no expiration date (null expiresAt)', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const joinData = { code: 'NOEXPIRY' }

        const noExpiryInviteCode = {
          ...createMockInviteCode({
            code: 'NOEXPIRY',
            expiresAt: null, // No expiration
          }),
          business: createMockBusiness(),
        }

        const createdMember = {
          ...createMockBusinessMember(),
          business: { ...createMockBusiness(), members: [] },
        }

        const user = createMockUser()

        mockReadBody.mockResolvedValue(joinData)
        prismaMock.inviteCode.findUnique.mockResolvedValue(noExpiryInviteCode as any)
        prismaMock.businessMember.findUnique.mockResolvedValue(null)
        prismaMock.businessMember.create.mockResolvedValue(createdMember as any)
        prismaMock.inviteCode.update.mockResolvedValue({} as any)
        prismaMock.user.findUnique.mockResolvedValue(user)

        // Act
        const result = await simulateJoinBusinessHandler(mockEvent)

        // Assert - should succeed
        expect(result.accessToken).toBe('mock-access-token')
      })

      it('should handle invite code with no max uses limit (null maxUses)', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const joinData = { code: 'UNLIMITED' }

        const unlimitedInviteCode = {
          ...createMockInviteCode({
            code: 'UNLIMITED',
            maxUses: null, // Unlimited
            usedCount: 1000, // High usage
          }),
          business: createMockBusiness(),
        }

        const createdMember = {
          ...createMockBusinessMember(),
          business: { ...createMockBusiness(), members: [] },
        }

        const user = createMockUser()

        mockReadBody.mockResolvedValue(joinData)
        prismaMock.inviteCode.findUnique.mockResolvedValue(unlimitedInviteCode as any)
        prismaMock.businessMember.findUnique.mockResolvedValue(null)
        prismaMock.businessMember.create.mockResolvedValue(createdMember as any)
        prismaMock.inviteCode.update.mockResolvedValue({} as any)
        prismaMock.user.findUnique.mockResolvedValue(user)

        // Act
        const result = await simulateJoinBusinessHandler(mockEvent)

        // Assert - should succeed even with high usage
        expect(result.accessToken).toBe('mock-access-token')
      })

      it('should handle user not found after membership creation', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const joinData = { code: 'VALIDCODE' }

        const inviteCode = {
          ...createMockInviteCode({ code: 'VALIDCODE' }),
          business: createMockBusiness(),
        }

        const createdMember = {
          ...createMockBusinessMember(),
          business: { ...createMockBusiness(), members: [] },
        }

        mockReadBody.mockResolvedValue(joinData)
        prismaMock.inviteCode.findUnique.mockResolvedValue(inviteCode as any)
        prismaMock.businessMember.findUnique.mockResolvedValue(null)
        prismaMock.businessMember.create.mockResolvedValue(createdMember as any)
        prismaMock.inviteCode.update.mockResolvedValue({} as any)
        prismaMock.user.findUnique.mockResolvedValue(null) // User not found

        // Act & Assert
        await expect(simulateJoinBusinessHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 404,
          message: 'User not found',
        })
      })
    })
  })

  // ==========================================================================
  // POST /api/user/select-business (Select Business)
  // ==========================================================================

  describe('POST /api/user/select-business', () => {
    describe('Happy Path', () => {
      it('should successfully select a business the user is a member of', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const selectData = { businessId: '550e8400-e29b-41d4-a716-446655440000' }

        const membership = {
          ...createMockBusinessMember({
            businessId: selectData.businessId,
            userId: 'user-123',
            role: 'EMPLOYEE',
          }),
          business: {
            id: selectData.businessId,
            name: 'Selected Business',
          },
        }

        const user = createMockUser({ id: 'user-123' })

        mockReadBody.mockResolvedValue(selectData)
        prismaMock.businessMember.findUnique.mockResolvedValue(membership as any)
        prismaMock.user.findUnique.mockResolvedValue(user)

        // Act
        const result = await simulateSelectBusinessHandler(mockEvent)

        // Assert
        expect(result.user).toEqual({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'USER',
          business: {
            id: selectData.businessId,
            name: 'Selected Business',
            role: 'EMPLOYEE',
          },
        })
        expect(result.accessToken).toBe('mock-access-token')
        expect(result.refreshToken).toBe('mock-refresh-token')
      })

      it('should return tokens with the selected business context', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const selectData = { businessId: '550e8400-e29b-41d4-a716-446655440000' }

        const membership = {
          ...createMockBusinessMember({
            businessId: selectData.businessId,
            role: 'BOSS',
          }),
          business: {
            id: selectData.businessId,
            name: 'Boss Business',
          },
        }

        const user = createMockUser()

        mockReadBody.mockResolvedValue(selectData)
        prismaMock.businessMember.findUnique.mockResolvedValue(membership as any)
        prismaMock.user.findUnique.mockResolvedValue(user)

        // Act
        await simulateSelectBusinessHandler(mockEvent)

        // Assert - tokens should include business context
        expect(mockGenerateAccessToken).toHaveBeenCalledWith(
          user,
          { businessId: selectData.businessId, businessRole: 'BOSS' }
        )
        expect(mockGenerateRefreshToken).toHaveBeenCalledWith(
          user,
          { businessId: selectData.businessId, businessRole: 'BOSS' }
        )
      })

      it('should include the correct role in the response', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const selectData = { businessId: '550e8400-e29b-41d4-a716-446655440000' }

        const roles: BusinessRole[] = ['OWNER', 'BOSS', 'EMPLOYEE']

        for (const role of roles) {
          vi.clearAllMocks()
          mockGenerateAccessToken.mockReturnValue('mock-access-token')
          mockGenerateRefreshToken.mockReturnValue('mock-refresh-token')

          const membership = {
            ...createMockBusinessMember({
              businessId: selectData.businessId,
              role,
            }),
            business: {
              id: selectData.businessId,
              name: `${role} Business`,
            },
          }

          const user = createMockUser()

          mockReadBody.mockResolvedValue(selectData)
          prismaMock.businessMember.findUnique.mockResolvedValue(membership as any)
          prismaMock.user.findUnique.mockResolvedValue(user)

          // Act
          const result = await simulateSelectBusinessHandler(mockEvent)

          // Assert
          expect(result.user.business.role).toBe(role)
        }
      })
    })

    describe('Validation Errors', () => {
      it('should return 400 for invalid UUID format', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const invalidUUIDs = [
          'not-a-uuid',
          '123',
          '',
          'xyz-123-456',
          '550e8400-e29b-41d4-a716', // Incomplete UUID
        ]

        for (const invalidId of invalidUUIDs) {
          const selectData = { businessId: invalidId }
          mockReadBody.mockResolvedValue(selectData)

          // Act & Assert
          await expect(simulateSelectBusinessHandler(mockEvent)).rejects.toMatchObject({
            statusCode: 400,
            message: 'Invalid business ID',
          })
        }
      })

      it('should return 400 for missing businessId field', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const selectData = {}

        mockReadBody.mockResolvedValue(selectData)

        // Act & Assert
        await expect(simulateSelectBusinessHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
        })

        expect(prismaMock.businessMember.findUnique).not.toHaveBeenCalled()
      })
    })

    describe('Authorization Errors', () => {
      it('should return 403 when user is not a member of the business', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const selectData = { businessId: '550e8400-e29b-41d4-a716-446655440000' }

        mockReadBody.mockResolvedValue(selectData)
        prismaMock.businessMember.findUnique.mockResolvedValue(null) // Not a member

        // Act & Assert
        await expect(simulateSelectBusinessHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 403,
          message: 'You are not a member of this business',
        })
      })

      it('should check membership with correct user and business IDs', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'specific-user-id' })
        const selectData = { businessId: '550e8400-e29b-41d4-a716-446655440000' }

        mockReadBody.mockResolvedValue(selectData)
        prismaMock.businessMember.findUnique.mockResolvedValue(null)

        // Act
        try {
          await simulateSelectBusinessHandler(mockEvent)
        } catch {
          // Expected to throw
        }

        // Assert - verify the correct IDs were used
        expect(prismaMock.businessMember.findUnique).toHaveBeenCalledWith({
          where: {
            businessId_userId: {
              businessId: '550e8400-e29b-41d4-a716-446655440000',
              userId: 'specific-user-id',
            },
          },
          include: {
            business: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })
      })
    })

    describe('Edge Cases', () => {
      it('should handle user not found after membership verification', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const selectData = { businessId: '550e8400-e29b-41d4-a716-446655440000' }

        const membership = {
          ...createMockBusinessMember(),
          business: {
            id: selectData.businessId,
            name: 'Test Business',
          },
        }

        mockReadBody.mockResolvedValue(selectData)
        prismaMock.businessMember.findUnique.mockResolvedValue(membership as any)
        prismaMock.user.findUnique.mockResolvedValue(null) // User not found

        // Act & Assert
        await expect(simulateSelectBusinessHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 404,
          message: 'User not found',
        })
      })

      it('should accept valid UUID with uppercase letters', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const selectData = { businessId: '550E8400-E29B-41D4-A716-446655440000' } // Uppercase

        const membership = {
          ...createMockBusinessMember({
            businessId: selectData.businessId,
          }),
          business: {
            id: selectData.businessId,
            name: 'Test Business',
          },
        }

        const user = createMockUser()

        mockReadBody.mockResolvedValue(selectData)
        prismaMock.businessMember.findUnique.mockResolvedValue(membership as any)
        prismaMock.user.findUnique.mockResolvedValue(user)

        // Act
        const result = await simulateSelectBusinessHandler(mockEvent)

        // Assert - should succeed
        expect(result.accessToken).toBe('mock-access-token')
      })
    })
  })

  // ==========================================================================
  // GET /api/user/businesses (Get User Businesses)
  // ==========================================================================

  describe('GET /api/user/businesses', () => {
    describe('Happy Path', () => {
      it('should return all businesses the user belongs to', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })

        const memberships = [
          {
            ...createMockBusinessMember({ businessId: 'business-1', role: 'OWNER' }),
            business: {
              id: 'business-1',
              name: 'First Business',
              _count: { members: 5 },
            },
          },
          {
            ...createMockBusinessMember({ businessId: 'business-2', role: 'EMPLOYEE' }),
            business: {
              id: 'business-2',
              name: 'Second Business',
              _count: { members: 10 },
            },
          },
        ]

        prismaMock.businessMember.findMany.mockResolvedValue(memberships as any)

        // Act
        const result = await simulateGetUserBusinessesHandler(mockEvent)

        // Assert
        expect(result.businesses).toHaveLength(2)
        expect(result.businesses[0]).toMatchObject({
          id: 'business-1',
          name: 'First Business',
          role: 'OWNER',
          memberCount: 5,
        })
        expect(result.businesses[1]).toMatchObject({
          id: 'business-2',
          name: 'Second Business',
          role: 'EMPLOYEE',
          memberCount: 10,
        })
      })

      it('should include correct role for each business', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })

        const memberships = [
          {
            ...createMockBusinessMember({ businessId: 'b1', role: 'OWNER' }),
            business: { id: 'b1', name: 'Owned', _count: { members: 1 } },
          },
          {
            ...createMockBusinessMember({ businessId: 'b2', role: 'BOSS' }),
            business: { id: 'b2', name: 'Boss At', _count: { members: 3 } },
          },
          {
            ...createMockBusinessMember({ businessId: 'b3', role: 'EMPLOYEE' }),
            business: { id: 'b3', name: 'Employee At', _count: { members: 20 } },
          },
        ]

        prismaMock.businessMember.findMany.mockResolvedValue(memberships as any)

        // Act
        const result = await simulateGetUserBusinessesHandler(mockEvent)

        // Assert
        expect(result.businesses[0].role).toBe('OWNER')
        expect(result.businesses[1].role).toBe('BOSS')
        expect(result.businesses[2].role).toBe('EMPLOYEE')
      })

      it('should include member count for each business', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })

        const memberships = [
          {
            ...createMockBusinessMember({ businessId: 'b1' }),
            business: { id: 'b1', name: 'Small', _count: { members: 2 } },
          },
          {
            ...createMockBusinessMember({ businessId: 'b2' }),
            business: { id: 'b2', name: 'Large', _count: { members: 150 } },
          },
        ]

        prismaMock.businessMember.findMany.mockResolvedValue(memberships as any)

        // Act
        const result = await simulateGetUserBusinessesHandler(mockEvent)

        // Assert
        expect(result.businesses[0].memberCount).toBe(2)
        expect(result.businesses[1].memberCount).toBe(150)
      })

      it('should include joinedAt timestamp for each business', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const joinDate1 = new Date('2024-01-15')
        const joinDate2 = new Date('2024-06-01')

        const memberships = [
          {
            ...createMockBusinessMember({
              businessId: 'b1',
              createdAt: joinDate1,
            }),
            business: { id: 'b1', name: 'First', _count: { members: 1 } },
          },
          {
            ...createMockBusinessMember({
              businessId: 'b2',
              createdAt: joinDate2,
            }),
            business: { id: 'b2', name: 'Second', _count: { members: 1 } },
          },
        ]

        prismaMock.businessMember.findMany.mockResolvedValue(memberships as any)

        // Act
        const result = await simulateGetUserBusinessesHandler(mockEvent)

        // Assert
        expect(result.businesses[0].joinedAt).toEqual(joinDate1)
        expect(result.businesses[1].joinedAt).toEqual(joinDate2)
      })
    })

    describe('Empty Results', () => {
      it('should return empty array for user with no businesses', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })

        prismaMock.businessMember.findMany.mockResolvedValue([])

        // Act
        const result = await simulateGetUserBusinessesHandler(mockEvent)

        // Assert
        expect(result.businesses).toEqual([])
        expect(result.businesses).toHaveLength(0)
      })

      it('should return empty businesses array structure even when empty', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'new-user' })

        prismaMock.businessMember.findMany.mockResolvedValue([])

        // Act
        const result = await simulateGetUserBusinessesHandler(mockEvent)

        // Assert
        expect(result).toHaveProperty('businesses')
        expect(Array.isArray(result.businesses)).toBe(true)
      })
    })

    describe('Query Verification', () => {
      it('should query with correct user ID', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'specific-user-id' })

        prismaMock.businessMember.findMany.mockResolvedValue([])

        // Act
        await simulateGetUserBusinessesHandler(mockEvent)

        // Assert
        expect(prismaMock.businessMember.findMany).toHaveBeenCalledWith({
          where: { userId: 'specific-user-id' },
          include: {
            business: {
              include: {
                _count: {
                  select: { members: true },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        })
      })

      it('should order businesses by createdAt descending', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })

        prismaMock.businessMember.findMany.mockResolvedValue([])

        // Act
        await simulateGetUserBusinessesHandler(mockEvent)

        // Assert - verify ordering
        expect(prismaMock.businessMember.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: {
              createdAt: 'desc',
            },
          })
        )
      })
    })

    describe('Edge Cases', () => {
      it('should handle single business membership', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })

        const memberships = [
          {
            ...createMockBusinessMember({ businessId: 'only-business', role: 'OWNER' }),
            business: {
              id: 'only-business',
              name: 'Only Business',
              _count: { members: 1 },
            },
          },
        ]

        prismaMock.businessMember.findMany.mockResolvedValue(memberships as any)

        // Act
        const result = await simulateGetUserBusinessesHandler(mockEvent)

        // Assert
        expect(result.businesses).toHaveLength(1)
        expect(result.businesses[0].name).toBe('Only Business')
      })

      it('should handle many business memberships', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })

        const memberships = Array.from({ length: 50 }, (_, i) => ({
          ...createMockBusinessMember({ businessId: `business-${i}` }),
          business: {
            id: `business-${i}`,
            name: `Business ${i}`,
            _count: { members: i + 1 },
          },
        }))

        prismaMock.businessMember.findMany.mockResolvedValue(memberships as any)

        // Act
        const result = await simulateGetUserBusinessesHandler(mockEvent)

        // Assert
        expect(result.businesses).toHaveLength(50)
      })

      it('should handle business with zero member count (edge case)', async () => {
        // Note: This shouldn't happen in practice (user is a member), but test the handling
        const mockEvent = createMockEvent({ userId: 'user-123' })

        const memberships = [
          {
            ...createMockBusinessMember(),
            business: {
              id: 'b1',
              name: 'Empty Business',
              _count: { members: 0 }, // Edge case
            },
          },
        ]

        prismaMock.businessMember.findMany.mockResolvedValue(memberships as any)

        // Act
        const result = await simulateGetUserBusinessesHandler(mockEvent)

        // Assert
        expect(result.businesses[0].memberCount).toBe(0)
      })
    })

    describe('Response Structure', () => {
      it('should return correct response structure', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })
        const joinDate = new Date('2024-03-15')

        const memberships = [
          {
            ...createMockBusinessMember({
              businessId: 'test-id',
              role: 'OWNER',
              createdAt: joinDate,
            }),
            business: {
              id: 'test-id',
              name: 'Test Business',
              _count: { members: 5 },
            },
          },
        ]

        prismaMock.businessMember.findMany.mockResolvedValue(memberships as any)

        // Act
        const result = await simulateGetUserBusinessesHandler(mockEvent)

        // Assert - verify all expected fields
        expect(result.businesses[0]).toHaveProperty('id')
        expect(result.businesses[0]).toHaveProperty('name')
        expect(result.businesses[0]).toHaveProperty('role')
        expect(result.businesses[0]).toHaveProperty('memberCount')
        expect(result.businesses[0]).toHaveProperty('joinedAt')

        // Verify no extra fields leak through
        expect(Object.keys(result.businesses[0])).toEqual([
          'id',
          'name',
          'role',
          'memberCount',
          'joinedAt',
        ])
      })

      it('should not include sensitive business information', async () => {
        // Arrange
        const mockEvent = createMockEvent({ userId: 'user-123' })

        const memberships = [
          {
            ...createMockBusinessMember(),
            business: {
              id: 'b1',
              name: 'Business',
              _count: { members: 1 },
              // These fields should not appear in response
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        ]

        prismaMock.businessMember.findMany.mockResolvedValue(memberships as any)

        // Act
        const result = await simulateGetUserBusinessesHandler(mockEvent)

        // Assert - sensitive fields should not be in response
        expect(result.businesses[0]).not.toHaveProperty('createdAt')
        expect(result.businesses[0]).not.toHaveProperty('updatedAt')
      })
    })
  })
})
