const nodemailer = require('nodemailer');
const debug = require('debug')('eventhub:email');
const fs = require('fs');
const handlebars = require('handlebars');
const path = require('path');

// Configurazione del trasportatore email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  },
  debug: false,
  logger: false
});

// Test di verifica del trasportatore
transporter.verify(function (error, success) {
    if (error) {
        console.error('Errore nella configurazione del trasportatore di posta:', error);
    } else {
        // console.log('Trasportatore verificato con successo');
    }
});

const getTemplate = async (templateName) => {
    const filePath = path.join(__dirname, 'emailTemplates', `${templateName}.html`);
    const source = await fs.promises.readFile(filePath, 'utf-8');
    return handlebars.compile(source);
};

const sendEmail = async (to, subject, templateName, templateData) => {
    try {
        const template = await getTemplate(templateName);
        const htmlContent = template(templateData);

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: to,
            subject: subject,
            html: htmlContent
        };

        debug('Attempting to send email to %s with subject %s', to, subject);
        await transporter.sendMail(mailOptions);
        debug('Email sent successfully to %s', to);
        return { success: true, message: 'Email inviata con successo' };
    } catch (error) {
        console.error(`Errore nell\'invio dell\'email con template ${templateName}:`, error);
        debug(`Failed to send email to %s with template ${templateName}: %O`, to, error);
        return { success: false, message: 'Errore nell\'invio dell\'email', error: error.message };
    }
};

module.exports = { sendEmail };