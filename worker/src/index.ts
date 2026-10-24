import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Bindings } from './types';
import { authMiddleware } from './middleware/auth';
import { reportsRoute } from './routes/reports';
import { salesRoute } from './routes/sales';
import { settingsRoute } from './routes/settings';
import { analyticsRoute } from './routes/analytics';
import { shiftsRoute } from './routes/shifts';

const app = new Hono<{ Bindings: Bindings }>();

// 1. Enable CORS for mobile companion app
app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization', 'x-owner-pin'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
}));

// 2. Auth Protection Middleware for all API endpoints
app.use('/api/*', authMiddleware);

// 3. Health Check (Public endpoint for uptime monitoring)
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: c.env.APP_NAME || 'Sirka Owner API',
    authEnabled: Boolean(c.env.OWNER_SECRET_KEY && c.env.OWNER_SECRET_KEY.trim()),
    timestamp: new Date().toISOString(),
  });
});

// 4. Mount Modular API Sub-Routers
app.route('/api', reportsRoute);
app.route('/api', salesRoute);
app.route('/api', settingsRoute);
app.route('/api', analyticsRoute);
app.route('/api', shiftsRoute);

export default app;
