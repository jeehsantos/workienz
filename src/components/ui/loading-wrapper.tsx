/**
 * Loading Wrapper Component
 * 
 * Integrates LoadingManager with skeleton components for seamless loading states
 * 
 * Requirements: 7.1, 7.3
 */

import { ReactNode } from 'react';
import { useLoadingManager } from '@/hooks/useLoadingManager';
import { LoaderConfig } from '@/lib/loadingManager';
import { cn } from '@/lib/utils';

export interface LoadingWrapperProps {
  id: string;
  config?: LoaderConfig;
  skeleton: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
  onRetry?: () => void;
}

/**
 * Wrapper component that shows skeleton during loading and handles errors
 */
export function LoadingWrapper({
  id,
  config,
  skeleton,
  error: errorComponent,
  children,
  className,
  onRetry,
}: LoadingWrapperProps) {
  const { isLoading, error, clearError } = useLoadingManager({
    id,
    config: config || { minDisplayTime: 200 },
  });

  const handleRetry = () => {
    clearError();
    onRetry?.();
  };

  if (error) {
    if (errorComponent) {
      return <div className={className}>{errorComponent}</div>;
    }

    return (
      <div className={cn('flex flex-col items-center justify-center py-8 space-y-4', className)}>
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-destructive">
            {error.message || 'An error occurred'}
          </p>
          {onRetry && (
            <button
              onClick={handleRetry}
              className="text-sm text-primary hover:underline"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className={className}>{skeleton}</div>;
  }

  return <div className={className}>{children}</div>;
}

/**
 * Simple loading wrapper with default skeleton
 */
export interface SimpleLoadingWrapperProps {
  isLoading: boolean;
  error?: Error | null;
  skeleton: ReactNode;
  children: ReactNode;
  className?: string;
  onRetry?: () => void;
}

export function SimpleLoadingWrapper({
  isLoading,
  error,
  skeleton,
  children,
  className,
  onRetry,
}: SimpleLoadingWrapperProps) {
  if (error) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-8 space-y-4', className)}>
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-destructive">
            {error.message || 'An error occurred'}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-sm text-primary hover:underline"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className={className}>{skeleton}</div>;
  }

  return <div className={className}>{children}</div>;
}
