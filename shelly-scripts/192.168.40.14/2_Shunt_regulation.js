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
function getSetpointTemperature() {
  return Shelly.getComponentStatus("number:200").value
}

function getPrimaryTemperature() {
  return Shelly.getComponentStatus("temperature:101").tC;
}

function getSupplyTemperature() {
  return Shelly.getComponentStatus("temperature:102").tC
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
  const T_setpoint = getSetpointTemperature();
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
  //print("Primary: ", T_p, "°C, Supply: ", T_supply, "°C, Return: ", T_r, "°C, Setpoint: ", T_setpoint, "°C")
  
  const shuntPos = Shelly.getComponentStatus("cover:0").current_pos
  // Determine if movement is needed by comparing the desired shunt position with our estimated one.
  const diff = desiredShuntPos - shuntPos;

  if (diff < 5) {
    // print("Shunt position within threshold. No movement required.");
    return;
  }

  print("Shunt position: ", shuntPos, "%, Desired shunt position: ", desiredShuntPos, "% (Ideal: ", (targetFraction * 100).toFixed(1), "%, Correction: ", (correction * 100).toFixed(1), "%)")
  print("Issuing command: Cover.GoToPosition to new shunt position: " + desiredShuntPos + "%");
  
  Shelly.call("Cover.GoToPosition", { id: 0, pos: desiredShuntPos }, function(res, error_code, error_message) {
    if (error_code !== 0) {
      print("Error issuing " + command + ": " + error_message);
    }
  });
}

Timer.set(10000, true, regulate);
