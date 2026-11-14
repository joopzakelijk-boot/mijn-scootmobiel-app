import React, { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, CircleMarker, Circle, Polyline, Marker, useMap, useMapEvents } from 'react-leaflet';
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

// Meldt het zichtbare gebied, zodat de app daar de knooppunten kan ophalen
function MoveReporter({ onMove }) {
  const map = useMap();
  const report = () => {
    const b = map.getBounds();
    onMove?.({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() }, map.getZoom());
  };
  useMapEvents({ moveend: report });
  useEffect(() => { report(); }, []);
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

// Bij het plannen met knooppunten iets uitzoomen, zodat er meerdere in beeld zijn
function OverviewZoom({ zoom }) {
  const map = useMap();
  useEffect(() => {
    if (zoom && map.getZoom() > zoom) map.setZoom(zoom);
  }, [zoom]);
  return null;
}

// Knooppuntbordje: nummer in een rondje, blauw als het gekozen is
const nodeIcon = (ref, order) => L.divIcon({
  className: '',
  html: `<div class="kp-icon${order ? ' kp-selected' : ''}">${ref}${order ? `<span class="kp-order">${order}</span>` : ''}</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20]
});

export default function RealMap({
  position, route, destination, follow, setFollow, isNavigating,
  knooppunten = [], netwerk = [], selected = [], onNodeClick, onMove, planLine, overviewZoom
}) {
  // Volgorde-nummers van gekozen knooppunten (een knooppunt kan vaker gekozen zijn)
  const orderById = useMemo(() => {
    const m = {};
    selected.forEach((n, i) => { m[n.id] = m[n.id] ? `${m[n.id]},${i + 1}` : `${i + 1}`; });
    return m;
  }, [selected]);

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

      {/* Knooppuntennetwerk (groene lijnen) */}
      {netwerk.map((w) => (
        <Polyline key={w.id} positions={w.coords.map((c) => [c.lat, c.lng])} pathOptions={{ color: '#15803d', weight: 4, opacity: 0.55 }} interactive={false} />
      ))}

      {/* Voorlopige lijn tussen de gekozen knooppunten */}
      {planLine && planLine.length > 1 && (
        <Polyline positions={planLine.map((c) => [c.lat, c.lng])} pathOptions={{ color: '#1d4ed8', weight: 4, dashArray: '8 8' }} interactive={false} />
      )}

      {route && (
        <>
          {/* Witte rand onder de route, zodat hij goed opvalt */}
          <Polyline positions={route.coords.map((c) => [c.lat, c.lng])} pathOptions={{ color: '#ffffff', weight: 11, opacity: 0.9 }} />
          <Polyline positions={route.coords.map((c) => [c.lat, c.lng])} pathOptions={{ color: isNavigating ? '#2563eb' : '#64748b', weight: 7 }} />
        </>
      )}

      {knooppunten.map((n) => (
        <Marker
          key={n.id}
          position={[n.lat, n.lng]}
          icon={nodeIcon(n.ref, orderById[n.id])}
          eventHandlers={{ click: () => onNodeClick?.(n) }}
          keyboard={true}
          title={`Knooppunt ${n.ref}`}
        />
      ))}

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
      <MoveReporter onMove={onMove} />
      <OverviewZoom zoom={overviewZoom} />
    </MapContainer>
  );
}
