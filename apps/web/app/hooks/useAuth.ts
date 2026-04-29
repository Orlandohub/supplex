import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getBrowserClient } from "~/lib/auth/supabase-client";
import { getErrorMessage } from "~/lib/api-helpers";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";
import type { User } from "@supplex/types";

interface AuthState {
  // Auth State
  user: SupabaseUser | null;
  userRecord: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  setAuth: (
    user: SupabaseUser | null,
    session: Session | null,
    userRecord?: User | null
  ) => void;
  setLoading: (loading: boolean) => void;
  signIn: (
    email: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<{ success: boolean; error?: string }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    tenantName: string
  ) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  forgotPassword: (
    email: string
  ) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  refreshAuth: () => Promise<void>;
  clearAuth: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      userRecord: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,

      // Set authentication state
      setAuth: (user, session, userRecord = null) => {
        set({
          user,
          session,
          userRecord,
          isAuthenticated: !!user && !!session,
          isLoading: false,
        });
      },

      // Set loading state
      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      // Sign in with email and password
      signIn: async (email, password, rememberMe = false) => {
        set({ isLoading: true });

        try {
          const supabase = getBrowserClient();

          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            set({ isLoading: false });
            return { success: false, error: error.message };
          }

          if (data.user && data.session) {
            // Fetch user record from database
            const { data: userRecord, error: userError } = (await supabase
              .from("users")
              .select("*")
              .eq("id", data.user.id)
              .single()) as { data: any; error: any };

            if (userError) {
              console.error("Error fetching user record:", userError);
            }

            // Check if user is deactivated
            if (userRecord && !userRecord.is_active) {
              console.log(
                "[AUTH] User is deactivated, fetching admin contact info"
              );

              // Fetch admin contact info
              const { data: adminUsers } = (await supabase
                .from("users")
                .select("full_name, email")
                .eq("tenant_id", userRecord.tenant_id)
                .eq("role", "admin")
                .eq("is_active", true)
                .limit(1)) as { data: any[] | null };

              const adminUser = adminUsers?.[0];
              const adminInfo = adminUser
                ? `${adminUser.full_name}\n${adminUser.email}`
                : "your company's admin";

              // Sign out immediately (revoke the session that was just created)
              console.log("[AUTH] Signing out deactivated user");
              await supabase.auth.signOut();

              set({ isLoading: false });
              return {
                success: false,
                error: `Your user has been deactivated, please contact your company's admin:\n${adminInfo}`,
              };
            }

            get().setAuth(data.user, data.session, userRecord);

            // Handle "Remember Me" functionality
            if (rememberMe) {
              localStorage.setItem("supplex_remember_me", "true");
            } else {
              localStorage.removeItem("supplex_remember_me");
            }

            return { success: true };
          }

          set({ isLoading: false });
          return { success: false, error: "Authentication failed" };
        } catch (error) {
          set({ isLoading: false });
          return {
            success: false,
            error: getErrorMessage(error, "Sign in failed"),
          };
        }
      },

      // Sign up with email, password, and tenant creation
      signUp: async (email, password, fullName, tenantName) => {
        set({ isLoading: true });

        try {
          // Call our API endpoint that handles both user and tenant creation
          const apiUrl =
            typeof window !== "undefined" && window.ENV?.API_URL
              ? window.ENV.API_URL
              : process.env.API_URL || "http://localhost:3001";

          const response = await fetch(`${apiUrl}/api/auth/register`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              email,
              password,
              fullName,
              tenantName,
            }),
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            set({ isLoading: false });
            return {
              success: false,
              error: result.error || `Registration failed (${response.status})`,
            };
          }

          // Registration successful - now sign in the user
          const supabase = getBrowserClient();

          const { data: signInData, error: signInError } =
            await supabase.auth.signInWithPassword({
              email,
              password,
            });

          if (signInError || !signInData.user || !signInData.session) {
            console.error("Auto-login error after registration:", signInError);
            set({ isLoading: false });
            return {
              success: false,
              error:
                signInError?.message ||
                "Registration successful, but auto-login failed. Please sign in manually.",
            };
          }

          // Set auth state with the signed-in user and user record from API
          get().setAuth(signInData.user, signInData.session, result.data?.user);

          set({ isLoading: false });
          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          return {
            success: false,
            error: getErrorMessage(error, "Network error during registration"),
          };
        }
      },

      // Sign out
      signOut: async () => {
        set({ isLoading: true });

        try {
          const supabase = getBrowserClient();
          await supabase.auth.signOut();

          get().clearAuth();

          // Clear remember me flag
          localStorage.removeItem("supplex_remember_me");

          // Redirect to login page
          window.location.href = "/login";
        } catch (error) {
          console.error("Sign out error:", error);
          // Force clear auth state even if API call fails
          get().clearAuth();
          window.location.href = "/login";
        }
      },

      // Forgot password
      forgotPassword: async (email) => {
        set({ isLoading: true });

        try {
          const supabase = getBrowserClient();

          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
          });

          set({ isLoading: false });

          if (error) {
            return { success: false, error: error.message };
          }

          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          return {
            success: false,
            error: getErrorMessage(error, "Password reset failed"),
          };
        }
      },

      // Reset password (after clicking reset link)
      resetPassword: async (password) => {
        set({ isLoading: true });

        try {
          const supabase = getBrowserClient();

          const { data, error } = await supabase.auth.updateUser({
            password,
          });

          set({ isLoading: false });

          if (error) {
            return { success: false, error: error.message };
          }

          if (data.user) {
            // Refresh auth state after password reset
            await get().refreshAuth();
            return { success: true };
          }

          return { success: false, error: "Password reset failed" };
        } catch (error) {
          set({ isLoading: false });
          return {
            success: false,
            error: getErrorMessage(error, "Password reset failed"),
          };
        }
      },

      // Refresh authentication state
      // SECURITY: Uses getUser() to validate session with server
      refreshAuth: async () => {
        try {
          const supabase = getBrowserClient();

          // Use getUser() to validate session with Supabase Auth server
          const {
            data: { user },
            error,
          } = await supabase.auth.getUser();

          if (error) {
            // Only log non-session-missing errors (session missing is expected when not logged in)
            if (error.message !== "Auth session missing!") {
              console.error("Auth refresh error:", error);
            }
            get().clearAuth();
            return;
          }

          if (user) {
            // Get session data after user validation
            const {
              data: { session },
            } = await supabase.auth.getSession();

            // Fetch updated user record
            const { data: userRecord, error: userError } = await supabase
              .from("users")
              .select("*")
              .eq("id", user.id)
              .single();

            if (userError) {
              console.error("Error fetching user record:", userError);
            }

            get().setAuth(user, session, userRecord);
          } else {
            get().clearAuth();
          }
        } catch (error) {
          console.error("Auth refresh error:", error);
          get().clearAuth();
        }
      },

      // Clear authentication state and persisted localStorage entry
      clearAuth: () => {
        set({
          user: null,
          userRecord: null,
          session: null,
          isAuthenticated: false,
          isLoading: false,
        });
        try {
          localStorage.removeItem("supplex-auth");
        } catch {
          // SSR or restricted environment — safe to ignore
        }
      },
    }),
    {
      name: "supplex-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
