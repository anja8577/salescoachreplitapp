import sgMail from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

interface EmailParams {
  to: string;
  from: string | { email: string; name: string };
  replyTo?: string;
  subject: string;
  text?: string;
  html?: string;
}

export class EmailService {
  private static fromEmail = process.env.SENDGRID_FROM_EMAIL || 'salescoach@akticon.net';
  
  // Enhanced email delivery with better authentication
  private static getOptimalSenderConfig(recipientEmail: string): {
    from: string | { email: string; name: string };
    headers: { [key: string]: string };
  } {
    const domain = recipientEmail.split('@')[1]?.toLowerCase();
    
    const baseHeaders: { [key: string]: string } = {
      'X-Priority': 'Normal',
      'X-MSMail-Priority': 'Normal'
    };
    
    // Special handling for problematic domains
    if (domain === 'outlook.com' || domain === 'hotmail.com' || domain?.includes('outlook')) {
      return {
        from: {
          email: this.fromEmail,
          name: 'SalesCoach Password Reset'
        },
        headers: {
          ...baseHeaders,
          'List-Unsubscribe': `<mailto:${this.fromEmail}?subject=unsubscribe>`,
          'X-Entity-ID': `password-reset-${Date.now()}`
        }
      };
    }
    
    // Default configuration for other providers
    return {
      from: this.fromEmail,
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high'
      }
    };
  }

  static async sendPasswordResetEmail(
    userEmail: string,
    resetToken: string,
    userName: string
  ): Promise<boolean> {
    try {
      const baseUrl = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000';
      const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
      
      // Get optimized sender configuration based on recipient domain
      const senderConfig = this.getOptimalSenderConfig(userEmail);
      
      const emailBody = {
        text: `Hello ${userName},\n\nYou requested to reset your password for SalesCoach.\n\nClick the link below to reset your password:\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nThe SalesCoach Team`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0;">SalesCoach</h1>
            </div>
            <h2 style="color: #333; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Password Reset Request</h2>
            <p style="font-size: 16px; line-height: 1.5;">Hello ${userName},</p>
            <p style="font-size: 16px; line-height: 1.5;">We received a request to reset your password for your SalesCoach account.</p>
            <div style="text-align: center; margin: 40px 0;">
              <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px;">Reset Your Password</a>
            </div>
            <p style="font-size: 14px; color: #666; border: 1px solid #e5e7eb; padding: 15px; border-radius: 6px; background-color: #f9fafb;">
              <strong>Security Note:</strong> This link will expire in 1 hour for your security. If you didn't request this reset, you can safely ignore this email.
            </p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280;">
              <p>Best regards,<br>The SalesCoach Team</p>
            </div>
          </div>
        `
      };

      const result = await sgMail.send({
        to: userEmail,
        from: senderConfig.from,
        subject: 'SalesCoach - Password Reset Request',
        text: emailBody.text,
        html: emailBody.html,
        headers: senderConfig.headers,
        trackingSettings: {
          clickTracking: { enable: false },
          openTracking: { enable: false },
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