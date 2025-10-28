const db = require('../db/config');

const checkRole = (roles) => {
    return async (req, res, next) => {
        try {
            const userId = req.user?.id; // Use req.user.id from the protect middleware
            if (!userId) {
                return res.status(401).json({ message: 'Non autorizzato' });
            }

            const result = await db.query('SELECT role FROM users WHERE id = $1', [userId]);
            if (result.rows.length === 0) {
                return res.status(401).json({ message: 'Utente non trovato' });
            }

            const userRole = result.rows[0].role;
            if (!roles.includes(userRole)) {
                return res.status(403).json({ message: 'Accesso negato' });
            }

            next();
        } catch (error) {
            console.error('Errore nella verifica del ruolo:', error);
            res.status(500).json({ message: 'Errore del server' });
        }
    };
};

module.exports = checkRole;