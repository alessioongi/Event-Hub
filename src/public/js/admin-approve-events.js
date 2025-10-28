document.addEventListener('DOMContentLoaded', async () => {
    const pendingEvents = document.getElementById('pendingEvents');

    async function loadPendingEvents() {
        try {
            const response = await fetch('/api/events/pending', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const events = await response.json();
            const pendingEventsContainer = document.getElementById('pendingEvents');
            pendingEventsContainer.innerHTML = ''; // Clear previous events

            console.log('Fetched events:', events); // Log the fetched events

            if (events.length === 0) {
                pendingEventsContainer.innerHTML = '<p>Nessun evento in attesa di approvazione.</p>';
                return;
            }

            events.forEach(event => {
                const eventCard = document.createElement('div');
                eventCard.className = 'card';
                eventCard.innerHTML = `
                    <h2>${event.title}</h2>
                    <p>${event.description}</p>
                    <p><strong>Data:</strong> ${new Date(event.event_date).toLocaleDateString()}</p>
                    <p><strong>Stato:</strong> <span class="status-${event.status}">${event.status}</span></p>
                    <button class="approve-btn">Approva</button>
                    <button class="reject-btn">Rifiuta</button>
                `;
                eventCard.querySelector('.approve-btn').addEventListener('click', () => updateEventStatus(event.id, 'approved'));
                eventCard.querySelector('.reject-btn').addEventListener('click', () => updateEventStatus(event.id, 'rejected'));

                pendingEventsContainer.appendChild(eventCard);
                console.log('Appended event card for:', event.title);
            });
        } catch (error) {
            console.error('Errore nel caricamento degli eventi in sospeso:', error); // Log any errors during fetch
        }
    }

    async function updateEventStatus(eventId, status) {
        console.log(`Attempting to update event ${eventId} with status ${status}`);
        let action = status === 'approved' ? 'approve' : 'reject';
        try {
            const response = await fetch(`/api/events/${eventId}/${action}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });
    
            console.log('Response from server:', response);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            console.log(`Event ${eventId} ${status} successfully.`);
            loadPendingEvents(); // Ricarica gli eventi dopo l'aggiornamento
        } catch (error) {
            console.error(`Error updating event ${eventId} status to ${status}:`, error);
        }
    }

    loadPendingEvents();
});