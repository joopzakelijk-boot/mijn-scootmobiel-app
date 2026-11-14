// Rekenhulpen voor afstanden en routes. Punten zijn { lat, lng }.

const R = 6371000; // straal van de aarde in meters
const rad = (d) => (d * Math.PI) / 180;

// Afstand in meters tussen twee punten
export const distance = (a, b) => {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// Kortste afstand (meters) van punt p tot het lijnstuk a-b.
// Op korte afstanden is een platte benadering nauwkeurig genoeg.
const distanceToSegment = (p, a, b) => {
  const kx = Math.cos(rad(p.lat)) * R * Math.PI / 180;
  const ky = R * Math.PI / 180;
  const ax = (a.lng - p.lng) * kx, ay = (a.lat - p.lat) * ky;
  const bx = (b.lng - p.lng) * kx, by = (b.lat - p.lat) * ky;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  return Math.hypot(ax + t * dx, ay + t * dy);
};

// Kortste afstand (meters) van een punt tot de route (lijst punten)
export const distanceToRoute = (p, coords) => {
  let min = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    min = Math.min(min, distanceToSegment(p, coords[i], coords[i + 1]));
  }
  return min;
};

// Punt op `meters` afstand vanaf het begin van de route (voor de demo-rit)
export const pointAlongRoute = (coords, meters) => {
  let left = meters;
  for (let i = 0; i < coords.length - 1; i++) {
    const seg = distance(coords[i], coords[i + 1]);
    if (left <= seg) {
      const t = seg === 0 ? 0 : left / seg;
      return {
        lat: coords[i].lat + (coords[i + 1].lat - coords[i].lat) * t,
        lng: coords[i].lng + (coords[i + 1].lng - coords[i].lng) * t,
        done: false
      };
    }
    left -= seg;
  }
  return { ...coords[coords.length - 1], done: true };
};

// "350 m" of "1,2 km"
export const formatDistance = (m) => {
  if (m == null || !isFinite(m)) return '–';
  if (m < 1000) return `${Math.max(0, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
};

// Gesproken/geschreven afstand: "Over 50 meter"
export const spokenDistance = (m) => {
  if (m < 1000) return `Over ${Math.max(10, Math.round(m / 10) * 10)} meter`;
  return `Over ${(m / 1000).toFixed(1).replace('.', ',')} kilometer`;
};

const TURNS = {
  'left': 'Ga linksaf',
  'right': 'Ga rechtsaf',
  'slight left': 'Houd links aan',
  'slight right': 'Houd rechts aan',
  'sharp left': 'Ga scherp linksaf',
  'sharp right': 'Ga scherp rechtsaf',
  'straight': 'Ga rechtdoor',
  'uturn': 'Keer om'
};

// Nederlandse instructie voor een routestap van de routeplanner (OSRM)
export const instructionText = (step) => {
  const { type, modifier, exit } = step.maneuver;
  if (type === 'depart') return `Vertrek${step.name ? ` over ${step.name}` : ''}`;
  if (type === 'arrive') return 'U bent op uw bestemming';
  const toStreet = step.name ? ` naar ${step.name}` : '';
  if (type === 'roundabout' || type === 'rotary') {
    return `Neem op de rotonde afslag ${exit || 1}${toStreet}`;
  }
  if (type === 'continue' || type === 'new name') {
    return `Ga ${modifier === 'straight' || !modifier ? 'rechtdoor' : 'verder'}${step.name ? ` over ${step.name}` : ''}`;
  }
  return `${TURNS[modifier] || 'Ga verder'}${toStreet}`;
};

// Eerste letter klein, voor gebruik midden in een zin ("Over 50 meter ga linksaf")
export const lowerFirst = (text) => text.charAt(0).toLowerCase() + text.slice(1);
