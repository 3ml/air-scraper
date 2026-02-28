import { BaseScenario, type ScenarioConfig, type ScenarioContext } from '../BaseScenario.js';
import type { ScraperEngine } from '../../scraper/ScraperEngine.js';

interface TestInput {
  url?: string;
  message?: string;
}

interface TestOutput {
  title: string;
  url: string;
  timestamp: string;
  message?: string;
}

/**
 * TestScenario - A simple test scenario for validating the system
 */
export class TestScenario extends BaseScenario<TestInput, TestOutput> {
  readonly config: ScenarioConfig = {
    action: 'test',
    name: 'Test Scenario',
    description: 'Simple test scenario to validate the scraping system',
    maxConcurrent: 5,
    cooldownSeconds: 0,
    timeout: 60000,
    retries: 1,
  };

  protected async run(
    engine: ScraperEngine,
    input: TestInput,
    _context: ScenarioContext
  ): Promise<TestOutput> {
    const url = input.url || 'https://example.com';

    // Navigate to the test page
    await engine.navigate(url);

    // Add some human-like behavior
    await engine.delay();
    await engine.scroll({ distance: 200 });

    // Extract page title
    const title = await engine.evaluate(() => document.title);

    return {
      title: title || 'Unknown',
      url: engine.currentUrl,
      timestamp: new Date().toISOString(),
      message: input.message,
    };
  }

  protected getWarmupUrl(input: TestInput): string | undefined {
    if (input.url) {
      const urlObj = new URL(input.url);
      return urlObj.origin;
    }
    return undefined;
  }
}

export default TestScenario;
