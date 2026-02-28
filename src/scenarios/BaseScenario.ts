import { ScraperEngine, type ScraperResult } from '../scraper/ScraperEngine.js';
import logger from '../observability/logger.js';

export interface ScenarioConfig {
  action: string;
  name: string;
  description?: string;
  maxConcurrent?: number;
  cooldownSeconds?: number;
  timeout?: number;
  retries?: number;
}

export interface ScenarioContext {
  taskId: string;
  requestId: string;
  inputData: Record<string, unknown>;
}

/**
 * BaseScenario - Abstract base class for all scraping scenarios
 */
export abstract class BaseScenario<TInput = Record<string, unknown>, TOutput = unknown> {
  abstract readonly config: ScenarioConfig;

  /**
   * Validate input data before execution
   */
  protected validateInput(data: unknown): TInput {
    // Override in subclass for custom validation
    return data as TInput;
  }

  /**
   * Main execution method - must be implemented by subclasses
   */
  protected abstract run(engine: ScraperEngine, input: TInput, context: ScenarioContext): Promise<TOutput>;

  /**
   * Execute the scenario with full lifecycle management
   */
  async execute(context: ScenarioContext): Promise<ScraperResult<TOutput>> {
    const scenarioLogger = logger.child({
      scenario: this.config.action,
      taskId: context.taskId,
      requestId: context.requestId,
    });

    scenarioLogger.info({ inputData: context.inputData }, 'Starting scenario execution');

    // Validate input
    let validatedInput: TInput;
    try {
      validatedInput = this.validateInput(context.inputData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Invalid input data';
      scenarioLogger.error({ error: errorMessage }, 'Input validation failed');
      return {
        success: false,
        error: `Validation error: ${errorMessage}`,
        executionMs: 0,
      };
    }

    // Create engine and execute
    const engine = new ScraperEngine({
      sessionId: `${this.config.action}-${context.taskId}`,
      timeout: this.config.timeout,
    });

    try {
      const result = await engine.execute(
        async (eng) => this.run(eng, validatedInput, context),
        { warmupUrl: this.getWarmupUrl(validatedInput) }
      );

      if (result.success) {
        scenarioLogger.info({ executionMs: result.executionMs }, 'Scenario completed successfully');
      } else {
        scenarioLogger.error({ error: result.error }, 'Scenario failed');
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      scenarioLogger.error({ error: errorMessage }, 'Unexpected scenario error');

      return {
        success: false,
        error: errorMessage,
        executionMs: 0,
      };
    } finally {
      await engine.closeSession();
    }
  }

  /**
   * Get warmup URL for session warmup (override in subclass)
   */
  protected getWarmupUrl(_input: TInput): string | undefined {
    return undefined;
  }

  /**
   * Get scenario config
   */
  getConfig(): ScenarioConfig {
    return this.config;
  }
}

export default BaseScenario;
