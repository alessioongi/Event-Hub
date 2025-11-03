require('dotenv').config();

const dotenv = require('dotenv');
const envConfig = dotenv.config();
const { pool } = require('./db/config');
const queries = require('./db/queries');
const { insertChatMessage } = require('./db/queries');

console.log('Value of pool after import:', pool);

if (envConfig.error) {
  console.error('Error loading .env file:', envConfig.error);
}

// Connessione al database
pool.connect()
.then(() => console.log('Connesso al database PostgreSQL'))
.catch(err => console.error('Errore di connessione al database', err));

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const http = require('http');
const { Server } = require('socket.io');
const authRoutes = require('./routes/auth.routes');
const eventRoutes = require('./routes/event.routes');
const { protect } = require('./middleware/auth.middleware');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Consenti tutte le origini per lo sviluppo
        methods: ["GET", "POST"]
    }
});
const port = process.env.PORT || 3000;

// Middleware per il parsing del body delle richieste
app.use(express.json());

// Middleware per il logging delle richieste
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
});

// Configurazione della sessione
app.use(session({
    secret: process.env.SESSION_SECRET || 'il_tuo_segreto_super_sicuro',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Impostare su true se si usa HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 ore
    }
}));

io.on('connection', (socket) => {
    console.log('Nuova connessione Socket.IO');

    socket.on('joinEvent', (eventId) => {
        socket.join(eventId);
        console.log(`Utente ${socket.id} si è unito all'evento ${eventId}`);
    });

    socket.on('chatMessage', async ({ eventId, userId, message }) => {
        try {
            const user = await queries.findUserById(userId);
            if (!user || user.is_blocked) {
                console.warn(`Tentativo di invio messaggio da utente bloccato o inesistente: ${userId}`);
                return;
            }
            const username = user.name;
            if (!username) {
                console.error('Errore: Nome utente non trovato per userId:', userId);
                return;
            }
            const newMessage = await insertChatMessage(eventId, userId, username, message);
            const clientMessage = {
                ...newMessage,
                userName: newMessage.username // Mappa 'username' dal DB a 'userName' per il client
            };
            io.to(eventId).emit('message', clientMessage);
        } catch (error) {
            console.error('Errore durante il salvataggio del messaggio di chat:', error);
        }
    });

    socket.on('leaveEvent', (eventId) => {
        socket.leave(eventId);
        console.log(`Utente ${socket.id} ha lasciato l'evento ${eventId}`);
    });

    socket.on('disconnect', () => {
        console.log('Utente disconnesso da Socket.IO');
    });
});

// Middleware per verificare l'autenticazione
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Non autorizzato' });
    }
};

// Middleware per verificare il ruolo di admin
const isAdmin = async (req, res, next) => {
    try {
        const result = await pool.query(
            'SELECT role FROM users WHERE id = $1',
            [req.session.userId]
        );

        if (result.rows.length > 0 && result.rows[0].role === 'admin') {
            next();
        } else {
            res.status(403).json({ error: 'Accesso negato' });
        }
    } catch (error) {
        console.error('Errore nella verifica del ruolo admin:', error);
        res.status(500).json({ error: 'Errore del server' });
    }
};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Servire i file statici dalla directory 'public'
app.use('/api/auth', authRoutes);
app.use('/api', eventRoutes);

app.use(express.static('src/public'));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Proteggi la pagina pubblica
app.get('/public-page.html', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'public-page.html'));
});

// Route per la pagina degli eventi creati dall\'utente
app.get('/my-created-events', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'my-created-events.html'));
});

// Endpoint per la registrazione
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role = 'user' } = req.body;

        // Verifica se l\'utente esiste già
        const userExists = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: 'Email già registrata' });
        }

        // Hash della password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Ottieni il prossimo ID utente disponibile
        const newUserId = await queries.findLowestAvailableUserId();

        // Inserimento nuovo utente
        const result = await pool.query(
            'INSERT INTO users (id, name, email, password, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role',
            [newUserId, name, email, hashedPassword, role]
        );

        // Imposta la sessione
        req.session.userId = result.rows[0].id;
        req.session.userRole = result.rows[0].role;

        res.status(201).json({
            id: result.rows[0].id,
            name: result.rows[0].name,
            email: result.rows[0].email,
            role: result.rows[0].role
        });
    } catch (error) {
        console.error('Errore durante la registrazione:', error);
        res.status(500).json({ error: 'Errore durante la registrazione' });
    }
});



