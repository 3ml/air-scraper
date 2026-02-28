import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, BrowserContext, Page } from 'playwright';
import { env } from '../../config/env.js';
import { userAgentRotator } from '../evasion/UserAgentRotator.js';
import { viewportManager } from '../evasion/ViewportManager.js';
import { localeConfig, geoConfig } from '../evasion/index.js';
import logger from '../../observability/logger.js';

// Add stealth plugin to playwright
chromium.use(StealthPlugin());

export interface StealthBrowserOptions {
  headless?: boolean;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
}

export interface StealthContextOptions {
  userAgent?: string;
  viewport?: { width: number; height: number };
  storagePath?: string;
}

/**
 * StealthConfig - Configures Playwright for stealth/anti-detection
 */
export class StealthConfig {
  /**
   * Launch a stealth-configured browser
   */
  static async launchBrowser(options: StealthBrowserOptions = {}): Promise<Browser> {
    const launchOptions: Parameters<typeof chromium.launch>[0] = {
      headless: options.headless ?? env.BROWSER_HEADLESS,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-infobars',
        '--disable-web-security',
        '--disable-site-isolation-trials',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--start-maximized',
        '--disable-extensions',
        '--disable-plugins-discovery',
        '--disable-translate',
        '--disable-sync',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-client-side-phishing-detection',
        '--disable-default-apps',
        '--disable-hang-monitor',
        '--disable-popup-blocking',
        '--disable-prompt-on-repost',
        '--metrics-recording-only',
        '--safebrowsing-disable-auto-update',
      ],
    };

    if (options.proxy) {
      launchOptions.proxy = {
        server: options.proxy.server,
        username: options.proxy.username,
        password: options.proxy.password,
      };
    }

    logger.debug({ headless: launchOptions.headless }, 'Launching stealth browser');
    return chromium.launch(launchOptions);
  }

  /**
   * Create a stealth-configured browser context
   */
  static async createContext(
    browser: Browser,
    options: StealthContextOptions = {}
  ): Promise<BrowserContext> {
    const ua = options.userAgent || userAgentRotator.getRandomUserAgent().ua;
    const viewport = options.viewport || viewportManager.getRandomizedViewport();

    const contextOptions: Parameters<Browser['newContext']>[0] = {
      userAgent: ua,
      viewport,
      locale: localeConfig.locale,
      timezoneId: localeConfig.timezone,
      geolocation: geoConfig,
      permissions: ['geolocation'],
      extraHTTPHeaders: {
        'Accept-Language': localeConfig.acceptLanguage,
      },
      javaScriptEnabled: true,
      bypassCSP: false,
      ignoreHTTPSErrors: false,
      // Device scale factor
      deviceScaleFactor: 1,
      // Enable touch for mobile-like behavior (disabled for desktop)
      hasTouch: false,
      isMobile: false,
    };

    // Use persistent context if storage path provided
    if (options.storagePath) {
      contextOptions.storageState = options.storagePath;
    }

    const context = await browser.newContext(contextOptions);

    // Add stealth scripts to all pages
    await context.addInitScript(() => {
      // Override navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Override navigator.plugins (simulate real plugins)
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', filename: 'internal-nacl-plugin' },
        ],
      });

      // Override navigator.languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['it-IT', 'it', 'en-US', 'en'],
      });

      // Mock chrome runtime
      (window as any).chrome = {
        runtime: {},
        loadTimes: () => ({}),
        csi: () => ({}),
        app: {},
      };

      // Override permissions API
      const originalQuery = Permissions.prototype.query;
      Permissions.prototype.query = (parameters: any) => {
        if (parameters.name === 'notifications') {
          return Promise.resolve({ state: 'denied', onchange: null } as PermissionStatus);
        }
        return originalQuery.call(navigator.permissions, parameters);
      };
    });

    logger.debug({ userAgent: ua.substring(0, 50), viewport }, 'Created stealth context');
    return context;
  }

  /**
   * Create a new page with additional stealth measures
   */
  static async createPage(context: BrowserContext): Promise<Page> {
    const page = await context.newPage();

    // Block known fingerprinting resources
    await page.route('**/*', (route) => {
      const url = route.request().url();
      const blockedPatterns = [
        'google-analytics.com',
        'googletagmanager.com',
        'doubleclick.net',
        'facebook.net',
        'hotjar.com',
        'mouseflow.com',
        'clarity.ms',
      ];

      if (blockedPatterns.some((pattern) => url.includes(pattern))) {
        return route.abort();
      }
      return route.continue();
    });

    return page;
  }

  /**
   * Apply additional runtime stealth to an existing page
   */
  static async applyPageStealth(page: Page): Promise<void> {
    await page.evaluate(() => {
      // Randomize canvas fingerprint
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function (type?: string) {
        if (type === 'image/png') {
          const canvas = this;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < imageData.data.length; i += 4) {
              // Add tiny noise to RGB values
              imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + (Math.random() - 0.5)));
            }
            ctx.putImageData(imageData, 0, 0);
          }
        }
        return originalToDataURL.apply(this, arguments as any);
      };

      // Randomize WebGL fingerprint
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function (parameter: number) {
        // Vendor and renderer
        if (parameter === 37445) return 'Intel Inc.';
        if (parameter === 37446) return 'Intel(R) Iris(TM) Plus Graphics 640';
        return getParameter.apply(this, arguments as any);
      };
    });
  }
}

export default StealthConfig;
