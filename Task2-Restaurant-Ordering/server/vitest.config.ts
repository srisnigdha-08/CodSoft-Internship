import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      PORT: '5050',
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/dinedesk_db?schema=public',
      JWT_SECRET: 'test_jwt_secret_configured_strictly_for_automated_integration_tests_only_32_chars',
      COOKIE_SECRET: 'test_cookie_secret_configured_strictly_for_automated_integration_tests_only_32_chars',
      FRONTEND_ORIGIN: 'http://localhost:3000',
    },
  },
});
