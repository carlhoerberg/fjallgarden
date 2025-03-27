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
  response.body = [
    "# HELP shelly_temperature gauge",
    "# HELP shelly_cover_position gauge",
    "shelly_temperature{name=\"Radiatorkrets retur\"} " + Shelly.getComponentStatus("temperature:100").tC,
    "shelly_temperature{name=\"Radiatorkrets framledning\"} " + Shelly.getComponentStatus("temperature:101").tC,
    "shelly_temperature{name=\"Radiatorkrets primär\"} " + Shelly.getComponentStatus("temperature:102").tC,
    "shelly_temperature{name=\"Radiatorkrets setpoint\"} " + Shelly.getComponentStatus("number:200").value,
    "shelly_temperature{name=\"Förskolan öster\"} " + (Shelly.getComponentStatus("bthomesensor:205").value || NaN),
    "shelly_cover_position{name=\"Radiatorkrets shuntposition\"} " + Shelly.getComponentStatus("cover:0").current_pos
  ].join("\n")
  response.headers = [["Content-Type", "text/plain"]]
  response.send()
}

HTTPServer.registerEndpoint("metrics", httpServerHandler);
