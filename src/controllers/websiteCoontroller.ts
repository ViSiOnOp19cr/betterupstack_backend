import { Request, Response } from 'express';
import prisma from '../lib/db'


export const CreateWebsite = async (req: Request, res: Response) => {
    try {
        const url = req.body.url;

        if (!url) {
            res.status(411).json({
                message: "url not to be found"
            });
            return;
        }
        const website = await prisma.website.create({

            data: {
                url,
                user_id: req.userId!,
                time_added: new Date(),
            }
        });
        res.json({
            id: website.id
        });
    } catch (error) {
        res.status(500).json({
            error
        })
    }
}

export const websiteStatus = async(req: Request, res: Response) => {
    try {
        const website = await prisma.website.findFirst({

            where: {
                user_id: req.userId!,
                id: req.params.websiteId!
            },
            include: {
                ticks: {
                    orderBy: [{
                        createdAt: 'desc'
                    }],
                    take: 1
                }
            }
        });
        if (!website) {
            res.status(411).json({
                message: "website not found"
            })
            return
        }
        res.json({
            url: website.url,
            id: website.id,
            user_id: website.user_id
        })
    }catch(error){
        res.status(500).json({
            error
        })
    }
}