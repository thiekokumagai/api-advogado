import { Injectable } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PushNotificationService {
  constructor(private readonly prisma: PrismaService) {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@portaladvocacia.com.br';

    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
    }
  }

  // Update user's WebPush Subscription in DB
  async updateSubscription(userId: string, subscription: any) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        webPushSubscription: subscription,
      },
    });
  }

  // Send web push notification to specific users or office
  async sendWebPushToOffice(
    officeId: string,
    title: string,
    body: string,
    data?: any,
  ) {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      console.warn('VAPID keys não configuradas. Pulando disparo de Push Notification.');
      return;
    }

    const users = await this.prisma.user.findMany({
      where: {
        officeId,
        webPushSubscription: { not: null },
      },
      select: { webPushSubscription: true },
    });

    const payload = JSON.stringify({
      title,
      body,
      data: {
        ...data,
        icon: '/pwa-192x192.png',
      },
    });

    for (const u of users) {
      if (!u.webPushSubscription) continue;
      try {
        await webpush.sendNotification(u.webPushSubscription as any, payload);
      } catch (error: any) {
        console.error('Erro ao enviar WebPush:', error?.message || error);
      }
    }
  }
}
