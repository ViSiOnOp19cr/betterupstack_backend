import {Request , Response} from 'express';
import prisma from '../lib/db';
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv';

dotenv.config();
const JWTSECRET = process.env.JWT || "audfjhasiudfjonhsiafoesdnvhsidjamnhjdf";

export const signup = async(req:Request,res:Response)=>{
    try{
        const {username, password} = req.body;
        if(!username || !password) {
            res.status(400).json({
                message:"username or password is missing"
            });
            return;
        }
        const hashpass = await bcrypt.hash(password, 10);
        await prisma.user.create({
            data:{
                username,
                password:hashpass
            }
        });
        res.status(200).json({
            message:"user signup done successfully"
        });
    }catch(error){
        res.status(500).json({
            message:"server is down"
        });
    }
}

export const signin = async(req:Request, res:Response) =>{
    try{
        const {username, password} = req.body;
        if(!username || !password){
            res.status(400).json({
                message:"usename or password is missing"
            })
        };
        const user = await prisma.user.findFirst({
            where:{
                username:username
            }
        });
        if(!user){
            res.status(400).json({
                message:"user not found"
            });
            return;
        }
        const pass = await bcrypt.compare(password,user.password);
        if(!pass){
            res.status(400).json({
                message:"pass is wrong bro think harder"
            })
        };
        const token = jwt.sign({
            sub:user.id,
        }, JWTSECRET,{ expiresIn: '1h' });

        res.status(200).json({
            message:"signed in successfully",
            token
        })
    }catch(error){
        res.status(500).json({
            message:"server is down"
        });
    }
}