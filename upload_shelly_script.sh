#!/usr/bin/env bash
#
# upload_shelly_script.sh
#
# Uploads a single JavaScript script file to the corresponding Shelly device:
#  1) Stops it first, if running.
#  2) Uploads the new code.
#  3) Restarts only if it was running prior to upload.
#
# Directory Structure (example):
#   shelly-script-backup/192.168.1.10/0_myScript.js
#
# Usage:
#   ./upload_shelly_script.sh /path/to/<DEVICE_IP>/<SCRIPT_ID>_<NAME>.js
#

# Check that exactly one argument (file path) was provided
if [ $# -ne 1 ]; then
  echo "Usage: $0 /path/to/backup_directory/<DEVICE_IP>/<SCRIPT_ID>_<NAME>.js"
  exit 1
fi

# Path to the script file
SCRIPT_PATH="$1"

# Verify that the file actually exists
if [ ! -f "$SCRIPT_PATH" ]; then
  echo "Error: File '$SCRIPT_PATH' not found."
  exit 1
fi

# Derive Shelly IP from the parent directory
# For example, if SCRIPT_PATH is ".../192.168.1.10/0_myScript.js",
# then device_dir => ".../192.168.1.10"
# shelly_ip => "192.168.1.10"
device_dir=$(dirname "$SCRIPT_PATH")
shelly_ip=$(basename "$device_dir")

# Extract script ID from the filename (everything before the first underscore)
# e.g. "0_myScript.js" => "0"
filename=$(basename "$SCRIPT_PATH")
script_id=$(echo "$filename" | cut -d'_' -f1)

# 1) Check if script is running on the device
#    We call `Script.GetStatus?id=<ID>` and parse `.running` (true/false)
is_running=$(curl -s "http://${shelly_ip}/rpc/Script.GetStatus?id=${script_id}" | jq -r '.running')

if [ "$is_running" = "true" ]; then
  echo "Script ID=${script_id} is currently running. Stopping it now..."
  curl -s "http://${shelly_ip}/rpc/Script.Stop?id=${script_id}" >/dev/null
else
  echo "Script ID=${script_id} is NOT running; no need to stop."
fi

# 2) Read the modified file and escape for JSON
# Replace newlines with \n and escape double quotes
script_code=$(sed ':a;N;$!ba;s/"/\\"/g;s/\n/\\n/g' "$SCRIPT_PATH")

# Construct JSON payload (id is integer, code is string)
json_payload="{\"id\":${script_id},\"code\":\"${script_code}\"}"

echo "--------------------------------------------------"
echo "Uploading script to Shelly device @ $shelly_ip"
echo "  Script ID: $script_id"
echo "  File: $SCRIPT_PATH"
echo "--------------------------------------------------"

# 3) Upload (SetCode) to the Shelly
response=$(curl -s -X POST \
  "http://${shelly_ip}/rpc/Script.SetCode" \
  -H "Content-Type: application/json" \
  --data "${json_payload}")

# Check for errors
if [[ "$response" == *"error"* ]]; then
  echo "Error response from device:"
  echo "$response"
  exit 1
else
  echo "Successfully uploaded script to Shelly @ $shelly_ip"
fi

# 4) Restart if it was previously running
if [ "$is_running" = "true" ]; then
  echo "Script was running before; starting it again..."
  curl -s "http://${shelly_ip}/rpc/Script.Start?id=${script_id}" >/dev/null
else
  echo "Script was not running before; leaving it stopped."
fi
