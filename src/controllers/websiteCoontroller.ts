import { Request, Response } from 'express';
import prisma from '../lib/db'
import dotenv from 'dotenv';
dotenv.config();


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
            message: "internal server error"
        })
    }
}

export const websiteStatus = async (req: Request, res: Response) => {
    try {
        const website = await prisma.website.findFirst({
            where: {
                user_id: req.userId!,
                id: req.params.websiteId!
            }
        });

        if (!website) {
            res.status(411).json({
                message: "website not found"
            });
            return;
        }

        // Fetch recent ticks with region info
        const recentTicks = await prisma.website_tick.findMany({
            where: { website_id: website.id },
            include: { region: true },
            orderBy: { createdAt: 'desc' },
            take: 20
        });


        res.json({
            url: website.url,
            id: website.id,
            recent_ticks: recentTicks.map(t => ({
                status: t.status,
                response_time_ms: t.response_time_ms,
                region: t.region.name,
                timestamp: t.createdAt
            }))
        });
    } catch (error) {
        res.status(500).json({
            message: "internal server error"
        })
    }
}
export const getUserWebsites = async (req: Request, res: Response) => {
    try {
        const websites = await prisma.website.findMany({
            where: {
                user_id: req.userId!
            },
            include: {
                ticks: {
                    orderBy: {
                        createdAt: 'desc'
                    },
                    take: 1
                }
            },
            orderBy: {
                time_added: 'desc'
            }
        });

        const websitesWithStatus = websites.map(website => ({
            id: website.id,
            url: website.url,
            time_added: website.time_added,
            latest_status: website.ticks[0]?.status || 'Unknown',
            last_checked: website.ticks[0]?.createdAt || null
        }));

        res.json({
            websites: websitesWithStatus,
            total: websites.length
        });
    } catch (error) {
        console.error('Get user websites error:', error);
        res.status(500).json({
            message: "Internal server error"
        });
    }
};
export const updateUserEmail = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        if (!email) {
            res.status(411).json({
                message: "email not to be found"
            });
            return;
        }
        await prisma.user.update({
            where: { id: req.userId! },
            data: { email: email }
        });
        res.json({
            message: "Email updated successfully"
        });
    } catch (error) {
        res.status(500).json({
            message: "internal server error"
        })
    }
}