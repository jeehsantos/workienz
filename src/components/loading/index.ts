/**
 * Loading Components Index
 * 
 * Central export for all loading-related components
 */

// Core loading manager
export { LoadingManager, LoadingManagerClass } from '@/lib/loadingManager';
export type { LoaderConfig, LoadingState } from '@/lib/loadingManager';

// Hooks
export { useLoadingManager, useMultipleLoadingStates } from '@/hooks/useLoadingManager';
export type { UseLoadingManagerOptions, UseLoadingManagerReturn } from '@/hooks/useLoadingManager';

// Skeleton components
export {
  SkeletonCard,
  SkeletonList,
  SkeletonListItem,
  SkeletonGrid,
  SkeletonTable,
  SkeletonProfile,
  SkeletonForm,
  SkeletonArticle,
  SkeletonJobPosting,
  SkeletonMessage,
} from '@/components/ui/skeleton-components';

export type {
  SkeletonCardProps,
  SkeletonListProps,
  SkeletonListItemProps,
  SkeletonGridProps,
  SkeletonTableProps,
  SkeletonProfileProps,
  SkeletonFormProps,
  SkeletonArticleProps,
  SkeletonJobPostingProps,
  SkeletonMessageProps,
} from '@/components/ui/skeleton-components';

// Transition components
export {
  FadeInWrapper,
  LoadingTransition,
  StaggeredFadeIn,
  LayoutShiftPrevention,
} from '@/components/ui/fade-in-wrapper';

export type {
  FadeInWrapperProps,
  LoadingTransitionProps,
  StaggeredFadeInProps,
  LayoutShiftPreventionProps,
} from '@/components/ui/fade-in-wrapper';

// Wrapper components
export {
  LoadingWrapper,
  SimpleLoadingWrapper,
} from '@/components/ui/loading-wrapper';

export type {
  LoadingWrapperProps,
  SimpleLoadingWrapperProps,
} from '@/components/ui/loading-wrapper';

export {
  EnhancedLoadingWrapper,
  QuickLoadingWrapper,
} from '@/components/ui/enhanced-loading-wrapper';

export type {
  EnhancedLoadingWrapperProps,
  QuickLoadingWrapperProps,
} from '@/components/ui/enhanced-loading-wrapper';

// Base skeleton
export { Skeleton } from '@/components/ui/skeleton';
