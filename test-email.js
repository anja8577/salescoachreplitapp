const sgMail = require('@sendgrid/mail');

if (!process.env.SENDGRID_API_KEY) {
  console.error("SENDGRID_API_KEY not found");
  process.exit(1);
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const testEmail = async () => {
  try {
    const msg = {
      to: 'info@akticon.net',
      from: {
        email: 'salescoach@akticon.net',
        name: 'SalesCoach Test'
      },
      subject: 'Test Email - Password Reset Troubleshooting',
      text: 'This is a test email to verify SendGrid delivery.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Test Email</h2>
          <p>This is a test email to verify SendGrid delivery.</p>
          <p>If you receive this email, the SendGrid configuration is working correctly.</p>
          <p>Time sent: ${new Date().toISOString()}</p>
        </div>
      `,
      trackingSettings: {
        clickTracking: { enable: false },
        openTracking: { enable: true }
      }
    };

    const result = await sgMail.send(msg);
    console.log('Test email sent successfully');
    console.log('Status code:', result[0].statusCode);
    console.log('Message ID:', result[0].headers['x-message-id']);
    console.log('Response headers:', result[0].headers);
    
  } catch (error) {
    console.error('SendGrid test error:', error);
    if (error.response) {
      console.error('Error response:', error.response.body);
    }
  }
};

testEmail();