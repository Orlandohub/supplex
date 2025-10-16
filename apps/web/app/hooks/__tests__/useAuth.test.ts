import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '../useAuth';
import { UserRole } from '@supplex/types';

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    getSession: vi.fn(),
    refreshSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } }
    })),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
  })),
};

// Mock getBrowserClient
vi.mock('~/lib/auth/supabase-client', () => ({
  getBrowserClient: () => mockSupabaseClient,
}));

// Mock fetch for API calls
global.fetch = vi.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = mockLocalStorage as any;

// Mock window.location
const mockLocation = {
  href: '',
  origin: 'http://localhost:3000',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.href = '';
  });

  afterEach(() => {
    // Reset localStorage mock
    mockLocalStorage.getItem.mockReset();
    mockLocalStorage.setItem.mockReset();
    mockLocalStorage.removeItem.mockReset();
  });

  describe('signIn', () => {
    it('should sign in user successfully', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      const mockSession = { access_token: 'token', user: mockUser };
      const mockUserRecord = { 
        id: '123', 
        email: 'test@example.com', 
        fullName: 'Test User',
        role: 'admin' 
      };

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockUserRecord,
              error: null,
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const response = await result.current.signIn('test@example.com', 'password123');
        expect(response.success).toBe(true);
      });

      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.userRecord).toEqual(mockUserRecord);
      });
    });

    it('should handle sign in error', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' },
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const response = await result.current.signIn('test@example.com', 'wrongpassword');
        expect(response.success).toBe(false);
        expect(response.error).toBe('Invalid credentials');
      });

      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should handle remember me functionality', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      const mockSession = { access_token: 'token', user: mockUser };

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: '123', email: 'test@example.com' },
              error: null,
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn('test@example.com', 'password123', true);
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('supplex_remember_me', 'true');
    });
  });

  describe('signUp', () => {
    it('should sign up user successfully with API endpoint', async () => {
      const mockApiResponse = {
        success: true,
        data: {
          user: { 
            id: '123', 
            email: 'test@example.com',
            fullName: 'Test User',
            role: 'admin',
            tenantId: 'tenant-123' 
          },
          tenant: { id: 'tenant-123', name: 'Test Company' },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      });

      const mockUser = { id: '123', email: 'test@example.com' };
      const mockSession = { access_token: 'token', user: mockUser };

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const response = await result.current.signUp(
          'test@example.com',
          'password123',
          'Test User',
          'Test Company'
        );
        expect(response.success).toBe(true);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/auth/register',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password123',
            fullName: 'Test User',
            tenantName: 'Test Company',
          }),
        })
      );
    });

    it('should handle sign up API error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          success: false,
          error: 'Email already exists',
        }),
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const response = await result.current.signUp(
          'test@example.com',
          'password123',
          'Test User',
          'Test Company'
        );
        expect(response.success).toBe(false);
        expect(response.error).toBe('Email already exists');
      });
    });
  });

  describe('forgotPassword', () => {
    it('should send forgot password email successfully', async () => {
      mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
        error: null,
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const response = await result.current.forgotPassword('test@example.com');
        expect(response.success).toBe(true);
      });

      expect(mockSupabaseClient.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        { redirectTo: 'http://localhost:3000/reset-password' }
      );
    });

    it('should handle forgot password error', async () => {
      mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
        error: { message: 'User not found' },
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const response = await result.current.forgotPassword('nonexistent@example.com');
        expect(response.success).toBe(false);
        expect(response.error).toBe('User not found');
      });
    });
  });

  describe('signOut', () => {
    it('should sign out user successfully', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth());

      // Set initial auth state
      act(() => {
        result.current.setAuth(
          { id: '123', email: 'test@example.com' } as any,
          { access_token: 'token' } as any,
          {
            id: '123',
            email: 'test@example.com',
            tenantId: 'tenant-123',
            fullName: 'Test User',
            role: UserRole.VIEWER,
            avatarUrl: null,
            isActive: true,
            lastLoginAt: null,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        );
      });

      expect(result.current.isAuthenticated).toBe(true);

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('supplex_remember_me');
      expect(mockLocation.href).toBe('/login');
    });
  });

  describe('refreshAuth', () => {
    it('should refresh authentication state', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      const mockSession = { access_token: 'token', user: mockUser };
      const mockUserRecord = { id: '123', email: 'test@example.com' };

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockUserRecord,
              error: null,
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.refreshAuth();
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
    });

    it('should clear auth on session error', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Session expired' },
      });

      const { result } = renderHook(() => useAuth());

      // Set initial auth state
      act(() => {
        result.current.setAuth(
          { id: '123', email: 'test@example.com' } as any,
          { access_token: 'token' } as any
        );
      });

      expect(result.current.isAuthenticated).toBe(true);

      await act(async () => {
        await result.current.refreshAuth();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBe(null);
    });
  });

  describe('state management', () => {
    it('should set authentication state correctly', () => {
      const { result } = renderHook(() => useAuth());

      const mockUser = { id: '123', email: 'test@example.com' };
      const mockSession = { access_token: 'token', user: mockUser };
      const mockUserRecord = { id: '123', email: 'test@example.com' };

      act(() => {
        result.current.setAuth(mockUser as any, mockSession as any, {
          id: 'user-456',
          tenantId: 'tenant-123',
          email: 'test@example.com',
          fullName: 'Test User',
          role: UserRole.VIEWER,
          avatarUrl: null,
          isActive: true,
          lastLoginAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.session).toEqual(mockSession);
      expect(result.current.userRecord).toEqual(mockUserRecord);
      expect(result.current.isLoading).toBe(false);
    });

    it('should clear authentication state correctly', () => {
      const { result } = renderHook(() => useAuth());

      // Set initial state
      act(() => {
        result.current.setAuth(
          { id: '123', email: 'test@example.com' } as any,
          { access_token: 'token' } as any
        );
      });

      expect(result.current.isAuthenticated).toBe(true);

      // Clear state
      act(() => {
        result.current.clearAuth();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBe(null);
      expect(result.current.session).toBe(null);
      expect(result.current.userRecord).toBe(null);
      expect(result.current.isLoading).toBe(false);
    });

    it('should set loading state correctly', () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.setLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
    });
  });
});
