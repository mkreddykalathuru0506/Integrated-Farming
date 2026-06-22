import { createApp } from './app';
import { env } from './env';

const app = createApp();

app.listen(env.API_PORT, () => {
  console.log(`[ifm-api] listening on http://localhost:${env.API_PORT} (${env.NODE_ENV})`);
});
