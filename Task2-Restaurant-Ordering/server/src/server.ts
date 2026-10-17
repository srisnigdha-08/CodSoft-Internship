import app from './app';
import { config } from './config';
import prisma from './prisma';

async function startServer() {
  try {
    // Verify database connection
    await prisma.$connect();
    console.log('Connected to PostgreSQL successfully.');

    app.listen(config.port, () => {
      console.log(`DineDesk API Server running at http://localhost:${config.port}`);
      console.log(`Health check: http://localhost:${config.port}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
