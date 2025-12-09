import express, { Response, Request } from 'express';
import session from 'express-session';
import cors from 'cors';
import passport from './config/passport';
import { authRouter } from './routes/authRouter';
import { websiteRouter } from './routes/websiteRouter';
import { SESSION_SECRET, CLIENT_URL } from './lib/config';

const app = express();

app.use(cors({
    origin: "*",
    credentials: true
}));

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, 
        maxAge: 24 * 60 * 60 * 1000, 
    },
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/websites', websiteRouter);

export default app;