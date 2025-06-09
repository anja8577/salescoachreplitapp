import sgMail from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

interface EmailParams {
  to: string;
  from: string | { email: string; name: string };
  subject: string;
  text?: string;
  html?: string;
}

export class EmailService {
  private static fromEmail = process.env.SENDGRID_FROM_EMAIL || 'salescoach@akticon.net';

  static async sendPasswordResetEmail(
    userEmail: string,
    resetToken: string,
    userName: string
  ): Promise<boolean> {
    try {
      const baseUrl = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000';
      const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
      
      const emailParams: EmailParams = {
        to: userEmail,
        from: {
          email: this.fromEmail,
          name: 'SalesCoach Support'
        } as any,
        subject: 'Reset Your SalesCoach Password',
        text: `Hello ${userName},\n\nYou requested to reset your password for SalesCoach.\n\nClick the link below to reset your password:\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nThe SalesCoach Team`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Reset Your SalesCoach Password</h2>
            <p>Hello ${userName},</p>
            <p>You requested to reset your password for SalesCoach.</p>
            <p>Click the button below to reset your password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${resetUrl}</p>
            <p><strong>This link will expire in 1 hour.</strong></p>
            <p>If you didn't request this password reset, please ignore this email.</p>
            <p>Best regards,<br>The SalesCoach Team</p>
          </div>
        `
      };

      const result = await sgMail.send({
        to: emailParams.to,
        from: emailParams.from,
        subject: emailParams.subject,
        text: emailParams.text || '',
        html: emailParams.html || '',
        trackingSettings: {
          clickTracking: { enable: true },
          openTracking: { enable: true },
          subscriptionTracking: { enable: false }
        },
        mailSettings: {
          sandboxMode: { enable: false }
        }
      });
      
      const messageId = result[0]?.headers?.['x-message-id'] || 'unknown';
      console.log(`Password reset email sent to ${userEmail} - Message ID: ${messageId}`);
      console.log('SendGrid status code:', result[0]?.statusCode);
      console.log('Email details:', {
        to: userEmail,
        from: this.fromEmail,
        subject: 'Reset Your SalesCoach Password',
        messageId: messageId,
        timestamp: new Date().toISOString()
      });
      
      return true;
    } catch (error: any) {
      console.error('SendGrid email error:', error);
      if (error.response && error.response.body && error.response.body.errors) {
        console.error('SendGrid error details:', JSON.stringify(error.response.body.errors, null, 2));
      }
      if (error.code) {
        console.error('SendGrid error code:', error.code);
      }
      return false;
    }
  }

  static async sendEmail(params: EmailParams): Promise<boolean> {
    try {
      await sgMail.send({
        to: params.to,
        from: params.from || this.fromEmail,
        subject: params.subject,
        text: params.text || '',
        html: params.html || '',
      });
      return true;
    } catch (error) {
      console.error('SendGrid email error:', error);
      return false;
    }
  }
}