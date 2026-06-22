import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Load the repo-root .env for local runs (DATABASE_URL, secrets).
// In CI the file is absent and env comes from the job — config() is simply skipped.
const here = path.dirname(fileURLToPath(import.meta.url));
const rootEnv = path.resolve(here, '../../../.env');
if (existsSync(rootEnv)) config({ path: rootEnv });
