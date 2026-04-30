// Sea-route helpers used by all map components.
//
// `searoute-ts` returns a sea-going polyline between two points. For some
// long-haul pairs (e.g. East Africa → Europe) the algorithm can pick the
// long way round Africa, or — when one endpoint is far inland / on a
// landlocked snap point — produce a degenerate straight line that cuts
// across continents. To guarantee a sensible visual route we:
//
//   1. Insert canonical waypoints (Bab-el-Mandeb, Suez south, Suez north)
//      for trips between the Indian Ocean basin and Europe/Mediterranean.
//   2. Fall back to a great-circle through those waypoints if searoute
//      can't resolve a leg.

import { seaRoute } from "searoute-ts";

type LL = [number, number]; // [lat, lon]

// Canonical chokepoint waypoints
const BAB_EL_MANDEB: LL = [12.58, 43.33];
const SUEZ_SOUTH: LL = [29.92, 32.55]; // Gulf of Suez entrance
const SUEZ_NORTH: LL = [31.35, 32.30]; // Port Said
const GIBRALTAR: LL = [35.95, -5.6];

// Region tests (rough bounding boxes)
function inIndianOceanBasin([lat, lon]: LL): boolean {
  // East Africa coast, Arabian Sea, Indian subcontinent, SE Asia
  return lat >= -40 && lat <= 30 && lon >= 20 && lon <= 110;
}
function inMediterraneanOrNWEurope([lat, lon]: LL): boolean {
  // Mediterranean basin + Atlantic Europe
  return lat >= 30 && lat <= 70 && lon >= -15 && lon <= 40;
}
function inAtlanticEurope([lat, lon]: LL): boolean {
  return lat >= 35 && lat <= 70 && lon >= -15 && lon <= 10;
}

/**
 * Given start + end, return waypoints that should be visited in order
 * (excluding start and end) to force a Suez-canal route when applicable.
 */
function suezWaypointsBetween(a: LL, b: LL): LL[] {
  const aIO = inIndianOceanBasin(a);
  const bIO = inIndianOceanBasin(b);
  const aMed = inMediterraneanOrNWEurope(a);
  const bMed = inMediterraneanOrNWEurope(b);

  // Indian Ocean → Europe (or reverse)
  if (aIO && bMed) {
    const wps: LL[] = [BAB_EL_MANDEB, SUEZ_SOUTH, SUEZ_NORTH];
    if (inAtlanticEurope(b)) wps.push(GIBRALTAR);
    return wps;
  }
  if (bIO && aMed) {
    const wps: LL[] = [];
    if (inAtlanticEurope(a)) wps.push(GIBRALTAR);
    wps.push(SUEZ_NORTH, SUEZ_SOUTH, BAB_EL_MANDEB);
    return wps;
  }
  return [];
}

/** Run searoute on a single leg; returns [] if it fails or is degenerate. */
function searouteLeg(a: LL, b: LL): LL[] {
  try {
    const origin = { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [a[1], a[0]] } };
    const dest = { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [b[1], b[0]] } };
    const route = seaRoute(origin as any, dest as any);
    const coords = (route?.geometry?.coordinates || []) as [number, number][];
    if (coords.length >= 2) {
      return coords.map(([lon, lat]) => [lat, lon] as LL);
    }
  } catch {
    /* ignore */
  }
  return [];
}

/**
 * Build a polyline from `points`, routing each leg via the sea, and
 * automatically inserting Suez/Bab-el-Mandeb/Gibraltar waypoints when the
 * leg is between the Indian Ocean basin and Europe.
 */
export function buildSeaRouteLatLngs(points: LL[]): LL[] {
  if (points.length < 2) return points;
  const out: LL[] = [];

  const pushLeg = (legPts: LL[]) => {
    if (!legPts.length) return;
    if (out.length) legPts.shift(); // avoid dup at junction
    out.push(...legPts);
  };

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const waypoints = suezWaypointsBetween(a, b);
    const legPoints: LL[] = [a, ...waypoints, b];

    let legOk = false;
    const collected: LL[] = [];
    for (let j = 0; j < legPoints.length - 1; j++) {
      const seg = searouteLeg(legPoints[j], legPoints[j + 1]);
      if (seg.length >= 2) {
        if (collected.length) seg.shift();
        collected.push(...seg);
        legOk = true;
      } else {
        // straight fallback for this sub-leg
        if (!collected.length) collected.push(legPoints[j]);
        collected.push(legPoints[j + 1]);
      }
    }
    if (legOk || collected.length >= 2) {
      pushLeg(collected);
    } else {
      if (!out.length) out.push(a);
      out.push(b);
    }
  }
  return out;
}
