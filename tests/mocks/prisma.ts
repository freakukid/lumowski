import { vi, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { mockDeep, mockReset } from 'vitest-mock-extended'
import type { DeepMockProxy } from 'vitest-mock-extended'

// Create a deep mock of Prisma Client
export const prismaMock = mockDeep<PrismaClient>()

// Type for the mocked Prisma client
export type MockPrismaClient = DeepMockProxy<PrismaClient>

// Reset the mock before each test
beforeEach(() => {
  mockReset(prismaMock)
})

// Mock the prisma module
vi.mock('~/server/utils/prisma', () => ({
  prisma: prismaMock
}))

// Helper to create mock inventory items
export function createMockInventoryItem(overrides = {}) {
  return {
    id: 'test-item-1',
    userId: 'test-user-1',
    schemaId: 'test-schema-1',
    data: { name: 'Test Item', quantity: 100 },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

// Helper to create mock users
export function createMockUser(overrides = {}) {
  return {
    id: 'test-user-1',
    email: 'test@example.com',
    password: 'hashed-password',
    name: 'Test User',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

// Helper to create mock schemas
export function createMockSchema(overrides = {}) {
  return {
    id: 'test-schema-1',
    userId: 'test-user-1',
    name: 'Default Schema',
    columns: [
      { id: 'name', name: 'Name', type: 'text', role: 'name', order: 0, required: true },
      { id: 'quantity', name: 'Quantity', type: 'number', role: 'quantity', order: 1 },
      { id: 'price', name: 'Price', type: 'currency', role: 'price', order: 2 }
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}
