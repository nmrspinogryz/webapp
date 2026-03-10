const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory Queue and Pending Requests
const commandQueue = [];
const pendingRequests = {};

// WebApp Endpoint -> Sends command to Queue and WAITS for result
app.post('/command', (req, res) => {
    const { command } = req.body;

    if (!command) {
        return res.status(400).json({ error: 'Command is required' });
    }

    const commandId = crypto.randomUUID();
    console.log(`[SyncServer] Received WebApp Command [${commandId}]: ${command}`);

    // Store the res object so we can reply when the worker finishes
    pendingRequests[commandId] = res;

    // Add to queue for the worker to pick up
    commandQueue.push({ id: commandId, command });

    // Set a timeout in case the worker crashes or takes too long (60 seconds)
    setTimeout(() => {
        if (pendingRequests[commandId]) {
            console.log(`[SyncServer] Command [${commandId}] timed out waiting for OpenClaw Worker`);
            pendingRequests[commandId].status(504).json({
                error: 'Timeout waiting for OpenClaw agent response'
            });
            delete pendingRequests[commandId];
        }
    }, 60000);
});

// Worker Endpoint -> Long polling / regular polling for new commands
app.get('/worker/poll', (req, res) => {
    if (commandQueue.length > 0) {
        const nextCommand = commandQueue.shift();
        console.log(`[SyncServer] Worker picked up Command [${nextCommand.id}]`);
        return res.json(nextCommand);
    }

    // Empty queue
    res.json(null);
});

// Worker Endpoint -> Posts the execution result back to the SyncServer
app.post('/worker/result', (req, res) => {
    const { id, response, raw, error } = req.body;

    if (!id) {
        return res.status(400).json({ error: 'Command ID is required' });
    }

    console.log(`[SyncServer] Worker returned result for Command [${id}]`);

    const pendingRes = pendingRequests[id];
    if (pendingRes) {
        if (error) {
            pendingRes.status(500).json({ error, rawOutput: raw });
        } else {
            pendingRes.json({ status: 'ok', message: response, raw });
        }
        delete pendingRequests[id];
    } else {
        console.log(`[SyncServer] Command [${id}] result received, but WebApp connection was already closed/timed out.`);
    }

    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`✅ SyncServer is running on http://localhost:${PORT}`);
});
