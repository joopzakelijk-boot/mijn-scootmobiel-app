import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Polyline, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Midden van Nederland, zolang de eigen locatie nog niet bekend is
const NL_CENTER = [52.1, 5.3];

// Houdt de kaart gecentreerd op de gebruiker zolang `follow` aan staat.
// Als de gebruiker de kaart zelf versleept, gaat volgen uit.
function FollowUser({ position, follow, setFollow, zoom }) {
  const map = useMap();
  useMapEvents({ dragstart: () => setFollow(false) });
  useEffect(() => {
    if (follow && position) {
      map.setView([position.lat, position.lng], Math.max(map.getZoom(), zoom), { animate: true });
    }
  }, [follow, position?.lat, position?.lng]);
  return null;
}

// Kaart opnieuw laten meten als het vak van grootte verandert (bijv. het paneel onderin)
function ResizeWatcher() {
  const map = useMap();
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

// Laat de hele route zien zodra er een nieuwe route is (als we niet volgen)
function FitRoute({ route, follow }) {
  const map = useMap();
  useEffect(() => {
    if (route && !follow) {
      // Even wachten tot het paneel onderin zijn hoogte heeft, dan de hele route tonen
      const id = setTimeout(() => {
        map.invalidateSize();
        map.fitBounds(route.coords.map((c) => [c.lat, c.lng]), { paddingTopLeft: [40, 80], paddingBottomRight: [40, 40] });
      }, 50);
      return () => clearTimeout(id);
    }
  }, [route]);
  return null;
}

export default function RealMap({ position, route, destination, follow, setFollow, isNavigating }) {
  return (
    <MapContainer
      center={position ? [position.lat, position.lng] : NL_CENTER}
      zoom={position ? 17 : 7}
      maxZoom={19}
      zoomControl={false}
      className="w-full h-full"
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      {route && (
        <>
          {/* Witte rand onder de route, zodat hij goed opvalt */}
          <Polyline positions={route.coords.map((c) => [c.lat, c.lng])} pathOptions={{ color: '#ffffff', weight: 11, opacity: 0.9 }} />
          <Polyline positions={route.coords.map((c) => [c.lat, c.lng])} pathOptions={{ color: isNavigating ? '#2563eb' : '#64748b', weight: 7 }} />
        </>
      )}

      {destination && (
        <CircleMarker center={[destination.lat, destination.lng]} radius={10} pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#dc2626', fillOpacity: 1 }} />
      )}

      {position && (
        <>
          {position.accuracy > 15 && (
            <Circle center={[position.lat, position.lng]} radius={position.accuracy} pathOptions={{ color: '#2563eb', weight: 1, fillOpacity: 0.08 }} />
          )}
          <CircleMarker center={[position.lat, position.lng]} radius={11} pathOptions={{ color: '#ffffff', weight: 4, fillColor: '#2563eb', fillOpacity: 1 }} />
        </>
      )}

      <FollowUser position={position} follow={follow} setFollow={setFollow} zoom={isNavigating ? 18 : 17} />
      <FitRoute route={route} follow={follow} />
      <ResizeWatcher />
    </MapContainer>
  );
}
