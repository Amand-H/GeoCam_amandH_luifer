import type { Config } from 'drizzle-kit';

export default {
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  // Sin driver 'expo' drizzle-kit no genera drizzle/migrations.js
  driver: 'expo',
} satisfies Config;
