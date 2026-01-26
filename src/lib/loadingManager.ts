/**
 * Loading Manager
 * 
 * Manages loading states across the application with support for:
 * - Loading state registration and coordination
 * - Minimum display time logic to prevent flashing
 * - Multiple concurrent loading states
 * 
 * Requirements: 7.3
 */

export interface LoaderConfig {
  minDisplayTime: number; // Minimum time to display loading state (ms)
  skeleton?: React.ComponentType<any>;
  errorFallback?: React.ComponentType<{ error: Error; retry?: () => void }>;
}

export interface LoadingState {
  id: string;
  isLoading: boolean;
  startTime: number | null;
  minDisplayTime: number;
  error: Error | null;
}

class LoadingManagerClass {
  private loaders: Map<string, LoadingState> = new Map();
  private configs: Map<string, LoaderConfig> = new Map();
  private listeners: Map<string, Set<(state: LoadingState) => void>> = new Map();

  /**
   * Register a loader with configuration
   */
  registerLoader(id: string, config: LoaderConfig): void {
    this.configs.set(id, config);
    
    if (!this.loaders.has(id)) {
      this.loaders.set(id, {
        id,
        isLoading: false,
        startTime: null,
        minDisplayTime: config.minDisplayTime,
        error: null,
      });
    }
  }

  /**
   * Start loading state for a loader
   */
  startLoading(id: string): void {
    const loader = this.loaders.get(id);
    const config = this.configs.get(id);

    if (!loader || !config) {
      console.warn(`[LoadingManager] Loader "${id}" not registered`);
      return;
    }

    const updatedLoader: LoadingState = {
      ...loader,
      isLoading: true,
      startTime: Date.now(),
      error: null,
    };

    this.loaders.set(id, updatedLoader);
    this.notifyListeners(id, updatedLoader);
  }

  /**
   * Stop loading state for a loader
   * Respects minimum display time to prevent flashing
   */
  async stopLoading(id: string, error?: Error): Promise<void> {
    const loader = this.loaders.get(id);
    const config = this.configs.get(id);

    if (!loader || !config) {
      console.warn(`[LoadingManager] Loader "${id}" not registered`);
      return;
    }

    if (!loader.isLoading) {
      return;
    }

    const elapsedTime = loader.startTime ? Date.now() - loader.startTime : 0;
    const remainingTime = Math.max(0, loader.minDisplayTime - elapsedTime);

    // Wait for minimum display time if needed
    if (remainingTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, remainingTime));
    }

    const updatedLoader: LoadingState = {
      ...loader,
      isLoading: false,
      startTime: null,
      error: error || null,
    };

    this.loaders.set(id, updatedLoader);
    this.notifyListeners(id, updatedLoader);
  }

  /**
   * Get current loading state for a loader
   */
  getLoadingState(id: string): LoadingState | null {
    return this.loaders.get(id) || null;
  }

  /**
   * Get loader configuration
   */
  getLoaderConfig(id: string): LoaderConfig | null {
    return this.configs.get(id) || null;
  }

  /**
   * Subscribe to loading state changes
   */
  subscribe(id: string, listener: (state: LoadingState) => void): () => void {
    if (!this.listeners.has(id)) {
      this.listeners.set(id, new Set());
    }

    this.listeners.get(id)!.add(listener);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(id);
      if (listeners) {
        listeners.delete(listener);
      }
    };
  }

  /**
   * Clear error state for a loader
   */
  clearError(id: string): void {
    const loader = this.loaders.get(id);
    if (loader && loader.error) {
      const updatedLoader: LoadingState = {
        ...loader,
        error: null,
      };
      this.loaders.set(id, updatedLoader);
      this.notifyListeners(id, updatedLoader);
    }
  }

  /**
   * Unregister a loader and clean up
   */
  unregisterLoader(id: string): void {
    this.loaders.delete(id);
    this.configs.delete(id);
    this.listeners.delete(id);
  }

  /**
   * Check if any loaders are currently loading
   */
  isAnyLoading(): boolean {
    return Array.from(this.loaders.values()).some((loader) => loader.isLoading);
  }

  /**
   * Get all active loading states
   */
  getActiveLoadingStates(): LoadingState[] {
    return Array.from(this.loaders.values()).filter((loader) => loader.isLoading);
  }

  /**
   * Notify all listeners for a specific loader
   */
  private notifyListeners(id: string, state: LoadingState): void {
    const listeners = this.listeners.get(id);
    if (listeners) {
      listeners.forEach((listener) => listener(state));
    }
  }

  /**
   * Reset all loading states (useful for testing)
   */
  reset(): void {
    this.loaders.clear();
    this.configs.clear();
    this.listeners.clear();
  }
}

// Export singleton instance
export const LoadingManager = new LoadingManagerClass();

// Export class for testing
export { LoadingManagerClass };
