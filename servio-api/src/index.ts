import { Hono } from 'hono';
import type { AppEnv } from './env';
import { corsMiddleware } from './middleware/cors';
import { errorHandler, notFoundHandler } from './middleware/error';
import { requestId } from './middleware/request-id';
import { auth } from './routes/auth';
import { bookings } from './routes/bookings';
import { catalog } from './routes/catalog';
import { health } from './routes/health';
import { uploads } from './routes/uploads';
import { me } from './routes/me';

const app = new Hono<AppEnv>();

app.use('*', requestId);
app.use('*', corsMiddleware);
app.onError(errorHandler);
app.notFound(notFoundHandler);

const v1 = new Hono<AppEnv>();
v1.route('/', health);
v1.route('/', catalog);
v1.route('/', auth);
v1.route('/', me);
v1.route('/', bookings);
v1.route('/', uploads);
app.route('/api/v1', v1);

export default app;
