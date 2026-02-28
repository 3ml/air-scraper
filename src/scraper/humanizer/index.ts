import type { Page, ElementHandle } from 'playwright';
import { MouseSimulator } from './MouseSimulator.js';
import { TypingSimulator } from './TypingSimulator.js';
import { ScrollSimulator } from './ScrollSimulator.js';
import { DelayManager } from './DelayManager.js';

export { MouseSimulator } from './MouseSimulator.js';
export { TypingSimulator } from './TypingSimulator.js';
export { ScrollSimulator } from './ScrollSimulator.js';
export { DelayManager } from './DelayManager.js';

/**
 * Humanizer - Unified interface for human-like browser interactions
 */
export class Humanizer {
  private mouse: MouseSimulator;
  private typing: TypingSimulator;
  private scroll: ScrollSimulator;

  constructor() {
    this.mouse = new MouseSimulator();
    this.typing = new TypingSimulator();
    this.scroll = new ScrollSimulator();
  }

  // Mouse actions
  async moveTo(page: Page, element: ElementHandle | null): Promise<void> {
    return this.mouse.moveTo(page, element);
  }

  async click(page: Page, element: ElementHandle | null): Promise<void> {
    return this.mouse.click(page, element);
  }

  async doubleClick(page: Page, element: ElementHandle | null): Promise<void> {
    return this.mouse.doubleClick(page, element);
  }

  async hover(page: Page, element: ElementHandle | null): Promise<void> {
    return this.mouse.hover(page, element);
  }

  // Typing actions
  async type(
    page: Page,
    element: ElementHandle | null,
    text: string,
    options?: { includeTypos?: boolean }
  ): Promise<void> {
    return this.typing.type(page, element, text, options);
  }

  async typeIntoSelector(
    page: Page,
    selector: string,
    text: string,
    options?: { includeTypos?: boolean }
  ): Promise<void> {
    return this.typing.typeIntoSelector(page, selector, text, options);
  }

  async clearAndType(
    page: Page,
    element: ElementHandle | null,
    text: string
  ): Promise<void> {
    return this.typing.clearAndType(page, element, text);
  }

  // Scroll actions
  async scrollGradual(
    page: Page,
    options?: { distance?: number; duration?: number; direction?: 'down' | 'up' }
  ): Promise<void> {
    return this.scroll.scrollGradual(page, options);
  }

  async randomScroll(page: Page): Promise<void> {
    return this.scroll.randomScroll(page);
  }

  async scrollToElement(page: Page, selector: string): Promise<void> {
    return this.scroll.scrollToElement(page, selector);
  }

  async scrollToBottom(page: Page): Promise<void> {
    return this.scroll.scrollToBottom(page);
  }

  // Delays
  async interActionDelay(): Promise<void> {
    return DelayManager.interActionDelay();
  }

  async microDelay(): Promise<void> {
    return DelayManager.microDelay();
  }

  async thinkingDelay(): Promise<void> {
    return DelayManager.thinkingDelay();
  }

  async randomDelay(minMs: number, maxMs: number): Promise<void> {
    return DelayManager.randomDelay(minMs, maxMs);
  }

  // Composite actions
  async clickAndType(
    page: Page,
    element: ElementHandle | null,
    text: string
  ): Promise<void> {
    await this.click(page, element);
    await DelayManager.microDelay();
    await this.type(page, element, text);
  }

  async clickButton(page: Page, selector: string): Promise<void> {
    const element = await page.$(selector);
    await this.click(page, element);
  }

  async fillForm(
    page: Page,
    fields: Array<{ selector: string; value: string }>
  ): Promise<void> {
    for (const field of fields) {
      const element = await page.$(field.selector);
      if (element) {
        await this.click(page, element);
        await this.thinkingDelay();
        await this.clearAndType(page, element, field.value);
        await this.interActionDelay();
      }
    }
  }
}

export default Humanizer;
