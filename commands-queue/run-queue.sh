#!/bin/bash

# Explicitly set the PORT for the Commands Queue
export PORT="3000"

# Run the Commands Queue server
node commands-queue.js
