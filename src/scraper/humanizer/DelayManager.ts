/**
 * DelayManager - Manages random delays to simulate human behavior
 */
export class DelayManager {
  /**
   * Generate a random delay with Gaussian distribution
   */
  static gaussianRandom(mean: number, stdDev: number): number {
    // Box-Muller transform for Gaussian distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return Math.max(0, mean + z * stdDev);
  }

  /**
   * Random delay between actions (2-8 seconds with variance)
   */
  static async interActionDelay(): Promise<void> {
    const delay = this.gaussianRandom(5000, 1500); // Mean 5s, stdDev 1.5s
    const bounded = Math.min(Math.max(delay, 2000), 8000); // Clamp to 2-8s
    await this.sleep(bounded);
  }

  /**
   * Short delay for micro-interactions (100-500ms)
   */
  static async microDelay(): Promise<void> {
    const delay = this.gaussianRandom(300, 100);
    const bounded = Math.min(Math.max(delay, 100), 500);
    await this.sleep(bounded);
  }

  /**
   * Page load delay - wait after navigation (1-3s)
   */
  static async pageLoadDelay(): Promise<void> {
    const delay = this.gaussianRandom(2000, 500);
    const bounded = Math.min(Math.max(delay, 1000), 3000);
    await this.sleep(bounded);
  }

  /**
   * Thinking delay - before filling forms or making decisions (1-4s)
   */
  static async thinkingDelay(): Promise<void> {
    const delay = this.gaussianRandom(2500, 750);
    const bounded = Math.min(Math.max(delay, 1000), 4000);
    await this.sleep(bounded);
  }

  /**
   * Random delay within specified bounds
   */
  static async randomDelay(minMs: number, maxMs: number): Promise<void> {
    const delay = Math.random() * (maxMs - minMs) + minMs;
    await this.sleep(delay);
  }

  /**
   * Jitter - add small random variation to any operation
   */
  static jitter(baseMs: number, variance: number = 0.2): number {
    const jitterAmount = baseMs * variance;
    return baseMs + (Math.random() * 2 - 1) * jitterAmount;
  }

  /**
   * Exponential backoff with jitter
   */
  static exponentialBackoff(attempt: number, baseMs: number = 1000): number {
    const exponentialDelay = Math.pow(2, attempt) * baseMs;
    const jitter = Math.random() * 1000; // 0-1000ms jitter
    return exponentialDelay + jitter;
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default DelayManager;
