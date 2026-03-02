import type { BaseScenario, ScenarioConfig } from './BaseScenario.js';
import logger from '../observability/logger.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ScenarioConstructor = new () => BaseScenario<any, any>;

/**
 * ScenarioRegistry - Manages registration and lookup of scraping scenarios
 */
class ScenarioRegistry {
  private scenarios: Map<string, ScenarioConstructor> = new Map();
  private instances: Map<string, BaseScenario> = new Map();

  /**
   * Register a scenario class
   */
  register(ScenarioClass: ScenarioConstructor): void {
    const instance = new ScenarioClass();
    const config = instance.getConfig();

    if (this.scenarios.has(config.action)) {
      logger.warn({ action: config.action }, 'Overwriting existing scenario');
    }

    this.scenarios.set(config.action, ScenarioClass);
    this.instances.set(config.action, instance);

    logger.info({ action: config.action, name: config.name }, 'Scenario registered');
  }

  /**
   * Get a scenario instance by action name
   */
  get(action: string): BaseScenario | undefined {
    return this.instances.get(action);
  }

  /**
   * Create a new instance of a scenario
   */
  createInstance(action: string): BaseScenario | undefined {
    const ScenarioClass = this.scenarios.get(action);
    if (!ScenarioClass) return undefined;
    return new ScenarioClass();
  }

  /**
   * Check if a scenario exists
   */
  has(action: string): boolean {
    return this.scenarios.has(action);
  }

  /**
   * Get all registered scenario configs
   */
  getAll(): ScenarioConfig[] {
    return Array.from(this.instances.values()).map((s) => s.getConfig());
  }

  /**
   * Get list of registered action names
   */
  getActions(): string[] {
    return Array.from(this.scenarios.keys());
  }

  /**
   * Unregister a scenario
   */
  unregister(action: string): boolean {
    const deleted = this.scenarios.delete(action);
    this.instances.delete(action);
    return deleted;
  }

  /**
   * Clear all scenarios
   */
  clear(): void {
    this.scenarios.clear();
    this.instances.clear();
  }
}

// Singleton instance
export const scenarioRegistry = new ScenarioRegistry();

/**
 * Decorator for auto-registering scenarios
 */
export function RegisterScenario() {
  return function (target: ScenarioConstructor) {
    scenarioRegistry.register(target);
    return target;
  };
}

export default scenarioRegistry;
