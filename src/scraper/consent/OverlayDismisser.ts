import type { ElementHandle, Locator, Page } from 'playwright';
import logger from '../../observability/logger.js';
import { DelayManager } from '../humanizer/DelayManager.js';
import { CookieConsentHandler } from './CookieConsentHandler.js';

export interface DismissOptions {
  /** Total time budget for the dismiss loop (default 10000ms) */
  maxDurationMs?: number;
  /** Hard cap on clicks performed in a single call (default 6) */
  maxClicks?: number;
}

/**
 * OverlayDismisser - Removes blocking overlays (consent dialogs, login walls, modals)
 * before a screenshot is taken.
 *
 * Complements CookieConsentHandler, which only matches CMPs by container class/id and runs
 * a single pass right after navigation. Many overlays are injected seconds later (e.g. the
 * Instagram login wall) or use obfuscated class names (e.g. the Meta cookie dialog), so this
 * dismisser retries for a bounded period and matches by ARIA role and visible text instead.
 *
 * Strategy per round:
 *   1. CookieConsentHandler patterns (known CMP vendors)
 *   2. Consent buttons matched by accessible name
 *   3. Close ("X") controls inside a modal dialog
 *   4. Escape key, if a dialog is still visible and nothing else worked
 *
 * Steps 2-4 only act on elements living inside an overlay (a [role="dialog"] or a fixed/sticky
 * viewport-covering container), so ordinary page content is never clicked.
 */
export class OverlayDismisser {
  /** Accessible names of buttons that dismiss a consent dialog (accept variants first) */
  private static readonly CONSENT_BUTTON_TEXT =
    /^(consenti tutti i cookie|allow all cookies|accetta tutti|accetta tutto|accept all|acconsento|accetto|rifiuta cookie facoltativi|decline optional cookies)/i;

  /** Accessible names / titles of "close" controls */
  private static readonly CLOSE_LABEL = /^(chiudi|close|schließen|schliessen|fermer|cerrar)$/i;

  /**
   * Dismiss every blocking overlay found on the page.
   * Never throws; returns the labels of what was dismissed (for logging).
   */
  static async dismissAll(page: Page, options: DismissOptions = {}): Promise<string[]> {
    const maxDurationMs = options.maxDurationMs ?? 10000;
    const maxClicks = options.maxClicks ?? 6;

    const dismissed: string[] = [];
    const deadline = Date.now() + maxDurationMs;
    let quietRounds = 0;

    while (Date.now() < deadline && quietRounds < 2 && dismissed.length < maxClicks) {
      let label: string | null = null;

      try {
        if (await CookieConsentHandler.handle(page)) {
          label = 'cookie-consent-pattern';
        } else {
          label =
            (await this.clickByAccessibleName(page, this.CONSENT_BUTTON_TEXT, 'consent')) ??
            (await this.clickCloseControl(page)) ??
            (await this.pressEscape(page));
        }
      } catch (error) {
        logger.debug({ error }, 'Overlay dismiss round failed');
      }

      if (label) {
        dismissed.push(label);
        quietRounds = 0;
        logger.info({ label }, 'Overlay dismissed');
      } else {
        quietRounds++;
      }

      if (Date.now() < deadline) {
        await DelayManager.randomDelay(500, 900);
      }
    }

    return dismissed;
  }

  /**
   * Click the first visible button whose accessible name matches, when it sits inside an overlay.
   */
  private static async clickByAccessibleName(
    page: Page,
    name: RegExp,
    label: string
  ): Promise<string | null> {
    const candidates = page.getByRole('button', { name });
    const count = await candidates.count();

    for (let i = 0; i < count; i++) {
      const candidate = candidates.nth(i);
      if (await this.clickIfInOverlay(candidate)) {
        return label;
      }
    }

    return null;
  }

  /**
   * Click the "X" of a modal dialog. The label may live on the control itself or on the
   * inner <svg>/<title>; clicking the icon works because the event bubbles to the control.
   */
  private static async clickCloseControl(page: Page): Promise<string | null> {
    const dialogs = page.locator('[role="dialog"]');
    const dialogCount = await dialogs.count();

    for (let d = 0; d < dialogCount; d++) {
      const closers = dialogs.nth(d).locator('[aria-label], [title]');
      const closerCount = await closers.count();

      for (let c = 0; c < closerCount; c++) {
        const closer = closers.nth(c);
        const label =
          (await closer.getAttribute('aria-label')) ?? (await closer.getAttribute('title')) ?? '';
        if (!this.CLOSE_LABEL.test(label.trim())) continue;

        if (await this.clickIfInOverlay(closer)) {
          return 'modal-close';
        }
      }
    }

    return null;
  }

  /**
   * Last resort: some dialogs close on Escape even without a visible close control.
   */
  private static async pressEscape(page: Page): Promise<string | null> {
    const dialog = page.locator('[role="dialog"]').first();
    if (!(await dialog.isVisible().catch(() => false))) return null;

    await page.keyboard.press('Escape');
    await DelayManager.randomDelay(300, 600);

    return (await dialog.isVisible().catch(() => false)) ? null : 'escape-key';
  }

  private static async clickIfInOverlay(locator: Locator): Promise<boolean> {
    try {
      if (!(await locator.isVisible())) return false;

      const handle = await locator.elementHandle();
      if (!handle) return false;

      try {
        if (!(await this.isInOverlay(handle))) return false;
      } finally {
        await handle.dispose();
      }

      await DelayManager.randomDelay(200, 500);
      await locator.click({ timeout: 3000 });
      await DelayManager.randomDelay(300, 800);
      return true;
    } catch (error) {
      logger.debug({ error }, 'Overlay element click failed');
      return false;
    }
  }

  /**
   * True when the element belongs to a modal dialog or to a fixed/sticky container that
   * covers a significant part of the viewport - i.e. something blocking the screenshot.
   */
  private static async isInOverlay(handle: ElementHandle<Node>): Promise<boolean> {
    return handle.evaluate((node) => {
      const element = node as HTMLElement;
      if (element.closest('[role="dialog"], [aria-modal="true"]')) return true;

      const viewportArea = window.innerWidth * window.innerHeight;

      for (let current: HTMLElement | null = element; current; current = current.parentElement) {
        const style = window.getComputedStyle(current);
        if (style.position !== 'fixed' && style.position !== 'sticky') continue;

        const box = current.getBoundingClientRect();
        if ((box.width * box.height) / viewportArea >= 0.15) return true;
      }

      return false;
    });
  }
}

export default OverlayDismisser;
