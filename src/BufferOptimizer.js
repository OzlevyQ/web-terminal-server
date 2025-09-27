const zlib = require('zlib');

class BufferOptimizer {
  constructor(config) {
    this.config = config;
    this.compressionCache = new Map();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    
    // Clear cache periodically
    this.cacheCleanupInterval = setInterval(() => {
      this.cleanupCache();
    }, 5 * 60 * 1000); // Every 5 minutes
  }
  
  optimize(packet) {
    const { data, token } = packet;
    
    // Skip optimization for small packets
    if (data.length < this.config.performance.compressionThreshold) {
      return {
        data,
        token,
        compressed: false
      };
    }
    
    // Try compression for large packets
    if (data.length > this.config.performance.compressionThreshold * 2) {
      const compressed = this.compress(data);
      if (compressed && compressed.length < data.length * 0.8) {
        return {
          data: compressed,
          token,
          compressed: true
        };
      }
    }
    
    // Return uncompressed for medium packets
    return {
      data,
      token,
      compressed: false
    };
  }
  
  compress(data) {
    try {
      // Check cache first
      const cacheKey = this.getCacheKey(data);
      if (this.compressionCache.has(cacheKey)) {
        this.cacheHits++;
        return this.compressionCache.get(cacheKey);
      }
      
      this.cacheMisses++;
      
      // Synchronous compression for speed
      const compressed = zlib.deflateSync(data, {
        level: zlib.Z_BEST_SPEED // Fastest compression
      });
      
      // Cache if beneficial
      if (compressed.length < data.length * 0.9) {
        this.compressionCache.set(cacheKey, compressed);
      }
      
      return compressed;
    } catch (error) {
      console.error('Compression error:', error);
      return null;
    }
  }
  
  decompress(data) {
    try {
      return zlib.inflateSync(data);
    } catch (error) {
      console.error('Decompression error:', error);
      return data;
    }
  }
  
  getCacheKey(data) {
    // Use first 100 bytes as cache key for performance
    const sample = data.slice(0, 100);
    return sample.toString('base64');
  }
  
  // Analyze data patterns for AI CLI optimization
  analyzePattern(data) {
    const strData = data.toString();
    
    // Detect common AI CLI patterns
    const patterns = {
      isJSON: /^[\s]*[\{\[]/.test(strData),
      isMarkdown: /^#{1,6}\s/.test(strData) || /^\*\*/.test(strData),
      isCode: /^```/.test(strData) || /function|class|import|const|let|var/.test(strData),
      isProgress: /\[[\=\-\s]*\]/.test(strData) || /\d+%/.test(strData),
      isANSI: /\x1b\[/.test(strData),
      isLargeOutput: strData.length > 10000
    };
    
    return patterns;
  }
  
  // Optimize based on detected patterns
  applyPatternOptimization(data, patterns) {
    // For progress bars and ANSI sequences, use minimal buffering
    if (patterns.isProgress || patterns.isANSI) {
      return {
        priority: 'high',
        buffer: false,
        compress: false
      };
    }
    
    // For JSON/structured data, use compression
    if (patterns.isJSON || patterns.isCode) {
      return {
        priority: 'normal',
        buffer: true,
        compress: data.length > 1024
      };
    }
    
    // For large outputs, always compress and buffer
    if (patterns.isLargeOutput) {
      return {
        priority: 'low',
        buffer: true,
        compress: true
      };
    }
    
    return {
      priority: 'normal',
      buffer: false,
      compress: false
    };
  }
  
  getStats() {
    const hitRate = this.cacheHits + this.cacheMisses > 0
      ? (this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100
      : 0;
    
    return {
      cacheSize: this.compressionCache.size,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate: hitRate.toFixed(2) + '%'
    };
  }
  
  cleanupCache() {
    // Keep only recent entries
    const maxCacheSize = 100;
    
    if (this.compressionCache.size > maxCacheSize) {
      const entriesToRemove = this.compressionCache.size - maxCacheSize;
      const keys = Array.from(this.compressionCache.keys());
      
      for (let i = 0; i < entriesToRemove; i++) {
        this.compressionCache.delete(keys[i]);
      }
    }
    
    console.log('Cache cleanup:', this.getStats());
  }
  
  destroy() {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }
    this.compressionCache.clear();
  }
}

module.exports = BufferOptimizer;