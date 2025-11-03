document.addEventListener('DOMContentLoaded', async () => {
    const eventNameSpan = document.getElementById('eventName');
    const messagesDiv = document.getElementById('messages');
    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    let currentUserId = null; // Variabile per memorizzare l'ID dell'utente
    let isUserBlocked = false; // Variabile per memorizzare lo stato di blocco dell'utente
    let currentRoom = null; // Nuova variabile per tracciare la stanza dell'evento corrente
    let socket = null; // Socket inizializzato successivamente

    // Funzione per recuperare l'ID dell'utente corrente e lo stato di blocco
    async function fetchUserData() {
        try {
            const response = await fetch('/api/user');
            if (response.ok) {
                const userData = await response.json();
                currentUserId = userData.id;
                isUserBlocked = userData.is_blocked; // Assumi che l'API restituisca is_blocked
                if (isUserBlocked) {
                    messageInput.disabled = true;
                    sendMessageBtn.disabled = true;
                    messageInput.placeholder = 'Non puoi inviare messaggi perché sei bloccato.';
                }
            } else {
                console.error('Errore nel recupero dei dati utente:', response.statusText);
            }
        } catch (error) {
            console.error('Errore nel recupero dei dati utente:', error);
        }
    }

    // Chiama la funzione per recuperare i dati utente all'avvio
    await fetchUserData();

    // Ottiene i parametri dall'URL
    function getUrlParameter(name) {
        name = name.replace(/[[\]]/g, '\$&');
        var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
        var results = regex.exec(window.location.href);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, ' '));
    }

    const eventId = getUrlParameter('eventId');

    // Inizializza socket solo se c'è un eventId valido
    if (eventId) {
        socket = io(); // Inizializza Socket.IO

        // Chiamata API per ottenere i dettagli dell'evento, incluso il nome
        try {
            const eventResponse = await fetch(`/api/events/${eventId}`);
            if (eventResponse.ok) {
                const eventData = await eventResponse.json();
                if (eventNameSpan) { // Controlla che l'elemento esista
                    eventNameSpan.textContent = eventData.name; // Aggiorna il nome dell'evento
                } else {
                    console.error('Elemento con id "eventName" non trovato nel DOM');
                }
            } else {
                console.error('Errore nel recupero dei dettagli dell\'evento:', response.statusText);
                if (eventNameSpan) {
                    eventNameSpan.textContent = `Evento non trovato (ID: ${eventId})`;
                }
            }
        } catch (error) {
            console.error('Errore nel recupero dei dettagli dell\'evento:', error);
            if (eventNameSpan) {
                eventNameSpan.textContent = `Errore nel caricamento dell'evento (ID: ${eventId})`;
            }
        }

        // Funzione per cambiare stanza dell'evento
        async function changeEventRoom(newEventId) {
            if (socket && currentRoom) {
                // Lascia la stanza precedente
                socket.emit('leaveEvent', currentRoom);
            }
            currentRoom = newEventId;
            // Unisciti alla nuova stanza
            socket.emit('joinEvent', currentRoom);
            // Carica i messaggi dell'evento corrente
            loadMessages(currentRoom);
        }

        // Cambia stanza con l'eventId corrente
        await changeEventRoom(eventId);
    } else {
        if (eventNameSpan) {
            eventNameSpan.textContent = 'Nessun Evento Selezionato';
        }
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
        if (messageText && currentUserId && !isUserBlocked && socket && currentRoom) {
            socket.emit('chatMessage', { eventId: currentRoom, userId: currentUserId, message: messageText });
            messageInput.value = '';
        } else if (isUserBlocked) {
            alert('Non puoi inviare messaggi perché sei bloccato.');
        } else if (!currentUserId) {
            console.error('Impossibile inviare il messaggio: ID utente non disponibile.');
            alert('Devi essere loggato per inviare messaggi.');
        } else if (!socket || !currentRoom) {
            console.error('Impossibile inviare il messaggio: connessione socket non valida o evento non selezionato.');
            alert('Nessuna connessione alla chat disponibile.');
        }
    });

    // Gestisci i messaggi in arrivo
    if (socket) {
        socket.on('message', (data) => {
            displayMessage(data.userName, data.message_text);
        });
    }

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessageBtn.click();
        }
    });

    // Pulisci la connessione socket quando la pagina viene chiusa
    window.addEventListener('beforeunload', () => {
        if (socket && currentRoom) {
            socket.emit('leaveEvent', currentRoom);
            socket.disconnect();
        }
    });
});