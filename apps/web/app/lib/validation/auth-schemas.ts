import { z } from 'zod';

/**
 * Password validation schema with comprehensive security requirements
 */
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  // Optional: Special characters (commented out for better UX)
  // .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
  .refine((password) => {
    // Check for common weak patterns
    const weakPatterns = [
      /^123/i, // Starts with 123
      /password/i, // Contains "password"
      /qwerty/i, // Contains "qwerty"
      /admin/i, // Contains "admin"
      /(.)\1{2,}/, // Three or more consecutive identical characters
    ];
    
    return !weakPatterns.some(pattern => pattern.test(password));
  }, 'Password contains common patterns that make it vulnerable');

/**
 * Email validation schema
 */
export const emailSchema = z.string()
  .min(1, 'Email is required')
  .max(255, 'Email address is too long')
  .email('Please enter a valid email address')
  .refine((email) => {
    // Additional email validation
    const domain = email.split('@')[1];
    return domain && domain.length > 2 && !domain.includes('..');
  }, 'Please enter a valid email address');

/**
 * Full name validation schema
 */
export const fullNameSchema = z.string()
  .min(1, 'Full name is required')
  .min(2, 'Full name must be at least 2 characters')
  .max(100, 'Full name must not exceed 100 characters')
  .regex(/^[a-zA-Z\s'.-]+$/, 'Full name can only contain letters, spaces, apostrophes, dots, and hyphens')
  .refine((name) => {
    // Check for reasonable name format
    const trimmed = name.trim();
    const words = trimmed.split(/\s+/);
    return words.length >= 1 && words.every(word => word.length > 0);
  }, 'Please enter a valid full name');

/**
 * Tenant/Company name validation schema
 */
export const tenantNameSchema = z.string()
  .min(1, 'Company name is required')
  .min(2, 'Company name must be at least 2 characters')
  .max(100, 'Company name must not exceed 100 characters')
  .regex(/^[a-zA-Z0-9\s'.&-]+$/, 'Company name contains invalid characters')
  .refine((name) => {
    // Check for prohibited names
    const prohibited = [
      'admin', 'administrator', 'root', 'system', 'api', 'www', 'mail', 'ftp', 
      'test', 'demo', 'null', 'undefined', 'supplex'
    ];
    const lowerName = name.toLowerCase().trim();
    return !prohibited.includes(lowerName);
  }, 'This company name is not available');

/**
 * Login form validation schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

/**
 * Sign up form validation schema
 */
export const signUpSchema = z.object({
  email: emailSchema,
  fullName: fullNameSchema,
  tenantName: tenantNameSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  acceptTerms: z.boolean().refine(val => val === true, {
    message: 'You must accept the terms and conditions',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

/**
 * Forgot password form validation schema
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

/**
 * Reset password form validation schema
 */
export const resetPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

/**
 * Password strength calculation
 */
export interface PasswordStrength {
  score: number; // 0-5
  feedback: string[];
  isValid: boolean;
}

export function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, feedback: ['Enter a password'], isValid: false };
  }

  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push('At least 8 characters');
  }

  // Uppercase check
  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('One uppercase letter');
  }

  // Lowercase check
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('One lowercase letter');
  }

  // Number check
  if (/[0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push('One number');
  }

  // Length bonus
  if (password.length >= 12) {
    score += 1;
  }

  // Character variety bonus
  const charTypes = [
    /[a-z]/.test(password), // lowercase
    /[A-Z]/.test(password), // uppercase
    /[0-9]/.test(password), // numbers
    /[^a-zA-Z0-9]/.test(password), // special chars
  ].filter(Boolean).length;

  if (charTypes >= 3) {
    score += 1;
  }

  // Check for weak patterns (penalty)
  const weakPatterns = [
    /(.)\1{2,}/, // Repeated characters
    /123|abc|qwe/i, // Sequential patterns
    /password|admin|user/i, // Common words
  ];

  if (weakPatterns.some(pattern => pattern.test(password))) {
    score = Math.max(0, score - 1);
    feedback.push('Avoid common patterns');
  }

  // Validate against Zod schema
  const isValid = passwordSchema.safeParse(password).success;

  return {
    score: Math.min(5, score),
    feedback,
    isValid,
  };
}

/**
 * Get password strength description
 */
export function getPasswordStrengthDescription(score: number): {
  text: string;
  color: string;
} {
  if (score <= 1) return { text: 'Very Weak', color: 'text-red-600' };
  if (score <= 2) return { text: 'Weak', color: 'text-orange-600' };
  if (score <= 3) return { text: 'Fair', color: 'text-yellow-600' };
  if (score <= 4) return { text: 'Good', color: 'text-blue-600' };
  return { text: 'Strong', color: 'text-green-600' };
}

/**
 * Get password strength bar color
 */
export function getPasswordStrengthBarColor(score: number): string {
  if (score <= 1) return 'bg-red-500';
  if (score <= 2) return 'bg-orange-500';
  if (score <= 3) return 'bg-yellow-500';
  if (score <= 4) return 'bg-blue-500';
  return 'bg-green-500';
}

// Export types for form data
export type LoginFormData = z.infer<typeof loginSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
