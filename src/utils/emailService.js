const nodemailer = require('nodemailer');
const debug = require('debug')('eventhub:email');

// Configurazione del trasportatore email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  },
  debug: true,
  logger: true
});

// Test di verifica del trasportatore
transporter.verify(function (error, success) {
    if (error) {
        console.error('Errore nella configurazione del trasportatore di posta:', error);
    } else {
        // console.log('Trasportatore verificato con successo');
    }
});

const sendEmail = async (to, subject, htmlContent) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: to,
        subject: subject,
        html: htmlContent
    };

    try {
        debug('Attempting to send email to %s with subject %s', to, subject);
        await transporter.sendMail(mailOptions);
        debug('Email sent successfully to %s', to);
        return { success: true, message: 'Email inviata con successo' };
    } catch (error) {
        console.error('Errore nell\'invio dell\'email:', error);
        debug('Failed to send email to %s: %O', to, error);
        return { success: false, message: 'Errore nell\'invio dell\'email', error: error.message };
    }
};

module.exports = { sendEmail };