import { Resend } from 'resend';
import prisma from '../lib/db';
import { website_status } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();
const resend = new Resend(process.env.Mail_API);

interface NotificationLog {
  websiteId: string;
  lastNotifiedStatus: website_status;
  lastNotifiedAt: Date;
}


const notificationCache = new Map<string, NotificationLog>();

export class NotificationService {
  

  static async checkAndNotifyStatusChange(
    websiteId: string, 
    newStatus: website_status,
    regionId: string
  ) {
    try {
     
      const previousTick = await prisma.website_tick.findFirst({
        where: { 
          website_id: websiteId,
          region_id: regionId 
        },
        orderBy: { createdAt: 'desc' },
        skip: 1, 
      });

      const previousStatus = previousTick?.status;

      if (previousStatus && previousStatus !== newStatus) {
        await this.sendStatusChangeNotification(websiteId, newStatus, previousStatus);
      }
    } catch (error) {
      console.error('Error checking status change:', error);
    }
  }

  private static async sendStatusChangeNotification(
    websiteId: string,
    newStatus: website_status,
    previousStatus: website_status
  ) {

    const cacheKey = `${websiteId}-${newStatus}`;
    const cached = notificationCache.get(cacheKey);
    

    if (cached && Date.now() - cached.lastNotifiedAt.getTime() < 15 * 60 * 1000) {
      return;
    }

    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      include: { user: true }
    });

    if (!website?.user.email) {
      console.log(`No email found for website ${websiteId}`);
      return;
    }

    await this.sendEmail(
      website.user.email,
      website.url,
      newStatus,
      previousStatus
    );


    notificationCache.set(cacheKey, {
      websiteId,
      lastNotifiedStatus: newStatus,
      lastNotifiedAt: new Date()
    });

    console.log(`Sent ${newStatus} notification for ${website.url} to ${website.user.email}`);
  }

  private static async sendEmail(
    email: string,
    websiteUrl: string,
    newStatus: website_status,
    previousStatus: website_status
  ) {
    const isDown = newStatus === 'Down';
    const subject = isDown 
      ? `🚨 ${websiteUrl} is DOWN` 
      : `✅ ${websiteUrl} is back UP`;

    const html = isDown ? `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">🚨 Website Alert: Site Down</h2>
        <p><strong>Website:</strong> ${websiteUrl}</p>
        <p><strong>Status:</strong> <span style="color: #dc2626; font-weight: bold;">DOWN</span></p>
        <p><strong>Previous Status:</strong> ${previousStatus}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        <p>Your website appears to be experiencing issues. Please check your server and network connectivity.</p>
        <hr style="margin: 20px 0;">
        <p style="color: #6b7280; font-size: 14px;">
          Best regards,<br>
          <strong>UpGuard Monitoring Team</strong>
        </p>
      </div>
    ` : `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">✅ Website Recovery: Site Up</h2>
        <p><strong>Website:</strong> ${websiteUrl}</p>
        <p><strong>Status:</strong> <span style="color: #16a34a; font-weight: bold;">UP</span></p>
        <p><strong>Previous Status:</strong> ${previousStatus}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        <p>Great news! Your website is back online and responding normally.</p>
        <hr style="margin: 20px 0;">
        <p style="color: #6b7280; font-size: 14px;">
          Best regards,<br>
          <strong>UpGuard Monitoring Team</strong>
        </p>
      </div>
    `;

    try {
      const { error } = await resend.emails.send({
        from: 'UpGuard Alerts <alerts@emails.chandancr.xyz>',
        to: [email],
        subject,
        html
      });

      if (error) {
        console.error('Failed to send email:', error);
        throw error;
      }
    } catch (error) {
      console.error('Email sending error:', error);
      throw error;
    }
  }

  static cleanCache() {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [key, value] of notificationCache.entries()) {
      if (value.lastNotifiedAt.getTime() < oneHourAgo) {
        notificationCache.delete(key);
      }
    }
  }
}