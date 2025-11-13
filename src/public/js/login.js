document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, password }),
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('userRole', data.user.role);
                    // Reindirizza l'utente alla pagina principale o a una dashboard
                    window.location.href = '/'; // Reindirizza alla home page
                } else {
                    alert(data.message || 'Errore durante il login');
                }
            } catch (error) {
                console.error('Errore:', error);
                alert('Si è verificato un errore durante il tentativo di accesso.');
            }
        });
    }
});


function togglePasswordVisibility(id) {
    const input = document.getElementById(id);
    const toggle = input.nextElementSibling;
    if (input.type === 'password') {
        input.type = 'text';
        toggle.textContent = '🔒'; // Change icon to locked eye
    } else {
        input.type = 'password';
        toggle.textContent = '👁️'; // Change icon to open eye
    }
}