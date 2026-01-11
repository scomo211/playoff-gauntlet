#!/bin/bash
# Run this in terminal to update scores every minute during games
# Press Ctrl+C to stop

echo "Starting live score updates... (Ctrl+C to stop)"
while true; do
    echo ""
    echo "=== $(date +'%H:%M:%S') - Updating scores ==="
    curl -s "https://playoffgauntlet.com/api/update-scores" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"Updated {d.get('playersUpdated',0)} players, {d.get('lineupsUpdated',0)} lineups\")"
    sleep 60
done
