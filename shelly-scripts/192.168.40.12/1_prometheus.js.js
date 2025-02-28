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
    ["shelly_temperature{name=\"Retur\"}", Shelly.getComponentStatus("temperature:100").tC].join(" "),
    ["shelly_temperature{name=\"Primär\"}", Shelly.getComponentStatus("temperature:101").tC].join(" "),
    ["shelly_temperature{name=\"Framledning\"}", Shelly.getComponentStatus("temperature:102").tC].join(" "),
    ["shelly_temperature{name=\"Utomhus\"}", Shelly.getComponentStatus("bthomesensor:202").value].join(" "),
    ["shelly_cover{name=\"Ställdon\"}", cover].join(" ")
  ].join("\n")
  response.headers = [["Content-Type", "text/plain"]]
  response.send();
}

HTTPServer.registerEndpoint("metrics", httpServerHandler);
