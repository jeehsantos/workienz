/**
 * Real-time Connection Manager
 * 
 * Manages Supabase real-time connections to prevent connection overload.
 * Implements connection pooling and sharing to optimize resource usage.
 * 
 * Requirements: 9.1
 */

import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface ChannelSubscription {
  channel: RealtimeChannel;
  subscribers: Set<string>;
  lastActivity: number;
  batchedUpdates?: {
    updates: any[];
    timeout: ReturnType<typeof setTimeout> | null;
    callback: (payload: any) => void;
  };
}

class RealtimeConnectionManager {
  private channels: Map<string, ChannelSubscription> = new Map();
  private readonly MAX_CONNECTIONS = 5; // Limit concurrent connections
  private readonly IDLE_TIMEOUT = 60000; // 1 minute idle timeout
  private readonly BATCH_WINDOW = 100; // 100ms batching window (Requirement 9.2)
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup interval to remove idle connections
    this.startCleanup();
  }

  /**
   * Subscribe to a channel with connection pooling
   * Reuses existing channels when possible
   */
  subscribe(
    channelName: string,
    subscriberId: string,
    config: {
      event: string;
      schema: string;
      table: string;
      filter?: string;
    },
    callback: (payload: any) => void,
    options?: {
      enableBatching?: boolean; // Enable update batching (Requirement 9.2)
    }
  ): () => void {
    const enableBatching = options?.enableBatching ?? false;

    // Check if we've hit the connection limit
    if (this.channels.size >= this.MAX_CONNECTIONS && !this.channels.has(channelName)) {
      console.warn(
        `[RealtimeConnectionManager] Connection limit reached (${this.MAX_CONNECTIONS}). ` +
        `Reusing existing channels or waiting for cleanup.`
      );
      // Try to clean up idle connections first
      this.cleanupIdleConnections();
    }

    let channelSub = this.channels.get(channelName);

    if (!channelSub) {
      // Create new channel
      const channel = supabase.channel(channelName);
      
      channelSub = {
        channel,
        subscribers: new Set([subscriberId]),
        lastActivity: Date.now(),
      };

      // Set up the subscription with optional batching
      if (enableBatching) {
        // Initialize batching state
        channelSub.batchedUpdates = {
          updates: [],
          timeout: null,
          callback,
        };

        channel
          .on("postgres_changes" as any, config, (payload) => {
            // Update last activity
            const sub = this.channels.get(channelName);
            if (sub && sub.batchedUpdates) {
              sub.lastActivity = Date.now();
              this.batchUpdate(channelName, payload);
            }
          })
          .subscribe();
      } else {
        // Direct callback without batching
        channel
          .on("postgres_changes" as any, config, (payload) => {
            // Update last activity
            const sub = this.channels.get(channelName);
            if (sub) {
              sub.lastActivity = Date.now();
            }
            callback(payload);
          })
          .subscribe();
      }

      this.channels.set(channelName, channelSub);
      
      console.info(
        `[RealtimeConnectionManager] Created new channel: ${channelName} ` +
        `(${this.channels.size}/${this.MAX_CONNECTIONS} connections)` +
        (enableBatching ? ' [BATCHING ENABLED]' : '')
      );
    } else {
      // Reuse existing channel
      channelSub.subscribers.add(subscriberId);
      channelSub.lastActivity = Date.now();
      
      console.info(
        `[RealtimeConnectionManager] Reused channel: ${channelName} ` +
        `(${channelSub.subscribers.size} subscribers)`
      );
    }

    // Return unsubscribe function
    return () => {
      this.unsubscribe(channelName, subscriberId);
    };
  }

  /**
   * Unsubscribe from a channel
   * Removes the channel if no more subscribers
   */
  private unsubscribe(channelName: string, subscriberId: string): void {
    const channelSub = this.channels.get(channelName);
    if (!channelSub) return;

    channelSub.subscribers.delete(subscriberId);

    // If no more subscribers, remove the channel
    if (channelSub.subscribers.size === 0) {
      // Clear any pending batch timeout
      if (channelSub.batchedUpdates?.timeout) {
        clearTimeout(channelSub.batchedUpdates.timeout);
      }

      supabase.removeChannel(channelSub.channel);
      this.channels.delete(channelName);
      
      console.info(
        `[RealtimeConnectionManager] Removed channel: ${channelName} ` +
        `(${this.channels.size}/${this.MAX_CONNECTIONS} connections)`
      );
    } else {
      console.info(
        `[RealtimeConnectionManager] Unsubscribed from channel: ${channelName} ` +
        `(${channelSub.subscribers.size} subscribers remaining)`
      );
    }
  }

  /**
   * Batch an update within the batching window
   * Requirement 9.2: Batch updates within 100ms window
   */
  private batchUpdate(channelName: string, payload: any): void {
    const channelSub = this.channels.get(channelName);
    if (!channelSub || !channelSub.batchedUpdates) return;

    const { updates, timeout, callback } = channelSub.batchedUpdates;

    // Add update to batch
    updates.push(payload);

    // Clear existing timeout
    if (timeout) {
      clearTimeout(timeout);
    }

    // Set new timeout to flush batch after BATCH_WINDOW
    channelSub.batchedUpdates.timeout = setTimeout(() => {
      if (updates.length > 0) {
        // Flush all batched updates
        const batchedPayloads = [...updates];
        updates.length = 0; // Clear the array

        console.info(
          `[RealtimeConnectionManager] Flushing ${batchedPayloads.length} batched updates for ${channelName}`
        );

        // Call callback with batched updates
        callback({ batched: true, updates: batchedPayloads });
      }
      channelSub.batchedUpdates!.timeout = null;
    }, this.BATCH_WINDOW);
  }

  /**
   * Clean up idle connections
   */
  private cleanupIdleConnections(): void {
    const now = Date.now();
    const channelsToRemove: string[] = [];

    this.channels.forEach((channelSub, channelName) => {
      const idleTime = now - channelSub.lastActivity;
      
      // Remove channels that have been idle for too long
      if (idleTime > this.IDLE_TIMEOUT && channelSub.subscribers.size === 0) {
        channelsToRemove.push(channelName);
      }
    });

    channelsToRemove.forEach((channelName) => {
      const channelSub = this.channels.get(channelName);
      if (channelSub) {
        supabase.removeChannel(channelSub.channel);
        this.channels.delete(channelName);
        
        console.info(
          `[RealtimeConnectionManager] Cleaned up idle channel: ${channelName}`
        );
      }
    });
  }

  /**
   * Start periodic cleanup of idle connections
   */
  private startCleanup(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, this.IDLE_TIMEOUT);
  }

  /**
   * Stop cleanup interval
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get connection metrics
   */
  getMetrics() {
    const metrics = {
      totalConnections: this.channels.size,
      maxConnections: this.MAX_CONNECTIONS,
      channels: Array.from(this.channels.entries()).map(([name, sub]) => ({
        name,
        subscribers: sub.subscribers.size,
        idleTime: Date.now() - sub.lastActivity,
      })),
    };

    return metrics;
  }

  /**
   * Log connection metrics
   */
  logMetrics(): void {
    const metrics = this.getMetrics();
    
    console.info('[RealtimeConnectionManager] Metrics', {
      connections: `${metrics.totalConnections}/${metrics.maxConnections}`,
      channels: metrics.channels.map(c => ({
        name: c.name,
        subscribers: c.subscribers,
        idleSeconds: Math.floor(c.idleTime / 1000),
      })),
    });
  }

  /**
   * Cleanup all connections (for app shutdown)
   */
  cleanup(): void {
    this.stopCleanup();
    
    this.channels.forEach((channelSub) => {
      // Clear any pending batch timeouts
      if (channelSub.batchedUpdates?.timeout) {
        clearTimeout(channelSub.batchedUpdates.timeout);
      }
      supabase.removeChannel(channelSub.channel);
    });
    
    this.channels.clear();
    console.info('[RealtimeConnectionManager] All connections cleaned up');
  }
}

// Export singleton instance
export const realtimeConnectionManager = new RealtimeConnectionManager();

// Log metrics in development every 2 minutes
if (import.meta.env.DEV) {
  setInterval(() => {
    realtimeConnectionManager.logMetrics();
  }, 2 * 60 * 1000);
}
