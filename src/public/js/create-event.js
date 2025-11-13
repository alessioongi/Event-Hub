document.addEventListener('DOMContentLoaded', () => {
    const createEventForm = document.getElementById('createEventForm');
    const messageElement = document.getElementById('message');

    createEventForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitButton = createEventForm.querySelector('button[type="submit"]');
        submitButton.disabled = true; // Disabilita il pulsante per prevenire doppi click

        const formData = new FormData();
        formData.append('title', document.getElementById('title').value);
        formData.append('description', document.getElementById('description').value);
        const eventDate = document.getElementById('eventDate').value;
        const eventTime = document.getElementById('eventTime').value;
        formData.append('event_date', eventDate);
        formData.append('event_time', eventTime);
        formData.append('capacity', document.getElementById('capacity').value);
        formData.append('address', document.getElementById('address').value);
        formData.append('location', document.getElementById('location').value);
        formData.append('category', document.getElementById('category').value);

        const imageUrl = document.getElementById('image_url').value;
        const pdfFile = document.getElementById('pdf_file').files[0];

        if (imageUrl) {
            formData.append('image_url', imageUrl);
        }

        if (pdfFile) {
            formData.append('pdf_file', pdfFile);
        }

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                messageElement.textContent = 'You must be logged in to create an event.';
                messageElement.className = 'message error';
                return;
            }


            const response = await fetch('/api/events', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
            });

            const data = await response.json();

            if (response.ok) {
                messageElement.textContent = data.message || 'Event created successfully!';
                messageElement.className = 'message success';
                createEventForm.reset();
            } else {
                messageElement.textContent = data.message || 'Failed to create event.';
                messageElement.className = 'message error';
            }
        } catch (error) {
            console.error('Error creating event:', error);
            messageElement.textContent = 'An error occurred. Please try again.';
            messageElement.className = 'message error';
        } finally {
            submitButton.disabled = false; // Riabilita il pulsante
        }
    });
});