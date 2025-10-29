import { Pool } from 'pg';
import { FROM_DATABASE_URL, TO_DATABASE_URL } from '../constants';

export const fromDB = new Pool({
  connectionString: FROM_DATABASE_URL,
});

export const toDB = new Pool({
  connectionString: TO_DATABASE_URL,
});
