import { Hono } from 'hono';
import type { AppEnv } from './env';
import { corsMiddleware } from './middleware/cors';
import { errorHandler, notFoundHandler } from './middleware/error';
import { requestId } from './middleware/request-id';
import { auth } from './routes/auth';
import { bookings } from './routes/bookings';
import { community } from './routes/community';
import { catalog } from './routes/catalog';
import { health } from './routes/health';
import { uploads } from './routes/uploads';
import { wallet } from './routes/wallet';
import { pro } from './routes/pro';
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
v1.route('/', wallet);
v1.route('/', community);
v1.route('/', pro);
app.route('/api/v1', v1);

export default app;
