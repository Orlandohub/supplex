import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getBrowserClient } from '~/lib/auth/supabase-client';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import type { User } from '@supplex/types';

interface AuthState {
  // Auth State
  user: SupabaseUser | null;
  userRecord: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Actions
  setAuth: (user: SupabaseUser | null, session: Session | null, userRecord?: User | null) => void;
  setLoading: (loading: boolean) => void;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, fullName: string, tenantName: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
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
            const { data: userRecord, error: userError } = await supabase
              .from('users')
              .select('*')
              .eq('id', data.user.id)
              .single();

            if (userError) {
              console.error('Error fetching user record:', userError);
            }

            get().setAuth(data.user, data.session, userRecord);
            
            // Handle "Remember Me" functionality
            if (rememberMe) {
              localStorage.setItem('supplex_remember_me', 'true');
            } else {
              localStorage.removeItem('supplex_remember_me');
            }
            
            return { success: true };
          }

          set({ isLoading: false });
          return { success: false, error: 'Authentication failed' };
        } catch (error: any) {
          set({ isLoading: false });
          return { success: false, error: error.message || 'Sign in failed' };
        }
      },

      // Sign up with email, password, and tenant creation
      signUp: async (email, password, fullName, tenantName) => {
        set({ isLoading: true });
        
        try {
          // Call our API endpoint that handles both user and tenant creation
          const apiUrl = typeof window !== 'undefined' && window.ENV?.API_URL 
            ? window.ENV.API_URL 
            : process.env.API_URL || 'http://localhost:3001';
          
          const response = await fetch(`${apiUrl}/api/auth/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
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
              error: result.error || `Registration failed (${response.status})` 
            };
          }

          // Registration successful - now sign in the user
          const supabase = getBrowserClient();
          
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (signInError || !signInData.user || !signInData.session) {
            set({ isLoading: false });
            return { 
              success: false, 
              error: 'Registration successful, but auto-login failed. Please sign in manually.' 
            };
          }

          // Set auth state with the signed-in user and user record from API
          get().setAuth(signInData.user, signInData.session, result.data?.user);
          
          set({ isLoading: false });
          return { success: true };

        } catch (error: any) {
          set({ isLoading: false });
          return { 
            success: false, 
            error: error.message || 'Network error during registration' 
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
          localStorage.removeItem('supplex_remember_me');
          
          // Redirect to login page
          window.location.href = '/login';
        } catch (error) {
          console.error('Sign out error:', error);
          // Force clear auth state even if API call fails
          get().clearAuth();
          window.location.href = '/login';
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
        } catch (error: any) {
          set({ isLoading: false });
          return { success: false, error: error.message || 'Password reset failed' };
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

          return { success: false, error: 'Password reset failed' };
        } catch (error: any) {
          set({ isLoading: false });
          return { success: false, error: error.message || 'Password reset failed' };
        }
      },

      // Refresh authentication state
      refreshAuth: async () => {
        try {
          const supabase = getBrowserClient();
          
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('Auth refresh error:', error);
            get().clearAuth();
            return;
          }

          if (session?.user) {
            // Fetch updated user record
            const { data: userRecord, error: userError } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (userError) {
              console.error('Error fetching user record:', userError);
            }

            get().setAuth(session.user, session, userRecord);
          } else {
            get().clearAuth();
          }
        } catch (error) {
          console.error('Auth refresh error:', error);
          get().clearAuth();
        }
      },

      // Clear authentication state
      clearAuth: () => {
        set({
          user: null,
          userRecord: null,
          session: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },
    }),
    {
      name: 'supplex-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist the user record and basic auth state
        // Session tokens should be handled by httpOnly cookies
        userRecord: state.userRecord,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
