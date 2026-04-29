import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useAuth } from "~/hooks/useAuth";
import { useRouteLoaderData, useNavigate } from "react-router";
import { getBrowserClient } from "~/lib/auth/supabase-client";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";
import { asUserRecord, type UserRecord } from "~/lib/auth/user-record";
import type { AppLoaderData } from "~/routes/_app";

interface AuthContextType {
  user: SupabaseUser | null;
  userRecord: UserRecord | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  initialUser?: SupabaseUser | null;
  initialSession?: Session | null;
}

export function AuthProvider({
  children,
  initialUser = null,
  initialSession = null,
}: AuthProviderProps) {
  const {
    user,
    userRecord,
    session,
    isLoading,
    isAuthenticated,
    setAuth,
    setLoading,
    clearAuth,
  } = useAuth();

  const navigate = useNavigate();

  // Hydrate userRecord from the _app loader (server-validated, single getUser() call)
  const appData = useRouteLoaderData<AppLoaderData>("routes/_app");

  useEffect(() => {
    if (initialUser && initialSession) {
      const serverUserRecord = appData?.userRecord
        ? asUserRecord(appData.userRecord)
        : null;
      setAuth(initialUser, initialSession, serverUserRecord);
    }

    if (typeof window === "undefined") return;

    const supabase = getBrowserClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, eventSession) => {
      if (event === "SIGNED_IN") {
        if (!eventSession) return;
        const { data: fetchedUserRecord } = await supabase
          .from("users")
          .select("*, tenant:tenants(*)")
          .eq("id", eventSession.user.id)
          .single();
        setAuth(
          eventSession.user,
          eventSession,
          fetchedUserRecord ? asUserRecord(fetchedUserRecord) : null
        );
      } else if (event === "SIGNED_OUT") {
        clearAuth();
        navigate("/login", { replace: true });
      } else if (event === "TOKEN_REFRESHED") {
        if (!eventSession) return;
        const currentUserRecord = useAuth.getState().userRecord;
        setAuth(eventSession.user, eventSession, currentUserRecord);
      } else if (event === "USER_UPDATED") {
        if (!eventSession) return;
        const { data: freshUserRecord } = await supabase
          .from("users")
          .select("*, tenant:tenants(*)")
          .eq("id", eventSession.user.id)
          .single();
        setAuth(
          eventSession.user,
          eventSession,
          freshUserRecord ? asUserRecord(freshUserRecord) : null
        );
      }
    });

    // Lightweight revalidation when a stale tab regains focus
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;
      const {
        data: { session: localSession },
      } = await supabase.auth.getSession();
      if (!localSession) {
        clearAuth();
        navigate("/login", { replace: true });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    setLoading(false);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contextValue: AuthContextType = {
    user,
    userRecord,
    session,
    isLoading,
    isAuthenticated,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
