#!/usr/bin/env bash
#
# backup_shelly_scripts.sh
#
# This script takes multiple Shelly device IPs as arguments,
# and for each IP, it lists all available scripts and downloads
# their JS code for backup. Each device’s scripts are stored in
# a subdirectory named after the device IP.
#
# Usage:
#   ./backup_shelly_scripts.sh <SHELLY_IP_1> [<SHELLY_IP_2> ... <SHELLY_IP_N>]
#
# Example:
#   ./backup_shelly_scripts.sh 192.168.1.10 192.168.1.11
#

# ------------- Configuration -------------
OUTPUT_DIR="./shelly-scripts"  # Base directory for backups
# ----------------------------------------

# Ensure at least one IP argument is provided
if [ $# -lt 1 ]; then
  echo "Usage: $0 <SHELLY_IP_1> [<SHELLY_IP_2> ... <SHELLY_IP_N>]"
  echo "Example: $0 192.168.1.10 192.168.1.11"
  exit 1
fi

# Create base output directory if it doesn't exist
mkdir -p "${OUTPUT_DIR}"

# Function to back up scripts from a single Shelly device
backup_shelly_scripts() {
  local SHELLY_IP="$1"
  echo "--------------------------------------------------"
  echo "Backing up scripts for Shelly @ ${SHELLY_IP}..."

  # Create a subdirectory for this device's scripts
  local DEVICE_DIR="${OUTPUT_DIR}/${SHELLY_IP}"
  mkdir -p "${DEVICE_DIR}"

  # Fetch the list of scripts (declare + assign in one line)
  local scripts_json=$(curl -s "http://${SHELLY_IP}/rpc/Script.List")
  if [ -z "${scripts_json}" ] || [[ "${scripts_json}" == *"error"* ]]; then
    echo "  Error: Could not fetch script list from ${SHELLY_IP}. Response was:"
    echo "  ${scripts_json}"
    return 1
  fi

  # Parse the number of scripts (declare + assign in one line)
  local script_count=$(echo "${scripts_json}" | jq '.scripts | length')
  echo "  Found ${script_count} script(s) on ${SHELLY_IP}."

  if [ "${script_count}" -eq 0 ]; then
    echo "  No scripts to download for ${SHELLY_IP}."
    return 0
  fi

  # Iterate through each script, using 'jq' to parse JSON
  echo "${scripts_json}" | jq -c '.scripts[]' | while read -r script_info; do
    local script_id=$(echo "${script_info}" | jq -r '.id')
    local script_name=$(echo "${script_info}" | jq -r '.name')
    local safe_name=$(echo "${script_name}" | tr ' ' '_')

    # Get the script code directly from the "code" field
    local script_code=$(curl -s "http://${SHELLY_IP}/rpc/Script.GetCode?id=${script_id}" | jq -r '.data')

    local filename="${DEVICE_DIR}/${script_id}_${safe_name}.js"
    echo "${script_code}" > "${filename}"

    echo "    - Downloaded: Script ID=${script_id}, Name='${script_name}' → ${filename}"
  done

  echo "  Done backing up scripts for ${SHELLY_IP}."
}

# MAIN: Loop through all provided IPs and back up scripts
for IP in "$@"; do
  backup_shelly_scripts "${IP}"
done

echo "--------------------------------------------------"
echo "All requested backups completed."
echo "Scripts are stored under '${OUTPUT_DIR}' in subdirectories per IP address."
