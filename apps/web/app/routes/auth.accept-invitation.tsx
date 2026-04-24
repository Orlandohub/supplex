import {
  data as json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import { useState } from "react";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

// Password validation schema
const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(
        /[!@#$%^&*(),.?":{}|<>]/,
        "Password must contain at least one special character"
      ),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type _PasswordFormData = z.infer<typeof passwordSchema>;

// Loader: Get token from URL and validate it exists
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return json({ error: "MISSING_TOKEN", token: null });
  }

  return json({ error: null, token });
};

// Action: Submit password and accept invitation
export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const token = formData.get("token") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  // Validate form data
  const validation = passwordSchema.safeParse({ password, confirmPassword });
  if (!validation.success) {
    return json(
      {
        success: false,
        error: "VALIDATION_ERROR",
        errors: validation.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  try {
    const apiUrl = process.env.API_URL || "http://localhost:3001";
    const response = await fetch(`${apiUrl}/api/auth/accept-invitation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return json(
        {
          success: false,
          error: data.error?.code || "UNKNOWN_ERROR",
          message: data.error?.message || "Failed to accept invitation",
        },
        { status: response.status }
      );
    }

    // Success - redirect to login page
    return redirect("/login?invitation_accepted=true");
  } catch (error) {
    console.error("Error accepting invitation:", error);
    return json(
      {
        success: false,
        error: "NETWORK_ERROR",
        message: "Failed to connect to server",
      },
      { status: 500 }
    );
  }
};

export default function AcceptInvitation() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as
    | {
        success: boolean;
        error?: string;
        message?: string;
        errors?: {
          password?: string[];
          confirmPassword?: string[];
        };
      }
    | undefined;
  const navigation = useNavigation();
  const [showPassword, setShowPassword] = useState(false);

  const isSubmitting = navigation.state === "submitting";

  // Handle missing token
  if (loaderData.error === "MISSING_TOKEN") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <XCircle className="h-6 w-6 text-red-600" />
              <CardTitle>Invalid Invitation Link</CardTitle>
            </div>
            <CardDescription>
              This invitation link is invalid or incomplete.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Please check the invitation link you received and try again. If
              you continue to experience issues, contact your administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle expired invitation
  if (actionData && actionData.error === "INVITATION_EXPIRED") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
              <CardTitle>Invitation Expired</CardTitle>
            </div>
            <CardDescription>
              This invitation link has expired (48-hour validity).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Invitation links are valid for 48 hours. Please contact your
              administrator to request a new invitation link.
            </p>
            <Button asChild variant="outline" className="w-full">
              <a href="/login">Go to Login</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle already used invitation
  if (actionData && actionData.error === "INVITATION_USED") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <CardTitle>Invitation Already Used</CardTitle>
            </div>
            <CardDescription>
              This invitation has already been activated.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Your account has been activated. You can now log in with your
              email and password.
            </p>
            <Button asChild className="w-full">
              <a href="/login">Go to Login</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main password setup form
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set Your Password</CardTitle>
          <CardDescription>
            Create a secure password to activate your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" className="space-y-4">
            <input type="hidden" name="token" value={loaderData.token || ""} />

            {/* Error Alert */}
            {actionData &&
              !actionData.success &&
              actionData.error !== "INVITATION_EXPIRED" &&
              actionData.error !== "INVITATION_USED" && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>
                    {actionData.message || "Failed to set password"}
                  </AlertDescription>
                </Alert>
              )}

            {/* Password Requirements */}
            <div className="rounded-md bg-blue-50 p-4">
              <p className="text-sm font-medium text-blue-900 mb-2">
                Password Requirements:
              </p>
              <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                <li>At least 8 characters long</li>
                <li>Contains uppercase and lowercase letters</li>
                <li>Contains at least one number</li>
                <li>Contains at least one special character (!@#$%^&*)</li>
              </ul>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password">
                Password <span className="text-red-500">*</span>
              </Label>
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                required
                disabled={isSubmitting}
              />
              {actionData?.errors?.password && (
                <p className="text-sm text-red-600">
                  {actionData.errors.password[0]}
                </p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                Confirm Password <span className="text-red-500">*</span>
              </Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Confirm your password"
                required
                disabled={isSubmitting}
              />
              {actionData?.errors?.confirmPassword && (
                <p className="text-sm text-red-600">
                  {actionData.errors.confirmPassword[0]}
                </p>
              )}
            </div>

            {/* Show Password Toggle */}
            <div className="flex items-center space-x-2">
              <input
                id="showPassword"
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <Label
                htmlFor="showPassword"
                className="text-sm font-normal text-gray-700 cursor-pointer"
              >
                Show passwords
              </Label>
            </div>

            {/* Submit Button */}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting
                ? "Setting Password..."
                : "Set Password & Activate Account"}
            </Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
