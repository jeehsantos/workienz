import { useState, useEffect, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "contractor" | "employee" | "writer";

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  isLoading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    roles: [],
    isLoading: true,
  });

  const fetchUserRoles = useCallback(async (userId: string) => {
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
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthState((prev) => ({
        ...prev,
        session,
        user: session?.user ?? null,
        isLoading: false,
      }));

      // Defer role fetching to avoid deadlock
      if (session?.user) {
        setTimeout(async () => {
          const roles = await fetchUserRoles(session.user.id);
          setAuthState((prev) => ({ ...prev, roles }));
        }, 0);
      } else {
        setAuthState((prev) => ({ ...prev, roles: [] }));
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState((prev) => ({
        ...prev,
        session,
        user: session?.user ?? null,
        isLoading: false,
      }));

      if (session?.user) {
        fetchUserRoles(session.user.id).then((roles) => {
          setAuthState((prev) => ({ ...prev, roles }));
        });
      }
    });

    return () => subscription.unsubscribe();
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

  return {
    ...authState,
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
