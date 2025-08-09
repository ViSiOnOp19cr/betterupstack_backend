import express from 'express';
import { authRouter } from './routes/authRouter';

const app = express();
app.use('/api/v1', authRouter);



app.listen(3005,()=>{
    console.log("server running in port 3005")
})