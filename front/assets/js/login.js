document.addEventListener('DOMContentLoaded', () => {
    // Si ya hay una sesion activa, ir directo al gestor de clientes
    if (getToken()) {
        window.location.href = './clients.html';
        return;
    }

    const form = document.getElementById('login-form');
    const alertBox = document.getElementById('alert-box');
    const submitBtn = document.getElementById('btn-login');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideAlert(alertBox);

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        if (!email || !password) {
            showAlert(alertBox, 'Ingresa tu email y tu contrasena');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Ingresando...';

        try {
            const data = await apiFetch('/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            saveSession(data.token, data.user);
            window.location.href = './clients.html';
        } catch (error) {
            showAlert(alertBox, error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Iniciar sesion';
        }
    });
});
