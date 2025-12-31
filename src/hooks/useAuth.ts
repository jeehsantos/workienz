import { useState, useEffect, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "contractor" | "employee" | "writer";

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  isLoading: boolean;
  rolesLoading: boolean;
}

export function useAuth() {
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

  useEffect(() => {
    let isMounted = true;

    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      
      setAuthState((prev) => ({
        ...prev,
        session,
        user: session?.user ?? null,
        isLoading: false,
        rolesLoading: session?.user ? true : false,
        roles: session?.user ? prev.roles : [],
      }));

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

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      
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
      } else {
        if (isMounted) {
          setAuthState((prev) => ({ ...prev, rolesLoading: false }));
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserRoles]);

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    userType: AppRole
  ) => {
    const redirectUrl = `${window.location.origin}/`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
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
