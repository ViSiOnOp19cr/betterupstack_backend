import express from 'express';
import { CreateWebsite, websiteStatus, getUserWebsites , updateUserEmail} from '../controllers/websiteCoontroller';
import { usermiddleware } from '../middlewares/authmiddleware';

export const websiteRouter = express.Router();

websiteRouter.use(usermiddleware);  

websiteRouter.post('/', CreateWebsite);

websiteRouter.get('/:websiteId', websiteStatus);

websiteRouter.get('/', getUserWebsites);

websiteRouter.put('/update', updateUserEmail);