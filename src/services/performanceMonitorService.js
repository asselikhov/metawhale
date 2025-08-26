/**
 * Performance Monitoring Service
 * Tracks callback response times and identifies performance bottlenecks
 */

class PerformanceMonitorService {
  constructor() {
    this.metrics = new Map();
    this.slowCallbacks = [];
    this.responseTimeThreshold = 1000; // 1 second threshold
    this.maxMetricsStorage = 1000;
  }

  /**
   * Start timing a callback operation
   * @param {string} callbackType - Type of callback (e.g., 'personal_cabinet', 'p2p_menu')
   * @param {string} chatId - User chat ID
   * @returns {Function} End timing function
   */
  startTiming(callbackType, chatId) {
    const startTime = Date.now();
    const operationId = `${callbackType}_${chatId}_${startTime}`;
    
    console.log(`⏱️ [PERF] Starting timer for ${callbackType} (${chatId})`);
    
    return {
      end: (details = {}) => this.endTiming(operationId, callbackType, chatId, startTime, details),
      operationId
    };
  }

  /**
   * End timing and record metrics
   */
  endTiming(operationId, callbackType, chatId, startTime, details = {}) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const metric = {
      operationId,
      callbackType,
      chatId,
      startTime,
      endTime,
      duration,
      details,
      timestamp: new Date()
    };

    // Store metric
    this.metrics.set(operationId, metric);
    
    // Clean old metrics if storage is full
    if (this.metrics.size > this.maxMetricsStorage) {
      const oldestKey = this.metrics.keys().next().value;
      this.metrics.delete(oldestKey);
    }

    // Log performance
    const emoji = duration < 100 ? '⚡' : duration < 500 ? '🟡' : duration < 1000 ? '🟠' : '🔴';
    console.log(`${emoji} [PERF] ${callbackType} completed in ${duration}ms (${chatId})`);

    // Track slow callbacks
    if (duration > this.responseTimeThreshold) {
      this.slowCallbacks.push(metric);
      console.warn(`🐌 [PERF] SLOW CALLBACK: ${callbackType} took ${duration}ms (threshold: ${this.responseTimeThreshold}ms)`);
      
      // Keep only last 100 slow callbacks
      if (this.slowCallbacks.length > 100) {
        this.slowCallbacks.shift();
      }
    }

    // Emit performance event if needed
    this.emitPerformanceEvent(metric);

