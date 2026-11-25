import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.routes.js';
import schoolRoutes from './routes/school.routes.js';
import { prisma } from './db.js';

const app = express();
const port = Number(process.env.PORT || 4000);

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());

const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const clean = origin.replace(/\/$/, '');
      if (allowedOrigins.includes('*') || allowedOrigins.includes(clean)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false
  }),
  authRoutes
);

app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', service: 'babcock-prep-api', timestamp: new Date().toISOString() })
);

app.use('/api', schoolRoutes);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err instanceof Error ? err.message : 'Unknown server error');
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

const server = app.listen(port, '0.0.0.0', () =>
  console.log(`BABCOCK PREP API listening on http://0.0.0.0:${port}`)
);

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
