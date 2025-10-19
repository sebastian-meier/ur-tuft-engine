/**
 * Express server bootstrap. Applies cross-cutting middleware, mounts feature routers, and exposes
 * auxiliary developer tooling such as Swagger UI.
 */
import path from 'node:path';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import uploadRouter from './routes/upload';
import preflightRouter from './routes/preflight';
import toolTestRouter from './routes/toolTest';
import boundingBoxRouter from './routes/boundingBox';

const app = express();

app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json());

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.1.0',
    info: {
      title: 'UR Tuft Engine API',
      version: '0.1.0',
      description:
        'Endpoints for generating Universal Robots programs from bitmap artwork and streaming them to the controller.',
    },
  },
  apis: [path.resolve(__dirname, 'routes/*.{ts,js}')],
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Lightweight service health probe.
 *     tags:
 *       - System
 *     responses:
 *       '200':
 *         description: Service is ready to receive requests.
 */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/images', uploadRouter);
app.use('/api/preflight', preflightRouter);
app.use('/api/tool-test', toolTestRouter);
app.use('/api/bounding-box', boundingBoxRouter);

/**
 * Express error-handling middleware that normalizes thrown values into JSON responses.
 */
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  res.status(500).json({ error: message });
});

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend API listening on port ${config.port}`);
});
