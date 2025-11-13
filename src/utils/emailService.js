const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // use TLS
  requireTLS: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

const sendEmail = async (to, subject, htmlContent, templateName = null, templateContext = {}) => {
  try {
    let finalHtmlContent = htmlContent;

    if (templateName) {
      const templatePath = path.join(__dirname, 'emailTemplates', `${templateName}.html`);
      const source = fs.readFileSync(templatePath, 'utf-8');
      const template = handlebars.compile(source);
      finalHtmlContent = template(templateContext);
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      html: finalHtmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: %s', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = { sendEmail };