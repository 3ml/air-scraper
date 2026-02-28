import type { Page } from 'playwright';
import logger from '../../observability/logger.js';
import { DelayManager } from '../humanizer/DelayManager.js';

interface ConsentPattern {
  name: string;
  selectors: string[];
  acceptSelectors: string[];
  rejectSelectors?: string[];
}

/**
 * CookieConsentHandler - Handles various cookie consent popups
 */
export class CookieConsentHandler {
  private static patterns: ConsentPattern[] = [
    {
      name: 'iubenda',
      selectors: ['.iubenda-cs-container', '#iubenda-cs-banner'],
      acceptSelectors: ['.iubenda-cs-accept-btn', '[class*="iubenda"][class*="accept"]'],
      rejectSelectors: ['.iubenda-cs-reject-btn'],
    },
    {
      name: 'cookiebot',
      selectors: ['#CybotCookiebotDialog', '#CookieboxAlertContainer'],
      acceptSelectors: ['#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll', '#CybotCookiebotDialogBodyButtonAccept'],
      rejectSelectors: ['#CybotCookiebotDialogBodyButtonDecline'],
    },
    {
      name: 'onetrust',
      selectors: ['#onetrust-banner-sdk', '.onetrust-pc-dark-filter'],
      acceptSelectors: ['#onetrust-accept-btn-handler', '.onetrust-close-btn-handler'],
      rejectSelectors: ['#onetrust-reject-all-handler'],
    },
    {
      name: 'quantcast',
      selectors: ['.qc-cmp2-container', '.qc-cmp-ui-container'],
      acceptSelectors: ['[data-testid="GDPR-accept"]', '.qc-cmp-button'],
      rejectSelectors: ['[data-testid="GDPR-reject"]'],
    },
    {
      name: 'didomi',
      selectors: ['#didomi-host', '.didomi-popup-container'],
      acceptSelectors: ['#didomi-notice-agree-button', '[data-testid="agree-button"]'],
      rejectSelectors: ['#didomi-notice-disagree-button'],
    },
    {
      name: 'generic-it',
      selectors: [
        '[class*="cookie-banner"]',
        '[class*="cookie-consent"]',
        '[class*="cookie-notice"]',
        '[class*="gdpr-banner"]',
        '[class*="privacy-banner"]',
        '[id*="cookie-banner"]',
        '[id*="cookie-consent"]',
        '[id*="gdpr"]',
      ],
      acceptSelectors: [
        '[class*="accept"]',
        '[class*="accetta"]',
        '[class*="agree"]',
        'button:has-text("Accetta")',
        'button:has-text("Accept")',
        'button:has-text("Accetto")',
        'button:has-text("OK")',
        'button:has-text("Continua")',
        'a:has-text("Accetta")',
        'a:has-text("Accept")',
      ],
    },
  ];

  /**
   * Detect and handle cookie consent popup
   */
  static async handle(page: Page, action: 'accept' | 'reject' = 'accept'): Promise<boolean> {
    try {
      // Wait a bit for consent popup to appear
      await DelayManager.randomDelay(500, 1500);

      for (const pattern of this.patterns) {
        const handled = await this.tryPattern(page, pattern, action);
        if (handled) {
          logger.info({ pattern: pattern.name, action }, 'Cookie consent handled');
          return true;
        }
      }

      logger.debug('No cookie consent popup detected');
      return false;
    } catch (error) {
      logger.warn({ error }, 'Error handling cookie consent');
      return false;
    }
  }

  /**
   * Try a specific consent pattern
   */
  private static async tryPattern(
    page: Page,
    pattern: ConsentPattern,
    action: 'accept' | 'reject'
  ): Promise<boolean> {
    // Check if consent dialog is present
    for (const selector of pattern.selectors) {
      try {
        const element = await page.$(selector);
        if (element && await element.isVisible()) {
          // Found the consent dialog, try to interact
          const buttonSelectors = action === 'accept' ? pattern.acceptSelectors : (pattern.rejectSelectors || pattern.acceptSelectors);

          for (const btnSelector of buttonSelectors) {
            try {
              const button = await page.$(btnSelector);
              if (button && await button.isVisible()) {
                // Add small delay before clicking (human-like)
                await DelayManager.randomDelay(200, 500);
                await button.click();
                await DelayManager.randomDelay(300, 800);
                return true;
              }
            } catch {
              // Try next selector
            }
          }
        }
      } catch {
        // Try next selector
      }
    }

    return false;
  }

  /**
   * Wait for consent dialog and handle it
   */
  static async waitAndHandle(
    page: Page,
    timeout: number = 5000,
    action: 'accept' | 'reject' = 'accept'
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const handled = await this.handle(page, action);
      if (handled) return true;
      await DelayManager.randomDelay(500, 1000);
    }

    return false;
  }

  /**
   * Check if a consent dialog is currently visible
   */
  static async isPresent(page: Page): Promise<boolean> {
    for (const pattern of this.patterns) {
      for (const selector of pattern.selectors) {
        try {
          const element = await page.$(selector);
          if (element && await element.isVisible()) {
            return true;
          }
        } catch {
          // Continue checking
        }
      }
    }
    return false;
  }
}

export default CookieConsentHandler;
