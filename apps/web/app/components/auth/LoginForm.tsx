import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "~/hooks/useAuth";
import { Link } from "@remix-run/react";
import { config } from "~/lib/config";

// Validation schema
const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .max(255, "Email is too long"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters"),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

// Dev login types
interface DevUser {
  id: string;
  email: string;
  role: string;
  fullName: string;
  isActive: boolean;
  supplierId?: string;
  supplierName?: string;
}

interface DevTenant {
  id: string;
  name: string;
  users: DevUser[];
  supplierUsers: DevUser[];
}

interface DevUsersResponse {
  tenants: DevTenant[];
}

interface LoginFormProps {
  onSuccess?: () => void;
  redirectTo?: string;
  className?: string;
}

export function LoginForm({
  onSuccess,
  redirectTo,
  className = "",
}: LoginFormProps) {
  const { signIn, isLoading, setAuth } = useAuth();
  const [submitError, setSubmitError] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);

  // Dev Quick Login State
  const isDevelopment = config.isDevelopment;
  const [devUsers, setDevUsers] = useState<DevUsersResponse | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [devLoading, setDevLoading] = useState(false);
  const [devError, setDevError] = useState<string>("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  // Load saved email from localStorage
  useEffect(() => {
    const savedEmail = localStorage.getItem("supplex_saved_email");
    const rememberMe = localStorage.getItem("supplex_remember_me") === "true";

    if (savedEmail) {
      setValue("email", savedEmail);
    }
    if (rememberMe) {
      setValue("rememberMe", true);
    }
  }, [setValue]);

  // Fetch dev users on mount (development only)
  useEffect(() => {
    if (isDevelopment) {
      fetch(`${config.apiUrl}/api/auth/dev/users`)
        .then((res) => res.json())
        .then((data) => setDevUsers(data))
        .catch((err) => console.error("Failed to load dev users:", err));
    }
  }, [isDevelopment]);

  // Save form data to localStorage as user types
  const watchedEmail = watch("email");
  const watchedRememberMe = watch("rememberMe");

  useEffect(() => {
    if (watchedEmail) {
      localStorage.setItem("supplex_saved_email", watchedEmail);
    }
  }, [watchedEmail]);

  useEffect(() => {
    if (watchedRememberMe) {
      localStorage.setItem("supplex_remember_me", "true");
    } else {
      localStorage.removeItem("supplex_remember_me");
    }
  }, [watchedRememberMe]);

  const onSubmit = async (data: LoginFormData) => {
    setSubmitError("");

    try {
      const result = await signIn(data.email, data.password, data.rememberMe);

      if (result.success) {
        onSuccess?.();

        // Small delay to ensure session is properly set
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Redirect to intended page or default
        const targetUrl = redirectTo ? decodeURIComponent(redirectTo) : "/";
        window.location.href = targetUrl;
      } else {
        setSubmitError(result.error || "Login failed. Please try again.");
      }
    } catch (error: any) {
      setSubmitError(error.message || "An unexpected error occurred.");
    }
  };

  // Dev Quick Login — uses signInWithPassword with a temporary password set by the API
  const handleDevLogin = async () => {
    if (!selectedUser) return;

    setDevError("");
    setDevLoading(true);

    try {
      // API sets a temp password for the user and returns their email
      const response = await fetch(`${config.apiUrl}/api/auth/dev/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setDevError(result.error || "Dev login failed");
        setDevLoading(false);
        return;
      }

      // Use the exact same signIn flow as normal login
      const signInResult = await signIn(result.email, result.tempPassword, false);

      if (!signInResult.success) {
        setDevError(signInResult.error || "Dev login failed");
        setDevLoading(false);
        return;
      }

      onSuccess?.();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const targetUrl = redirectTo ? decodeURIComponent(redirectTo) : "/";
      window.location.href = targetUrl;
    } catch (error: any) {
      console.error("Dev login error:", error);
      setDevError(error.message || "Dev login failed");
      setDevLoading(false);
    }
  };

  // Get users for selected tenant
  const selectedTenantData = devUsers?.tenants.find(
    (t) => t.id === selectedTenant
  );
  const allUsersForTenant = selectedTenantData
    ? [...selectedTenantData.users, ...selectedTenantData.supplierUsers]
    : [];

  return (
    <div className={`w-full max-w-md mx-auto ${className}`}>
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h1>
        <p className="text-gray-600">Sign in to your Supplex account</p>
      </div>

      {/* Dev Quick Login Section (Development Only) */}
      {isDevelopment && devUsers && (
        <div className="mb-8 p-4 border-2 border-yellow-400 bg-yellow-50 rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🚀</span>
            <h2 className="text-lg font-semibold text-gray-900">
              Dev Quick Login
            </h2>
          </div>

          <div className="space-y-3">
            {/* Tenant Dropdown */}
            <div>
              <label
                htmlFor="dev-tenant"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Tenant
              </label>
              <select
                id="dev-tenant"
                value={selectedTenant}
                onChange={(e) => {
                  setSelectedTenant(e.target.value);
                  setSelectedUser("");
                  setDevError("");
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                disabled={devLoading}
              >
                <option value="">Select tenant...</option>
                {devUsers.tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </div>

            {/* User Dropdown */}
            {selectedTenant && (
              <div>
                <label
                  htmlFor="dev-user"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  User
                </label>
                <select
                  id="dev-user"
                  value={selectedUser}
                  onChange={(e) => {
                    setSelectedUser(e.target.value);
                    setDevError("");
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  disabled={devLoading}
                >
                  <option value="">Select user...</option>
                  
                  {/* Tenant Users */}
                  {selectedTenantData && selectedTenantData.users.length > 0 && (
                    <optgroup label="Tenant Users">
                      {selectedTenantData.users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.fullName} ({user.role}) - {user.email}
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {/* Supplier Users */}
                  {selectedTenantData && selectedTenantData.supplierUsers.length > 0 && (
                    <optgroup label="Supplier Users">
                      {selectedTenantData.supplierUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.fullName} ({user.role}) - {user.email}
                          {user.supplierName && ` [${user.supplierName}]`}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            )}

            {/* Dev Error */}
            {devError && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {devError}
              </div>
            )}

            {/* Quick Login Button */}
            <button
              type="button"
              onClick={handleDevLogin}
              disabled={!selectedUser || devLoading}
              className={`
                w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-gray-900
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500
                disabled:opacity-50 disabled:cursor-not-allowed
                ${
                  !selectedUser || devLoading
                    ? "bg-yellow-200"
                    : "bg-yellow-400 hover:bg-yellow-500"
                }
              `}
            >
              {devLoading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-900"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Quick Login...
                </>
              ) : (
                "Quick Login"
              )}
            </button>
          </div>

          <div className="mt-3 pt-3 border-t border-yellow-300">
            <p className="text-xs text-gray-600 text-center">
              Development only - Not visible in production
            </p>
          </div>
        </div>
      )}

      {/* Regular Login Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Email Field */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Email address
          </label>
          <input
            {...register("email")}
            type="email"
            id="email"
            autoComplete="email"
            className={`
              w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              disabled:bg-gray-50 disabled:text-gray-500
              ${errors.email ? "border-red-300 focus:ring-red-500 focus:border-red-500" : "border-gray-300"}
            `}
            placeholder="you@company.com"
            disabled={isLoading || isSubmitting}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Password
          </label>
          <div className="relative">
            <input
              {...register("password")}
              type={showPassword ? "text" : "password"}
              id="password"
              autoComplete="current-password"
              className={`
                w-full px-3 py-2 pr-10 border rounded-md shadow-sm placeholder-gray-400
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                disabled:bg-gray-50 disabled:text-gray-500
                ${errors.password ? "border-red-300 focus:ring-red-500 focus:border-red-500" : "border-gray-300"}
              `}
              placeholder="Enter your password"
              disabled={isLoading || isSubmitting}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading || isSubmitting}
            >
              {showPassword ? (
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                  />
                </svg>
              )}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Remember Me & Forgot Password */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              {...register("rememberMe")}
              id="rememberMe"
              type="checkbox"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              disabled={isLoading || isSubmitting}
            />
            <label
              htmlFor="rememberMe"
              className="ml-2 block text-sm text-gray-700"
            >
              Remember me
            </label>
          </div>

          <Link
            to="/forgot-password"
            className="text-sm text-blue-600 hover:text-blue-500 font-medium"
          >
            Forgot password?
          </Link>
        </div>

        {/* Submit Error */}
        {submitError && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="ml-3">
                <p className="text-sm text-red-800 whitespace-pre-line">{submitError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || isSubmitting}
          className={`
            w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
            disabled:opacity-50 disabled:cursor-not-allowed
            ${
              isLoading || isSubmitting
                ? "bg-gray-400"
                : "bg-blue-600 hover:bg-blue-700"
            }
          `}
        >
          {isLoading || isSubmitting ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </button>

        {/* Sign Up Link */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Don&apos;t have an account?{" "}
            <Link
              to="/signup"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Sign up
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
