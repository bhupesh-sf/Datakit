import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface SlackNotificationPayload {
  text?: string;
  blocks?: any[];
  username?: string;
  icon_emoji?: string;
}

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private readonly webhookUrl: string;

  constructor(private configService: ConfigService) {
    this.webhookUrl = this.configService.get<string>('SLACK_WEBHOOK_URL');
  }

  async sendNotification(payload: SlackNotificationPayload): Promise<void> {
    if (!this.webhookUrl) {
      this.logger.warn(
        'Slack webhook URL not configured, skipping notification',
      );
      return;
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status}`);
      }

      this.logger.log('Slack notification sent successfully');
    } catch (error) {
      this.logger.error('Failed to send Slack notification:', error);
    }
  }

  async notifyNewUser(user: {
    email: string;
    name: string;
    id: string;
  }): Promise<void> {
    const payload = {
      text: `🎉 New User Signup!`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🎉 New User Signup!',
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Name:*\n${user.name}`,
            },
            {
              type: 'mrkdwn',
              text: `*Email:*\n${user.email}`,
            },
            {
              type: 'mrkdwn',
              text: `*User ID:*\n${user.id}`,
            },
            {
              type: 'mrkdwn',
              text: `*Time:*\n${new Date().toLocaleString()}`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '👤 New user has joined DataKit',
            },
          ],
        },
      ],
      username: 'DataKit Bot',
      icon_emoji: ':rocket:',
    };

    await this.sendNotification(payload);
  }

  async notifyWaitlistSignup(waitlist: {
    email: string;
    featureName: string;
    id: string;
    userId?: string;
  }): Promise<void> {
    const payload = {
      text: `🔔 New Waitlist Signup!`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🔔 New Waitlist Signup!',
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Email:*\n${waitlist.email}`,
            },
            {
              type: 'mrkdwn',
              text: `*Feature:*\n${waitlist.featureName}`,
            },
            {
              type: 'mrkdwn',
              text: `*User ID:*\n${waitlist.userId || 'Anonymous'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Time:*\n${new Date().toLocaleString()}`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '⏳ Someone is interested in upcoming features',
            },
          ],
        },
      ],
      username: 'DataKit Bot',
      icon_emoji: ':bell:',
    };

    await this.sendNotification(payload);
  }
}
