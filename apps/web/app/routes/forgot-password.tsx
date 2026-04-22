import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { data as json, redirect } from "react-router";
import { useSearchParams } from "react-router";
import { getSession } from "~/lib/auth/session.server";
import { ForgotPasswordForm } from "~/components/auth/ForgotPasswordForm";

export const meta: MetaFunction = () => {
  return [
    { title: "Forgot Password | Supplex" },
    {
      name: "description",
      content:
        "Reset your Supplex account password to regain access to your supplier management dashboard.",
    },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  // Check if user is already authenticated
  const { session, user } = await getSession(request);

  if (session && user) {
    // User is already logged in, redirect to dashboard
    return redirect("/");
  }

  return json({});
}

export default function ForgotPassword() {
  const [searchParams] = useSearchParams();

  // Check for error messages
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const message = searchParams.get("message");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="flex items-center">
            <div className="bg-blue-600 text-white rounded-lg p-2">
              <svg
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                />
              </svg>
            </div>
            <span className="ml-2 text-2xl font-bold text-gray-900">
              Supplex
            </span>
          </div>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-lg sm:rounded-lg sm:px-10">
          {/* Error Messages */}
          {error && (
            <div className="mb-6 rounded-md bg-red-50 p-4">
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
                  <h3 className="text-sm font-medium text-red-800">
                    Password Reset Error
                  </h3>
                  <p className="mt-1 text-sm text-red-700">
                    {errorDescription ||
                      "An error occurred while processing your request."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Success Messages */}
          {message && (
            <div className="mb-6 rounded-md bg-green-50 p-4">
              <div className="flex">
                <svg
                  className="h-5 w-5 text-green-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="ml-3">
                  <p className="text-sm text-green-700">{message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Forgot Password Form */}
          <ForgotPasswordForm />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-sm text-gray-600">
          Need help? Contact our{" "}
          <a
            href="/support"
            className="text-blue-600 hover:text-blue-500 underline"
          >
            support team
          </a>
        </p>
      </div>
    </div>
  );
}
