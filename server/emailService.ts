import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export class EmailService {
  private static fromEmail = 'noreply@salescoach.app'; // You can customize this

  static async sendPasswordResetEmail(
    userEmail: string,
    resetToken: string,
    userName: string
  ): Promise<boolean> {
    try {
      const resetUrl = `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/reset-password?token=${resetToken}`;
      
      const emailParams: EmailParams = {
        to: userEmail,
        from: this.fromEmail,
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

      await mailService.send(emailParams);
      console.log(`Password reset email sent to ${userEmail}`);
      return true;
    } catch (error) {
      console.error('SendGrid email error:', error);
      return false;
    }
  }

  static async sendEmail(params: EmailParams): Promise<boolean> {
    try {
      await mailService.send({
        to: params.to,
        from: params.from || this.fromEmail,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });
      return true;
    } catch (error) {
      console.error('SendGrid email error:', error);
      return false;
    }
  }
}