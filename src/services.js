// Gratis kaartdiensten van OpenStreetMap.
// Let op: deze openbare diensten zijn bedoeld voor licht gebruik (demo / eigen gebruik).
// Voor een app met veel gebruikers is een eigen of betaalde dienst nodig.

const NOMINATIM = 'https://nominatim.openstreetmap.org';
// Routeplanner met profielen voor voetgangers (stoep, past bij een scootmobiel) en fietsers
const ROUTERS = {
  scootmobiel: 'https://routing.openstreetmap.de/routed-foot',
  fiets: 'https://routing.openstreetmap.de/routed-bike'
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

// Route berekenen van `from` naar `to`.
// Geeft { coords: [{lat,lng}], steps: [...], distance (m), duration (s) }
export async function fetchRoute(from, to, vehicleType = 'scootmobiel') {
  const base = ROUTERS[vehicleType] || ROUTERS.scootmobiel;
  const url = `${base}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}` +
    '?overview=full&geometries=geojson&steps=true';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Route berekenen lukt nu niet. Probeer het zo opnieuw.');
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('Geen route gevonden naar deze bestemming.');
  const route = data.routes[0];
  return {
    coords: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    steps: route.legs[0].steps.map((s) => ({
      ...s,
      location: { lat: s.maneuver.location[1], lng: s.maneuver.location[0] }
    })),
    distance: route.distance,
    duration: route.duration
  };
}
