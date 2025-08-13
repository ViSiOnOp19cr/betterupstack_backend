import { Request, Response, NextFunction } from "express";
import { JWTSECRET } from "../lib/config";
import jwt from 'jsonwebtoken'


export const usermiddleware = (req:Request, res:Response, next:NextFunction) =>{
    
    const token = req.headers.authorization;


    if(!token){
        res.status(411).json({
            message:"auth token not found brother"
        });
        return;
    }
    const decoded = jwt.verify(token,JWTSECRET) as {sub:string}
    if(decoded && decoded.sub){
        req.userId = decoded.sub;
        next();
    }
    else{
        res.status(500).json({
            message:"user  not found"
        });
    }
}
