-- Elimina gli indici esistenti
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_reset_token;

-- Elimina la tabella esistente
DROP TABLE IF EXISTS users CASCADE;

-- Crea la tabella users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    reset_password_token VARCHAR(255),
    reset_password_expire TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Crea gli indici
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_reset_token ON users(reset_password_token);

-- Elimina la tabella events esistente
DROP TABLE IF EXISTS events CASCADE;

-- Crea la tabella events
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    capacity INTEGER NOT NULL,
    image_url TEXT,
    pdf_url TEXT,
    address VARCHAR(255),
    location VARCHAR(255),
    category VARCHAR(100),
    organizer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Elimina la tabella event_registrations esistente
DROP TABLE IF EXISTS event_registrations CASCADE;

-- Crea la tabella event_registrations
CREATE TABLE event_registrations (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, event_id)
);