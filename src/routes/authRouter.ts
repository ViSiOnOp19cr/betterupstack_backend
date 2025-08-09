import express from 'express';
import {signin, signup} from '../controllers/authController';

export const authRouter = express.Router();

authRouter.post('/signup', signup);
authRouter.post('/signin', signin);