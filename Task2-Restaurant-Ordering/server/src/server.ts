import app from './app';
import { config } from './config';
import { connectDatabase, supportsTransactions } from './db';

async function startServer() {
  try {
    await connectDatabase(config.mongodbUri);
    console.log('Connected to MongoDB successfully.');

    if (!(await supportsTransactions())) {
      console.warn(
        'MongoDB is running as a standalone server, so multi-document transactions are unavailable. ' +
        'Related writes use compensating clean-up instead. Use a replica set for full atomicity.'
      );
    }

    app.listen(config.port, () => {
      console.log(`DineDesk API Server running at http://localhost:${config.port}`);
      console.log(`Health check: http://localhost:${config.port}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
