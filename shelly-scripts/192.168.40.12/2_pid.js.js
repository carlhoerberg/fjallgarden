// PID Control for Cover based on Temperature Sensor in Shelly Script

// PID constants
const Kp = 1;
const Ki = 0.1;
const Kd = 0;

// Other settings
const interval = 10000; // ms Polling interval
const full_move_time = 45.0; // Full movement time in seconds

// Variables for PID calculation
let integral = 0;
let previous_error = 0;

function moveCover(duration, direction) {
  const coverState = Shelly.getComponentStatus("cover:0");
        
  // Don't send new commands if cover is already moving
  if (coverState.state === "opening" || coverState.state === "closing") {
      console.log("Cover is already moving so ignoring this adjustment")
      return;
  }
  
  console.log("Moving cover " + direction + " for " + duration + " seconds");

  // direction: "open" or "close"
  Shelly.call("Cover." + direction, { id: 0 }, null, null);
  
  Timer.set(duration * 1000, false, function() {
    Shelly.call("Cover.Stop", { id: 0 }, null, null);
  });
}

function updateCover(pid_output) {
  const move_time = Math.abs(pid_output) / 100 * full_move_time;
  if (move_time < 5) return;
  if (pid_output > 0) {
    moveCover(move_time, "Open");
  } else if (pid_output < 0) {
    moveCover(move_time, "Close");
  }
}

function pidControl() {
  const target_temp = Shelly.getComponentStatus("number:200").value;
  const current_temp = Shelly.getComponentStatus("temperature:102").tC;
  const error = target_temp - current_temp;

  integral += error * (interval / 1000);
  const derivative = (error - previous_error) / (interval / 1000);

  let output = Kp * error + Ki * integral + Kd * derivative;
  console.log("Target Temp: " + target_temp + ", Current Temp: " + current_temp + ", Error: " + error + ", PID output: " + output);

  updateCover(output);
  previous_error = error;
}

pidControl();
Timer.set(interval, true, pidControl);
