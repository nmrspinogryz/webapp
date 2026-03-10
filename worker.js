const { execFile } = require('child_process');

// Determine the URL of the SyncServer
const SYNC_SERVER_URL = process.env.SYNC_URL || 'http://localhost:3000';
const POLL_INTERVAL_MS = 2000;

console.log(`Starting OpenClaw Worker Daemon...`);
console.log(`Configured to poll SyncServer at: ${SYNC_SERVER_URL}`);

async function pollForCommands() {
    try {
        const res = await fetch(`${SYNC_SERVER_URL}/worker/poll`);

        if (!res.ok) {
            console.error(`[Worker] Failed polling server. Status: ${res.status}`);
            return scheduleNextPoll();
        }

        const data = await res.json();

        // If data is null, the queue is empty
        if (!data) {
            return scheduleNextPoll();
        }

        const { id, command } = data;
        console.log(`\n[Worker] Picked up Command [${id}]: "${command}"`);

        // Execute the command
        executeOpenClawCommand(id, command);

        // Immediately poll again in case there are more in the queue
        // (Don't wait for execution to finish before pulling the next rule, though we process sequentially here)
        // Wait! Since execFile is async and we want to process one by one simply, 
        // we'll wait until execution finishes before polling again. You can parallelize this if needed.

    } catch (e) {
        console.error(`[Worker] Polling error (Server offline?):`, e.message);
        scheduleNextPoll();
    }
}

function executeOpenClawCommand(id, command) {
    console.log(`[Worker] Executing engine CLI for [${id}]...`);

    execFile('openclaw', ['agent', '--agent', 'main', '--message', command, '--json'], { maxBuffer: 1024 * 1024 * 10 }, async (error, stdout, stderr) => {

        let resultPayload = {
            id,
            response: "Done.",
            raw: null,
            error: null
        };

        if (error) {
            console.error(`[Worker] CLI Execution Failed:`, error.message);
            resultPayload.error = error.message;
            resultPayload.raw = stdout || stderr;
        } else {
            try {
                // Find and parse JSON output
                const firstBraceIdx = stdout.indexOf('{');
                if (firstBraceIdx === -1) {
                    throw new Error("No JSON found in OpenClaw output");
                }

                const jsonStr = stdout.substring(firstBraceIdx);
                const resultData = JSON.parse(jsonStr);

                resultPayload.raw = resultData;

                if (resultData && resultData.messages && resultData.messages.length > 0) {
                    const lastMsg = resultData.messages[resultData.messages.length - 1];
                    if (lastMsg && lastMsg.text) {
                        resultPayload.response = lastMsg.text;
                    }
                }

            } catch (parseError) {
                console.error(`[Worker] Output Parse Error:`, parseError.message);
                resultPayload.error = 'Failed to parse JSON engine output.';
                resultPayload.raw = stdout;
            }
        }

        // Return result to SyncServer
        submitResult(resultPayload);
    });
}

async function submitResult(payload) {
    try {
        console.log(`[Worker] Submitting result for [${payload.id}] back to SyncServer...`);
        const res = await fetch(`${SYNC_SERVER_URL}/worker/result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            console.error(`[Worker] Failed to submit result. Status: ${res.status}`);
        } else {
            console.log(`[Worker] Successfully returned result for [${payload.id}]`);
        }
    } catch (e) {
        console.error(`[Worker] Failed to connect to SyncServer to submit result:`, e.message);
    } finally {
        // Resume polling
        scheduleNextPoll();
    }
}

function scheduleNextPoll() {
    setTimeout(pollForCommands, POLL_INTERVAL_MS);
}

// Start the loop
scheduleNextPoll();
