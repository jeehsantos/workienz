/**
 * React hook for mutations with automatic cache invalidation
 * 
 * Requirements: 5.2
 */

import { useState, useCallback } from 'react';
import { defaultCacheManager } from '@/lib/cacheManager';

interface UseMutationOptions<TData, TVariables> {
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables) => void;
  onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables) => void;
  invalidateKeys?: string[];
  invalidatePatterns?: (string | RegExp)[];
}

interface UseMutationResult<TData, TVariables> {
  mutate: (variables: TVariables) => Promise<TData>;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  data: TData | null;
  error: Error | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  reset: () => void;
}

/**
 * Hook for mutations with automatic cache invalidation
 */
export function useMutation<TData = any, TVariables = any>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: UseMutationOptions<TData, TVariables> = {}
): UseMutationResult<TData, TVariables> {
  const {
    onSuccess,
    onError,
    onSettled,
    invalidateKeys = [],
    invalidatePatterns = [],
  } = options;

  const [data, setData] = useState<TData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
    setIsSuccess(false);
    setIsError(false);
  }, []);

  const mutate = useCallback(
    async (variables: TVariables): Promise<TData> => {
      setIsLoading(true);
      setError(null);
      setIsSuccess(false);
      setIsError(false);

      try {
        const result = await mutationFn(variables);
        
        // Invalidate cache
        invalidateKeys.forEach(key => {
          defaultCacheManager.delete(key);
        });
        
        invalidatePatterns.forEach(pattern => {
          defaultCacheManager.invalidate(pattern);
        });

        setData(result);
        setIsSuccess(true);
        onSuccess?.(result, variables);
        onSettled?.(result, null, variables);
        
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        setIsError(true);
        onError?.(error, variables);
        onSettled?.(undefined, error, variables);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [mutationFn, invalidateKeys, invalidatePatterns, onSuccess, onError, onSettled]
  );

  return {
    mutate,
    mutateAsync: mutate,
    data,
    error,
    isLoading,
    isSuccess,
    isError,
    reset,
  };
}

/**
 * Hook for creating a job with cache invalidation
 */
export function useCreateJob() {
  return useMutation(
    async (jobData: any) => {
      const { data, error } = await supabase
        .from('jobs')
        .insert(jobData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    {
      invalidatePatterns: [/^app:jobs:list/],
    }
  );
}

/**
 * Hook for updating a job with cache invalidation
 */
export function useUpdateJob() {
  return useMutation(
    async ({ id, updates }: { id: string; updates: any }) => {
      const { data, error } = await supabase
        .from('jobs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    {
      invalidatePatterns: [/^app:jobs:/],
    }
  );
}

/**
 * Hook for deleting a job with cache invalidation
 */
export function useDeleteJob() {
  return useMutation(
    async (id: string) => {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { id };
    },
    {
      invalidatePatterns: [/^app:jobs:/],
    }
  );
}

/**
 * Hook for updating a profile with cache invalidation
 */
export function useUpdateProfile() {
  return useMutation(
    async ({ userId, updates }: { userId: string; updates: any }) => {
      const { data, error } = await supabase
        .from('employee_profiles')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    {
      invalidatePatterns: [/^app:user:.*:profile/, /^app:profile/],
    }
  );
}

/**
 * Hook for creating an article with cache invalidation
 */
export function useCreateArticle() {
  return useMutation(
    async (articleData: any) => {
      const { data, error } = await supabase
        .from('articles')
        .insert(articleData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    {
      invalidatePatterns: [/^app:articles:list/],
    }
  );
}

/**
 * Hook for updating an article with cache invalidation
 */
export function useUpdateArticle() {
  return useMutation(
    async ({ id, updates }: { id: string; updates: any }) => {
      const { data, error } = await supabase
        .from('articles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    {
      invalidatePatterns: [/^app:articles:/],
    }
  );
}

/**
 * Hook for submitting a job application with cache invalidation
 */
export function useSubmitApplication() {
  return useMutation(
    async (applicationData: any) => {
      const { data, error } = await supabase
        .from('job_applications')
        .insert(applicationData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    {
      invalidatePatterns: [/^app:jobs:/, /^app:user:.*:applications/],
    }
  );
}

// Import supabase for the hooks
import { supabase } from '@/integrations/supabase/client';
