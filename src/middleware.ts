import { betterAuthProvider } from '@xmcp-dev/better-auth';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
const authSecret = process.env.BETTER_AUTH_SECRET;
const baseURL = process.env.BETTER_AUTH_BASE_URL;
if (!databaseUrl || !authSecret || !baseURL) {
  throw new Error('DATABASE_URL, BETTER_AUTH_SECRET, and BETTER_AUTH_BASE_URL are required');
}

export default betterAuthProvider({
  database: new Pool({ connectionString: databaseUrl, max: 5 }),
  baseURL,
  secret: authSecret,
  providers: {
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
    },
  },
});
