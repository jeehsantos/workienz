/**
 * Enhanced Loading Wrapper
 * 
 * Combines LoadingManager, skeleton components, and smooth transitions
 * Provides complete loading state management with:
 * - Minimum display time
 * - Smooth fade-in transitions
 * - Layout shift prevention
 * - Error handling with retry
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { ReactNode } from 'react';
import { useLoadingManager } from '@/hooks/useLoadingManager';
import { LoaderConfig } from '@/lib/loadingManager';
import { LoadingTransition } from './fade-in-wrapper';
import { cn } from '@/lib/utils';

export interface EnhancedLoadingWrapperProps {
  id: string;
  config?: LoaderConfig;
  skeleton: ReactNode;
  children: ReactNode;
  className?: string;
  transitionDuration?: number;
  onRetry?: () => void;
  errorComponent?: ReactNode;
  showErrorDetails?: boolean;
}

/**
 * Complete loading wrapper with all features
 */
export function EnhancedLoadingWrapper({
  id,
  config,
  skeleton,
  children,
  className,
  transitionDuration = 300,
  onRetry,
  errorComponent,
  showErrorDetails = false,
}: EnhancedLoadingWrapperProps) {
  const { isLoading, error, clearError } = useLoadingManager({
    id,
    config: config || { minDisplayTime: 200 },
  });

  const handleRetry = () => {
    clearError();
    onRetry?.();
  };

  // Show error state
  if (error) {
    if (errorComponent) {
      return <div className={className}>{errorComponent}</div>;
    }

    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-12 px-4 space-y-4',
          className
        )}
      >
        <div className="text-center space-y-3 max-w-md">
          <div className="space-y-1">
            <p className="text-sm font-medium text-destructive">
              Something went wrong
            </p>
            {showErrorDetails && (
              <p className="text-xs text-muted-foreground">
                {error.message}
              </p>
            )}
          </div>

          {onRetry && (
            <button
              onClick={handleRetry}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  // Show loading or content with smooth transition
  return (
    <LoadingTransition
      isLoading={isLoading}
      skeleton={skeleton}
      duration={transitionDuration}
      minDisplayTime={config?.minDisplayTime || 200}
      className={className}
    >
      {children}
    </LoadingTransition>
  );
}

/**
 * Simplified version for quick use
 */
export interface QuickLoadingWrapperProps {
  isLoading: boolean;
  error?: Error | null;
  skeleton: ReactNode;
  children: ReactNode;
  className?: string;
  onRetry?: () => void;
}

export function QuickLoadingWrapper({
  isLoading,
  error,
  skeleton,
  children,
  className,
  onRetry,
}: QuickLoadingWrapperProps) {
  if (error) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-12 px-4 space-y-4',
          className
        )}
      >
        <div className="text-center space-y-3 max-w-md">
          <p className="text-sm font-medium text-destructive">
            {error.message || 'Something went wrong'}
          </p>

          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <LoadingTransition
      isLoading={isLoading}
      skeleton={skeleton}
      duration={300}
      minDisplayTime={200}
      className={className}
    >
      {children}
    </LoadingTransition>
  );
}
