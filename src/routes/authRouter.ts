import express from 'express';
import {signin, signup, me} from '../controllers/authController';
import { usermiddleware } from '../middlewares/authmiddleware';
export const authRouter = express.Router();

authRouter.post('/signup', signup);
authRouter.post('/signin', signin);
authRouter.get('/me',usermiddleware, me);