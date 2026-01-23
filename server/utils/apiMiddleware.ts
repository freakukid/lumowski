import type { H3Event, EventHandler, EventHandlerRequest } from 'h3'
import type { BusinessRole } from '~/types/user'
import type { JwtPayload } from '~/server/utils/auth'
import { requireBusiness, requireRole } from '~/server/utils/permissions'

/**
 * Configuration options for the protectedRoute wrapper.
 */
export interface ProtectedRouteOptions {
  /**
   * Whether a business context is required for this route.
   * If true, the route will fail with 403 if the user has no selected business.
   * @default false
   */
  requireBusiness?: boolean

  /**
   * Allowed roles for this route. If specified, only users with one of these
   * roles can access the route.
   * @example ['OWNER', 'BOSS'] - Only owners and bosses can access
   */
  allowedRoles?: BusinessRole[]

  /**
   * Human-readable action description for error messages.
   * Used when role check fails.
   * @example 'update inventory items'
   */
  action?: string
}

/**
 * Context passed to protected route handlers.
 * Provides typed access to authentication info and common helpers.
 */
export interface ProtectedRouteContext {
  /**
   * The authenticated user's JWT payload.
   */
  auth: JwtPayload

  /**
   * The business ID from the JWT (only present if requireBusiness is true).
   * TypeScript will narrow this based on the options.
   */
  businessId: string
}

/**
 * Handler function type for protected routes.
 */
export type ProtectedRouteHandler<T> = (
  event: H3Event,
  context: ProtectedRouteContext
) => T | Promise<T>

/**
 * Creates a protected route handler that automatically handles:
 * - Extracting and typing the auth context from event.context.auth
 * - Requiring business context (optional)
 * - Role-based access control (optional)
 *
 * This reduces boilerplate in API routes and ensures consistent error handling.
 *
 * @param handler - The route handler function
 * @param options - Configuration options for auth/role requirements
 * @returns An H3 event handler
 *
 * @example
 * ```typescript
 * // Basic protected route (authentication required)
 * export default protectedRoute(async (event, { auth }) => {
 *   // auth is typed as JwtPayload
 *   return { userId: auth.userId }
 * })
 *
 * // Route requiring business context
 * export default protectedRoute(
 *   async (event, { auth, businessId }) => {
 *     // businessId is guaranteed to be a string here
 *     const items = await prisma.inventoryItem.findMany({
 *       where: { businessId }
 *     })
 *     return items
 *   },
 *   { requireBusiness: true }
 * )
 *
 * // Route with role-based access control
 * export default protectedRoute(
 *   async (event, { auth, businessId }) => {
 *     // Only OWNER and BOSS can reach this code
 *     const body = await readBody(event)
 *     // ... create item logic
 *   },
 *   {
 *     requireBusiness: true,
 *     allowedRoles: ['OWNER', 'BOSS'],
 *     action: 'create inventory items'
 *   }
 * )
 * ```
 */
export function protectedRoute<T>(
  handler: ProtectedRouteHandler<T>,
  options: ProtectedRouteOptions = {}
): EventHandler<EventHandlerRequest, T | Promise<T>> {
  const {
    requireBusiness: requireBusinessContext = false,
    allowedRoles,
    action = 'perform this action',
  } = options

  return defineEventHandler(async (event) => {
    // Extract auth from context (set by auth middleware)
    const auth = event.context.auth as JwtPayload

    // Verify business context if required
    let businessId: string = ''
    if (requireBusinessContext) {
      requireBusiness(auth.businessId)
      businessId = auth.businessId as string
    } else if (auth.businessId) {
      businessId = auth.businessId
    }

    // Check role-based access if roles are specified
    if (allowedRoles && allowedRoles.length > 0) {
      requireRole(auth.businessRole, allowedRoles, action)
    }

    // Create the typed context
    const context: ProtectedRouteContext = {
      auth,
      businessId,
    }

    // Call the handler with the typed context
    return handler(event, context)
  })
}

/**
 * Shorthand for creating a route that requires business context.
 * Equivalent to protectedRoute(handler, { requireBusiness: true })
 */
export function businessRoute<T>(
  handler: ProtectedRouteHandler<T>,
  options: Omit<ProtectedRouteOptions, 'requireBusiness'> = {}
): EventHandler<EventHandlerRequest, T | Promise<T>> {
  return protectedRoute(handler, { ...options, requireBusiness: true })
}

/**
 * Shorthand for creating a route that requires OWNER or BOSS role.
 * Common pattern for inventory management operations.
 */
export function managerRoute<T>(
  handler: ProtectedRouteHandler<T>,
  action: string = 'perform this action'
): EventHandler<EventHandlerRequest, T | Promise<T>> {
  return protectedRoute(handler, {
    requireBusiness: true,
    allowedRoles: ['OWNER', 'BOSS'],
    action,
  })
}

/**
 * Shorthand for creating a route that requires OWNER role only.
 * Used for schema management and destructive operations.
 */
export function ownerRoute<T>(
  handler: ProtectedRouteHandler<T>,
  action: string = 'perform this action'
): EventHandler<EventHandlerRequest, T | Promise<T>> {
  return protectedRoute(handler, {
    requireBusiness: true,
    allowedRoles: ['OWNER'],
    action,
  })
}
