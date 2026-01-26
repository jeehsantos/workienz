/**
 * Skeleton Component Library
 * 
 * Reusable skeleton components for different content layouts
 * - Card skeletons
 * - List skeletons
 * - Grid skeletons
 * - Custom layouts
 * 
 * Requirements: 7.1
 */

import { Skeleton } from './skeleton';
import { cn } from '@/lib/utils';

// ============================================================================
// Card Skeleton
// ============================================================================

export interface SkeletonCardProps {
  className?: string;
  showImage?: boolean;
  showTitle?: boolean;
  showDescription?: boolean;
  showFooter?: boolean;
  lines?: number;
}

export function SkeletonCard({
  className,
  showImage = true,
  showTitle = true,
  showDescription = true,
  showFooter = true,
  lines = 3,
}: SkeletonCardProps) {
  return (
    <div className={cn('rounded-lg border bg-card p-4 space-y-3', className)}>
      {showImage && <Skeleton className="h-48 w-full rounded-md" />}
      
      {showTitle && <Skeleton className="h-6 w-3/4" />}
      
      {showDescription && (
        <div className="space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn(
                'h-4',
                i === lines - 1 ? 'w-2/3' : 'w-full'
              )}
            />
          ))}
        </div>
      )}
      
      {showFooter && (
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// List Skeleton
// ============================================================================

export interface SkeletonListItemProps {
  className?: string;
  showAvatar?: boolean;
  showIcon?: boolean;
  lines?: number;
}

export function SkeletonListItem({
  className,
  showAvatar = false,
  showIcon = false,
  lines = 2,
}: SkeletonListItemProps) {
  return (
    <div className={cn('flex items-start gap-3 p-3', className)}>
      {showAvatar && <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />}
      {showIcon && <Skeleton className="h-5 w-5 rounded flex-shrink-0 mt-0.5" />}
      
      <div className="flex-1 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn(
              'h-4',
              i === 0 ? 'w-3/4' : i === lines - 1 ? 'w-1/2' : 'w-full'
            )}
          />
        ))}
      </div>
    </div>
  );
}

export interface SkeletonListProps {
  className?: string;
  count?: number;
  itemProps?: SkeletonListItemProps;
  divider?: boolean;
}

export function SkeletonList({
  className,
  count = 5,
  itemProps,
  divider = true,
}: SkeletonListProps) {
  return (
    <div className={cn('space-y-0', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <SkeletonListItem {...itemProps} />
          {divider && i < count - 1 && <div className="border-b" />}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Grid Skeleton
// ============================================================================

export interface SkeletonGridProps {
  className?: string;
  columns?: 1 | 2 | 3 | 4 | 6;
  count?: number;
  itemClassName?: string;
  cardProps?: SkeletonCardProps;
}

export function SkeletonGrid({
  className,
  columns = 3,
  count = 6,
  itemClassName,
  cardProps,
}: SkeletonGridProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
  };

  return (
    <div className={cn('grid gap-4', gridCols[columns], className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} className={itemClassName} {...cardProps} />
      ))}
    </div>
  );
}

// ============================================================================
// Table Skeleton
// ============================================================================

export interface SkeletonTableProps {
  className?: string;
  rows?: number;
  columns?: number;
  showHeader?: boolean;
}

export function SkeletonTable({
  className,
  rows = 5,
  columns = 4,
  showHeader = true,
}: SkeletonTableProps) {
  return (
    <div className={cn('w-full', className)}>
      {showHeader && (
        <div className="flex gap-4 border-b pb-3 mb-3">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      )}
      
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={colIndex}
                className={cn(
                  'h-4 flex-1',
                  colIndex === 0 && 'max-w-[100px]'
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Profile Skeleton
// ============================================================================

export interface SkeletonProfileProps {
  className?: string;
  showCover?: boolean;
  showBio?: boolean;
  showStats?: boolean;
}

export function SkeletonProfile({
  className,
  showCover = true,
  showBio = true,
  showStats = true,
}: SkeletonProfileProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {showCover && <Skeleton className="h-48 w-full rounded-lg" />}
      
      <div className="flex items-start gap-4">
        <Skeleton className="h-24 w-24 rounded-full flex-shrink-0" />
        
        <div className="flex-1 space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
          
          {showBio && (
            <div className="space-y-2 pt-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          )}
        </div>
      </div>
      
      {showStats && (
        <div className="flex gap-6 pt-4 border-t">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Form Skeleton
// ============================================================================

export interface SkeletonFormProps {
  className?: string;
  fields?: number;
  showSubmit?: boolean;
}

export function SkeletonForm({
  className,
  fields = 4,
  showSubmit = true,
}: SkeletonFormProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ))}
      
      {showSubmit && (
        <div className="pt-2">
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Article Skeleton
// ============================================================================

export interface SkeletonArticleProps {
  className?: string;
  showImage?: boolean;
  showMeta?: boolean;
}

export function SkeletonArticle({
  className,
  showImage = true,
  showMeta = true,
}: SkeletonArticleProps) {
  return (
    <article className={cn('space-y-4', className)}>
      {showImage && <Skeleton className="h-64 w-full rounded-lg" />}
      
      <div className="space-y-3">
        <Skeleton className="h-10 w-3/4" />
        
        {showMeta && (
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        )}
        
        <div className="space-y-2 pt-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn(
                'h-4',
                i % 4 === 3 ? 'w-2/3' : 'w-full'
              )}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

// ============================================================================
// Job Posting Skeleton
// ============================================================================

export interface SkeletonJobPostingProps {
  className?: string;
  variant?: 'card' | 'list' | 'detail';
}

export function SkeletonJobPosting({
  className,
  variant = 'card',
}: SkeletonJobPostingProps) {
  if (variant === 'detail') {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="space-y-3">
          <Skeleton className="h-10 w-3/4" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-5 w-48" />
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-20 rounded-full" />
          ))}
        </div>
        
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn(
                'h-4',
                i % 5 === 4 ? 'w-3/4' : 'w-full'
              )}
            />
          ))}
        </div>
        
        <div className="flex gap-3 pt-4">
          <Skeleton className="h-10 flex-1 rounded-md" />
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={cn('flex items-start gap-4 p-4 border-b', className)}>
        <Skeleton className="h-12 w-12 rounded flex-shrink-0" />
        
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2 pt-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-16 rounded-full" />
            ))}
          </div>
        </div>
        
        <Skeleton className="h-8 w-24 rounded-md flex-shrink-0" />
      </div>
    );
  }

  // Default: card variant
  return (
    <SkeletonCard
      className={className}
      showImage={false}
      showTitle={true}
      showDescription={true}
      showFooter={true}
      lines={2}
    />
  );
}

// ============================================================================
// Message/Chat Skeleton
// ============================================================================

export interface SkeletonMessageProps {
  className?: string;
  count?: number;
  variant?: 'sent' | 'received';
}

export function SkeletonMessage({
  className,
  count = 5,
  variant,
}: SkeletonMessageProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: count }).map((_, i) => {
        const isSent = variant === 'sent' || (variant === undefined && i % 2 === 0);
        
        return (
          <div
            key={i}
            className={cn(
              'flex gap-2',
              isSent ? 'justify-end' : 'justify-start'
            )}
          >
            {!isSent && <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />}
            
            <div className={cn('space-y-1', isSent ? 'items-end' : 'items-start')}>
              <Skeleton className={cn('h-4 w-20')} />
              <Skeleton
                className={cn(
                  'h-16 rounded-lg',
                  i % 3 === 0 ? 'w-48' : i % 3 === 1 ? 'w-64' : 'w-56'
                )}
              />
            </div>
            
            {isSent && <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}
