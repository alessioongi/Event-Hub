document.addEventListener('DOMContentLoaded', async () => {
    const eventNameSpan = document.getElementById('eventName');
    const messagesDiv = document.getElementById('messages');
    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');

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

    if (eventId) {
        // In un'applicazione reale, qui faresti una chiamata API per ottenere i dettagli dell'evento
        // Per ora, useremo un placeholder
        eventNameSpan.textContent = `Evento ${eventId}`;

        // Carica i messaggi esistenti (placeholder)
        loadMessages(eventId);
    } else {
        eventNameSpan.textContent = 'Nessun Evento Selezionato';
    }

    // Funzione per caricare i messaggi (placeholder)
    async function loadMessages(id) {
        // Qui andrebbe la logica per recuperare i messaggi dal backend
        // Per ora, mostriamo un messaggio di esempio
        messagesDiv.innerHTML = `<div class="message"><strong>Sistema:</strong> Benvenuto nella chat dell'evento!</div>`;
    }

    // Invia un messaggio (placeholder)
    sendMessageBtn.addEventListener('click', () => {
        const messageText = messageInput.value.trim();
        if (messageText) {
            // Qui andrebbe la logica per inviare il messaggio al backend (es. tramite WebSocket)
            // Per ora, lo aggiungiamo direttamente alla UI
            const newMessageDiv = document.createElement('div');
            newMessageDiv.classList.add('message');
            newMessageDiv.innerHTML = `<strong>Tu:</strong> ${messageText}`;
            messagesDiv.appendChild(newMessageDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight; // Scorri in basso
            messageInput.value = '';
        }
    });

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessageBtn.click();
        }
    });
});