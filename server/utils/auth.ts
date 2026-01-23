import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import type { User, BusinessRole } from '@prisma/client'

const SALT_ROUNDS = 10

export interface JwtPayload {
  userId: string
  email: string
  role: string
  businessId: string | null
  businessRole: BusinessRole | null
}

export interface BusinessMembership {
  businessId: string
  businessRole: BusinessRole
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateAccessToken(user: User, membership?: BusinessMembership | null): string {
  const config = useRuntimeConfig()
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    businessId: membership?.businessId ?? null,
    businessRole: membership?.businessRole ?? null,
  }
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '15m' })
}

export function generateRefreshToken(user: User, membership?: BusinessMembership | null): string {
  const config = useRuntimeConfig()
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    businessId: membership?.businessId ?? null,
    businessRole: membership?.businessRole ?? null,
  }
  return jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: '7d' })
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    const config = useRuntimeConfig()
    return jwt.verify(token, config.jwtSecret) as JwtPayload
  } catch {
    return null
  }
}

export function verifyRefreshToken(token: string): JwtPayload | null {
  try {
    const config = useRuntimeConfig()
    return jwt.verify(token, config.jwtRefreshSecret) as JwtPayload
  } catch {
    return null
  }
}

/**
 * Represents both access and refresh tokens for authentication.
 */
export interface TokenPair {
  accessToken: string
  refreshToken: string
}

/**
 * Generates both access and refresh tokens for a user.
 * Convenience function that wraps generateAccessToken and generateRefreshToken.
 *
 * @param user - The user to generate tokens for
 * @param membership - Optional business membership context for the tokens
 * @returns Object containing both accessToken and refreshToken
 *
 * @example
 * ```typescript
 * const { accessToken, refreshToken } = generateTokenPair(user, membership)
 * return { accessToken, refreshToken }
 * ```
 */
export function generateTokenPair(user: User, membership?: BusinessMembership | null): TokenPair {
  return {
    accessToken: generateAccessToken(user, membership),
    refreshToken: generateRefreshToken(user, membership),
  }
}
