/** Returns the database named in a MongoDB connection string, or null if there is none. */
export function databaseNameFrom(uri: string): string | null {
  const match = /^mongodb(?:\+srv)?:\/\/[^/?]+\/([^/?]+)/.exec(uri.trim());
  return match ? decodeURIComponent(match[1]) : null;
}