    return metric;
  }

  /**
   * Emit performance events for monitoring
   */
  emitPerformanceEvent(metric) {
    if (metric.duration > this.responseTimeThreshold * 2) {
      // Very slow callback
      console.error(`🚨 [PERF] CRITICAL: ${metric.callbackType} took ${metric.duration}ms - investigating performance issue`);
    }
  }

  /**
   * Get performance statistics
   */
  getStats() {
    const allMetrics = Array.from(this.metrics.values());
    
    if (allMetrics.length === 0) {
      return {
        totalCallbacks: 0,
        averageResponseTime: 0,
        slowCallbacks: 0,
        fastCallbacks: 0,
        callbackTypes: {}
      };
    }

    const totalDuration = allMetrics.reduce((sum, metric) => sum + metric.duration, 0);
    const averageResponseTime = totalDuration / allMetrics.length;
    
    const slowCallbacks = allMetrics.filter(m => m.duration > this.responseTimeThreshold).length;
    const fastCallbacks = allMetrics.filter(m => m.duration <= 100).length;

    // Group by callback type
    const callbackTypes = {};
    allMetrics.forEach(metric => {
      if (!callbackTypes[metric.callbackType]) {
        callbackTypes[metric.callbackType] = {
          count: 0,
          totalDuration: 0,
          minDuration: Infinity,
          maxDuration: 0,
          slowCount: 0
        };
      }
      
      const type = callbackTypes[metric.callbackType];
      type.count++;
      type.totalDuration += metric.duration;
      type.minDuration = Math.min(type.minDuration, metric.duration);
      type.maxDuration = Math.max(type.maxDuration, metric.duration);
      
      if (metric.duration > this.responseTimeThreshold) {
        type.slowCount++;
      }
    });

    // Calculate averages for each type
    Object.values(callbackTypes).forEach(type => {
      type.avgDuration = type.totalDuration / type.count;
      type.slowPercentage = (type.slowCount / type.count) * 100;
    });

    return {
      totalCallbacks: allMetrics.length,
      averageResponseTime: Math.round(averageResponseTime),
      slowCallbacks,
      fastCallbacks,
      slowPercentage: Math.round((slowCallbacks / allMetrics.length) * 100),
      fastPercentage: Math.round((fastCallbacks / allMetrics.length) * 100),
      callbackTypes,
      recentSlowCallbacks: this.slowCallbacks.slice(-10) // Last 10 slow callbacks
    };
  }

  /**
   * Get top slowest callbacks
   */
  getSlowestCallbacks(limit = 10) {
    const allMetrics = Array.from(this.metrics.values());
    return allMetrics
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit)
      .map(metric => ({
        callbackType: metric.callbackType,
        duration: metric.duration,
        chatId: metric.chatId,
        timestamp: metric.timestamp
      }));
  }

  /**
   * Get performance report
   */
  getPerformanceReport() {
    const stats = this.getStats();
    const slowest = this.getSlowestCallbacks(5);
    
    return {
      summary: {
        totalCallbacks: stats.totalCallbacks,
        averageResponseTime: `${stats.averageResponseTime}ms`,
        performanceGrade: this.getPerformanceGrade(stats),
        slowCallbacksPercentage: `${stats.slowPercentage}%`
      },
      byCallbackType: stats.callbackTypes,
      slowestCallbacks: slowest,
      recommendations: this.getPerformanceRecommendations(stats)
    };
  }

  /**
   * Get performance grade
   */
  getPerformanceGrade(stats) {
    const avgTime = stats.averageResponseTime;
    const slowPercentage = stats.slowPercentage;
    
    if (avgTime < 100 && slowPercentage < 5) return 'A+ (Excellent)';
    if (avgTime < 200 && slowPercentage < 10) return 'A (Very Good)';
    if (avgTime < 500 && slowPercentage < 20) return 'B (Good)';
    if (avgTime < 1000 && slowPercentage < 30) return 'C (Acceptable)';
    return 'D (Needs Optimization)';
  }

  /**
   * Get performance recommendations
   */
  getPerformanceRecommendations(stats) {
    const recommendations = [];
    
    if (stats.slowPercentage > 20) {
      recommendations.push('High percentage of slow callbacks - implement more background processing');
    }
    
    if (stats.averageResponseTime > 500) {
      recommendations.push('Average response time is high - add more instant callback responses');
    }

    // Check specific callback types
    Object.entries(stats.callbackTypes).forEach(([type, typeStats]) => {
      if (typeStats.slowPercentage > 30) {
        recommendations.push(`${type} callbacks are frequently slow - optimize this specific handler`);
      }
      
      if (typeStats.avgDuration > 1000) {
        recommendations.push(`${type} has high average response time (${Math.round(typeStats.avgDuration)}ms) - consider caching or background processing`);
      }
    });

    if (recommendations.length === 0) {
      recommendations.push('Performance is good! No specific optimizations needed.');
    }

    return recommendations;
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.metrics.clear();
    this.slowCallbacks = [];
    console.log('🧹 [PERF] Performance metrics cleared');
  }

  /**
   * Set response time threshold
   */
  setThreshold(milliseconds) {
    this.responseTimeThreshold = milliseconds;
    console.log(`⚡ [PERF] Response time threshold set to ${milliseconds}ms`);
  }

  /**
   * Monitor a callback function
   */
  monitorCallback(callbackType) {
    return (originalFunction) => {
      return async function(ctx, ...args) {
        const chatId = ctx.chat?.id?.toString() || 'unknown';
        const timer = performanceMonitor.startTiming(callbackType, chatId);
        
        try {
          const result = await originalFunction.call(this, ctx, ...args);
          timer.end({ success: true });
          return result;
        } catch (error) {
          timer.end({ success: false, error: error.message });
          throw error;
        }
      };
    };
  }

  /**
   * Log performance summary periodically
   */
  startPeriodicLogging(intervalMinutes = 60) {
    setInterval(() => {
      const stats = this.getStats();
      if (stats.totalCallbacks > 0) {
        console.log('📊 [PERF] Performance Summary:');
        console.log(`   Total callbacks: ${stats.totalCallbacks}`);
        console.log(`   Average response: ${stats.averageResponseTime}ms`);
        console.log(`   Slow callbacks: ${stats.slowPercentage}%`);
        console.log(`   Performance grade: ${this.getPerformanceGrade(stats)}`);
      }
    }, intervalMinutes * 60 * 1000);
    
    console.log(`📊 [PERF] Periodic logging started (every ${intervalMinutes} minutes)`);
  }
}

const performanceMonitor = new PerformanceMonitorService();
module.exports = performanceMonitor;