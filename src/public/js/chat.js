document.addEventListener('DOMContentLoaded', async () => {
    const eventNameSpan = document.getElementById('eventName');
    const messagesDiv = document.getElementById('messages');
    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    let currentUserId = null; // Variabile per memorizzare l'ID dell'utente

    // Funzione per recuperare l'ID dell'utente corrente
    async function fetchUserId() {
        try {
            const response = await fetch('/api/user');
            if (response.ok) {
                const userData = await response.json();
                currentUserId = userData.id;
            } else {
                console.error('Errore nel recupero dell\'ID utente:', response.statusText);
            }
        } catch (error) {
            console.error('Errore nel recupero dell\'ID utente:', error);
        }
    }

    // Chiama la funzione per recuperare l'ID utente all'avvio
    await fetchUserId();

    // Ottiene i parametri dall'URL
    function getUrlParameter(name) {
        name = name.replace(/[[\]]/g, '\\$&');
        var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
        var results = regex.exec(window.location.href);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, ' '));
    }

    const eventId = getUrlParameter('eventId');
    const socket = io(); // Inizializza Socket.IO

    if (eventId) {
        // In un'applicazione reale, qui faresti una chiamata API per ottenere i dettagli dell'evento
        // Per ora, useremo un placeholder
        eventNameSpan.textContent = `Evento ${eventId}`;

        // Unisciti alla stanza dell'evento
        socket.emit('joinEvent', eventId);

        // Carica i messaggi esistenti
        loadMessages(eventId);
    } else {
        eventNameSpan.textContent = 'Nessun Evento Selezionato';
    }

    // Funzione per caricare i messaggi
    async function loadMessages(id) {
        try {
            const token = localStorage.getItem('token'); // Recupera il token
            const response = await fetch(`/api/chat/messages/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}` // Aggiungi il token all'intestazione
                }
            });
            if (response.ok) {
                const messages = await response.json();
                messagesDiv.innerHTML = ''; // Pulisci i messaggi placeholder
                messages.forEach(msg => {
                    displayMessage(msg.user_name, msg.message_text);
                });
            } else if (response.status === 401) {
                console.error('Non autorizzato a recuperare i messaggi della chat. Effettua il login.');
                displayMessage('Sistema', 'Non autorizzato a caricare i messaggi. Effettua il login.');
            } else {
                console.error('Errore nel recupero dei messaggi della chat:', response.statusText);
                displayMessage('Sistema', 'Errore nel caricamento dei messaggi.');
            }
        } catch (error) {
            console.error('Errore nel recupero dei messaggi della chat:', error);
            displayMessage('Sistema', 'Errore nel caricamento dei messaggi.');
        }
    }

    // Funzione per visualizzare un messaggio
    function displayMessage(sender, message) {
        const newMessageDiv = document.createElement('div');
        newMessageDiv.classList.add('message');
        newMessageDiv.innerHTML = `<strong>${sender}:</strong> ${message}`;
        messagesDiv.appendChild(newMessageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight; // Scorri in basso
    }

    // Invia un messaggio
    sendMessageBtn.addEventListener('click', () => {
        const messageText = messageInput.value.trim();
        if (messageText && currentUserId) {
            socket.emit('chatMessage', { eventId, userId: currentUserId, message: messageText });
            messageInput.value = '';
        } else if (!currentUserId) {
            console.error('Impossibile inviare il messaggio: ID utente non disponibile.');
            alert('Devi essere loggato per inviare messaggi.');
        }
    });

    // Gestisci i messaggi in arrivo
    socket.on('message', (data) => {
        displayMessage(data.userName, data.message_text);
    });

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessageBtn.click();
        }
    });
});