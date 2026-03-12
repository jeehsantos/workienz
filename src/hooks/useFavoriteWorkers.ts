import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface FavoriteWorker {
  id: string;
  employee_user_id: string;
  employee_profile_id: string;
  note: string | null;
  job_id: string | null;
  created_at: string;
  employee_name: string;
  employee_avatar: string | null;
  employee_headline: string | null;
  employee_city: string | null;
  employee_skills: string[];
  employee_industry: string | null;
  job_title: string | null;
}

export function useFavoriteWorkers() {
  const [favorites, setFavorites] = useState<FavoriteWorker[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchFavorites = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-favorite-worker", {
        body: { action: "list" },
      });
      if (error) throw error;
      setFavorites(data?.favorites || []);
    } catch {
      console.error("Failed to fetch favorites");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addFavorite = useCallback(async (
    employeeUserId: string,
    employeeProfileId: string,
    note?: string,
    jobId?: string
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-favorite-worker", {
        body: {
          action: "add",
          employee_user_id: employeeUserId,
          employee_profile_id: employeeProfileId,
          note,
          job_id: jobId,
        },
      });
      if (error) throw error;
      toast({ title: "Worker saved to favorites ⭐" });
      return data?.favorite;
    } catch {
      toast({ title: "Error", description: "Failed to add favorite", variant: "destructive" });
      return null;
    }
  }, [toast]);

  const removeFavorite = useCallback(async (employeeUserId: string) => {
    try {
      const { error } = await supabase.functions.invoke("manage-favorite-worker", {
        body: { action: "remove", employee_user_id: employeeUserId },
      });
      if (error) throw error;
      setFavorites(prev => prev.filter(f => f.employee_user_id !== employeeUserId));
      toast({ title: "Worker removed from favorites" });
    } catch {
      toast({ title: "Error", description: "Failed to remove favorite", variant: "destructive" });
    }
  }, [toast]);

  const updateNote = useCallback(async (employeeUserId: string, note: string) => {
    try {
      const { error } = await supabase.functions.invoke("manage-favorite-worker", {
        body: { action: "update_note", employee_user_id: employeeUserId, note },
      });
      if (error) throw error;
      setFavorites(prev => prev.map(f =>
        f.employee_user_id === employeeUserId ? { ...f, note } : f
      ));
      toast({ title: "Note updated" });
    } catch {
      toast({ title: "Error", description: "Failed to update note", variant: "destructive" });
    }
  }, [toast]);

  return { favorites, isLoading, fetchFavorites, addFavorite, removeFavorite, updateNote };
}
