// Shelly Script for Shelly 2PM with Cover (shunt control)
// This script regulates a mixing shunt in a heating system by controlling a cover mechanism.
// Since Cover.SetPosition isn’t available, we use Cover.Open and Cover.Close,
// and we estimate the cover position manually. Full travel (0% to 100%) takes 45 seconds.

// The algorithm computes an ideal valve (cover) position from:
//      T_set = T_return + x*(T_primary - T_return)
// i.e., x_ideal = (T_set - T_return) / (T_primary - T_return)
// Then a proportional correction is added based on the supply error.
// The desired cover position is compared with the estimated cover position,
// and if a difference exists beyond a small threshold, the cover is commanded
// to move in the appropriate direction for a calculated time.
//
// Constants
const Kp = 0.1;                // proportional gain (tune as needed)

// desired supply temperature (°C)
const SetpointTemperature = Virtual.getHandle("number:200")
const TemperatureOffset = Virtual.getHandle("number:201")

function getIndoorTemperature() {
  return Shelly.getComponentStatus("bthomesensor:205").value;
}

function getOutdoorTemperature() {
  return Shelly.getComponentStatus("bthomesensor:202").value;
}

function getPrimaryTemperature() {
  return Shelly.getComponentStatus("temperature:102").tC;
}

function getSupplyTemperature() {
  return Shelly.getComponentStatus("temperature:101").tC
}

function getReturnTemperature() {
  return Shelly.getComponentStatus("temperature:100").tC
}

function isMoving() {
  const coverState = Shelly.getComponentStatus("cover:0").state;
  return coverState === "opening" || coverState === "closing"
}

// --- Regulation function ---
function regulate() {
  if (isMoving()) {
    print("Shunt is currently moving. Skipping regulation cycle.");
    return;
  }
  const T_setpoint = SetpointTemperature.getValue();
  const T_p = getPrimaryTemperature();
  const T_supply = getSupplyTemperature();
  const T_r = getReturnTemperature();
  
  let targetFraction = 0; // fraction from 0 (fully closed) to 1 (fully open)
  
  // Handle edge conditions to avoid division by zero
  if (Math.abs(T_p - T_r) < 0.1) {
    targetFraction = 1; // if there’s no temperature difference, default to open
  } else if (T_setpoint >= T_p) {
    targetFraction = 1;
  } else if (T_setpoint <= T_r) {
    targetFraction = 0;
  } else {
    targetFraction = (T_setpoint - T_r) / (T_p - T_r);
  }
  
  // Apply a proportional correction based on the supply error
  let error = T_setpoint - T_supply;
  let correction = Kp * error;
  
  let newFraction = targetFraction + correction;
  newFraction = Math.max(0, Math.min(1, newFraction));
  
  const desiredShuntPos = Math.round(newFraction * 100);
  print("Primary: ", T_p, "°C, Supply: ", T_supply, "°C, Return: ", T_r, "°C, Setpoint: ", T_setpoint, "°C")
  
  const shuntPos = Shelly.getComponentStatus("cover:0").current_pos

  print("Shunt position: ", shuntPos, "%, Desired shunt position: ", desiredShuntPos, "% (Ideal: ", (targetFraction * 100).toFixed(1), "%, Correction: ", (correction * 100).toFixed(1), "%)")

  // Determine if movement is needed by comparing the desired shunt position with our estimated one.
  const diff = Math.abs(desiredShuntPos - shuntPos)
  if (diff <= 2) {
    // print("Shunt position within threshold. No movement required.");
    return;
  }

  print("Issuing command: Cover.GoToPosition to new shunt position: " + desiredShuntPos + "%");
  
  Shelly.call("Cover.GoToPosition", { id: 0, pos: desiredShuntPos }, function(res, error_code, error_message) {
    if (error_code !== 0) {
      print("Error issuing " + command + ": " + error_message);
    }
  });
}

const HEATING_SLOPE  = 1.1;      // Slope of the heating curve
const BASE_OFFSET    = 29.0;     // Base offset (°C)
const OUT_REF        = 5.0;      // Outdoor reference temperature (°C)
const MIN_SUPPLY     = 10.0;     // Minimum allowed supply temperature (°C)
const MAX_SUPPLY     = 55.0;     // Maximum allowed supply temperature (°C)
const TARGET_INDOOR_TEMP = 19.5; // Target indoor temperature (°C)
const INDOOR_INFLUENCE = 1.5;    // How much indoor temperature affects the curve (°C/°C)

function regulateSupplyTemperature(T_outdoor, T_indoor) {
  // Calculate outdoor/indoor temperature error (negative when too warm)
  const outdoor_error = OUT_REF - T_outdoor
  const indoor_error = TARGET_INDOOR_TEMP - T_indoor;
  
  // Simple linear heating curve with indoor feedback:
  let T_supply = TemperatureOffset.getValue() +
                 BASE_OFFSET +
                 HEATING_SLOPE * outdoor_error +
                 INDOOR_INFLUENCE * indoor_error;
  
  // Clamp to min/max values
  T_supply = Math.max(MIN_SUPPLY, Math.min(MAX_SUPPLY, T_supply));

  print("Outdoor:", T_outdoor.toFixed(1), "°C, Outdoor error:", outdoor_error.toFixed(1), "°C, Indoor:", T_indoor.toFixed(1),
        "°C, Indoor error:", indoor_error.toFixed(1), "°C, Supply:", T_supply.toFixed(1), "°C");
  SetpointTemperature.setValue(T_supply)
}

function regulateSupplyTemperatureOnSensorChange(event) {
  if (event.component === "bthomesensor:202") {
    // Outdoor temperature changed
    if (event.delta.value !== undefined) {
      regulateSupplyTemperature(event.delta.value, getIndoorTemperature());
    }
  } else if (event.component === "bthomesensor:205") {
    // Indoor temperature changed
    if (event.delta.value !== undefined) {
      regulateSupplyTemperature(getOutdoorTemperature(), event.delta.value);
    }
  }
}

// Regulate setpoint on temperature sensor changes
Shelly.addStatusHandler(regulateSupplyTemperatureOnSensorChange)

// Set setpoint once using current temperature readings
regulateSupplyTemperature(getOutdoorTemperature(), getIndoorTemperature())

// Adjust shunt position every 10s
Timer.set(10000, true, regulate);
