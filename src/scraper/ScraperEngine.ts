import type { Page, BrowserContext } from 'playwright';
import { browserManager } from './browser/BrowserManager.js';
import { Humanizer } from './humanizer/index.js';
import { CookieConsentHandler } from './consent/CookieConsentHandler.js';
import { DelayManager } from './humanizer/DelayManager.js';
import logger from '../observability/logger.js';
import { env } from '../config/env.js';

export interface ScraperOptions {
  sessionId?: string;
  timeout?: number;
  warmupUrl?: string;
}

export interface ScraperResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  executionMs: number;
}

/**
 * ScraperEngine - Main orchestration class for scraping operations
 */
export class ScraperEngine {
  private humanizer: Humanizer;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private sessionId: string;
  private startTime: number = 0;

  constructor(options: ScraperOptions = {}) {
    this.sessionId = options.sessionId || `session-${Date.now()}`;
    this.humanizer = new Humanizer();
  }

  /**
   * Initialize browser and page
   */
  async initialize(): Promise<void> {
    this.startTime = Date.now();
    logger.info({ sessionId: this.sessionId }, 'Initializing ScraperEngine');

    this.page = await browserManager.createPage(this.sessionId);
    this.context = this.page.context();

    // Set default timeout
    this.page.setDefaultTimeout(env.TASK_TIMEOUT_MS);
    this.page.setDefaultNavigationTimeout(60000);
  }

  /**
   * Navigate to URL with human-like behavior
   */
  async navigate(url: string, options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }): Promise<void> {
    if (!this.page) throw new Error('ScraperEngine not initialized');

    logger.debug({ url }, 'Navigating to URL');

    await this.page.goto(url, {
      waitUntil: options?.waitUntil || 'domcontentloaded',
    });

    // Wait for page to settle
    await DelayManager.pageLoadDelay();

    // Handle cookie consent if present
    await CookieConsentHandler.handle(this.page);
  }

  /**
   * Perform session warmup (visit homepage, scroll around)
   */
  async warmup(baseUrl: string): Promise<void> {
    if (!this.page) throw new Error('ScraperEngine not initialized');

    logger.debug({ baseUrl }, 'Performing session warmup');

    // Navigate to homepage
    const url = new URL(baseUrl);
    await this.page.goto(url.origin, { waitUntil: 'domcontentloaded' });

    // Wait for page load
    await DelayManager.pageLoadDelay();

    // Handle cookie consent
    await CookieConsentHandler.handle(this.page);

    // Random scroll to simulate browsing
    await this.humanizer.randomScroll(this.page);

    // Random delay
    await DelayManager.interActionDelay();

    logger.debug('Session warmup complete');
  }

  /**
   * Click an element with human-like behavior
   */
  async click(selector: string): Promise<void> {
    if (!this.page) throw new Error('ScraperEngine not initialized');

    const element = await this.page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    await this.humanizer.click(this.page, element);
    await DelayManager.microDelay();
  }

  /**
   * Type text into an input field
   */
  async type(selector: string, text: string): Promise<void> {
    if (!this.page) throw new Error('ScraperEngine not initialized');

    const element = await this.page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    await this.humanizer.clickAndType(this.page, element, text);
  }

  /**
   * Clear and type into an input field
   */
  async clearAndType(selector: string, text: string): Promise<void> {
    if (!this.page) throw new Error('ScraperEngine not initialized');

    const element = await this.page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    await this.humanizer.click(this.page, element);
    await this.humanizer.clearAndType(this.page, element, text);
  }

  /**
   * Fill a form with multiple fields
   */
  async fillForm(fields: Array<{ selector: string; value: string }>): Promise<void> {
    if (!this.page) throw new Error('ScraperEngine not initialized');

    await this.humanizer.fillForm(this.page, fields);
  }

  /**
   * Scroll the page
   */
  async scroll(options?: { distance?: number; direction?: 'down' | 'up' }): Promise<void> {
    if (!this.page) throw new Error('ScraperEngine not initialized');

    await this.humanizer.scrollGradual(this.page, options);
  }

  /**
   * Wait for a selector with timeout
   */
  async waitFor(selector: string, timeout?: number): Promise<void> {
    if (!this.page) throw new Error('ScraperEngine not initialized');

    await this.page.waitForSelector(selector, { timeout: timeout || 30000 });
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation(): Promise<void> {
    if (!this.page) throw new Error('ScraperEngine not initialized');

    await this.page.waitForLoadState('domcontentloaded');
    await DelayManager.pageLoadDelay();
  }

  /**
   * Extract text from an element
   */
  async getText(selector: string): Promise<string | null> {
    if (!this.page) throw new Error('ScraperEngine not initialized');

    const element = await this.page.$(selector);
    if (!element) return null;

    return element.textContent();
  }

  /**
   * Extract attribute from an element
   */
  async getAttribute(selector: string, attribute: string): Promise<string | null> {
    if (!this.page) throw new Error('ScraperEngine not initialized');

    const element = await this.page.$(selector);
    if (!element) return null;

    return element.getAttribute(attribute);
  }

  /**
   * Extract data using page.evaluate
   */
  async evaluate<T>(fn: () => T): Promise<T> {
    if (!this.page) throw new Error('ScraperEngine not initialized');

    return this.page.evaluate(fn);
  }

  /**
   * Take a screenshot
   */
  async screenshot(path?: string): Promise<Buffer> {
    if (!this.page) throw new Error('ScraperEngine not initialized');

    return this.page.screenshot({ path, fullPage: true });
  }

  /**
   * Get current URL
   */
  get currentUrl(): string {
    return this.page?.url() || '';
  }

  /**
   * Get the underlying page instance (for advanced operations)
   */
  get rawPage(): Page | null {
    return this.page;
  }

  /**
   * Add inter-action delay
   */
  async delay(): Promise<void> {
    await DelayManager.interActionDelay();
  }

  /**
   * Add thinking delay (before form fills, decisions)
   */
  async think(): Promise<void> {
    await DelayManager.thinkingDelay();
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    const executionMs = Date.now() - this.startTime;
    logger.info({ sessionId: this.sessionId, executionMs }, 'Cleaning up ScraperEngine');

    if (this.page) {
      await this.page.close().catch(() => {});
      this.page = null;
    }

    // Note: We don't close context here to allow session reuse
    // Context will be cleaned up by BrowserManager's cleanup routine
  }

  /**
   * Force close context (end session completely)
   */
  async closeSession(): Promise<void> {
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
    this.page = null;
  }

  /**
   * Execute a scraping operation with full lifecycle management
   */
  async execute<T>(
    operation: (engine: ScraperEngine) => Promise<T>,
    options?: { warmupUrl?: string }
  ): Promise<ScraperResult<T>> {
    const startTime = Date.now();

    try {
      await this.initialize();

      // Warmup if URL provided
      if (options?.warmupUrl) {
        await this.warmup(options.warmupUrl);
      }

      // Execute the operation
      const data = await operation(this);

      return {
        success: true,
        data,
        executionMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage, sessionId: this.sessionId }, 'Scraping operation failed');

      return {
        success: false,
        error: errorMessage,
        executionMs: Date.now() - startTime,
      };
    } finally {
      await this.cleanup();
    }
  }
}

export default ScraperEngine;
