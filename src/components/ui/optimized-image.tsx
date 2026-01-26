/**
 * Optimized Image Component
 * 
 * Provides lazy loading, responsive sizing, and loading states for images
 * 
 * Requirements: 8.1, 8.2, 8.3
 */

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  lazy?: boolean;
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
  fallback?: React.ReactNode;
}

export function OptimizedImage({
  src,
  alt,
  className,
  lazy = true,
  priority = false,
  onLoad,
  onError,
  fallback,
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(!lazy || priority);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!lazy || priority) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before image enters viewport
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [lazy, priority]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  if (hasError && fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className={cn('relative overflow-hidden', className)} ref={imgRef}>
      {isInView && (
        <>
          {/* Loading placeholder */}
          {!isLoaded && (
            <div className="absolute inset-0 bg-muted animate-pulse" />
          )}
          
          {/* Actual image */}
          <img
            src={src}
            alt={alt}
            className={cn(
              'transition-opacity duration-300',
              isLoaded ? 'opacity-100' : 'opacity-0',
              className
            )}
            onLoad={handleLoad}
            onError={handleError}
            loading={lazy && !priority ? 'lazy' : 'eager'}
            decoding="async"
            {...props}
          />
        </>
      )}
      
      {/* Placeholder when not in view */}
      {!isInView && (
        <div className="absolute inset-0 bg-muted" />
      )}
    </div>
  );
}

/**
 * Responsive Image Component
 * 
 * Provides responsive image sizing with srcset support
 */
export interface ResponsiveImageProps extends OptimizedImageProps {
  srcSet?: string;
  sizes?: string;
}

export function ResponsiveImage({
  src,
  srcSet,
  sizes,
  ...props
}: ResponsiveImageProps) {
  return (
    <OptimizedImage
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      {...props}
    />
  );
}

/**
 * Background Image Component
 * 
 * Provides lazy loading for background images
 */
export interface BackgroundImageProps {
  src: string;
  className?: string;
  children?: React.ReactNode;
  lazy?: boolean;
  priority?: boolean;
}

export function BackgroundImage({
  src,
  className,
  children,
  lazy = true,
  priority = false,
}: BackgroundImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(!lazy || priority);
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lazy || priority) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px',
      }
    );

    if (divRef.current) {
      observer.observe(divRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [lazy, priority]);

  useEffect(() => {
    if (isInView && !isLoaded) {
      const img = new Image();
      img.src = src;
      img.onload = () => setIsLoaded(true);
    }
  }, [isInView, src, isLoaded]);

  return (
    <div
      ref={divRef}
      className={cn(
        'relative transition-opacity duration-300',
        isLoaded ? 'opacity-100' : 'opacity-0',
        className
      )}
      style={
        isLoaded
          ? {
              backgroundImage: `url(${src})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      {!isLoaded && <div className="absolute inset-0 bg-muted animate-pulse" />}
      {children}
    </div>
  );
}
