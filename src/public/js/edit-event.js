document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');
    const editEventForm = document.getElementById('editEventForm');
    const messageDiv = document.getElementById('message');

    if (!eventId) {
        messageDiv.className = 'message error';
        messageDiv.textContent = 'ID evento non fornito.';
        return;
    }

    async function fetchEventDetails() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                window.location.href = '/login.html';
                return;
            }

            const response = await fetch(`/api/events/${eventId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Errore nel recupero dei dettagli dell\'evento');
            }

            const event = await response.json();
            populateForm(event);
        } catch (error) {
            console.error('Errore nel recupero dei dettagli dell\'evento:', error);
            messageDiv.className = 'message error';
            messageDiv.textContent = `Errore: ${error.message}`;
        }
    }

    function populateForm(event) {
        document.getElementById('title').value = event.title;
        document.getElementById('description').value = event.description;
        document.getElementById('eventDate').value = event.event_date.split('T')[0]; // Formatta la data
        document.getElementById('eventTime').value = event.event_time;
        document.getElementById('capacity').value = event.capacity;
        document.getElementById('image_url_existing').value = event.image_url || ''; // Usa il campo nascosto per l'URL esistente
        document.getElementById('pdf_url_existing').value = event.pdf_url || ''; // Usa il campo nascosto per l'URL esistente
        // Non popolare il campo file input per l'immagine o il PDF per evitare problemi di sicurezza e UX
        document.getElementById('address').value = event.address;
        document.getElementById('location').value = event.location;
        document.getElementById('category').value = event.category || '';
    }

    editEventForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData();
        formData.append('title', document.getElementById('title').value);
        formData.append('description', document.getElementById('description').value);
        formData.append('event_date', document.getElementById('eventDate').value);
        formData.append('event_time', document.getElementById('eventTime').value);
        formData.append('capacity', document.getElementById('capacity').value);
        formData.append('address', document.getElementById('address').value);
        formData.append('location', document.getElementById('location').value);
        formData.append('category', document.getElementById('category').value);

        // Gestione dell'immagine
        const imageFile = document.getElementById('image_file').files[0];
        if (imageFile) {
            formData.append('image_file', imageFile);
        } else {
            // Se non viene caricata una nuova immagine, invia l'URL esistente
            formData.append('image_url_existing', document.getElementById('image_url_existing').value);
        }

        // Gestione del PDF
        const pdfFile = document.getElementById('pdf_file').files[0];
        if (pdfFile) {
            formData.append('pdf_file', pdfFile);
        } else {
            // Se non viene caricato un nuovo PDF, invia l'URL esistente
            formData.append('pdf_url_existing', document.getElementById('pdf_url_existing').value);
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/events/${eventId}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (response.ok) {
                messageDiv.className = 'message success';
                messageDiv.textContent = 'Evento aggiornato con successo! In attesa di ri-approvazione.';
                // Reindirizza l'utente alla pagina degli eventi creati dopo un breve ritardo
                setTimeout(() => {
                    window.location.href = '/my-created-events.html';
                }, 3000);
            } else {
                const errorData = await response.json();
                messageDiv.className = 'message error';
                messageDiv.textContent = errorData.message || 'Errore durante l\'aggiornamento dell\'evento.';
            }
        } catch (error) {
            console.error('Errore durante l\'aggiornamento dell\'evento:', error);
            messageDiv.className = 'message error';
            messageDiv.textContent = 'Si è verificato un errore durante l\'aggiornamento dell\'evento.';
        }
    });

    fetchEventDetails();
});