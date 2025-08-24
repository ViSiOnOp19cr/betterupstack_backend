import { Request, Response } from 'express';
import prisma from '../lib/db'
import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();
const API = process.env.Mail_API;
console.log(API);
const resend = new Resend(API);

export const sendMail = async (mail: string, status: string) => {
    if (status == 'DOWN') {
        const { data, error } = await resend.emails.send({
            from: 'Message from Upgaurd <hello@emails.chandancr.xyz>',
            to: [mail],
            subject: 'Website is down. 🚨',
            html: `
      <strong>Alert: Your website is down right now.!</strong>
      <p>Your website status is down please check your issues with website</p>
      <p>Thank you for using Upgaurd.</p>
      <p>Best regards,<br><strong>Upgaurd</strong></p>
    `,
        });
        if (error) {
            console.error("Error sending email:", error);
        } else {
            console.log("Mail sent:", data);
        }
    }
    else {
        const { data, error } = await resend.emails.send({
            from: 'Message from Upgaurd <hello@emails.chandancr.xyz>',
            to: [mail],
            subject: 'Website is UP again',
            html: `
      <strong>Alert: Your website is Up!</strong>
      <p>Your website status is Up and its working fine.</p>
      <p>Thank you for using Upgaurd.</p>
      <p>Best regards,<br><strong>Upgaurd</strong></p>
    `,
        });
        if (error) {
            console.error("Error sending email:", error);
        } else {
            console.log("Mail sent:", data);
        }
    }


};

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

        const latest_status = recentTicks[0]?.status || 'Unknown'
        if (recentTicks.length <= 1) {
            res.json({
                url: website.url,
                id: website.id,
                latest_status,
                recent_ticks: recentTicks.map(t => ({
                    status: t.status,
                    response_time_ms: t.response_time_ms,
                    region: t.region.name,
                    timestamp: t.createdAt
                }))
            });
            return;
        }


        const secondLatest_status = recentTicks[1]?.status || 'Unknown'
        if (latest_status != secondLatest_status) {
            const user = await prisma.user.findFirst({
                where: {
                    id: req.userId!,
                },
            });
            await sendMail(user?.email!, latest_status)
        }

        res.json({
            url: website.url,
            id: website.id,
            latest_status,
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