// Endpoint per il logout
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Errore durante il logout:', err);
            return res.status(500).json({ error: 'Errore durante il logout' });
        }
        res.json({ message: 'Logout effettuato con successo' });
    });
});

// Endpoint per verificare lo stato della sessione
app.get('/api/check-session', (req, res) => {
    if (req.session && req.session.userId) {
        res.json({
            isAuthenticated: true,
            userId: req.session.userId,
            userRole: req.session.userRole
        });
    } else {
        res.json({ isAuthenticated: false });
    }
});

// Endpoint per ottenere i dati dell\'utente
app.get('/api/user', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, email, role, is_blocked FROM users WHERE id = $1',
            [req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Errore nel recupero dei dati utente:', error);
        res.status(500).json({ error: 'Errore del server' });
    }
});

// Endpoint per verificare se l\'utente è admin
app.get('/api/check-admin', isAuthenticated, isAdmin, (req, res) => {
    res.json({ isAdmin: true });
});

// API per recuperare tutti gli utenti (solo per admin)
app.get('/api/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, email, role, is_blocked FROM users');
        res.json(result.rows);
    } catch (err) {
        console.error('Errore nel recupero degli utenti:', err);
        res.status(500).json({ message: 'Errore interno del server' });
    }
});

// API per eliminare un utente (solo per admin)
app.delete('/api/users/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Utente non trovato' });
        }
        res.status(200).json({ message: 'Utente eliminato con successo' });
    } catch (err) {
        console.error('Errore nell\'eliminazione dell\'utente:', err);
        res.status(500).json({ message: 'Errore interno del server' });
    }
});

// API per eliminare un utente (solo per admin)
app.delete('/api/users/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Utente non trovato' });
        }
        res.status(200).json({ message: 'Utente eliminato con successo' });
    } catch (err) {
        console.error('Errore nell\'eliminazione dell\'utente:', err);
        res.status(500).json({ message: 'Errore interno del server' });
    }
});

// API per bloccare/sbloccare un utente (solo per admin)
app.put('/api/users/:id/block', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { is_blocked } = req.body;
    try {
        const updatedUser = await queries.updateUserBlockStatus(id, is_blocked);
        if (!updatedUser) {
            return res.status(404).json({ message: 'Utente non trovato' });
        }
        res.status(200).json({ message: 'Stato di blocco utente aggiornato con successo', user: updatedUser });
    } catch (err) {
        console.error('Errore nell\'aggiornamento dello stato di blocco dell\'utente:', err);
        res.status(500).json({ message: 'Errore interno del server' });
    }
});

// API per richiedere il reset della password


// API per il reset della password
app.post('/api/reset-password', async (req, res) => {
    const { token, password } = req.body;
    try {
        // Trova il token di reset nel database
        const tokenResult = await pool.query(
            'SELECT * FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW()',
            [token]
        );

        if (tokenResult.rowCount === 0) {
            return res.status(400).json({ message: 'Token non valido o scaduto' });
        }

        const userId = tokenResult.rows[0].user_id;

        // Hash della nuova password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Aggiorna la password dell\'utente
        await pool.query(
            'UPDATE users SET password = $1 WHERE id = $2',
            [hashedPassword, userId]
        );

        // Elimina il token di reset
        await pool.query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);

        res.json({ message: 'Password resettata con successo' });
    } catch (err) {
        console.error('Errore nel reset della password:', err);
        res.status(500).json({ message: 'Errore interno del server' });
    }
});

// Middleware per la gestione degli errori
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).json({
        message: err.message || 'Errore interno del server',
        error: err.name || 'InternalServerError'
    });
});

// Avvio del server
server.listen(port, () => {
    console.log(`Server in esecuzione sulla porta ${port}`);
});