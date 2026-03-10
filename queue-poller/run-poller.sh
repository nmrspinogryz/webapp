#!/bin/bash

# Explicitly set the URL of the commands queue
export COMMANDS_QUEUE_URL="http://localhost:3000"

# Run the OpenClaw queue poller
node openclaw-queue-poller.js
