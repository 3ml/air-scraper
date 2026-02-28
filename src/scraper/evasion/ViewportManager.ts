import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface ViewportEntry {
  width: number;
  height: number;
  deviceScaleFactor: number;
  name: string;
  weight: number;
}

interface ViewportData {
  viewports: ViewportEntry[];
}

/**
 * ViewportManager - Manages realistic viewport sizes with weighted selection
 */
export class ViewportManager {
  private viewports: ViewportEntry[] = [];
  private totalWeight: number = 0;

  constructor() {
    this.loadViewports();
  }

  private loadViewports(): void {
    try {
      const dataPath = join(__dirname, '../../../data/viewports.json');
      const data = JSON.parse(readFileSync(dataPath, 'utf-8')) as ViewportData;
      this.viewports = data.viewports;
      this.totalWeight = this.viewports.reduce((sum, v) => sum + v.weight, 0);
    } catch (error) {
      // Fallback to common viewports
      this.viewports = [
        { width: 1920, height: 1080, deviceScaleFactor: 1, name: 'Full HD', weight: 30 },
        { width: 1366, height: 768, deviceScaleFactor: 1, name: 'HD Laptop', weight: 25 },
        { width: 1536, height: 864, deviceScaleFactor: 1.25, name: 'Scaled HD', weight: 20 },
        { width: 1440, height: 900, deviceScaleFactor: 1, name: 'MacBook Pro', weight: 15 },
        { width: 1680, height: 1050, deviceScaleFactor: 1, name: 'WSXGA+', weight: 10 },
      ];
      this.totalWeight = 100;
    }
  }

  /**
   * Get a random viewport using weighted selection
   * More common resolutions have higher probability
   */
  getRandomViewport(): ViewportEntry {
    if (this.viewports.length === 0) {
      return { width: 1920, height: 1080, deviceScaleFactor: 1, name: 'Default', weight: 1 };
    }

    // Weighted random selection
    let random = Math.random() * this.totalWeight;

    for (const viewport of this.viewports) {
      random -= viewport.weight;
      if (random <= 0) {
        return viewport;
      }
    }

    // Fallback to last viewport
    return this.viewports[this.viewports.length - 1];
  }

  /**
   * Get viewport for specific resolution category
   */
  getByCategory(category: 'hd' | 'fullhd' | 'qhd' | '4k'): ViewportEntry {
    const categoryMap: Record<string, [number, number]> = {
      hd: [1280, 1366],
      fullhd: [1920, 1920],
      qhd: [2560, 2560],
      '4k': [3840, 3840],
    };

    const [minWidth, maxWidth] = categoryMap[category];
    const filtered = this.viewports.filter((v) => v.width >= minWidth && v.width <= maxWidth);

    if (filtered.length === 0) {
      return this.getRandomViewport();
    }

    return filtered[Math.floor(Math.random() * filtered.length)];
  }

  /**
   * Get Playwright viewport configuration
   */
  getPlaywrightViewport(): {
    width: number;
    height: number;
    deviceScaleFactor: number;
  } {
    const viewport = this.getRandomViewport();
    return {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: viewport.deviceScaleFactor,
    };
  }

  /**
   * Add slight randomness to viewport dimensions
   * (Helps avoid fingerprinting by exact resolution)
   */
  getRandomizedViewport(): {
    width: number;
    height: number;
    deviceScaleFactor: number;
  } {
    const base = this.getRandomViewport();

    // Add small variance (±0-20 pixels)
    const widthVariance = Math.floor(Math.random() * 10) * 2;
    const heightVariance = Math.floor(Math.random() * 10) * 2;

    return {
      width: base.width - widthVariance,
      height: base.height - heightVariance,
      deviceScaleFactor: base.deviceScaleFactor,
    };
  }

  get count(): number {
    return this.viewports.length;
  }
}

// Singleton instance
export const viewportManager = new ViewportManager();

export default ViewportManager;
