import type { Page, ElementHandle } from 'playwright';
import { DelayManager } from './DelayManager.js';

interface Point {
  x: number;
  y: number;
}

/**
 * MouseSimulator - Simulates human-like mouse movements using Bezier curves
 */
export class MouseSimulator {
  private currentPosition: Point = { x: 0, y: 0 };

  /**
   * Generate a cubic Bezier curve path between two points
   */
  private generateBezierPath(start: Point, end: Point, steps: number = 50): Point[] {
    const path: Point[] = [];

    // Generate control points with some randomness
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    // Control point 1: offset from start
    const cp1: Point = {
      x: start.x + dx * (0.2 + Math.random() * 0.2),
      y: start.y + dy * (0.2 + Math.random() * 0.2) + (Math.random() - 0.5) * 50,
    };

    // Control point 2: offset from end
    const cp2: Point = {
      x: start.x + dx * (0.6 + Math.random() * 0.2),
      y: start.y + dy * (0.6 + Math.random() * 0.2) + (Math.random() - 0.5) * 50,
    };

    // Generate points along the Bezier curve
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const point = this.cubicBezier(start, cp1, cp2, end, t);
      path.push(point);
    }

    return path;
  }

  /**
   * Calculate point on cubic Bezier curve at parameter t
   */
  private cubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    return {
      x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
      y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
    };
  }

  /**
   * Move mouse to an element with human-like motion
   */
  async moveTo(page: Page, element: ElementHandle | null): Promise<void> {
    if (!element) return;

    const box = await element.boundingBox();
    if (!box) return;

    // Calculate target point with slight randomness within element
    const target: Point = {
      x: box.x + box.width * (0.3 + Math.random() * 0.4),
      y: box.y + box.height * (0.3 + Math.random() * 0.4),
    };

    await this.moveToPoint(page, target);
  }

  /**
   * Move mouse to a specific point with human-like motion
   */
  async moveToPoint(page: Page, target: Point): Promise<void> {
    const path = this.generateBezierPath(this.currentPosition, target);

    // Variable speed - faster in the middle, slower at start/end
    for (let i = 0; i < path.length; i++) {
      const point = path[i];

      // Calculate delay based on position in path (slower at edges)
      const progress = i / path.length;
      const speedFactor = 1 - Math.pow(2 * progress - 1, 2); // Parabola: faster in middle
      const baseDelay = 2; // Base delay in ms
      const delay = baseDelay + (1 - speedFactor) * 10;

      await page.mouse.move(point.x, point.y);
      await this.sleep(delay);
    }

    this.currentPosition = target;
  }

  /**
   * Click with human-like behavior (hover, pause, click)
   */
  async click(page: Page, element: ElementHandle | null): Promise<void> {
    if (!element) return;

    // Move to element
    await this.moveTo(page, element);

    // Brief hover pause
    await DelayManager.microDelay();

    // Click with slight movement variation
    const box = await element.boundingBox();
    if (box) {
      const clickX = box.x + box.width * (0.4 + Math.random() * 0.2);
      const clickY = box.y + box.height * (0.4 + Math.random() * 0.2);
      await page.mouse.click(clickX, clickY);
    } else {
      await element.click();
    }
  }

  /**
   * Double click with human-like timing
   */
  async doubleClick(page: Page, element: ElementHandle | null): Promise<void> {
    if (!element) return;

    await this.moveTo(page, element);
    await DelayManager.microDelay();

    const box = await element.boundingBox();
    if (box) {
      const clickX = box.x + box.width * (0.4 + Math.random() * 0.2);
      const clickY = box.y + box.height * (0.4 + Math.random() * 0.2);
      await page.mouse.dblclick(clickX, clickY);
    } else {
      await element.dblclick();
    }
  }

  /**
   * Hover over element
   */
  async hover(page: Page, element: ElementHandle | null): Promise<void> {
    await this.moveTo(page, element);
    await DelayManager.randomDelay(200, 500);
  }

  /**
   * Random mouse wiggle (simulates user looking around)
   */
  async wiggle(page: Page): Promise<void> {
    const movements = 2 + Math.floor(Math.random() * 3);

    for (let i = 0; i < movements; i++) {
      const target: Point = {
        x: this.currentPosition.x + (Math.random() - 0.5) * 100,
        y: this.currentPosition.y + (Math.random() - 0.5) * 100,
      };
      await this.moveToPoint(page, target);
      await DelayManager.randomDelay(100, 300);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default MouseSimulator;
