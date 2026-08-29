/**
 * A coarse region where telemetry data exists, with how many fixes it holds.
 * Used to show a first-time visitor where on the map to look. The dataset is
 * very unevenly distributed, so an empty-looking world view is misleading.
 */
export interface Hotspot {
  lat: number;
  lon: number;
  total: number;
}
