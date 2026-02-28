import type { Page, ElementHandle } from 'playwright';
import { DelayManager } from './DelayManager.js';

/**
 * TypingSimulator - Simulates human-like typing with variable delays
 */
export class TypingSimulator {
  // Characters that typically cause a pause
  private static PAUSE_CHARS = ['.', ',', '!', '?', ':', ';'];

  // Common typo probability (5%)
  private static TYPO_PROBABILITY = 0.05;

  // Keys that might be mistyped
  private static NEARBY_KEYS: Record<string, string[]> = {
    a: ['s', 'q', 'w', 'z'],
    b: ['v', 'g', 'h', 'n'],
    c: ['x', 'd', 'f', 'v'],
    d: ['s', 'e', 'r', 'f', 'c', 'x'],
    e: ['w', 'r', 'd', 's'],
    f: ['d', 'r', 't', 'g', 'v', 'c'],
    g: ['f', 't', 'y', 'h', 'b', 'v'],
    h: ['g', 'y', 'u', 'j', 'n', 'b'],
    i: ['u', 'o', 'k', 'j'],
    j: ['h', 'u', 'i', 'k', 'm', 'n'],
    k: ['j', 'i', 'o', 'l', 'm'],
    l: ['k', 'o', 'p'],
    m: ['n', 'j', 'k'],
    n: ['b', 'h', 'j', 'm'],
    o: ['i', 'p', 'l', 'k'],
    p: ['o', 'l'],
    q: ['w', 'a'],
    r: ['e', 't', 'f', 'd'],
    s: ['a', 'w', 'e', 'd', 'x', 'z'],
    t: ['r', 'y', 'g', 'f'],
    u: ['y', 'i', 'j', 'h'],
    v: ['c', 'f', 'g', 'b'],
    w: ['q', 'e', 's', 'a'],
    x: ['z', 's', 'd', 'c'],
    y: ['t', 'u', 'h', 'g'],
    z: ['a', 's', 'x'],
  };

  /**
   * Type text with human-like delays and occasional typos
   */
  async type(
    page: Page,
    element: ElementHandle | null,
    text: string,
    options?: { includeTypos?: boolean }
  ): Promise<void> {
    if (!element) return;

    const includeTypos = options?.includeTypos ?? true;

    // Focus the element first
    await element.focus();
    await DelayManager.microDelay();

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Simulate occasional typo
      if (includeTypos && Math.random() < TypingSimulator.TYPO_PROBABILITY) {
        await this.makeTypo(page, char);
      } else {
        await this.typeChar(page, char);
      }

      // Calculate delay for next character
      const delay = this.calculateDelay(char, text[i + 1]);
      await this.sleep(delay);
    }
  }

  /**
   * Type text into a selector
   */
  async typeIntoSelector(
    page: Page,
    selector: string,
    text: string,
    options?: { includeTypos?: boolean }
  ): Promise<void> {
    const element = await page.$(selector);
    await this.type(page, element, text, options);
  }

  /**
   * Clear field and type new text
   */
  async clearAndType(
    page: Page,
    element: ElementHandle | null,
    text: string,
    options?: { includeTypos?: boolean }
  ): Promise<void> {
    if (!element) return;

    await element.focus();
    await DelayManager.microDelay();

    // Select all and delete
    await page.keyboard.press('Control+a');
    await DelayManager.microDelay();
    await page.keyboard.press('Backspace');
    await DelayManager.microDelay();

    // Type new text
    await this.type(page, element, text, options);
  }

  /**
   * Type a single character
   */
  private async typeChar(page: Page, char: string): Promise<void> {
    await page.keyboard.type(char);
  }

  /**
   * Make a typo and correct it
   */
  private async makeTypo(page: Page, correctChar: string): Promise<void> {
    const lowerChar = correctChar.toLowerCase();
    const nearbyKeys = TypingSimulator.NEARBY_KEYS[lowerChar];

    if (nearbyKeys && nearbyKeys.length > 0) {
      // Type wrong character
      const wrongChar = nearbyKeys[Math.floor(Math.random() * nearbyKeys.length)];
      const finalWrongChar = correctChar === correctChar.toUpperCase() ? wrongChar.toUpperCase() : wrongChar;

      await this.typeChar(page, finalWrongChar);

      // Brief pause (noticing the typo)
      await DelayManager.randomDelay(100, 300);

      // Delete the typo
      await page.keyboard.press('Backspace');
      await DelayManager.microDelay();

      // Type correct character
      await this.typeChar(page, correctChar);
    } else {
      // No nearby keys, just type normally
      await this.typeChar(page, correctChar);
    }
  }

  /**
   * Calculate typing delay based on character context
   */
  private calculateDelay(currentChar: string, nextChar?: string): number {
    // Base delay with Gaussian distribution (mean 100ms, stdDev 25ms)
    let delay = DelayManager.gaussianRandom(100, 25);

    // Clamp to reasonable range
    delay = Math.max(50, Math.min(delay, 200));

    // Add extra delay after punctuation
    if (TypingSimulator.PAUSE_CHARS.includes(currentChar)) {
      delay += DelayManager.gaussianRandom(200, 50);
    }

    // Slightly faster for spaces
    if (currentChar === ' ') {
      delay *= 0.8;
    }

    // Slight pause before capital letters (shift key)
    if (nextChar && nextChar === nextChar.toUpperCase() && nextChar !== nextChar.toLowerCase()) {
      delay += 20;
    }

    return delay;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default TypingSimulator;
