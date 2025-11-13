const nodemailer = require('nodemailer');
const debug = require('debug')('eventhub:email');
const fs = require('fs');
const handlebars = require('handlebars');
const path = require('path');

// Configurazione del trasportatore email
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // use TLS
  requireTLS: true,
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

const sendEmail = async (to, subject, htmlContent, templateName = null, templateData = {}) => {
    try {
        let finalHtmlContent = htmlContent;

        if (templateName) {
            const template = await getTemplate(templateName);
            finalHtmlContent = template(templateData);
        }

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: to,
            subject: subject,
            html: finalHtmlContent
        };

        debug('Attempting to send email to %s with subject %s', to, subject);
        await transporter.sendMail(mailOptions);
        debug('Email sent successfully to %s', to);
        return { success: true, message: 'Email inviata con successo' };
    } catch (error) {
        console.error(`Errore nell\'invio dell\'email:`, error);
        debug(`Failed to send email to %s with subject %s: %O`, to, subject, error);
        return { success: false, message: 'Errore nell\'invio dell\'email', error: error.message };
    }
};

module.exports = { sendEmail };

// La funzione getAllUserEmails non è più necessaria qui, in quanto non è utilizzata in emailService.js
// e la sua implementazione precedente era incompleta (mancava 'pool').
// Se fosse necessaria, andrebbe implementata in un modulo separato o nel controller appropriato.

    async function getAllUserEmails() {
        try {
            const result = await pool.query('SELECT email FROM users');
            const emails = result.rows.map(row => row.email);
            console.log('Email recuperate dal database:', emails);
            return emails;
        } catch (error) {
            console.error('Errore nel recupero di tutti gli indirizzi email degli utenti:', error);
            return [];
        }
    }