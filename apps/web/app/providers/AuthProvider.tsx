import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useAuth } from "~/hooks/useAuth";
import { getBrowserClient } from "~/lib/auth/supabase-client";
import {
  setupSessionMonitoring,
  sessionMonitor,
} from "~/lib/auth/session-monitor";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";
import type { User } from "@supplex/types";

interface AuthContextType {
  user: SupabaseUser | null;
  userRecord: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  initialUser?: SupabaseUser | null;
  initialSession?: Session | null;
  initialUserRecord?: User | null;
}

export function AuthProvider({
  children,
  initialUser = null,
  initialSession = null,
  initialUserRecord = null,
}: AuthProviderProps) {
  const {
    user,
    userRecord,
    session,
    isLoading,
    isAuthenticated,
    setAuth,
    setLoading,
    clearAuth,
    refreshAuth,
  } = useAuth();

  useEffect(() => {
    // Initialize auth state from server-side props
    if (initialUser && initialSession) {
      setAuth(initialUser, initialSession, initialUserRecord);
    }

    // Only set up client-side auth listener in the browser
    if (typeof window !== "undefined") {
      const supabase = getBrowserClient();

      // Get initial session - SECURITY: Use getUser() to validate with server
      supabase.auth.getUser().then(async ({ data: { user }, error }) => {
        if (error) {
          // Only log non-session-missing errors (session missing is expected when not logged in)
          if (error.message !== "Auth session missing!") {
            // eslint-disable-next-line no-console
            console.error("Error validating user:", error);
          }
          setLoading(false);
          clearAuth();
          return;
        }

        if (user) {
          // Get session data after user validation
          const {
            data: { session },
          } = await supabase.auth.getSession();

          // Fetch user record from database with tenant information
          supabase
            .from("users")
            .select("*, tenant:tenants(*)")
            .eq("id", user.id)
            .single()
            .then(({ data: userRecord, error: userError }) => {
              if (userError) {
                // eslint-disable-next-line no-console
                console.error("Error fetching user record:", userError);
              }
              setAuth(user, session, userRecord);
              setLoading(false);
            });
        } else {
          setLoading(false);
          clearAuth();
        }
      });

      // Listen for auth state changes
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        // Debug: Auth state changed (removed to satisfy linter)

        if (event === "SIGNED_IN" && session) {
          // Fetch user record when signing in with tenant information
          const { data: userRecord, error: userError } = await supabase
            .from("users")
            .select("*, tenant:tenants(*)")
            .eq("id", session.user.id)
            .single();

          if (userError) {
            // eslint-disable-next-line no-console
            console.error("Error fetching user record:", userError);
          }

          setAuth(session.user, session, userRecord);
        } else if (event === "SIGNED_OUT") {
          clearAuth();
        } else if (event === "TOKEN_REFRESHED" && session) {
          // Update session on token refresh
          setAuth(session.user, session, userRecord);
        } else if (event === "USER_UPDATED" && session) {
          // Refresh user data when profile is updated
          await refreshAuth();
        }
      });

      // Set up session monitoring for automatic refresh
      setupSessionMonitoring({
        onSessionRefresh: (session) => {
          // Update auth state when session is refreshed
          setAuth(session.user, session, userRecord);
        },
        onSessionExpired: () => {
          // Clear auth state when session expires
          clearAuth();
        },
        onError: (error) => {
          // eslint-disable-next-line no-console
          console.error("Session monitoring error:", error);
        },
      });

      // Cleanup subscription and session monitor on unmount
      return () => {
        subscription.unsubscribe();
        sessionMonitor.stop();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Provide auth context value
  const contextValue: AuthContextType = {
    user,
    userRecord,
    session,
    isLoading,
    isAuthenticated,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

/**
 * Hook to access auth context
 * This provides read-only access to auth state
 * Use useAuth() hook for auth actions (login, logout, etc.)
 */
export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }

  return context;
}

/**
 * Higher-order component to require authentication
 */
export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>
) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading } = useAuthContext();

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
        </div>
      );
    }

    if (!isAuthenticated) {
      // This should not happen as routes should be protected server-side
      // but it's a good fallback
      window.location.href = "/login";
      return null;
    }

    return <WrappedComponent {...props} />;
  };
}
