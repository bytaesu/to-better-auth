# Monitor migration progress in real-time

INTERVAL=${1:-5}

echo "Migration Status Monitor"
echo "========================"
echo "Refresh interval: ${INTERVAL}s (Ctrl+C to exit)"
echo ""

while true; do
  clear
  echo "Migration Status Monitor - $(date '+%Y-%m-%d %H:%M:%S')"
  echo "=============================================="
  echo ""
  
  STATUS=$(curl -s http://localhost:7777/supabase/status)
  
  if [ $? -ne 0 ]; then
    echo "ERROR: Failed to connect to server"
    echo "  Make sure the server is running: pnpm dev"
    sleep $INTERVAL
    continue
  fi
  
  # Parse JSON
  STATE=$(echo "$STATUS" | jq -r '.status')
  PROGRESS=$(echo "$STATUS" | jq -r '.progress')
  ETA=$(echo "$STATUS" | jq -r '.eta // "calculating..."')
  
  TOTAL=$(echo "$STATUS" | jq -r '.stats.total')
  PROCESSED=$(echo "$STATUS" | jq -r '.stats.processed')
  SUCCESS=$(echo "$STATUS" | jq -r '.stats.success')
  FAILURE=$(echo "$STATUS" | jq -r '.stats.failure')
  SKIP=$(echo "$STATUS" | jq -r '.stats.skip')
  
  CURRENT_BATCH=$(echo "$STATUS" | jq -r '.batches.current')
  TOTAL_BATCHES=$(echo "$STATUS" | jq -r '.batches.total')
  
  STARTED_AT=$(echo "$STATUS" | jq -r '.timing.startedAt')
  COMPLETED_AT=$(echo "$STATUS" | jq -r '.timing.completedAt')
  
  # Status indicator
  case $STATE in
    "idle")
      STATUS_MARK="[IDLE]"
      ;;
    "running")
      STATUS_MARK="[RUNNING]"
      ;;
    "completed")
      STATUS_MARK="[DONE]"
      ;;
    "failed")
      STATUS_MARK="[FAILED]"
      ;;
    *)
      STATUS_MARK="[UNKNOWN]"
      ;;
  esac
  
  # Display
  echo "$STATUS_MARK Status: $STATE"
  echo "Progress: $PROGRESS"
  echo "ETA: $ETA"
  echo ""
  echo "Batches: $CURRENT_BATCH / $TOTAL_BATCHES"
  echo ""
  echo "Statistics:"
  echo "  Total:     $(printf "%'10d" $TOTAL)"
  echo "  Processed: $(printf "%'10d" $PROCESSED)"
  echo "  Success:   $(printf "%'10d" $SUCCESS)"
  echo "  Skip:      $(printf "%'10d" $SKIP)"
  echo "  Failure:   $(printf "%'10d" $FAILURE)"
  echo ""
  
  if [ "$STARTED_AT" != "null" ]; then
    echo "Started: $STARTED_AT"
  fi
  
  if [ "$COMPLETED_AT" != "null" ]; then
    echo "Completed: $COMPLETED_AT"
  fi
  
  # Show errors if any
  ERROR_COUNT=$(echo "$STATUS" | jq '.errors | length')
  if [ "$ERROR_COUNT" -gt 0 ]; then
    echo ""
    echo "Recent Errors (showing first 5):"
    echo "$STATUS" | jq -r '.errors[:5][] | "  - User \(.userId): \(.error)"'
  fi
  
  # Exit if completed or failed
  if [ "$STATE" = "completed" ] || [ "$STATE" = "failed" ]; then
    echo ""
    echo "=============================================="
    echo "Migration $STATE"
    break
  fi
  
  sleep $INTERVAL
done
