export { BaseScenario, type ScenarioConfig, type ScenarioContext } from './BaseScenario.js';
export { scenarioRegistry, RegisterScenario } from './registry.js';

// Import and register all scenarios
import { TestScenario } from './implementations/test.scenario.js';
import { AirEliteTestScenario } from './implementations/airelite-test.scenario.js';
import { scenarioRegistry } from './registry.js';

// Register built-in scenarios
scenarioRegistry.register(TestScenario);
scenarioRegistry.register(AirEliteTestScenario);

/**
 * Load custom scenarios dynamically (for future extensibility)
 * Can be used to load scenarios from a directory or external modules
 */
export async function loadCustomScenarios(_path?: string): Promise<void> {
  // Placeholder for dynamic scenario loading
  // In the future, this can scan a directory and load .scenario.ts files
}
