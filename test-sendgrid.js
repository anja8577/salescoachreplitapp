import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: 'info@akticon.net',
  from: 'salescoach@akticon.net',
  subject: 'SendGrid Test',
  text: 'This is a test email from SendGrid',
};

sgMail
  .send(msg)
  .then(() => {
    console.log('Email sent successfully');
  })
  .catch((error) => {
    console.error('SendGrid error:', error);
    if (error.response) {
      console.error('Response body:', error.response.body);
    }
  });