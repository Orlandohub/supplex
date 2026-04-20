import type { LoaderFunctionArgs } from "react-router";

/**
 * Catch-all route for handling special URLs that shouldn't throw errors
 * This includes Chrome DevTools requests like .well-known paths
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);

  // Handle .well-known requests (like Chrome DevTools)
  if (url.pathname.startsWith("/.well-known")) {
    return new Response(null, { status: 204 }); // No Content
  }

  // For all other 404s, return a proper 404 response
  throw new Response("Not Found", { status: 404 });
}

export default function CatchAll() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-8">Page not found</p>
        <a
          href="/"
          className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          Go back home
        </a>
      </div>
    </div>
  );
}
