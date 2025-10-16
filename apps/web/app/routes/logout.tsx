import type { ActionFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { signOut } from '~/lib/auth/session.server';

export async function action({ request }: ActionFunctionArgs) {
  return await signOut(request);
}

export async function loader() {
  // If someone tries to GET /logout, redirect them to the sign out flow
  return redirect('/login');
}

export default function Logout() {
  // This component should never be rendered since loader redirects
  return null;
}
