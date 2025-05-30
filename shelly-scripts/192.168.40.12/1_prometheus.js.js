/*
 * This script exposes a "/status" endpoint that returns Prometheus metrics that can be scraped.
 * It will be reachable under "<ip>/script/<id>/metrics". Id will be 1 if this is your first script.
 *
 * Example Prometheus config:
 *
 * scrape_configs:
 *   - job_name: 'shelly'
 *     metrics_path: /script/1/metrics
 *     static_configs:
 *       - targets: ['<ip>']
 */

function httpServerHandler(request, response) {
  let cover = -1
  switch (Shelly.getComponentStatus("cover:0").state) {
    case "closed": cover = 0; break;
    case "closing": cover = 1; break;
    case "stopped": cover = 2; break;
    case "opening": cover = 3; break;
    case "open": cover = 4; break;
    case "calibrating": cover = 5; break;
  }

  response.body = [
    "# HELP shelly_temperature gauge",
    "# HELP shelly_cover gauge",
    "shelly_temperature{name=\"TA02 primär\"} " + Shelly.getComponentStatus("temperature:101").tC,
    "shelly_temperature{name=\"TA02 framledning\"} " + Shelly.getComponentStatus("temperature:102").tC,
    "shelly_temperature{name=\"TA02 retur\"} " + Shelly.getComponentStatus("temperature:100").tC,
    "shelly_temperature{name=\"TA02 setpoint\"} " + Shelly.getComponentStatus("number:200").value,
    //"shelly_temperature{name=\"Utomhus\"} " + (Shelly.getComponentStatus("bthomesensor:202").value || NaN),
    "shelly_cover{name=\"TA02 ställdon\"} " + cover,
    "shelly_cover_position{name=\"TA02 shuntposition\"} " + Shelly.getComponentStatus("number:201").value
  ].join("\n")
  response.headers = [["Content-Type", "text/plain"]]
  response.send();
}

HTTPServer.registerEndpoint("metrics", httpServerHandler);
