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

        const recentTicks = await prisma.website_tick.findMany({
            where: { website_id: website.id },
            include: { region: true },
            orderBy: { createdAt: 'desc' },
            take: 20
        });

        let uptimePercentage = 0;
        let latestStatus = 'Unknown';
        let continuousUptimeStart = null;
        let uptimeDuration = null;

        if (recentTicks.length > 0) {
            latestStatus = recentTicks[0]?.status!;

            const upCount = recentTicks.filter(tick => tick.status === 'Up').length;
            uptimePercentage = Math.round((upCount / recentTicks.length) * 100 * 100) / 100; 

            if (latestStatus === 'Up') {

                let uptimeStartIndex = 0;
                for (let i = 0; i < recentTicks.length; i++) {
                    if (recentTicks[i]?.status !== 'Up') {
                        uptimeStartIndex = i;
                        break;
                    }
                    uptimeStartIndex = i + 1; 
                }

                if (uptimeStartIndex < recentTicks.length) {
                    continuousUptimeStart = recentTicks[uptimeStartIndex - 1]?.createdAt || recentTicks[recentTicks.length - 1]?.createdAt;
                } else {
                    const oldestUpTick = await prisma.website_tick.findFirst({
                        where: { 
                            website_id: website.id,
                            status: { not: 'Up' }
                        },
                        orderBy: { createdAt: 'desc' },
                        take: 1
                    });

                    if (oldestUpTick) {
                        const firstUpAfterDown = await prisma.website_tick.findFirst({
                            where: { 
                                website_id: website.id,
                                status: 'Up',
                                createdAt: { gt: oldestUpTick.createdAt }
                            },
                            orderBy: { createdAt: 'asc' }
                        });
                        continuousUptimeStart = firstUpAfterDown?.createdAt || recentTicks[recentTicks.length - 1]?.createdAt;
                    } else {
                        const firstTick = await prisma.website_tick.findFirst({
                            where: { website_id: website.id },
                            orderBy: { createdAt: 'asc' }
                        });
                        continuousUptimeStart = firstTick?.createdAt || null;
                    }
                }

                if (continuousUptimeStart) {
                    const now = new Date();
                    const diffMs = now.getTime() - new Date(continuousUptimeStart).getTime();
                    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

                    uptimeDuration = {
                        total_ms: diffMs,
                        days,
                        hours,
                        minutes,
                        formatted: days > 0 
                            ? `${days}d ${hours}h ${minutes}m`
                            : hours > 0 
                            ? `${hours}h ${minutes}m`
                            : `${minutes}m`
                    };
                }
            }
        }

        res.json({
            url: website.url,
            id: website.id,
            latest_status: latestStatus,
            uptime_percentage: uptimePercentage,
            continuous_uptime_start: continuousUptimeStart,
            uptime_duration: uptimeDuration,
            recent_ticks: recentTicks.map(t => ({
                status: t.status,
                connection_time_ms: t.connection_time_ms,
                tls_handshake_time_ms: t.tls_handshake_time_ms,
                data_transfer_time_ms: t.data_transfer_time_ms,
                total_response_time_ms: t.total_response_time_ms,
                region: t.region?.name || 'Unknown',
                timestamp: t.createdAt
            }))
        });
    } catch (error) {
        console.error('Website status error:', error);
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
        console.log(req.userId);
        console.log(email);
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