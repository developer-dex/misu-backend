import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { config } from './config.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { authRouter } from './routes/auth.js';
import { daysRouter } from './routes/days.js';
import { ingredientsRouter } from './routes/ingredients.js';
import { ordersRouter } from './routes/orders.js';
import { productsRouter } from './routes/products.js';
import { purchasesRouter } from './routes/purchases.js';
import { reportsRouter } from './routes/reports.js';

// The built React app, if present, is served from the same origin as the API
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'img-src': ["'self'", 'data:'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
        },
      },
    }),
  );
  app.use(compression());
  if (config.clientOrigins.length) app.use('/api', cors({ origin: config.clientOrigins }));
  app.use(express.json({ limit: '50kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, db: mongoose.connection.readyState === 1 });
  });
  app.use('/api/auth', authRouter);
  app.use('/api/products', requireAuth, productsRouter);
  app.use('/api/ingredients', requireAuth, ingredientsRouter);
  app.use('/api/days', requireAuth, daysRouter);
  app.use('/api/orders', requireAuth, ordersRouter);
  app.use('/api/purchases', requireAuth, purchasesRouter);
  app.use('/api/reports', requireAuth, reportsRouter);
  app.use('/api', notFound);

  if (existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false, maxAge: '1y', immutable: true }));
    // Every other path is a screen of the single-page app
    app.get('/{*splat}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
