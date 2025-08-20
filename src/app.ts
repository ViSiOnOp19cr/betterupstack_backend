import express,{ Response} from 'express';
import { authRouter } from './routes/authRouter';
import { websiteRouter } from './routes/websiteRouter';
import cors from 'cors';

const app = express();
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());

app.get('/health', (res:Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/websites', websiteRouter);




export default app;