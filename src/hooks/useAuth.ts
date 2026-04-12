import { useState, useEffect, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { initializeSessionManager, stopSessionManager } from "@/lib/sessionManager";
import { useToast } from "@/hooks/use-toast";

type AppRole = "admin" | "contractor" | "employee" | "writer";

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  isLoading: boolean;
  rolesLoading: boolean;
}

export function useAuth() {
  const hasAttemptedReferral = useRef(false);
  const { toast } = useToast();
  const authStateRef = useRef<AuthState | null>(null);
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    roles: [],
    isLoading: true,
    rolesLoading: true,
  });

  const fetchUserRoles = useCallback(async (userId: string): Promise<AppRole[]> => {
    try {
      const { data, error } = await supabase.rpc("get_user_roles", {
        _user_id: userId,
      });
      if (error) {
        console.error("Error fetching roles:", error);
        return [];
      }
      return (data as AppRole[]) || [];
    } catch (error) {
      console.error("Error fetching roles:", error);
      return [];
    }
  }, []);

  const applyPendingReferral = useCallback(async (session: Session | null) => {
    if (!session || hasAttemptedReferral.current) return;

    const referralCode = localStorage.getItem("pendingReferralCode");
    if (!referralCode) return;

    hasAttemptedReferral.current = true;

    try {
      const { data, error } = await supabase.functions.invoke("process-referral", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { referral_code: referralCode },
      });

      if (error || data?.error) {
        console.warn("Failed to apply referral code:", error?.message || data?.error);
        toast({
          title: "Referral not applied",
          description: "We couldn't apply your referral code. Please try again or contact support.",
          variant: "destructive",
        });
        return;
      }

      localStorage.removeItem("pendingReferralCode");
      toast({
        title: "Referral applied",
        description: "Your referral was recorded and will be verified after email confirmation.",
      });
    } catch (error) {
      console.error("Error applying referral code:", error);
      toast({
        title: "Referral not applied",
        description: "We couldn't apply your referral code. Please try again or contact support.",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Keep ref in sync for the visibility handler
  useEffect(() => {
    authStateRef.current = authState;
  }, [authState]);

  useEffect(() => {
    let isMounted = true;

    const clearAuthState = () => {
      if (!isMounted) return;
      setAuthState({
        user: null,
        session: null,
        roles: [],
        isLoading: false,
        rolesLoading: false,
      });
    };

    const clearAuthStorage = () => {
      try {
        // Supabase stores the session in localStorage; if it gets corrupted/stale,
        // we must remove it or the client will keep trying to refresh forever.
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (k.startsWith("sb-") || k.includes("supabase") || k.includes("auth-token")) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {
        // ignore
      }
    };

    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      // Critical: if token refresh fails, Supabase can keep retrying on tab focus.
      // We clear persisted auth + state to break the loop and force a clean login.
      if ((event as unknown as string) === "TOKEN_REFRESH_FAILED") {
        clearAuthStorage();
        clearAuthState();
        return;
      }

      if (event === "SIGNED_OUT") {
        clearAuthStorage();
        clearAuthState();
        stopSessionManager();
        hasAttemptedReferral.current = false;
        return;
      }

      setAuthState((prev) => ({
        ...prev,
        session,
        user: session?.user ?? null,
        isLoading: false,
        rolesLoading: session?.user ? true : false,
        roles: session?.user ? prev.roles : [],
      }));

      // Initialize session manager when user signs in
      if (session?.user && event === "SIGNED_IN") {
        initializeSessionManager({
          onSessionTimeout: async () => {
            // Auto sign out on timeout
            await supabase.auth.signOut();
          },
        });
        void applyPendingReferral(session);
      }

      // Defer role fetching to avoid deadlock
      if (session?.user) {
        setTimeout(async () => {
          if (!isMounted) return;
          const roles = await fetchUserRoles(session.user.id);
          if (isMounted) {
            setAuthState((prev) => ({ ...prev, roles, rolesLoading: false }));
          }
        }, 0);
      } else {
        setAuthState((prev) => ({ ...prev, roles: [], rolesLoading: false }));
      }
    });

    // THEN check for existing session with error handling
    supabase.auth
      .getSession()
      .then(async ({ data: { session }, error }) => {
        if (!isMounted) return;

        if (error) {
          console.error("Session error:", error);
          clearAuthStorage();
          clearAuthState();
          return;
        }

        setAuthState((prev) => ({
          ...prev,
          session,
          user: session?.user ?? null,
          isLoading: false,
          rolesLoading: session?.user ? true : false,
        }));

        if (session?.user) {
          const roles = await fetchUserRoles(session.user.id);
          if (isMounted) {
            setAuthState((prev) => ({ ...prev, roles, rolesLoading: false }));
          }
          
          // Initialize session manager for existing session
          initializeSessionManager({
            onSessionTimeout: async () => {
              // Auto sign out on timeout
              await supabase.auth.signOut();
            },
          });
          void applyPendingReferral(session);
        } else {
          if (isMounted) {
            setAuthState((prev) => ({ ...prev, rolesLoading: false }));
          }
        }
      })
      .catch((error) => {
        console.error("Auth initialization error:", error);
        clearAuthStorage();
        clearAuthState();
      });

    // Extra safety: when the tab becomes visible again, re-sync only if the user changed.
    const onVisibility = () => {
      if (!isMounted) return;
      if (document.visibilityState !== "visible") return;
      supabase.auth
        .getSession()
        .then(({ data: { session }, error }) => {
          if (!isMounted) return;
          if (error) {
            clearAuthStorage();
            clearAuthState();
            return;
          }
          // Only update state if the session user actually changed
          const currentUserId = authStateRef.current?.user?.id ?? null;
          const newUserId = session?.user?.id ?? null;
          if (currentUserId !== newUserId) {
            setAuthState((prev) => ({
              ...prev,
              session,
              user: session?.user ?? null,
              isLoading: false,
            }));
          }
        })
        .catch(() => {
          clearAuthStorage();
          clearAuthState();
        });
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", onVisibility);
      subscription.unsubscribe();
    };
  }, [applyPendingReferral, fetchUserRoles]);

  const signUp = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    userType: AppRole
  ) => {
    const redirectUrl = `${window.location.origin}/`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          first_name: firstName,
          last_name: lastName,
          user_type: userType,
        },
      },
    });

    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { data, error };
  };

  const signOut = async () => {
    // Stop session manager
    stopSessionManager();
    
    // Clear auth storage - inline implementation
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith("sb-") || k.includes("supabase") || k.includes("auth-token")) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore
    }
    
    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const hasRole = (role: AppRole): boolean => {
    return authState.roles.includes(role);
  };

  const isAdmin = (): boolean => hasRole("admin");
  const isContractor = (): boolean => hasRole("contractor");
  const isEmployee = (): boolean => hasRole("employee");
  const isWriter = (): boolean => hasRole("writer");

  // Combined loading state - true if either auth or roles are loading
  const isFullyLoaded = !authState.isLoading && !authState.rolesLoading;

  return {
    ...authState,
    // isLoading should be true until both auth AND roles are loaded
    isLoading: !isFullyLoaded,
    signUp,
    signIn,
    signOut,
    hasRole,
    isAdmin,
    isContractor,
    isEmployee,
    isWriter,
  };
}
