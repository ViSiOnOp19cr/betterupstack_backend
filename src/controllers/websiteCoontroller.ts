import { Request, Response } from 'express';
import prisma from '../lib/db'
import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();
const API = process.env.Mail_API;
console.log(API);
const resend = new Resend(API);

export const sendMail = async () => {
  const { data, error } = await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: ['chandancr515@gmail.com'],
    subject: 'Website Down Alert 🚨',
    html: '<strong>Alert: One of your websites is down!</strong>',
  });

  if (error) {
    console.error("Error sending email:", error);
  } else {
    console.log("Mail sent:", data);
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

        const latest_status = recentTicks[0]?.status || 'Unknown';
        const upCount = recentTicks.filter(t => t.status === 'Up').length;
        const uptime_percentage = recentTicks.length ? Math.round((upCount / recentTicks.length) * 100) : 0;
        for (const tick of recentTicks) {
      if (tick.status === 'Down') {
        await sendMail(); 
        break; 
      }
    }

        res.json({
            url: website.url,
            id: website.id,
            latest_status,
            uptime_percentage,
            recent_ticks: recentTicks.map(t => ({
                status: t.status,
                response_time_ms: t.response_time_ms,
                region: t.region.name,
                timestamp: t.createdAt
            }))
        });
    }catch(error){
        res.status(500).json({
            error
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