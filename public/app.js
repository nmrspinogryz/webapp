document.addEventListener('DOMContentLoaded', () => {
    // ---- CONFIGURATION ----
    // Set this strictly when deploying the WebApp to point to an external SyncServer.
    // If running from the same server, leave it as an empty string. 
    // Example: const SYNC_SERVER_URL = 'https://my-sync-server.cloud.com';
    const SYNC_SERVER_URL = window.SYNC_SERVER_URL || '';
    // -----------------------

    const form = document.getElementById('command-form');
    const input = document.getElementById('command-input');
    const responseArea = document.getElementById('response-area');
    const responseText = document.getElementById('agent-response');
    const submitBtn = document.getElementById('submit-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const command = input.value.trim();
        if (!command) return;

        // UI State: Loading
        input.disabled = true;
        submitBtn.disabled = true;

        responseArea.className = 'response-loading';
        responseText.textContent = '';

        // Remove error colors if any
        responseArea.style.borderColor = '';
        responseArea.style.background = '';
        responseText.style.color = '';

        try {
            const res = await fetch(`${SYNC_SERVER_URL}/command`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ command })
            });

            if (!res.ok) {
                throw new Error('Server returned an error');
            }

            const data = await res.json();

            // Wait a tiny bit extra to let the user see the loading animation
            // This is purely for aesthetic/UX reasons to feel responsive
            setTimeout(() => {
                // UI State: Success Update
                responseArea.className = 'response-visible';
                responseText.textContent = data.message;

                // Keep the input value so user sees what they ran
                input.value = '';
            }, 300);

        } catch (error) {
            console.error('Error sending command:', error);
            responseArea.className = 'response-visible';

            // Set error styles directly since response-visible class targets success usually
            responseArea.style.borderColor = 'rgba(251, 113, 133, 0.3)';
            responseArea.style.background = 'rgba(251, 113, 133, 0.05)';
            responseText.style.color = 'var(--error-color)';

            responseText.textContent = 'Connection error. Is the server running?';

            // Reset to default colors
            setTimeout(() => {
                responseArea.style.borderColor = '';
                responseArea.style.background = '';
                responseText.style.color = '';
            }, 4000);
        } finally {
            // Restore input after slight delay for UX
            setTimeout(() => {
                input.disabled = false;
                submitBtn.disabled = false;
                input.focus();
            }, 300);
        }
    });
});
