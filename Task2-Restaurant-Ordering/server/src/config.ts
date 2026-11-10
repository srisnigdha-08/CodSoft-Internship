import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error(
    'FATAL CONFIGURATION ERROR: JWT_SECRET environment variable is missing. ' +
    'Please set JWT_SECRET in server/.env (see server/.env.example) or via your process environment.'
  );
}

const mongodbUri = process.env.MONGODB_URI;
if (!mongodbUri) {
  throw new Error(
    'FATAL CONFIGURATION ERROR: MONGODB_URI environment variable is missing. ' +
    'Please set MONGODB_URI in server/.env (see server/.env.example) or via your process environment.'
  );
}

const cookieSecret = process.env.COOKIE_SECRET;
if (!cookieSecret) {
  throw new Error(
    'FATAL CONFIGURATION ERROR: COOKIE_SECRET environment variable is missing. ' +
    'Please set COOKIE_SECRET in server/.env (see server/.env.example) or via your process environment.'
  );
}

// The placeholders in .env.example are tolerated for local development only.
if (process.env.NODE_ENV === 'production') {
  for (const [name, value] of [['JWT_SECRET', jwtSecret], ['COOKIE_SECRET', cookieSecret]]) {
    if (value.length < 32 || value.startsWith('CHANGE_ME')) {
      throw new Error(`FATAL CONFIGURATION ERROR: ${name} must be a random value of at least 32 characters in production.`);
    }
  }
}

export const config = {
  port: parseInt(process.env.PORT || '5050', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  mongodbUri,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieSecret,
};
