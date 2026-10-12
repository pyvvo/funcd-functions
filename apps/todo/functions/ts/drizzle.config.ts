// drizzle-kit generate writes the migrations of one App version (funcd ADR-0236): DRIZZLE_VERSION names it, and each
// version's folder starts from the one before, so it holds every migration up to that version.
import { defineConfig } from 'drizzle-kit';

const version = process.env.DRIZZLE_VERSION ?? '1.0.0';

export default defineConfig({
  dialect: 'sqlite',
  schema: `src/db/schema-${version}.ts`,
  out: `drizzle/${version}`,
});
