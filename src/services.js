// Gratis kaartdiensten op basis van OpenStreetMap.
// Let op: deze openbare diensten zijn bedoeld voor licht gebruik (demo / eigen gebruik).
// Voor een app met veel gebruikers is een eigen of betaalde dienst nodig.
import { decodePolyline6 } from './geo';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const VALHALLA = 'https://valhalla1.openstreetmap.de/route';
const OVERPASS = 'https://overpass-api.de/api/interpreter';

// Routeprofielen. De scootmobiel rijdt over fietspaden en rustige straten,
// zonder trappen (die kan een fiets ook niet nemen), en vermijdt onverharde
// paden, hellingen en drukke wegen. Maximaal 12 km/u.
const PROFILES = {
  scootmobiel: {
    costing: 'bicycle',
    costing_options: {
      bicycle: {
        bicycle_type: 'City',
        cycling_speed: 12,
        use_roads: 0.1,          // liever fietspad dan rijbaan
        use_hills: 0.05,         // hellingen zoveel mogelijk vermijden
        avoid_bad_surfaces: 1,   // geen onverharde of slechte paden
        use_ferry: 0,            // geen pontjes
        use_living_streets: 0.8  // woonerven zijn prima
      }
    }
  },
  fiets: {
    costing: 'bicycle',
    costing_options: {
      bicycle: {
        bicycle_type: 'Hybrid',
        cycling_speed: 20,
        use_roads: 0.3,
        use_hills: 0.4,
        avoid_bad_surfaces: 0.5
      }
    }
  }
};

// Adres of plaats zoeken. Geeft een lijst { label, lat, lng }.
export async function searchAddress(query, near) {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '5',
    countrycodes: 'nl,be',
    'accept-language': 'nl'
  });
  if (near) {
    // Resultaten in de buurt eerst (± 20 km rondom de huidige plek)
    const d = 0.2;
    params.set('viewbox', `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
  }
  const res = await fetch(`${NOMINATIM}/search?${params}`);
  if (!res.ok) throw new Error('Zoeken lukt nu niet. Probeer het zo opnieuw.');
  const data = await res.json();
  return data.map((r) => ({ label: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) }));
}

// Adres bij een plek opzoeken (voor de noodknop)
export async function reverseGeocode({ lat, lng }) {
  const params = new URLSearchParams({ lat, lon: lng, format: 'jsonv2', 'accept-language': 'nl', zoom: '18' });
  const res = await fetch(`${NOMINATIM}/reverse?${params}`);
  if (!res.ok) throw new Error('Adres niet gevonden');
  const data = await res.json();
  const a = data.address || {};
  const street = [a.road, a.house_number].filter(Boolean).join(' ');
  const place = a.village || a.town || a.city || a.municipality || '';
  return [street, place].filter(Boolean).join(', ') || data.display_name;
}

const isStart = (t) => t === 1 || t === 2 || t === 3;
const isEnd = (t) => t === 4 || t === 5 || t === 6;

const nodeText = (points, i) => {
  const p = points[i];
  if (!p.ref) return 'Tussenpunt bereikt';
  const next = points[i + 1]?.ref;
  return `Knooppunt ${p.ref}${next ? `, volg daarna ${next}` : ''}`;
};

// Route berekenen langs een lijst punten [{ lat, lng, ref? }] (minstens 2).
// `ref` is het nummer van een fietsknooppunt.
// Geeft { coords, steps, distance (m), duration (s) }.
// Elke stap: { kind: 'depart'|'turn'|'node'|'arrive', text, location, distance, ref? }
export async function fetchRoute(points, vehicleType = 'scootmobiel') {
  const profile = PROFILES[vehicleType] || PROFILES.scootmobiel;
  const body = {
    locations: points.map((p) => ({ lat: p.lat, lon: p.lng, type: 'break' })),
    ...profile,
    units: 'kilometers',
    directions_options: { language: 'nl-NL', units: 'kilometers' }
  };
  const res = await fetch(`${VALHALLA}?json=${encodeURIComponent(JSON.stringify(body))}`);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.trip) {
    throw new Error('Geen geschikte route gevonden. Misschien is er geen verhard pad zonder trappen. Kies een ander punt.');
  }

  const legs = data.trip.legs;
  const coords = [];
  const steps = [];
  legs.forEach((leg, li) => {
    const shape = decodePolyline6(leg.shape);
    coords.push(...(li === 0 ? shape : shape.slice(1)));
    leg.maneuvers.forEach((m) => {
      if (isStart(m.type) && li > 0) return; // vertrek na een tussenpunt telt niet als aparte stap
      const step = {
        kind: isStart(m.type) ? 'depart' : isEnd(m.type) ? 'arrive' : 'turn',
        text: m.instruction,
        location: shape[m.begin_shape_index],
        distance: m.length * 1000
      };
      if (isEnd(m.type) && li < legs.length - 1) {
        // Aankomst bij een tussenpunt: dit is een knooppunt onderweg
        step.kind = 'node';
        step.ref = points[li + 1].ref;
        step.waypoint = li + 1;
        step.text = nodeText(points, li + 1);
        step.distance = legs[li + 1].maneuvers[0].length * 1000;
      }
      steps.push(step);
    });
  });

  return {
    coords,
    steps,
    distance: data.trip.summary.length * 1000,
    duration: data.trip.summary.time
  };
}

// Fietsknooppunten en het knooppuntennetwerk binnen een gebied ophalen.
// bounds: { south, west, north, east }
export async function fetchKnooppunten(bounds) {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  const query = `[out:json][timeout:25];
node["rcn_ref"](${bbox});
out;
relation["type"="route"]["network"="rcn"](${bbox});
way(r)(${bbox});
out geom;`;
  const res = await fetch(OVERPASS, {
    method: 'POST',
    body: new URLSearchParams({ data: query })
  });
  if (!res.ok) throw new Error('Knooppunten laden lukt nu niet. Probeer het zo opnieuw.');
  const data = await res.json();
  const nodes = [];
  const lines = [];
  for (const el of data.elements) {
    if (el.type === 'node' && el.tags?.rcn_ref) {
      nodes.push({ id: el.id, ref: el.tags.rcn_ref, lat: el.lat, lng: el.lon });
    } else if (el.type === 'way' && el.geometry) {
      lines.push({ id: el.id, coords: el.geometry.map((g) => ({ lat: g.lat, lng: g.lon })) });
    }
  }
  return { nodes, lines };
}
