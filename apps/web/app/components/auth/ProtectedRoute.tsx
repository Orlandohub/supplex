import { useEffect } from "react";
import { useNavigate, useLocation } from "@remix-run/react";
import { useAuthContext } from "~/providers/AuthProvider";
import type { UserRole } from "@supplex/types";
import type { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
  requireRole?: UserRole | UserRole[];
}

export function ProtectedRoute({
  children,
  fallback,
  requireRole,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, userRecord } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Redirect to login with the current path as redirect target
      const redirectTo = encodeURIComponent(
        location.pathname + location.search
      );
      navigate(`/login?redirectTo=${redirectTo}`, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, location]);

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      fallback || (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      )
    );
  }

  // If not authenticated, return null (navigation will happen via useEffect)
  if (!isAuthenticated) {
    return null;
  }

  // Check role requirements if specified
  if (requireRole && userRecord) {
    const allowedRoles = Array.isArray(requireRole)
      ? requireRole
      : [requireRole];

    if (!allowedRoles.includes(userRecord.role)) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="bg-red-100 rounded-full p-3 mx-auto mb-4 w-16 h-16 flex items-center justify-center">
              <svg
                className="h-8 w-8 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Access Denied
            </h1>
            <p className="text-gray-600 mb-6">
              You don&apos;t have permission to access this page.
            </p>
            <button
              onClick={() => navigate("/", { replace: true })}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      );
    }
  }

  // User is authenticated and has required role, render children
  return <>{children}</>;
}

/**
 * Higher-order component version for wrapping components
 */
export function withProtectedRoute<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    requireRole?: UserRole | UserRole[];
    fallback?: ReactNode;
  }
) {
  return function ProtectedComponent(props: P) {
    return (
      <ProtectedRoute
        requireRole={options?.requireRole}
        fallback={options?.fallback}
      >
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}
