import { useEffect, useRef, useState } from 'react';
import { distance } from './geo';

// Volgt de echte GPS-locatie van het apparaat.
// status: 'zoeken' | 'ok' | 'geweigerd' | 'niet-beschikbaar' | 'fout'
// Werkt alleen via https of op localhost (eis van de browser).
export function useLocation() {
  const [state, setState] = useState({ status: 'zoeken', position: null });
  const prev = useRef(null);

  useEffect(() => {
    if (!('geolocation' in navigator) || !window.isSecureContext) {
      setState({ status: 'niet-beschikbaar', position: null });
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const pos = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
          time: p.timestamp
        };
        // Snelheid in km/u: van het apparaat, of zelf berekend uit de vorige meting
        if (p.coords.speed != null && !isNaN(p.coords.speed)) {
          pos.speed = p.coords.speed * 3.6;
        } else if (prev.current) {
          const dt = (pos.time - prev.current.time) / 1000;
          pos.speed = dt > 0 ? (distance(prev.current, pos) / dt) * 3.6 : 0;
        } else {
          pos.speed = 0;
        }
        prev.current = pos;
        setState({ status: 'ok', position: pos });
      },
      (err) => {
        setState((s) => {
          // Bij een tijdelijke storing de laatste bekende plek houden
          if (s.position && err.code !== 1) return s;
          return { status: err.code === 1 ? 'geweigerd' : 'fout', position: s.position };
        });
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  return state;
}
