-- Custom Access Token Auth Hook
-- Runs before every JWT is issued (sign-in, token refresh).
-- Reads role and tenant_id from public.users and injects into app_metadata.
-- IMPORTANT: Uses jsonb_set to merge individual keys — preserves all pre-existing
-- app_metadata fields (provider, providers, etc.). Do NOT replace the whole object.
-- Reference: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  user_role text;
  user_tenant_id text;
BEGIN
  SELECT role, tenant_id::text
  INTO user_role, user_tenant_id
  FROM public.users
  WHERE id = (event->>'user_id')::uuid;

  IF user_role IS NULL OR user_tenant_id IS NULL THEN
    RETURN event;
  END IF;

  claims := event->'claims';

  IF jsonb_typeof(claims->'app_metadata') IS NULL THEN
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  END IF;

  claims := jsonb_set(claims, '{app_metadata, role}', to_jsonb(user_role));
  claims := jsonb_set(claims, '{app_metadata, tenant_id}', to_jsonb(user_tenant_id));

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- supabase_auth_admin needs EXECUTE to call the hook and SELECT to read users
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT SELECT ON TABLE public.users TO supabase_auth_admin;

-- Prevent direct invocation by application roles
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
