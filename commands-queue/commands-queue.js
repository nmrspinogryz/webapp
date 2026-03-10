const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
    console.log(`[CommandsQueue] Received WebApp Command [${commandId}]: ${command}`);

    // Store the res object so we can reply when the worker finishes
    pendingRequests[commandId] = res;

    // Add to queue for the OpenclawQueuePoller to pick up
    commandQueue.push({ id: commandId, command });

    // Set a timeout in case the worker crashes or takes too long (60 seconds)
    setTimeout(() => {
        if (pendingRequests[commandId]) {
            console.log(`[CommandsQueue] Command [${commandId}] timed out waiting for OpenclawQueuePoller`);
            pendingRequests[commandId].status(504).json({
                error: 'Timeout waiting for OpenClaw agent response'
            });
            delete pendingRequests[commandId];
        }
    }, 60000);
});

// OpenclawQueuePoller Endpoint -> Long polling / regular polling for new commands
app.get('/openclaw-queue-poller/poll', (req, res) => {
    if (commandQueue.length > 0) {
        const nextCommand = commandQueue.shift();
        console.log(`[CommandsQueue] OpenclawQueuePoller picked up Command [${nextCommand.id}]`);
        return res.json(nextCommand);
    }

    // Empty queue
    res.json(null);
});

// OpenclawQueuePoller Endpoint -> Posts the execution result back to the CommandsQueue
app.post('/openclaw-queue-poller/result', (req, res) => {
    const { id, response, raw, error } = req.body;

    if (!id) {
        return res.status(400).json({ error: 'Command ID is required' });
    }

    console.log(`[CommandsQueue] OpenclawQueuePoller returned result for Command [${id}]`);

    const pendingRes = pendingRequests[id];
    if (pendingRes) {
        if (error) {
            pendingRes.status(500).json({ error, rawOutput: raw });
        } else {
            pendingRes.json({ status: 'ok', message: response, raw });
        }
        delete pendingRequests[id];
    } else {
        console.log(`[CommandsQueue] Command [${id}] result received, but WebApp connection was already closed/timed out.`);
    }

    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`✅ CommandsQueue is running on http://localhost:${PORT}`);
});
