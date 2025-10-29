import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import supabaseRoute from './routes/supabase';

const app = new Hono();

/*
  Middlewares
*/
app.use('/*', logger());
app.use('/*', secureHeaders());

/*
  Routes
*/
app.route('/supabase', supabaseRoute);

export default {
  fetch: app.fetch,
  port: 7777,
};
