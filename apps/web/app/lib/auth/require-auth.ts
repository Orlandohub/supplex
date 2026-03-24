import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { getAuthenticatedUser, getAuthenticatedUserFast } from './session.server';
import type { UserRole } from '@supplex/types';

/**
 * Require authentication for a loader function (fast path).
 * Uses local JWT check instead of remote getUser() call (~200-500ms saving).
 * Safe because the root layout validates with getUser() on initial load and
 * the API server validates the JWT on every request.
 */
export async function requireAuth(args: LoaderFunctionArgs) {
  return await getAuthenticatedUserFast(args.request);
}

/**
 * Secure authentication that contacts Supabase Auth server (getUser()).
 * Use this ONLY in the root layout loader (_app.tsx) for the initial
 * session validation. All other loaders should use requireAuth (fast).
 */
export async function requireAuthSecure(args: LoaderFunctionArgs) {
  return await getAuthenticatedUser(args.request);
}

/**
 * Require authentication for an action function
 */
export async function requireAuthAction(args: ActionFunctionArgs) {
  return await getAuthenticatedUser(args.request);
}

/**
 * Require specific user role for a route
 */
export async function requireRole(
  request: Request, 
  requiredRole: UserRole | UserRole[]
): Promise<{
  user: any;
  session: any;
  userRecord: any;
  supabase: any;
  response: Response;
}> {
  const { user, session, supabase, response, userRecord } = await getAuthenticatedUser(request);
  
  const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  
  if (!userRecord || !allowedRoles.includes(userRecord.role)) {
    throw new Response('Forbidden: Insufficient permissions', { 
      status: 403,
      statusText: 'Forbidden'
    });
  }

  return { user, session, userRecord, supabase, response };
}

/**
 * Require admin role
 */
export async function requireAdmin(request: Request) {
  return await requireRole(request, 'admin' as UserRole);
}

/**
 * Require management role (admin or manager)
 */
export async function requireManager(request: Request) {
  return await requireRole(request, ['admin', 'procurement_manager', 'quality_manager'] as UserRole[]);
}

/**
 * Get current user with optional auth requirement  
 */
export async function getCurrentUser(request: Request, required: boolean = false) {
  if (required) {
    return await getAuthenticatedUser(request);
  }
  
  try {
    return await getAuthenticatedUser(request);
  } catch (error) {
    return null;
  }
}

/**
 * Check if user has permission for tenant resource
 */
export async function requireTenantAccess(
  request: Request, 
  resourceTenantId?: string
): Promise<{
  user: any;
  session: any;
  userRecord: any;
  supabase: any;
  response: Response;
}> {
  const { user, session, userRecord, supabase, response } = await getAuthenticatedUser(request);
  
  // If no specific tenant ID is provided, user can access their own tenant resources
  if (!resourceTenantId) {
    return { user, session, userRecord, supabase, response };
  }
  
  // Check if user's tenant matches the resource tenant
  if (userRecord.tenantId !== resourceTenantId) {
    throw new Response('Forbidden: Access denied to this tenant resource', { 
      status: 403,
      statusText: 'Forbidden'
    });
  }

  return { user, session, userRecord, supabase, response };
}

/**
 * Utility type for auth-protected loader data
 */
export type AuthenticatedLoaderData = {
  user: any;
  session: any;
  userRecord: any;
};
