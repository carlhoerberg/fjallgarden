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
//  - Sends the new setpoint to the heating system (placeholder command).
//  - Runs periodically on a timer.
//
// Adjust the constants, placeholder code, and the regulation interval for your setup.

// --- Constants and Configuration ---
const HEATING_SLOPE  = 1.1;      // Slope of the heating curve
const OFFSET         = 38.0;     // Base offset (°C)
const OUT_REF        = 5.0;      // Outdoor reference temperature (°C)
const MIN_SUPPLY     = 20.0;     // Minimum allowed supply temperature (°C)
const MAX_SUPPLY     = 60.0;     // Maximum allowed supply temperature (°C)

const SupplyTemperature = Virtual.getHandle("number:200")

function updateSupplyTemperature(T_supply) {
  SupplyTemperature.setValue(T_supply)
}

// --- Regulation Function ---
function regulateSupplyTemperature(T_outdoor) {
  // Example of a simple linear heating curve:
  //   T_supply = OFFSET + SLOPE * (OUT_REF - T_outdoor)
  // Adjust or replace with a more advanced “curve” as needed.
  let T_supply = OFFSET + HEATING_SLOPE * (OUT_REF - T_outdoor);
  
  // Clamp to min/max values
  T_supply = Math.max(MIN_SUPPLY, Math.min(MAX_SUPPLY, T_supply));
  
  print("Outdoor Temperature: " + T_outdoor + "°C");
  print("Calculated Supply Temperature: " + T_supply.toFixed(1) + "°C");
  
  // Update the virtual component on the other Shelly device with the new supply temperature.
  updateSupplyTemperature(T_supply);
}


Shelly.call("BTHomeSensor.GetStatus", { id: 202 }, function(status) {
  regulateSupplyTemperature(status.value)
})

Shelly.addStatusHandler(function(event) {
  if (event.component === "bthomesensor:202") {
    if (event.delta.value) {
      regulateSupplyTemperature(event.delta.value)
    }
  }
})
