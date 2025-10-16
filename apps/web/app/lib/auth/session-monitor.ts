import { getBrowserClient } from './supabase-client';

// Session monitoring configuration
const SESSION_CHECK_INTERVAL = 30 * 1000; // Check every 30 seconds
const REFRESH_THRESHOLD = 5 * 60 * 1000; // Refresh if expires in 5 minutes

class SessionMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private callbacks: {
    onSessionRefresh?: (session: any) => void;
    onSessionExpired?: () => void;
    onError?: (error: Error) => void;
  } = {};

  constructor() {
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleStorageChange = this.handleStorageChange.bind(this);
    this.refreshSession = this.refreshSession.bind(this);
  }

  /**
   * Start monitoring session
   */
  start(callbacks?: {
    onSessionRefresh?: (session: any) => void;
    onSessionExpired?: () => void;
    onError?: (error: Error) => void;
  }) {
    if (this.isRunning) {
      return;
    }

    this.callbacks = callbacks || {};
    this.isRunning = true;

    // Start periodic checks
    this.intervalId = setInterval(this.checkAndRefreshSession.bind(this), SESSION_CHECK_INTERVAL);

    // Listen for tab focus to check session immediately
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // Listen for storage changes (session updates from other tabs)
    window.addEventListener('storage', this.handleStorageChange);

    console.log('Session monitor started');
  }

  /**
   * Stop monitoring session
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('storage', this.handleStorageChange);

    console.log('Session monitor stopped');
  }

  /**
   * Check session and refresh if needed
   */
  private async checkAndRefreshSession(): Promise<void> {
    try {
      const supabase = getBrowserClient();
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Session check error:', error);
        this.callbacks.onError?.(error);
        return;
      }

      if (!session) {
        console.log('No active session found');
        this.callbacks.onSessionExpired?.();
        return;
      }

      // Check if session needs refresh
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;

      if (timeUntilExpiry <= REFRESH_THRESHOLD) {
        console.log('Session expiring soon, refreshing...');
        await this.refreshSession();
      }
    } catch (error) {
      console.error('Session monitoring error:', error);
      this.callbacks.onError?.(error as Error);
    }
  }

  /**
   * Refresh the current session
   */
  private async refreshSession(): Promise<void> {
    try {
      const supabase = getBrowserClient();
      const { data: { session }, error } = await supabase.auth.refreshSession();

      if (error) {
        console.error('Session refresh error:', error);
        
        // If refresh fails, the session is likely invalid
        if (error.message?.includes('Invalid Refresh Token') || 
            error.message?.includes('refresh_token_not_found')) {
          this.callbacks.onSessionExpired?.();
        } else {
          this.callbacks.onError?.(error);
        }
        return;
      }

      if (session) {
        console.log('Session refreshed successfully');
        this.callbacks.onSessionRefresh?.(session);
      } else {
        console.log('No session returned from refresh');
        this.callbacks.onSessionExpired?.();
      }
    } catch (error) {
      console.error('Session refresh error:', error);
      this.callbacks.onError?.(error as Error);
    }
  }

  /**
   * Handle tab visibility change
   */
  private handleVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      // Tab became visible, check session immediately
      this.checkAndRefreshSession();
    }
  }

  /**
   * Handle storage changes (cross-tab session sync)
   */
  private handleStorageChange(event: StorageEvent): void {
    // Listen for Supabase session changes from other tabs
    if (event.key?.includes('supabase.auth.token')) {
      console.log('Session updated in another tab, checking current session...');
      
      // Small delay to let Supabase process the change
      setTimeout(() => {
        this.checkAndRefreshSession();
      }, 100);
    }
  }

  /**
   * Force refresh session manually
   */
  async forceRefresh(): Promise<void> {
    await this.refreshSession();
  }

  /**
   * Check if monitor is running
   */
  get isActive(): boolean {
    return this.isRunning;
  }
}

// Export singleton instance
export const sessionMonitor = new SessionMonitor();

/**
 * Utility function to setup session monitoring with auth provider
 */
export function setupSessionMonitoring(authCallbacks: {
  onSessionRefresh?: (session: any) => void;
  onSessionExpired?: () => void;
  onError?: (error: Error) => void;
}) {
  if (typeof window === 'undefined') {
    return; // Don't run on server
  }

  sessionMonitor.start({
    onSessionRefresh: (session) => {
      console.log('Session refreshed by monitor');
      authCallbacks.onSessionRefresh?.(session);
    },
    onSessionExpired: () => {
      console.log('Session expired, redirecting to login');
      authCallbacks.onSessionExpired?.();
      // Redirect to login
      window.location.href = '/login';
    },
    onError: (error) => {
      console.error('Session monitoring error:', error);
      authCallbacks.onError?.(error);
    },
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    sessionMonitor.stop();
  });
}

/**
 * Utility to calculate time until session expires
 */
export function getTimeUntilExpiry(session: any): number | null {
  if (!session?.expires_at) {
    return null;
  }
  
  const expiresAt = session.expires_at * 1000;
  const now = Date.now();
  return Math.max(0, expiresAt - now);
}

/**
 * Utility to check if session is expiring soon
 */
export function isSessionExpiringSoon(session: any, thresholdMs: number = REFRESH_THRESHOLD): boolean {
  const timeUntilExpiry = getTimeUntilExpiry(session);
  return timeUntilExpiry !== null && timeUntilExpiry <= thresholdMs;
}
