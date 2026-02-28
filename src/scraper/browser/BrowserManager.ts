import type { Browser, BrowserContext, Page } from 'playwright';
import { StealthConfig } from './StealthConfig.js';
import { env } from '../../config/env.js';
import logger from '../../observability/logger.js';

interface BrowserInstance {
  browser: Browser;
  activeContexts: number;
  createdAt: number;
}

interface ContextSession {
  context: BrowserContext;
  sessionId: string;
  lastUsed: number;
}

/**
 * BrowserManager - Manages browser pool and context lifecycle
 */
export class BrowserManager {
  private static instance: BrowserManager;
  private browsers: BrowserInstance[] = [];
  private contexts: Map<string, ContextSession> = new Map();
  private maxPoolSize: number;
  private isShuttingDown = false;

  private constructor() {
    this.maxPoolSize = env.BROWSER_POOL_SIZE;
  }

  static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  /**
   * Get or create a browser instance
   */
  private async getBrowser(): Promise<Browser> {
    // Clean up closed browsers
    this.browsers = this.browsers.filter((b) => b.browser.isConnected());

    // Reuse existing browser with capacity
    const available = this.browsers.find((b) => b.activeContexts < 5);
    if (available) {
      return available.browser;
    }

    // Check pool limit
    if (this.browsers.length >= this.maxPoolSize) {
      // Wait for an available browser
      logger.warn('Browser pool at capacity, waiting...');
      await this.sleep(1000);
      return this.getBrowser();
    }

    // Launch new browser
    const browser = await StealthConfig.launchBrowser();
    this.browsers.push({
      browser,
      activeContexts: 0,
      createdAt: Date.now(),
    });

    browser.on('disconnected', () => {
      this.browsers = this.browsers.filter((b) => b.browser !== browser);
      logger.info('Browser disconnected and removed from pool');
    });

    logger.info({ poolSize: this.browsers.length }, 'New browser launched');
    return browser;
  }

  /**
   * Create a new browser context
   */
  async createContext(sessionId?: string): Promise<BrowserContext> {
    if (this.isShuttingDown) {
      throw new Error('BrowserManager is shutting down');
    }

    // Check for existing session
    if (sessionId && this.contexts.has(sessionId)) {
      const session = this.contexts.get(sessionId)!;
      session.lastUsed = Date.now();
      logger.debug({ sessionId }, 'Reusing existing context');
      return session.context;
    }

    const browser = await this.getBrowser();
    const context = await StealthConfig.createContext(browser);

    // Track in browser instance
    const instance = this.browsers.find((b) => b.browser === browser);
    if (instance) {
      instance.activeContexts++;
    }

    // Store session if ID provided
    if (sessionId) {
      this.contexts.set(sessionId, {
        context,
        sessionId,
        lastUsed: Date.now(),
      });
    }

    // Handle context close
    context.on('close', () => {
      if (instance) {
        instance.activeContexts = Math.max(0, instance.activeContexts - 1);
      }
      if (sessionId) {
        this.contexts.delete(sessionId);
      }
    });

    return context;
  }

  /**
   * Create a new page with stealth configuration
   */
  async createPage(sessionId?: string): Promise<Page> {
    const context = await this.createContext(sessionId);
    const page = await StealthConfig.createPage(context);
    await StealthConfig.applyPageStealth(page);
    return page;
  }

  /**
   * Close a specific context
   */
  async closeContext(sessionId: string): Promise<void> {
    const session = this.contexts.get(sessionId);
    if (session) {
      await session.context.close();
      this.contexts.delete(sessionId);
      logger.debug({ sessionId }, 'Context closed');
    }
  }

  /**
   * Clean up idle contexts (older than maxAge ms)
   */
  async cleanupIdleContexts(maxAge: number = 30 * 60 * 1000): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.contexts) {
      if (now - session.lastUsed > maxAge) {
        await session.context.close();
        this.contexts.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info({ cleaned }, 'Cleaned up idle contexts');
    }
    return cleaned;
  }

  /**
   * Get pool status
   */
  getStatus(): {
    browsers: number;
    activeContexts: number;
    sessions: number;
  } {
    return {
      browsers: this.browsers.length,
      activeContexts: this.browsers.reduce((sum, b) => sum + b.activeContexts, 0),
      sessions: this.contexts.size,
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    logger.info('Shutting down BrowserManager...');

    // Close all contexts
    for (const session of this.contexts.values()) {
      await session.context.close().catch(() => {});
    }
    this.contexts.clear();

    // Close all browsers
    for (const instance of this.browsers) {
      await instance.browser.close().catch(() => {});
    }
    this.browsers = [];

    logger.info('BrowserManager shutdown complete');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton export
export const browserManager = BrowserManager.getInstance();

export default BrowserManager;
