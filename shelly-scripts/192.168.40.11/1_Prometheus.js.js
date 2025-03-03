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
    "# HELP shelly_switch gauge",
    "shelly_switch{name=\"Fläkt\"} " + (Shelly.getComponentStatus("switch:0").output ? 1 : 0)
  ].join("\n")
  response.headers = [["Content-Type", "text/plain"]]
  response.send()
}

HTTPServer.registerEndpoint("metrics", httpServerHandler)
