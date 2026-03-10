#!/bin/bash

# Explicitly tell the webapp where the Commands Queue API is running.
# When running locally on different ports, this points to the queue server.
# When deploying to different machines, change this to the public IP/URL of the Queue server.
export COMMANDS_QUEUE_URL="http://localhost:3000"

# Serve the webapp statically on port 8080 using python's built-in server
# This is completely independent of the Node.js API server
echo "Starting standalone WebApp on http://localhost:8080"
python3 -m http.server 8080
