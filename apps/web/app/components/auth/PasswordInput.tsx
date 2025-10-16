import { useState, forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  showStrengthIndicator?: boolean;
  error?: string;
  label?: string;
  required?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ showStrengthIndicator = false, error, label, required = false, className = '', ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState<{
      score: number;
      feedback: string[];
    }>({ score: 0, feedback: [] });

    const calculatePasswordStrength = (password: string) => {
      if (!password) {
        return { score: 0, feedback: [] };
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

      // Symbol check (bonus)
      if (/[^A-Za-z0-9]/.test(password)) {
        score += 1;
      }

      return { score, feedback };
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (showStrengthIndicator) {
        const strength = calculatePasswordStrength(e.target.value);
        setPasswordStrength(strength);
      }
      props.onChange?.(e);
    };

    const getPasswordStrengthColor = (score: number) => {
      if (score <= 1) return 'bg-red-500';
      if (score <= 2) return 'bg-yellow-500';
      if (score <= 3) return 'bg-blue-500';
      return 'bg-green-500';
    };

    const getPasswordStrengthText = (score: number) => {
      if (score <= 1) return 'Weak';
      if (score <= 2) return 'Fair';
      if (score <= 3) return 'Good';
      return 'Strong';
    };

    return (
      <div>
        {label && (
          <label htmlFor={props.id} className="block text-sm font-medium text-gray-700 mb-2">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
        )}
        
        <div className="relative">
          <input
            {...props}
            ref={ref}
            type={showPassword ? 'text' : 'password'}
            onChange={handleChange}
            className={`
              w-full px-3 py-2 pr-10 border rounded-md shadow-sm placeholder-gray-400
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              disabled:bg-gray-50 disabled:text-gray-500
              ${error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'}
              ${className}
            `}
          />
          
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
            onClick={() => setShowPassword(!showPassword)}
            disabled={props.disabled}
            tabIndex={-1}
          >
            {showPassword ? (
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
              </svg>
            )}
          </button>
        </div>

        {/* Password Strength Indicator */}
        {showStrengthIndicator && props.value && (
          <div className="mt-2">
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthColor(passwordStrength.score)}`}
                  style={{
                    width: `${(passwordStrength.score / 4) * 100}%`,
                  }}
                ></div>
              </div>
              <span className={`text-xs font-medium ${
                passwordStrength.score <= 1 ? 'text-red-600' :
                passwordStrength.score <= 2 ? 'text-yellow-600' :
                passwordStrength.score <= 3 ? 'text-blue-600' : 'text-green-600'
              }`}>
                {getPasswordStrengthText(passwordStrength.score)}
              </span>
            </div>
            {passwordStrength.feedback.length > 0 && (
              <p className="mt-1 text-xs text-gray-600">
                Missing: {passwordStrength.feedback.join(', ')}
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
