/**
 * Cache Invalidation Utilities
 * Provides automatic cache invalidation on data mutations
 * 
 * Requirements: 5.2
 */

import { 
  defaultCacheManager,
  invalidateJobCache,
  invalidateProfileCache,
  invalidateArticleCache,
  invalidateSearchCache,
  invalidateUserCache,
} from './cacheManager';

/**
 * Invalidate cache after job mutations
 */
export const jobMutations = {
  /**
   * Invalidate cache after creating a job
   */
  onCreate: () => {
    invalidateJobCache(defaultCacheManager);
  },

  /**
   * Invalidate cache after updating a job
   */
  onUpdate: (jobId: string) => {
    invalidateJobCache(defaultCacheManager, jobId);
  },

  /**
   * Invalidate cache after deleting a job
   */
  onDelete: (jobId: string) => {
    invalidateJobCache(defaultCacheManager, jobId);
  },

  /**
   * Invalidate cache after changing job status
   */
  onStatusChange: (jobId: string) => {
    invalidateJobCache(defaultCacheManager, jobId);
  },
};

/**
 * Invalidate cache after profile mutations
 */
export const profileMutations = {
  /**
   * Invalidate cache after updating a profile
   */
  onUpdate: (userId: string) => {
    invalidateProfileCache(defaultCacheManager, userId);
    // Also invalidate user-specific caches
    invalidateUserCache(defaultCacheManager, userId);
  },

  /**
   * Invalidate cache after updating profile picture
   */
  onPictureUpdate: (userId: string) => {
    invalidateProfileCache(defaultCacheManager, userId);
  },

  /**
   * Invalidate cache after updating skills
   */
  onSkillsUpdate: (userId: string) => {
    invalidateProfileCache(defaultCacheManager, userId);
    // Invalidate search cache as skills affect search results
    invalidateSearchCache(defaultCacheManager);
  },
};

/**
 * Invalidate cache after article mutations
 */
export const articleMutations = {
  /**
   * Invalidate cache after creating an article
   */
  onCreate: () => {
    invalidateArticleCache(defaultCacheManager);
  },

  /**
   * Invalidate cache after updating an article
   */
  onUpdate: (articleId: string) => {
    invalidateArticleCache(defaultCacheManager, articleId);
  },

  /**
   * Invalidate cache after deleting an article
   */
  onDelete: (articleId: string) => {
    invalidateArticleCache(defaultCacheManager, articleId);
  },

  /**
   * Invalidate cache after publishing an article
   */
  onPublish: (articleId: string) => {
    invalidateArticleCache(defaultCacheManager, articleId);
  },

  /**
   * Invalidate cache after unpublishing an article
   */
  onUnpublish: (articleId: string) => {
    invalidateArticleCache(defaultCacheManager, articleId);
  },
};

/**
 * Invalidate cache after application mutations
 */
export const applicationMutations = {
  /**
   * Invalidate cache after submitting an application
   */
  onSubmit: (jobId: string, userId: string) => {
    // Invalidate job cache (application count may have changed)
    invalidateJobCache(defaultCacheManager, jobId);
    // Invalidate user's application list
    invalidateUserCache(defaultCacheManager, userId, 'applications');
  },

  /**
   * Invalidate cache after updating application status
   */
  onStatusChange: (jobId: string, userId: string) => {
    invalidateJobCache(defaultCacheManager, jobId);
    invalidateUserCache(defaultCacheManager, userId, 'applications');
  },

  /**
   * Invalidate cache after withdrawing an application
   */
  onWithdraw: (jobId: string, userId: string) => {
    invalidateJobCache(defaultCacheManager, jobId);
    invalidateUserCache(defaultCacheManager, userId, 'applications');
  },
};

/**
 * Invalidate cache after message mutations
 */
export const messageMutations = {
  /**
   * Invalidate cache after sending a message
   */
  onSend: (conversationId: string, userId: string) => {
    invalidateUserCache(defaultCacheManager, userId, 'conversations');
    invalidateUserCache(defaultCacheManager, userId, `conversation:${conversationId}`);
  },

  /**
   * Invalidate cache after marking messages as read
   */
  onMarkRead: (conversationId: string, userId: string) => {
    invalidateUserCache(defaultCacheManager, userId, 'conversations');
    invalidateUserCache(defaultCacheManager, userId, `conversation:${conversationId}`);
  },
};

/**
 * Invalidate cache after subscription mutations
 */
export const subscriptionMutations = {
  /**
   * Invalidate cache after subscription change
   */
  onChange: (userId: string) => {
    invalidateUserCache(defaultCacheManager, userId, 'subscription');
    invalidateProfileCache(defaultCacheManager, userId);
  },

  /**
   * Invalidate cache after subscription cancellation
   */
  onCancel: (userId: string) => {
    invalidateUserCache(defaultCacheManager, userId, 'subscription');
    invalidateProfileCache(defaultCacheManager, userId);
  },
};

/**
 * Invalidate all caches (use sparingly)
 */
export function invalidateAllCaches() {
  defaultCacheManager.clear();
}

/**
 * Wrapper for Supabase mutations with automatic cache invalidation
 */
export function withCacheInvalidation<T extends (...args: any[]) => Promise<any>>(
  mutationFn: T,
  invalidationFn: (...args: Parameters<T>) => void
): T {
  return (async (...args: Parameters<T>) => {
    try {
      const result = await mutationFn(...args);
      invalidationFn(...args);
      return result;
    } catch (error) {
      // Don't invalidate on error
      throw error;
    }
  }) as T;
}

/**
 * Example usage:
 * 
 * const createJobWithCache = withCacheInvalidation(
 *   createJob,
 *   () => jobMutations.onCreate()
 * );
 * 
 * const updateJobWithCache = withCacheInvalidation(
 *   updateJob,
 *   (jobId) => jobMutations.onUpdate(jobId)
 * );
 */
