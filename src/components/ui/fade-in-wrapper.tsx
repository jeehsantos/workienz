/**
 * Fade-In Wrapper Component
 * 
 * Provides smooth fade-in transitions from skeleton to content
 * Prevents layout shifts during transitions
 * 
 * Requirements: 7.4, 7.2
 */

import { ReactNode, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export interface FadeInWrapperProps {
  children: ReactNode;
  className?: string;
  duration?: number; // Duration in milliseconds
  delay?: number; // Delay before fade-in starts
  preserveHeight?: boolean; // Preserve height during transition to prevent layout shift
}

/**
 * Wrapper that fades in content smoothly
 */
export function FadeInWrapper({
  children,
  className,
  duration = 300,
  delay = 0,
  preserveHeight = true,
}: FadeInWrapperProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={cn(
        'transition-opacity',
        isVisible ? 'opacity-100' : 'opacity-0',
        className
      )}
      style={{
        transitionDuration: `${duration}ms`,
        ...(preserveHeight && height ? { minHeight: height } : {}),
      }}
      ref={(node) => {
        if (node && preserveHeight && !height) {
          setHeight(node.offsetHeight);
        }
      }}
    >
      {children}
    </div>
  );
}

/**
 * Loading transition component that handles skeleton to content transition
 */
export interface LoadingTransitionProps {
  isLoading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
  className?: string;
  duration?: number;
  minDisplayTime?: number; // Minimum time to show skeleton (prevents flashing)
}

export function LoadingTransition({
  isLoading,
  skeleton,
  children,
  className,
  duration = 300,
  minDisplayTime = 200,
}: LoadingTransitionProps) {
  const [showSkeleton, setShowSkeleton] = useState(isLoading);
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (isLoading) {
      setShowSkeleton(true);
      setLoadingStartTime(Date.now());
    } else if (loadingStartTime) {
      const elapsed = Date.now() - loadingStartTime;
      const remaining = Math.max(0, minDisplayTime - elapsed);

      const timer = setTimeout(() => {
        setShowSkeleton(false);
        setLoadingStartTime(null);
      }, remaining);

      return () => clearTimeout(timer);
    }
  }, [isLoading, loadingStartTime, minDisplayTime]);

  return (
    <div className={cn('relative', className)}>
      {showSkeleton ? (
        <div
          className={cn(
            'transition-opacity',
            !isLoading ? 'opacity-0' : 'opacity-100'
          )}
          style={{ transitionDuration: `${duration}ms` }}
        >
          {skeleton}
        </div>
      ) : (
        <FadeInWrapper duration={duration}>{children}</FadeInWrapper>
      )}
    </div>
  );
}

/**
 * Staggered fade-in for lists
 */
export interface StaggeredFadeInProps {
  children: ReactNode[];
  className?: string;
  staggerDelay?: number; // Delay between each item
  duration?: number;
}

export function StaggeredFadeIn({
  children,
  className,
  staggerDelay = 50,
  duration = 300,
}: StaggeredFadeInProps) {
  return (
    <div className={className}>
      {children.map((child, index) => (
        <FadeInWrapper
          key={index}
          duration={duration}
          delay={index * staggerDelay}
          preserveHeight={false}
        >
          {child}
        </FadeInWrapper>
      ))}
    </div>
  );
}

/**
 * Layout shift prevention wrapper
 * Reserves space for content to prevent cumulative layout shift
 */
export interface LayoutShiftPreventionProps {
  children: ReactNode;
  className?: string;
  minHeight?: number | string;
  aspectRatio?: string; // e.g., "16/9", "4/3"
}

export function LayoutShiftPrevention({
  children,
  className,
  minHeight,
  aspectRatio,
}: LayoutShiftPreventionProps) {
  return (
    <div
      className={cn('relative', className)}
      style={{
        minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight,
        aspectRatio,
      }}
    >
      {children}
    </div>
  );
}
