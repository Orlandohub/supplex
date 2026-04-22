/**
 * Dashboard Page
 * Main dashboard view (inside app shell)
 */

import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { data as json } from "react-router";
import { useLoaderData } from "react-router";
import { requireAuth } from "~/lib/auth/require-auth";

export const meta: MetaFunction = () => {
  return [
    { title: "Dashboard | Supplex" },
    {
      name: "description",
      content: "Your Supplex supplier management dashboard.",
    },
  ];
};

export async function loader(args: LoaderFunctionArgs) {
  // Require authentication for dashboard
  const { user, userRecord } = await requireAuth(args);

  return json({
    user,
    userRecord,
  });
}

export default function Dashboard() {
  const { user, userRecord } = useLoaderData<typeof loader>();

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Welcome Section */}
      <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
        <div className="px-4 py-5 sm:p-6">
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">
            Welcome to Supplex! 🎉
          </h1>
          <p className="text-neutral-600 mb-4">
            Your supplier management system is ready. You&apos;re successfully
            authenticated and can access protected routes.
          </p>

          {/* User Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="text-sm font-medium text-blue-800 mb-2">
              Authentication Details
            </h3>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-blue-700">Email</dt>
                <dd className="text-sm text-blue-900">{user?.email}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-blue-700">Role</dt>
                <dd className="text-sm text-blue-900 capitalize">
                  {userRecord?.role || "User"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-blue-700">Tenant</dt>
                <dd className="text-sm text-blue-900">
                  {userRecord?.tenant?.name || "Not configured"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-blue-700">User ID</dt>
                <dd className="text-sm text-blue-900 font-mono text-xs">
                  {user?.id}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-neutral-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-neutral-500 truncate">
                    Suppliers
                  </dt>
                  <dd className="text-lg font-medium text-neutral-900">
                    Active
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-neutral-50 px-5 py-3">
            <div className="text-sm">
              <a
                href="/suppliers"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                View suppliers →
              </a>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-neutral-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-neutral-500 truncate">
                    Documents
                  </dt>
                  <dd className="text-lg font-medium text-neutral-900">
                    Coming Soon
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-neutral-50 px-5 py-3">
            <div className="text-sm">
              <span className="text-neutral-600">
                Store and manage compliance documents
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-neutral-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 00-2-2z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-neutral-500 truncate">
                    Analytics
                  </dt>
                  <dd className="text-lg font-medium text-neutral-900">
                    Coming Soon
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-neutral-50 px-5 py-3">
            <div className="text-sm">
              <span className="text-neutral-600">
                Track performance and compliance metrics
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Development Info */}
      <div className="mt-8 bg-green-50 border border-green-200 rounded-md p-4">
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
            <h3 className="text-sm font-medium text-green-800">
              🎉 Story 1.10: Base UI Shell & Navigation Complete!
            </h3>
            <div className="mt-2 text-sm text-green-700">
              <p>
                <strong>New Features:</strong> App shell with collapsible
                sidebar, mobile navigation, notification center, and global
                search placeholders.
              </p>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>✅ Persistent layout with sidebar and top navigation</li>
                <li>✅ Mobile-responsive with bottom tab bar</li>
                <li>✅ Keyboard navigation support</li>
                <li>✅ Full accessibility features</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
