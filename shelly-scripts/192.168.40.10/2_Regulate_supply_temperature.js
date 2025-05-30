// Shelly Script for Regulating Supply Temperature Based on Outdoor Temperature
//
// This script calculates a supply temperature setpoint using a simple heating curve:
//     T_sup = OFFSET + SLOPE * (T_outdoor_reference - T_outdoor)
// or a table/curve approach—whatever best fits your system.
//
// Key points:
//  - The script reads the current outdoor temperature (placeholder function).
//  - Applies a heating curve formula to compute the supply temperature.
//  - Clamps the resulting temperature to a min/max range to avoid extremes.
//  - Sends the new setpoint to the heating system.
//  - Runs whenever outdoor temperature changes.
//
// Adjust the constants, placeholder code, and the regulation interval for your setup.

// --- Constants and Configuration ---
const HEATING_SLOPE  = 1.1;      // Slope of the heating curve
const OFFSET         = 40.0;     // Base offset (°C)
const OUT_REF        = 5.0;      // Outdoor reference temperature (°C)
const MIN_SUPPLY     = 20.0;     // Minimum allowed supply temperature (°C)
const MAX_SUPPLY     = 60.0;     // Maximum allowed supply temperature (°C)

function getOutdoorTemperature() {
  return Shelly.getComponentStatus("temperature:101").tC;
}

function updateSupplyTemperature(T_supply) {
  let targetIP = "192.168.40.12";  
  // Construct the URL for updating the virtual component.
  // The endpoint, query parameters, and method depend on how your target device is configured.
  let url = "http://" + targetIP + "/rpc/Number.Set?id=200&value=" + T_supply.toFixed(1);
  
  Shelly.call("HTTP.GET", { url: url }, function(res, error_code, error_message) {
    if (error_code !== 0) {
      print("Error updating virtual supply temperature: " + error_message);
    } else {
      print("Virtual supply temperature updated to " + T_supply.toFixed(1) + "°C on device " + targetIP);
    }
  });
}

// --- Regulation Function ---
function regulateSupplyTemperature(T_outdoor) {
  print("Outdoor Temperature: " + T_outdoor + "°C")

  // Example of a simple linear heating curve:
  //   T_supply = OFFSET + SLOPE * (OUT_REF - T_outdoor)
  // Adjust or replace with a more advanced “curve” as needed.
  let T_supply = OFFSET + HEATING_SLOPE * (OUT_REF - T_outdoor);
  
  // Clamp to min/max values
  T_supply = Math.max(MIN_SUPPLY, Math.min(MAX_SUPPLY, T_supply));
  
  // Update the virtual component on the other Shelly device with the new supply temperature.
  updateSupplyTemperature(T_supply);
}

// Called on each Shelly event (avoid anonymous methods in shelly script)
function onEvent(event) {
  if (event.component === "temperature:101") {
    const T_outdoor = event.info.tC
    regulateSupplyTemperature(T_outdoor)
  }
}

regulateSupplyTemperature(getOutdoorTemperature())
Shelly.addEventHandler(onEvent)
