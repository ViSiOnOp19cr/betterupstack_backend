import {Request, Response} from 'express';
import prisma from '../lib/db'


export const CreateWebsite = async(req:Request, res:Response) =>{
    const url = req.body.url;

    if(!url){
        res.status(411).json({
            message:"url not to be found"
        });
    }
    const website = await prisma.website.create({
        data:{
            url:url,
            user_id:req.userId
        }
    })
}