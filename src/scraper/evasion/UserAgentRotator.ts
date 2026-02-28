import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface UserAgentEntry {
  ua: string;
  platform: string;
  browser: string;
  version: string;
}

interface UserAgentData {
  userAgents: UserAgentEntry[];
}

/**
 * UserAgentRotator - Manages rotation of realistic User-Agent strings
 */
export class UserAgentRotator {
  private userAgents: UserAgentEntry[] = [];
  private usedIndices: Set<number> = new Set();
  private lastUsedIndex: number = -1;

  constructor() {
    this.loadUserAgents();
  }

  private loadUserAgents(): void {
    try {
      const dataPath = join(__dirname, '../../../data/user-agents.json');
      const data = JSON.parse(readFileSync(dataPath, 'utf-8')) as UserAgentData;
      this.userAgents = data.userAgents;
    } catch (error) {
      // Fallback to default user agents
      this.userAgents = [
        {
          ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          platform: 'Windows',
          browser: 'Chrome',
          version: '131',
        },
        {
          ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          platform: 'macOS',
          browser: 'Chrome',
          version: '131',
        },
        {
          ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0',
          platform: 'Windows',
          browser: 'Firefox',
          version: '134',
        },
      ];
    }
  }

  /**
   * Get a random User-Agent (avoiding consecutive repeats)
   */
  getRandomUserAgent(): UserAgentEntry {
    if (this.userAgents.length === 0) {
      throw new Error('No user agents available');
    }

    if (this.userAgents.length === 1) {
      return this.userAgents[0];
    }

    // Avoid using the same UA consecutively
    let index: number;
    do {
      index = Math.floor(Math.random() * this.userAgents.length);
    } while (index === this.lastUsedIndex);

    this.lastUsedIndex = index;
    return this.userAgents[index];
  }

  /**
   * Get User-Agent by platform preference
   */
  getByPlatform(platform: 'Windows' | 'macOS' | 'Linux'): UserAgentEntry {
    const filtered = this.userAgents.filter((ua) => ua.platform === platform);
    if (filtered.length === 0) {
      return this.getRandomUserAgent();
    }
    return filtered[Math.floor(Math.random() * filtered.length)];
  }

  /**
   * Get User-Agent by browser preference
   */
  getByBrowser(browser: 'Chrome' | 'Firefox' | 'Safari' | 'Edge'): UserAgentEntry {
    const filtered = this.userAgents.filter((ua) => ua.browser === browser);
    if (filtered.length === 0) {
      return this.getRandomUserAgent();
    }
    return filtered[Math.floor(Math.random() * filtered.length)];
  }

  /**
   * Get total number of available User-Agents
   */
  get count(): number {
    return this.userAgents.length;
  }

  /**
   * Reset rotation (clear usage tracking)
   */
  reset(): void {
    this.usedIndices.clear();
    this.lastUsedIndex = -1;
  }
}

// Singleton instance
export const userAgentRotator = new UserAgentRotator();

export default UserAgentRotator;
