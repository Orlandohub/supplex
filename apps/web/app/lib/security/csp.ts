/**
 * Content Security Policy configuration for Supplex
 * This helps prevent XSS attacks and other code injection vulnerabilities
 */

export interface CSPDirectives {
  'default-src'?: string[];
  'script-src'?: string[];
  'style-src'?: string[];
  'img-src'?: string[];
  'font-src'?: string[];
  'connect-src'?: string[];
  'media-src'?: string[];
  'object-src'?: string[];
  'child-src'?: string[];
  'worker-src'?: string[];
  'frame-src'?: string[];
  'form-action'?: string[];
  'base-uri'?: string[];
  'manifest-src'?: string[];
}

/**
 * Generate CSP directives for development environment
 */
export function getCSPDirectivesDev(): CSPDirectives {
  return {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'unsafe-inline'", // Required for Vite in development
      "'unsafe-eval'", // Required for Vite HMR
      'http://localhost:*', // Vite dev server
      'ws://localhost:*', // Vite HMR websocket
    ],
    'style-src': [
      "'self'",
      "'unsafe-inline'", // Required for Tailwind and dynamic styles
      'fonts.googleapis.com',
    ],
    'img-src': [
      "'self'",
      'data:', // For base64 images
      'blob:', // For dynamically generated images
      'https:', // Allow HTTPS images
    ],
    'font-src': [
      "'self'",
      'fonts.gstatic.com',
      'data:', // For base64 fonts
    ],
    'connect-src': [
      "'self'",
      'http://localhost:*', // Local API server
      'https://*.supabase.co', // Supabase API
      'wss://*.supabase.co', // Supabase realtime
      'ws://localhost:*', // Vite HMR
    ],
    'media-src': ["'self'", 'data:', 'blob:'],
    'object-src': ["'none'"],
    'child-src': ["'self'"],
    'worker-src': ["'self'", 'blob:'],
    'frame-src': ["'self'"],
    'form-action': ["'self'"],
    'base-uri': ["'self'"],
    'manifest-src': ["'self'"],
  };
}

/**
 * Generate CSP directives for production environment
 */
export function getCSPDirectivesProd(): CSPDirectives {
  return {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      // Add nonce or hash for inline scripts if needed
      // No unsafe-inline or unsafe-eval in production
    ],
    'style-src': [
      "'self'",
      "'unsafe-inline'", // Required for Tailwind
      'fonts.googleapis.com',
    ],
    'img-src': [
      "'self'",
      'data:',
      'blob:', 
      'https:', // Allow HTTPS images
    ],
    'font-src': [
      "'self'",
      'fonts.gstatic.com',
      'data:',
    ],
    'connect-src': [
      "'self'",
      'https://*.supabase.co', // Supabase API
      'wss://*.supabase.co', // Supabase realtime
      // Add your production API domain here
    ],
    'media-src': ["'self'", 'data:', 'blob:'],
    'object-src': ["'none'"],
    'child-src': ["'self'"],
    'worker-src': ["'self'", 'blob:'],
    'frame-src': ["'self'"],
    'form-action': ["'self'"],
    'base-uri': ["'self'"],
    'manifest-src': ["'self'"],
  };
}

/**
 * Convert CSP directives to header string
 */
export function generateCSPHeader(directives: CSPDirectives): string {
  return Object.entries(directives)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
}

/**
 * Get CSP header value based on environment
 */
export function getCSPHeader(isDevelopment: boolean = process.env.NODE_ENV === 'development'): string {
  const directives = isDevelopment ? getCSPDirectivesDev() : getCSPDirectivesProd();
  return generateCSPHeader(directives);
}

/**
 * Additional security headers for Supplex
 */
export function getSecurityHeaders(isDevelopment: boolean = process.env.NODE_ENV === 'development') {
  return {
    // Content Security Policy
    'Content-Security-Policy': getCSPHeader(isDevelopment),
    
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',
    
    // Enable XSS protection
    'X-XSS-Protection': '1; mode=block',
    
    // Prevent clickjacking
    'X-Frame-Options': 'DENY',
    
    // Referrer policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // Permission policy (formerly Feature Policy)
    'Permissions-Policy': [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'interest-cohort=()',
    ].join(', '),
    
    // Only allow HTTPS in production
    ...(isDevelopment ? {} : {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    }),
  };
}
