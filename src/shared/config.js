import dotenv from 'dotenv';

dotenv.config();

const requiredVars = ['DATABASE_PATH'];
for (const key of requiredVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const DATABASE_PATH = process.env.DATABASE_PATH;
export const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
export const NODE_ENV = process.env.NODE_ENV || 'development';
