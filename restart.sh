#!/bin/bash
cd ~/Desktop/campaign-timeline-viewer
lsof -ti:3002 | xargs kill -9 2>/dev/null
sleep 1
rm -rf .next node_modules/.cache
npx next dev -p 3002
