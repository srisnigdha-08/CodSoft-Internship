import { databaseNameFrom } from '../src/config/databaseName.js';

/**
 * Stops the suite before it can touch a development database. Called when Vitest loads and
 * again before setup; the connected server is checked separately before each cleanup.
 */
export function assertSafeTestDatabase(testUri: string | undefined, devUri?: string): string {
  if (!testUri) throw new Error('TEST_DATABASE_URL must be set to run the backend tests');
  const testName = databaseNameFrom(testUri);
  if (!testName) throw new Error('TEST_DATABASE_URL must be a MongoDB URI that names a database');
  if (!testName.toLowerCase().includes('test')) {
    throw new Error('Refusing to run: the TEST_DATABASE_URL database name must contain "test"');
  }
  if (devUri && databaseNameFrom(devUri) === testName) {
    throw new Error('Refusing to run: DATABASE_URL and TEST_DATABASE_URL name the same database');
  }
  return testName;
}
