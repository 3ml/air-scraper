import type { Page } from 'playwright';
import { DelayManager } from './DelayManager.js';

interface ScrollOptions {
  distance?: number;
  duration?: number;
  direction?: 'down' | 'up';
}

/**
 * ScrollSimulator - Simulates human-like scrolling behavior
 */
export class ScrollSimulator {
  /**
   * Scroll with acceleration and deceleration (easing)
   */
  async scrollGradual(page: Page, options: ScrollOptions = {}): Promise<void> {
    const { distance = 500, duration = 1000, direction = 'down' } = options;

    const steps = 30;
    const stepDuration = duration / steps;
    const sign = direction === 'down' ? 1 : -1;

    // Calculate scroll amounts with easing (ease-in-out)
    const scrollAmounts: number[] = [];
    let totalScroll = 0;

    for (let i = 0; i < steps; i++) {
      const progress = i / (steps - 1);
      // Ease-in-out function: slow at start and end, fast in middle
      const easeProgress = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const targetScroll = distance * easeProgress;
      const stepScroll = targetScroll - totalScroll;
      scrollAmounts.push(stepScroll);
      totalScroll = targetScroll;
    }

    // Execute scroll steps
    for (const amount of scrollAmounts) {
      await page.mouse.wheel(0, amount * sign);
      await this.sleep(stepDuration + (Math.random() - 0.5) * 10);
    }
  }

  /**
   * Random scroll - simulates user browsing/reading
   */
  async randomScroll(page: Page): Promise<void> {
    const scrollCount = 2 + Math.floor(Math.random() * 4);

    for (let i = 0; i < scrollCount; i++) {
      const distance = 100 + Math.random() * 400;
      const direction = Math.random() > 0.2 ? 'down' : 'up';

      await this.scrollGradual(page, { distance, direction });

      // Pause to "read" content
      await DelayManager.randomDelay(800, 2500);
    }
  }

  /**
   * Scroll to element with natural motion
   */
  async scrollToElement(page: Page, selector: string): Promise<void> {
    const element = await page.$(selector);
    if (!element) return;

    const box = await element.boundingBox();
    if (!box) return;

    const viewportHeight = await page.evaluate(() => window.innerHeight);
    const currentScroll = await page.evaluate(() => window.scrollY);

    // Calculate target scroll position (element centered in viewport)
    const targetScroll = box.y + currentScroll - viewportHeight / 2 + box.height / 2;
    const scrollDistance = Math.abs(targetScroll - currentScroll);
    const direction = targetScroll > currentScroll ? 'down' : 'up';

    await this.scrollGradual(page, { distance: scrollDistance, direction });
  }

  /**
   * Scroll to bottom of page gradually
   */
  async scrollToBottom(page: Page): Promise<void> {
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    const currentScroll = await page.evaluate(() => window.scrollY);

    const distance = scrollHeight - viewportHeight - currentScroll;
    if (distance <= 0) return;

    // Scroll in chunks with pauses
    const chunkSize = 400 + Math.random() * 200;
    let scrolled = 0;

    while (scrolled < distance) {
      const chunk = Math.min(chunkSize, distance - scrolled);
      await this.scrollGradual(page, { distance: chunk, direction: 'down' });
      scrolled += chunk;

      // Random pause between scrolls
      if (scrolled < distance) {
        await DelayManager.randomDelay(500, 1500);
      }
    }
  }

  /**
   * Scroll to top of page
   */
  async scrollToTop(page: Page): Promise<void> {
    const currentScroll = await page.evaluate(() => window.scrollY);
    if (currentScroll <= 0) return;

    await this.scrollGradual(page, { distance: currentScroll, direction: 'up' });
  }

  /**
   * Jittery scroll - micro-scrolls simulating reading
   */
  async readingScroll(page: Page, paragraphs: number = 3): Promise<void> {
    for (let i = 0; i < paragraphs; i++) {
      // Small scroll to next "paragraph"
      const distance = 80 + Math.random() * 120;
      await this.scrollGradual(page, {
        distance,
        duration: 300 + Math.random() * 200,
        direction: 'down',
      });

      // Reading pause (longer than browsing)
      await DelayManager.randomDelay(1500, 4000);

      // Occasional scroll back up to re-read
      if (Math.random() < 0.15) {
        await this.scrollGradual(page, {
          distance: 40 + Math.random() * 60,
          duration: 200,
          direction: 'up',
        });
        await DelayManager.randomDelay(800, 1500);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default ScrollSimulator;
