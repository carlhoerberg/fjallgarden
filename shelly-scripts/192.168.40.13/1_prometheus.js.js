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

//print(Shelly.getComponentStatus("emdata:0"))

function httpServerHandler(request, response) {
  const em = Shelly.getComponentStatus("em:0")
  const emdata = Shelly.getComponentStatus("emdata:0")
  response.body = [
    "# HELP shelly_em_current gauge",
    "shelly_em_current{L=\"1\"} " + em.a_current,
    "shelly_em_current{L=\"2\"} " + em.b_current,
    "shelly_em_current{L=\"3\"} " + em.c_current,
    "shelly_em_current{L=\"N\"} " + (em.n_current || NaN),
    "# HELP shelly_em_act_power gauge",
    "shelly_em_act_power{L=\"1\"} " + em.a_act_power,
    "shelly_em_act_power{L=\"2\"} " + em.b_act_power,
    "shelly_em_act_power{L=\"3\"} " + em.c_act_power,
    "# HELP shelly_em_aprt_power gauge",
    "shelly_em_aprt_power{L=\"1\"} " + em.a_aprt_power,
    "shelly_em_aprt_power{L=\"2\"} " + em.b_aprt_power,
    "shelly_em_aprt_power{L=\"3\"} " + em.c_aprt_power,
    "# HELP shelly_em_voltage gauge",
    "shelly_em_voltage{L=\"1\"} " + em.a_voltage,
    "shelly_em_voltage{L=\"2\"} " + em.b_voltage,
    "shelly_em_voltage{L=\"3\"} " + em.c_voltage,
    "# HELP shelly_em_total_act_energy counter",
    "shelly_em_total_act_energy{L=\"1\"} " + emdata.a_total_act_energy,
    "shelly_em_total_act_energy{L=\"2\"} " + emdata.b_total_act_energy,
    "shelly_em_total_act_energy{L=\"3\"} " + emdata.c_total_act_energy
  ].join("\n")
  response.headers = [["Content-Type", "text/plain"]]
  response.send();
}

HTTPServer.registerEndpoint("metrics", httpServerHandler);

/*
{ "id": 0, "a_current": 26.126, "a_voltage": 234.6, "a_act_power": 6139.6,
"a_aprt_power": 6139.6, "a_pf": 1, "a_freq": 50, "b_current": 35.352, "b_voltage": 233.6,
"b_act_power": 8211.7, "b_aprt_power": 8268.5, "b_pf": 0.99, "b_freq": 50, "c_current": 47.924,
"c_voltage": 233.5, "c_act_power": 11091.4, "c_aprt_power": 11185.7, "c_pf": 0.99, "c_freq": 50,
"n_current": null, "total_current": 109.402, "total_act_power": 25442.703, "total_aprt_power": 25593.734,
"user_calibrated_phase": [ ]
}
*/

// { "id": 0, "a_total_act_energy": 64735.49, "a_total_act_ret_energy": 0, "b_total_act_energy": 78798.66, "b_total_act_ret_energy": 0, "c_total_act_energy": 104999.43, "c_total_act_ret_energy": 0, "total_act": 248533.57, "total_act_ret": 0 }
