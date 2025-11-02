document.addEventListener('DOMContentLoaded', async () => {
    const myCreatedEventsDiv = document.getElementById('myCreatedEvents');

    async function loadMyCreatedEvents() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                myCreatedEventsDiv.innerHTML = '<p>Devi essere loggato per vedere i tuoi eventi creati.</p>';
                return;
            }

            const response = await fetch('/api/events/my-created', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const events = await response.json();

            if (events.length === 0) {
                myCreatedEventsDiv.innerHTML = '<p>Non hai ancora creato nessun evento.</p>';
                return;
            }

            myCreatedEventsDiv.innerHTML = events.map(event => `
                <div class='card'>
                    <h2>${event.title}</h2>
                    <p>${event.description}</p>
                    <p>Data: ${new Date(event.event_date).toLocaleDateString()} Ora: ${event.event_time}</p>
                    <p>Stato: <strong class="status-${event.status}">${event.status}</strong></p>
                    <button class="button logout-btn" onclick="handleEditEvent('${event.id}')">Modifica</button>
                    <button class="button logout-btn" onclick="handleDeleteEvent('${event.id}')">Elimina</button>
                </div>
            `).join('');

        } catch (error) {
            console.error('Errore nel caricamento degli eventi creati:', error);
            myCreatedEventsDiv.innerHTML = '<p>Errore nel caricamento degli eventi.</p>';
        }
    }

    loadMyCreatedEvents();

    window.handleEditEvent = (eventId) => {
        window.location.href = `/edit-event.html?id=${eventId}`;
    };

    window.handleDeleteEvent = async (eventId) => {
        console.log('Tentativo di eliminare l\'evento con ID:', eventId);
        if (!confirm('Sei sicuro di voler eliminare questo evento?')) {
            console.log('Eliminazione annullata dall\'utente.');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('Token non trovato. L\'utente non è autenticato.');
                alert('Devi essere loggato per eliminare un evento.');
                return;
            }
            console.log('Token trovato, invio richiesta DELETE per l\'evento:', eventId);
            const response = await fetch(`/api/events/${eventId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                console.log('Evento eliminato con successo:', eventId);
                alert('Evento eliminato con successo!');
                loadMyCreatedEvents(); // Ricarica gli eventi dopo l\'eliminazione
            } else {
                const errorData = await response.json();
                console.error('Errore durante l\'eliminazione dell\'evento:', errorData);
                alert(`Errore durante l\'eliminazione dell\'evento: ${errorData.message}`);
            }
        } catch (error) {
            console.error("Errore durante l\'eliminazione dell\'evento (catch block):", error);
            alert("Si è verificato un errore durante l\'eliminazione dell\'evento.");
        }
    };
});