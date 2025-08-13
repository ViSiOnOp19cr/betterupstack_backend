import express from 'express';
import { authRouter } from './routes/authRouter';
import { websiteRouter } from './routes/websiteRouter';

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/websites', websiteRouter);


app.use('*', (req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ message: 'Internal server error' });
});

export default app;