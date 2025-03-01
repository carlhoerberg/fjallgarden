
#!/usr/bin/env bash
#
# upload_shelly_script.sh
#
# This script uploads a single JavaScript file to a Shelly device (Gen2) using "Script.PutCode".
# It stops the script if running, updates the code, and restarts if it was running.
#
# Directory Structure Example:
#   shelly-script-backup/192.168.1.10/0_myScript.js
# Usage Example:
#   ./upload_shelly_script.sh ./shelly-script-backup/192.168.1.10/0_myScript.js
#

# Ensure exactly one argument was passed
if [ $# -ne 1 ]; then
  echo "Usage: $0 /path/to/<DEVICE_IP>/<SCRIPT_ID>_<NAME>.js"
  exit 1
fi

SCRIPT_PATH="$1"

# Verify the file exists
if [ ! -f "$SCRIPT_PATH" ]; then
  echo "Error: File '$SCRIPT_PATH' not found."
  exit 1
fi

# Extract Shelly IP from the parent directory name
# e.g., if SCRIPT_PATH = .../192.168.1.10/0_myScript.js
device_dir=$(dirname "$SCRIPT_PATH")
shelly_ip=$(basename "$device_dir")

# Extract script ID from the filename (before the first underscore)
# e.g. "0_myScript.js" -> script_id=0
filename=$(basename "$SCRIPT_PATH")
script_id=$(echo "$filename" | cut -d'_' -f1)

echo "Detected Shelly IP: $shelly_ip"
echo "Detected Script ID: $script_id"
echo "Script file path  : $SCRIPT_PATH"
echo "--------------------------------------------------"

# 1) Check if script is currently running (Script.GetStatus)
#    We parse .result.running (true/false)
is_running=$(curl -s \
  -X POST \
  -H "Content-Type: application/json" \
  --data "$(jq -n --argjson scriptId "$script_id" '
    {
      "id": 1,
      "method": "Script.GetStatus",
      "params": {
        "id": $scriptId
      }
    }
  ')" \
  "http://${shelly_ip}/rpc" | jq -r '.result.running')

if [ "$is_running" = "true" ]; then
  echo "Script ID=$script_id is currently running; stopping it..."
  curl -s \
    -X POST \
    -H "Content-Type: application/json" \
    --data "$(jq -n --argjson scriptId "$script_id" '
      {
        "id": 1,
        "method": "Script.Stop",
        "params": {
          "id": $scriptId
        }
      }
    ')" \
    "http://${shelly_ip}/rpc" >/dev/null
else
  echo "Script ID=$script_id is NOT running; no need to stop."
fi

# 2) Read the local script file content (no manual escaping)
script_code="$(cat "$SCRIPT_PATH")"

# 3) Generate JSON payload for "Script.PutCode" using jq
json_payload="$(jq -n \
  --arg code "$script_code" \
  --argjson scriptId "$script_id" '
  {
    "id": 1,
    "method": "Script.PutCode",
    "params": {
      "id": $scriptId,
      "code": $code
    }
  }
')"

echo "Uploading new code to Shelly device @ $shelly_ip ..."

# 4) Perform the upload (PutCode)
response="$(curl -s \
  -X POST \
  -H "Content-Type: application/json" \
  --data "${json_payload}" \
  "http://${shelly_ip}/rpc")"

# Check for errors in the response
if echo "$response" | jq -e '.error' >/dev/null 2>&1; then
  echo "Error response from device:"
  echo "$response"
  exit 1
else
  echo "Successfully uploaded new code for Script ID=$script_id"
fi

# 5) Restart the script if it was running before
if [ "$is_running" = "true" ]; then
  echo "Script was running before; starting it again..."
  curl -s \
    -X POST \
    -H "Content-Type: application/json" \
    --data "$(jq -n --argjson scriptId "$script_id" '
      {
        "id": 1,
        "method": "Script.Start",
        "params": {
          "id": $scriptId
        }
      }
    ')" \
    "http://${shelly_ip}/rpc" >/dev/null
else
  echo "Script was not running before; leaving it stopped."
fi

echo "Done."

