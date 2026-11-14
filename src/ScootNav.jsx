import React, { useState, useEffect, useRef } from 'react';
import { Battery, Navigation, AlertTriangle, Settings, Home, MapPin, Phone, Minus, Plus, Search, User, LocateFixed, X, MessageSquare, Play, Loader2 } from 'lucide-react';
import RealMap from './RealMap';
import { useLocation } from './useLocation';
import { searchAddress, reverseGeocode, fetchRoute, fetchKnooppunten } from './services';
import { distance, distanceToRoute, pointAlongRoute, formatDistance, spokenDistance, lowerFirst } from './geo';

// Instellingen worden in de browser bewaard (localStorage)
const STORAGE_KEY = 'scootnav-instellingen';
const TEXT_SCALE_MIN = 0.8;
const TEXT_SCALE_MAX = 1.5;
const DEFAULT_SETTINGS = {
  homeAddress: "Kerkplein 1, Het Dorp",
  contactName: "Dochter Emma",
  contactPhone: "06-12345678",
  textScale: 1,
  voiceEnabled: true,
  vehicleType: 'scootmobiel'
};

// Gemiddelde rijsnelheid (km/u) voor de verwachte reistijd
const TRAVEL_SPEED = { scootmobiel: 10, fiets: 18 };

// Demo-rit: rijdt op de maximumsnelheid van het voertuig, 3x versneld afgespeeld
const DEMO_SPEED = { scootmobiel: 12, fiets: 20 };
const DEMO_SPEEDUP = 3;
const DEMO_TICK_MS = 250;

// Knooppunten worden pas getoond vanaf dit zoomniveau (anders te veel tegelijk)
const KP_MIN_ZOOM = 13;
const KP_OVERVIEW_ZOOM = 14;

const loadSettings = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...DEFAULT_SETTINGS, ...(stored || {}) };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
};

// Telefoonnummer geschikt maken voor een tel:- of sms:-link (alleen cijfers en +)
const cleanPhone = (phone) => phone.replace(/[^\d+]/g, '');
const toTelHref = (phone) => `tel:${cleanPhone(phone)}`;

const osmLink = (p) => `https://www.openstreetmap.org/?mlat=${p.lat.toFixed(6)}&mlon=${p.lng.toFixed(6)}#map=18/${p.lat.toFixed(6)}/${p.lng.toFixed(6)}`;

const LOCATION_MESSAGES = {
  zoeken: 'Locatie wordt gezocht…',
  geweigerd: 'Geen toegang tot uw locatie. Sta locatie toe in de instellingen van uw browser.',
  'niet-beschikbaar': 'Locatie is hier niet beschikbaar. Open de app via https of op dit apparaat zelf.',
  fout: 'Uw locatie kon niet worden bepaald. Ga eventueel even naar buiten.'
};

const BigButton = ({ icon: Icon, label, onClick, color = "blue", fullWidth = false, disabled = false }) => {
  const colorClasses = {
    blue: "bg-blue-600 hover:bg-blue-700 text-white",
    red: "bg-red-600 hover:bg-red-700 text-white",
    green: "bg-green-600 hover:bg-green-700 text-white",
    gray: "bg-slate-200 hover:bg-slate-300 text-slate-800"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${colorClasses[color]} ${fullWidth ? 'w-full' : 'flex-1'}
      p-4 rounded-xl shadow-md transition-transform active:scale-95 flex flex-col items-center justify-center gap-2 min-h-[100px] disabled:opacity-50`}
    >
      <Icon size={40} strokeWidth={2} />
      <span className="text-lg font-bold">{label}</span>
    </button>
  );
};

export default function ScootNavApp() {
  const [view, setView] = useState('home'); // home, map, settings, sos
  const [batteryLevel, setBatteryLevel] = useState(85);
  const [showExitModal, setShowExitModal] = useState(false);

  // Persoonlijke instellingen (worden bewaard in de browser)
  const [saved] = useState(loadSettings);
  const [homeAddress, setHomeAddress] = useState(saved.homeAddress);
  const [contactName, setContactName] = useState(saved.contactName);
  const [contactPhone, setContactPhone] = useState(saved.contactPhone);
  const [textScale, setTextScale] = useState(saved.textScale);
  const [voiceEnabled, setVoiceEnabled] = useState(saved.voiceEnabled);
  const [vehicleType, setVehicleType] = useState(saved.vehicleType);

  // Locatie, zoeken en route
  const gps = useLocation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [destination, setDestination] = useState(null);
  const [route, setRoute] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [follow, setFollow] = useState(true);
  const [demo, setDemo] = useState(false);
  const [demoPos, setDemoPos] = useState(null);
  const [sosAddress, setSosAddress] = useState('');

  // Tijdens de demo-rit volgt de app de nagespeelde plek in plaats van de GPS
  const position = demo ? demoPos : gps.position;
  const speed = isNavigating && position ? Math.round(demo ? DEMO_SPEED[vehicleType] : (position.speed || 0)) : 0;

  // Instellingen automatisch bewaren bij elke wijziging
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        homeAddress, contactName, contactPhone, textScale, voiceEnabled, vehicleType
      }));
    } catch (e) {
      // Opslag niet beschikbaar (bijv. privévenster): app werkt gewoon door
    }
  }, [homeAddress, contactName, contactPhone, textScale, voiceEnabled, vehicleType]);

  // Tekstgrootte: alle Tailwind-maten zijn in rem, dus de basisgrootte schaalt alles mee
  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * textScale}px`;
  }, [textScale]);

  const changeTextScale = (delta) => {
    setTextScale(prev => {
      const next = Math.round((prev + delta) * 10) / 10;
      return Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, next));
    });
  };

  // Spraakbegeleiding: lees een tekst hardop voor als die aan staat
  const voiceRef = useRef(voiceEnabled);
  voiceRef.current = voiceEnabled;
  const say = (text, force = false) => {
    if (!(voiceRef.current || force) || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'nl-NL';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  const toggleVoice = () => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    if (next) {
      say("Spraakbegeleiding staat aan", true);
    } else if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  // Accu: er is (nog) geen koppeling met de scootmobiel, dus dit is een schatting
  useEffect(() => {
    if (!isNavigating) return;
    const id = setInterval(() => setBatteryLevel(prev => Math.max(0, prev - 0.1)), 3000);
    return () => clearInterval(id);
  }, [isNavigating]);

  // Vertrekpunt: de eigen locatie, of het thuisadres als de locatie onbekend is
  const getStart = async () => {
    if (gps.position) return { point: gps.position, fromHome: false };
    const found = await searchAddress(homeAddress);
    if (!found.length) throw new Error('Uw locatie is onbekend en uw thuisadres is niet gevonden. Controleer het thuisadres bij Instellingen.');
    return { point: found[0], fromHome: true };
  };

  // Route berekenen langs punten en klaarzetten. Geeft de route terug (of null bij een fout).
  const buildRoute = async (points, dest, note = '') => {
    const r = await fetchRoute(points, vehicleType);
    const full = { ...r, waypoints: points, roundTrip: !!dest.roundTrip };
    setDestination(dest);
    setRoute(full);
    setStepIndex(0);
    setFollow(false);
    setMessage(note);
    return full;
  };

  const planRoute = async (dest) => {
    setBusy(true);
    setMessage('');
    setResults(null);
    try {
      const { point, fromHome } = await getStart();
      return await buildRoute([point, dest], dest,
        fromHome ? 'Uw locatie is onbekend. De route start daarom bij uw thuisadres.' : '');
    } catch (e) {
      setMessage(e.message || 'Er ging iets mis. Probeer het opnieuw.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const onSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setMessage('');
    try {
      const found = await searchAddress(query.trim(), gps.position);
      setResults(found);
      if (!found.length) setMessage('Geen adres gevonden. Probeer straat en plaats, bijvoorbeeld "Markt 1, Gouda".');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  // ---- Zelf plannen met fietsknooppunten ----
  const [planMode, setPlanMode] = useState('adres'); // 'adres' | 'knooppunt'
  const [kpNodes, setKpNodes] = useState([]);
  const [kpLines, setKpLines] = useState([]);
  const [kpSelected, setKpSelected] = useState([]);
  const [kpStartAtMe, setKpStartAtMe] = useState(true);
  const [kpRoundTrip, setKpRoundTrip] = useState(false);
  const [kpStatus, setKpStatus] = useState(''); // '', 'zoom', 'laden', 'fout'
  const mapView = useRef(null);
  const kpLoaded = useRef(null);

  const loadKnooppunten = async () => {
    const v = mapView.current;
    if (!v) return;
    if (v.zoom < KP_MIN_ZOOM) { setKpStatus('zoom'); return; }
    const b = v.bounds;
    const done = kpLoaded.current;
    if (done && b.south >= done.south && b.north <= done.north && b.west >= done.west && b.east <= done.east) {
      setKpStatus('');
      return; // dit gebied is al geladen
    }
    // Iets ruimer ophalen, zodat kleine verschuivingen geen nieuwe aanvraag geven
    const padLat = (b.north - b.south) * 0.5, padLng = (b.east - b.west) * 0.5;
    const area = { south: b.south - padLat, north: b.north + padLat, west: b.west - padLng, east: b.east + padLng };
    setKpStatus('laden');
    try {
      const { nodes, lines } = await fetchKnooppunten(area);
      kpLoaded.current = area;
      setKpNodes(nodes);
      setKpLines(lines);
      setKpStatus('');
    } catch (e) {
      setKpStatus('fout');
    }
  };

  const onMapMove = (bounds, zoom) => {
    mapView.current = { bounds, zoom };
    if (planMode === 'knooppunt' && !route) loadKnooppunten();
  };

  useEffect(() => {
    if (planMode === 'knooppunt' && !route) loadKnooppunten();
  }, [planMode, route]);

  const onNodeClick = (node) => {
    if (planMode !== 'knooppunt' || route || isNavigating) return;
    setMessage('');
    setKpSelected((sel) => {
      // Nogmaals op het laatst gekozen knooppunt tikken = weer weghalen
      if (sel.length && sel[sel.length - 1].id === node.id) return sel.slice(0, -1);
      return [...sel, node];
    });
  };

  const planKnooppuntRoute = async () => {
    setMessage('');
    const nodes = kpSelected.map((n) => ({ lat: n.lat, lng: n.lng, ref: n.ref }));
    const points = [];
    if (kpStartAtMe) {
      if (!gps.position) {
        setMessage('Uw locatie is nog niet bekend. Zet "Start bij mijn locatie" uit, of wacht tot uw locatie gevonden is.');
        return;
      }
      points.push({ lat: gps.position.lat, lng: gps.position.lng });
    }
    points.push(...nodes);
    if (kpRoundTrip && points.length > 1) points.push({ ...points[0] });
    if (points.length < 2) {
      setMessage(kpStartAtMe ? 'Kies minstens één knooppunt.' : 'Kies minstens twee knooppunten.');
      return;
    }
    const refs = kpSelected.map((n) => n.ref);
    const last = points[points.length - 1];
    setBusy(true);
    try {
      await buildRoute(points, {
        label: `Knooppunten ${refs.join(' → ')}${kpRoundTrip ? ' (rondrit)' : ''}`,
        lat: last.lat, lng: last.lng, roundTrip: kpRoundTrip
      });
    } catch (e) {
      setMessage(e.message || 'Er ging iets mis. Probeer het opnieuw.');
    } finally {
      setBusy(false);
    }
  };

  // Voorlopige stippellijn tussen de gekozen punten (voordat de route berekend is)
  const planLine = planMode === 'knooppunt' && !route
    ? [
        ...(kpStartAtMe && gps.position ? [gps.position] : []),
        ...kpSelected,
        ...(kpRoundTrip && kpSelected.length ? [kpStartAtMe && gps.position ? gps.position : kpSelected[0]] : [])
      ]
    : null;

  // Accu: past de route binnen het bereik?
  const rangeKm = batteryLevel * 0.4;
  const batteryCheck = (meters, roundTrip) => {
    const km = meters / 1000;
    const fmt = (x) => x.toFixed(1).replace('.', ',');
    if (km > rangeKm) {
      return { level: 'red', text: `Te ver voor uw accu: de route is ${fmt(km)} km, uw bereik is ± ${Math.floor(rangeKm)} km. Kies een kortere route of laad eerst op.` };
    }
    if (km > rangeKm * 0.8) {
      return { level: 'amber', text: `Krap: de route is ${fmt(km)} km, uw bereik is ± ${Math.floor(rangeKm)} km.` };
    }
    if (!roundTrip && km * 2 > rangeKm) {
      return { level: 'amber', text: `Denk aan de terugweg: heen en terug is ${fmt(km * 2)} km, uw bereik is ± ${Math.floor(rangeKm)} km.` };
    }
    return { level: 'green', text: `Past ruim binnen uw accubereik (± ${Math.floor(rangeKm)} km).` };
  };

  // Navigatie bijhouden: stappen, aankondigingen, aankomst en omrijden
  const announced = useRef({});
  const minDistToNext = useRef(Infinity);
  const lastReroute = useRef(0);

  const startNavigation = (r = route, asDemo = false) => {
    if (!r) return;
    announced.current = {};
    minDistToNext.current = Infinity;
    setStepIndex(0);
    setDemo(asDemo);
    setDemoPos(asDemo ? { ...r.coords[0] } : null);
    setIsNavigating(true);
    setFollow(true);
    setView('map');
    const first = r.steps[1];
    say(`Route gestart. ${first ? first.text : ''}`);
  };

  const finishNavigation = (arrived) => {
    setIsNavigating(false);
    setDemo(false);
    setDemoPos(null);
    setShowExitModal(false);
    setFollow(true);
    if (arrived) {
      say("U bent op uw bestemming");
      setRoute(null);
      setDestination(null);
      setKpSelected([]);
      setTimeout(() => alert("Bestemming bereikt!"), 100);
    } else {
      say("Route gestopt");
    }
  };

  // Demo-rit: beweeg een nagespeelde plek over de route
  useEffect(() => {
    if (!isNavigating || !demo || !route) return;
    let travelled = 0;
    const kmh = DEMO_SPEED[vehicleType];
    const step = (kmh / 3.6) * (DEMO_TICK_MS / 1000) * DEMO_SPEEDUP;
    const id = setInterval(() => {
      travelled += step;
      setDemoPos({ ...pointAlongRoute(route.coords, travelled), speed: kmh });
    }, DEMO_TICK_MS);
    return () => clearInterval(id);
  }, [isNavigating, demo, route]);

  useEffect(() => {
    if (!isNavigating || !route || !position) return;

    let idx = stepIndex;
    let next = route.steps[idx + 1];

    // Aangekomen? (einde demo-rit, of vlak bij het laatste punt)
    if (position.done || !next || (next.kind === 'arrive' && distance(position, next.location) < 20)) {
      finishNavigation(true);
      return;
    }

    // Volgende afslag of knooppunt bereikt of voorbij? Dan door naar de stap daarna.
    const dNext = distance(position, next.location);
    minDistToNext.current = Math.min(minDistToNext.current, dNext);
    const passed = minDistToNext.current < 40 && dNext > minDistToNext.current + 20;
    if (next.kind !== 'arrive' && (dNext < 20 || passed)) {
      if (next.kind === 'node') say(next.text);
      idx += 1;
      minDistToNext.current = Infinity;
      setStepIndex(idx);
    }

    // Aankondigen: eerst bij een nieuwe stap, en nog eens vlak voor de afslag
    const upcoming = route.steps[idx + 1];
    if (upcoming && upcoming.kind !== 'arrive') {
      const d = distance(position, upcoming.location);
      const key = `${idx}`;
      if (!announced.current[key] && idx > 0) {
        announced.current[key] = 'far';
        say(`${spokenDistance(d)} ${lowerFirst(upcoming.text)}`);
      }
      if (d < 60 && announced.current[key] !== 'near') {
        announced.current[key] = 'near';
        say(`${spokenDistance(d)} ${lowerFirst(upcoming.text)}`);
      }
    }

    // Van de route af? Dan opnieuw berekenen via de knooppunten die nog komen
    // (hooguit eens per 15 seconden)
    if (!demo && distanceToRoute(position, route.coords) > 40 && Date.now() - lastReroute.current > 15000) {
      lastReroute.current = Date.now();
      say("U bent van de route af. De route wordt opnieuw berekend.");
      const passedNodes = route.steps.slice(0, idx + 1).filter((s) => s.kind === 'node').length;
      const remainingPoints = route.waypoints.slice(1 + passedNodes);
      const here = { lat: position.lat, lng: position.lng };
      fetchRoute([here, ...remainingPoints], vehicleType)
        .then((r) => {
          setRoute({ ...r, waypoints: [here, ...remainingPoints], roundTrip: route.roundTrip });
          setStepIndex(0);
          announced.current = {};
          minDistToNext.current = Infinity;
        })
        .catch(() => {});
    }
  }, [position, isNavigating]);

  // Huidige instructie en resterende afstand
  const upcomingStep = route?.steps[stepIndex + 1];
  const distToUpcoming = upcomingStep && position ? distance(position, upcomingStep.location) : null;
  const remaining = route && position && upcomingStep
    ? distToUpcoming + route.steps.slice(stepIndex + 1).reduce((s, st) => s + st.distance, 0)
    : route?.distance;
  const minutesFor = (meters) => Math.max(1, Math.round((meters / 1000) / TRAVEL_SPEED[vehicleType] * 60));

  const goHome = async () => {
    setView('map');
    setBusy(true);
    setMessage('');
    try {
      const found = await searchAddress(homeAddress, gps.position);
      if (!found.length) {
        setMessage('Uw thuisadres is niet gevonden. Controleer het bij Instellingen.');
        return;
      }
      const r = await planRoute({ ...found[0], label: homeAddress });
      if (r) startNavigation(r);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Noodknop: adres van de huidige plek opzoeken
  useEffect(() => {
    if (view !== 'sos' || !position) return;
    setSosAddress('');
    reverseGeocode(position).then(setSosAddress).catch(() => {});
  }, [view]);

  // Route weghalen; gekozen knooppunten blijven staan, zodat u ze kunt aanpassen
  const clearRoute = () => {
    setRoute(null);
    setDestination(null);
    setResults(null);
    setMessage('');
    setFollow(true);
  };

  // Views
  const renderHome = () => (
    <div className="flex flex-col h-full p-4 space-y-4 max-w-md mx-auto w-full">
      <div className="bg-blue-50 p-6 rounded-2xl shadow-sm border border-blue-100 mb-2">
        <h2 className="text-2xl font-bold text-blue-900 mb-2">Goedemiddag!</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-700 font-bold text-xl">
            <Battery size={28} className={batteryLevel < 20 ? 'text-red-500' : 'text-green-600'} />
            {Math.floor(batteryLevel)}% Accu
          </div>
          <div className="text-slate-500 text-sm font-semibold">
            Bereik: ± {Math.floor(batteryLevel * 0.4)} km
          </div>
        </div>
        <div className={`mt-3 text-sm font-semibold flex items-center gap-2 ${gps.status === 'ok' ? 'text-green-700' : 'text-amber-700'}`}>
          <LocateFixed size={18} />
          {gps.status === 'ok'
            ? `Locatie gevonden (nauwkeurig tot ± ${Math.round(gps.position.accuracy)} m)`
            : LOCATION_MESSAGES[gps.status]}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 flex-grow">
        <BigButton icon={MapPin} label="Nieuwe Rit" onClick={() => setView('map')} color="blue" />
        <BigButton icon={Home} label="Naar Huis" onClick={goHome} color="green" disabled={isNavigating} />
        <BigButton icon={Settings} label="Instellingen" onClick={() => setView('settings')} color="gray" />
        <BigButton icon={AlertTriangle} label="NOODKNOP" onClick={() => setView('sos')} color="red" />
      </div>
    </div>
  );

  const switchPlanMode = (mode) => {
    setPlanMode(mode);
    setMessage('');
    setResults(null);
    // Knooppunten liggen kilometers uit elkaar: kaart iets uitzoomen en niet meer volgen
    if (mode === 'knooppunt') setFollow(false);
  };

  const Toggle = ({ id, checked, onChange, label }) => (
    <label htmlFor={id} className="flex items-center justify-between gap-3 py-1 cursor-pointer">
      <span className="font-semibold text-slate-700">{label}</span>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`w-14 h-8 shrink-0 rounded-full relative transition-colors ${checked ? 'bg-green-500' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-1 bg-white w-6 h-6 rounded-full shadow-md transition-all ${checked ? 'right-1' : 'left-1'}`}></span>
      </button>
    </label>
  );

  const renderKnooppuntPlanner = () => (
    <div className="space-y-3">
      {kpSelected.length === 0 ? (
        <p className="text-slate-700 font-medium">
          Tik op de <span className="inline-block bg-green-700 text-white rounded-full px-2 font-bold">groene bordjes</span> op
          de kaart, in de volgorde waarin u wilt rijden.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Gekozen knooppunten">
          {kpStartAtMe && <span className="px-2 py-1 rounded-lg bg-slate-100 font-semibold text-slate-600">Ik</span>}
          {kpSelected.map((n, i) => (
            <React.Fragment key={i}>
              {(i > 0 || kpStartAtMe) && <span className="text-slate-400 font-bold">→</span>}
              <span className="min-w-[2.25rem] text-center px-2 py-1 rounded-lg bg-blue-700 text-white font-bold">{n.ref}</span>
            </React.Fragment>
          ))}
          {kpRoundTrip && <><span className="text-slate-400 font-bold">→</span><span className="px-2 py-1 rounded-lg bg-slate-100 font-semibold text-slate-600">Start</span></>}
        </div>
      )}

      <div className="border-y border-slate-200 py-1">
        <Toggle id="kp-start" checked={kpStartAtMe} onChange={setKpStartAtMe} label="Start bij mijn locatie" />
        <Toggle id="kp-rond" checked={kpRoundTrip} onChange={setKpRoundTrip} label="Rondrit: terug naar start" />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setKpSelected((s) => s.slice(0, -1))}
          disabled={!kpSelected.length}
          className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-700 disabled:opacity-40"
        >Laatste weg</button>
        <button
          onClick={() => setKpSelected([])}
          disabled={!kpSelected.length}
          className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-700 disabled:opacity-40"
        >Alles wissen</button>
      </div>
      <BigButton
        label="Bereken route"
        icon={Navigation}
        onClick={planKnooppuntRoute}
        fullWidth
        color="blue"
        disabled={busy || kpSelected.length === 0}
      />
    </div>
  );

  const renderAdresPlanner = () => (
    <>
      <form onSubmit={onSearch} className="relative">
        <Search className="absolute left-3 top-4 text-slate-400" size={24} />
        <input
          id="bestemming"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Waar wilt u heen?"
          enterKeyHint="search"
          className="w-full pl-12 pr-24 py-4 text-lg border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
        />
        <button type="submit" disabled={busy} className="absolute right-2 top-2 bottom-2 px-4 bg-blue-600 text-white rounded-lg font-bold disabled:opacity-50">
          Zoek
        </button>
      </form>
      {results && results.length > 0 && (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
          {results.map((r, i) => (
            <li key={i}>
              <button onClick={() => planRoute(r)} className="w-full text-left p-3 flex gap-3 items-start hover:bg-slate-50 active:bg-slate-100">
                <MapPin size={22} className="text-red-500 shrink-0 mt-0.5" />
                <span className="font-medium text-slate-800">{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  const BATTERY_STYLE = {
    green: 'bg-green-50 border-green-200 text-green-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    red: 'bg-red-50 border-red-300 text-red-800'
  };

  const renderPlanner = () => (
    <div className="p-4 space-y-3 max-h-[55vh] overflow-y-auto">
      {!route && (
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl" role="tablist" aria-label="Manier van plannen">
          {[['adres', 'Adres zoeken'], ['knooppunt', 'Knooppunten']].map(([mode, label]) => (
            <button
              key={mode}
              role="tab"
              aria-selected={planMode === mode}
              onClick={() => switchPlanMode(mode)}
              className={`py-2.5 rounded-lg font-bold ${planMode === mode ? 'bg-white shadow text-blue-700' : 'text-slate-600'}`}
            >{label}</button>
          ))}
        </div>
      )}

      {!route && (planMode === 'adres' ? renderAdresPlanner() : renderKnooppuntPlanner())}

      {busy && (
        <div className="flex items-center gap-2 text-slate-600 font-semibold">
          <Loader2 size={20} className="animate-spin" /> Even geduld…
        </div>
      )}

      {message && <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 font-medium">{message}</p>}

      {route && (() => {
        const check = batteryCheck(route.distance, route.roundTrip);
        return (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <MapPin size={26} className="text-red-500 shrink-0 mt-1" />
              <div className="flex-grow min-w-0">
                <div className="font-bold text-lg leading-tight break-words">{destination?.label}</div>
                <div className="text-slate-600 font-semibold mt-1">
                  {formatDistance(route.distance)} · ± {minutesFor(route.distance)} min
                </div>
              </div>
              <button onClick={clearRoute} aria-label={planMode === 'knooppunt' ? 'Route aanpassen' : 'Andere bestemming'} className="p-2 bg-slate-100 rounded-full shrink-0">
                <X size={22} />
              </button>
            </div>
            <p className={`border rounded-lg p-3 font-semibold flex gap-2 items-start ${BATTERY_STYLE[check.level]}`}>
              <Battery size={22} className="shrink-0 mt-0.5" /> {check.text}
            </p>
            {vehicleType === 'scootmobiel' && (
              <p className="text-sm text-slate-600">Scootmobielroute: zonder trappen, onverharde paden en pontjes, met zo weinig mogelijk hellingen en drukke wegen.</p>
            )}
            <BigButton label="Start Route" icon={Navigation} onClick={() => startNavigation(route, false)} fullWidth color="blue" disabled={!gps.position} />
            {!gps.position && <p className="text-sm text-slate-600">Starten kan zodra uw locatie bekend is. Probeer intussen de demo-rit.</p>}
            <button onClick={() => startNavigation(route, true)} className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-2">
              <Play size={20} /> Demo-rit (zonder rijden)
            </button>
          </div>
        );
      })()}
    </div>
  );

  const renderMap = () => (
    <div className="relative h-full w-full flex flex-col bg-slate-100">
      {/* Top Bar Overlay */}
      <div className="absolute top-0 left-0 right-0 z-[20] bg-white/90 backdrop-blur-sm p-2 shadow-md flex justify-between items-center px-4">
        <button onClick={() => setView('home')} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200" aria-label="Naar menu">
          <Home size={24} className="text-slate-700" />
        </button>
        <div className="text-xl font-bold text-slate-800">
          {isNavigating ? (demo ? "Demo-rit" : "Onderweg") : (planMode === 'knooppunt' ? "Plan uw route" : "Kies Bestemming")}
        </div>
        <div className={`font-bold ${batteryLevel < 20 ? 'text-red-600' : 'text-green-600'}`}>
          {Math.floor(batteryLevel)}%
        </div>
      </div>

      {/* Instructiebalk tijdens het rijden */}
      {isNavigating && upcomingStep && (
        <div className="absolute top-16 left-2 right-2 z-[20] bg-blue-700 text-white rounded-xl shadow-lg p-3 flex items-center gap-3">
          {upcomingStep.kind === 'node'
            ? <span className="kp-icon shrink-0" aria-hidden="true">{upcomingStep.ref}</span>
            : <Navigation size={36} className="shrink-0" />}
          <div className="min-w-0">
            <div className="text-2xl font-bold leading-tight">{formatDistance(distToUpcoming)}</div>
            <div className="text-lg font-semibold leading-tight break-words">{upcomingStep.text}</div>
          </div>
        </div>
      )}

      {/* Kaart */}
      <div className="flex-grow relative isolate">
        <RealMap
          position={position}
          route={route}
          destination={destination}
          follow={follow}
          setFollow={setFollow}
          isNavigating={isNavigating}
          knooppunten={planMode === 'knooppunt' && !isNavigating ? kpNodes : []}
          netwerk={planMode === 'knooppunt' && !isNavigating ? kpLines : []}
          selected={kpSelected}
          onNodeClick={onNodeClick}
          onMove={onMapMove}
          planLine={planLine}
          overviewZoom={planMode === 'knooppunt' && !route && !isNavigating ? KP_OVERVIEW_ZOOM : null}
        />
        {planMode === 'knooppunt' && !route && !isNavigating && kpStatus && (
          <div className="absolute left-2 right-2 top-16 z-[500] bg-white/95 border border-slate-200 text-slate-800 rounded-lg p-3 font-semibold shadow flex items-center gap-2">
            {kpStatus === 'laden' && <><Loader2 size={20} className="animate-spin" /> Knooppunten laden…</>}
            {kpStatus === 'zoom' && 'Zoom verder in om de knooppunten te zien.'}
            {kpStatus === 'fout' && <>Knooppunten laden lukt nu niet. <button onClick={() => { kpLoaded.current = null; loadKnooppunten(); }} className="underline text-blue-700">Opnieuw</button></>}
          </div>
        )}
        {!follow && position && (
          <button
            onClick={() => setFollow(true)}
            aria-label="Naar mijn locatie"
            className={`absolute right-3 z-[500] bg-white p-3 rounded-full shadow-lg ${isNavigating ? 'bottom-28' : 'bottom-3'}`}
          >
            <LocateFixed size={28} className="text-blue-600" />
          </button>
        )}
        {!position && gps.status !== 'ok' && !demo && (
          <div className="absolute left-2 right-2 top-16 z-[500] bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3 font-medium shadow">
            {LOCATION_MESSAGES[gps.status]}
          </div>
        )}
      </div>

      {/* Bottom Dashboard */}
      <div className="relative z-[20] bg-white border-t-2 border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        {!isNavigating ? renderPlanner() : (
          <div className="flex flex-row items-center justify-between p-4 bg-slate-50 gap-2">
            <div className="flex flex-col items-center w-24">
               <span className="text-slate-500 font-semibold text-xs uppercase">Snelheid</span>
               <span className="text-3xl font-bold text-slate-800 tabular-nums">{speed} <span className="text-sm">km/u</span></span>
            </div>

            <div className="flex flex-col items-center px-2 border-l border-r border-slate-200 flex-grow">
               <span className="text-slate-500 font-semibold text-xs uppercase">Nog te gaan</span>
               <span className="text-2xl font-bold tabular-nums">{formatDistance(remaining)}</span>
               <span className="text-slate-600 font-semibold text-sm">± {minutesFor(remaining || 0)} min</span>
            </div>

            <button
              onClick={() => setShowExitModal(true)}
              className="bg-red-100 text-red-700 p-3 rounded-xl font-bold flex flex-col items-center justify-center h-full active:bg-red-200 min-w-[80px]"
            >
              <span className="text-sm">STOP</span>
            </button>
          </div>
        )}
      </div>

      {/* Exit Modal */}
      {showExitModal && (
        <div className="absolute inset-0 z-[1000] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl">
            <h3 className="text-2xl font-bold mb-4">Route stoppen?</h3>
            <div className="flex gap-4">
              <button onClick={() => setShowExitModal(false)} className="flex-1 py-4 bg-slate-200 rounded-xl font-bold text-lg">Nee, doorgaan</button>
              <button onClick={() => finishNavigation(false)} className="flex-1 py-4 bg-red-600 text-white rounded-xl font-bold text-lg">Ja, stop</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderSOS = () => (
    <div className="flex flex-col h-full bg-red-50 p-6">
      <h2 className="text-3xl font-bold text-red-700 text-center mb-8">NOOD OPROEP</h2>
      
      <div className="bg-white p-6 rounded-2xl shadow-md mb-6 text-center border-2 border-red-100">
        <p className="text-slate-600 text-lg mb-2">Uw noodcontact:</p>
        <p className="text-2xl font-bold text-slate-900">{contactName}</p>
        <p className="text-slate-600 text-lg mt-4">Uw locatie nu:</p>
        <p className="text-slate-800 font-semibold">
          {position
            ? (sosAddress || `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`)
            : 'Uw locatie is nog niet bekend'}
        </p>
        {position && (
          <a href={osmLink(position)} target="_blank" rel="noreferrer" className="text-blue-700 underline text-sm">
            Bekijk op de kaart
          </a>
        )}
      </div>

      <a
        href={toTelHref(contactPhone)}
        className="bg-red-600 text-white w-full py-8 rounded-2xl text-2xl font-bold shadow-lg animate-pulse flex items-center justify-center gap-3 mb-4 active:scale-95 transition-transform"
      >
        <Phone size={32} />
        BEL {contactName.toUpperCase()}
      </a>

      {position && (
        <a
          href={`sms:${cleanPhone(contactPhone)}?body=${encodeURIComponent(`Ik heb hulp nodig. Mijn locatie: ${sosAddress ? sosAddress + ' - ' : ''}${osmLink(position)}`)}`}
          className="bg-white text-red-700 border-2 border-red-200 w-full py-4 rounded-2xl text-xl font-bold flex items-center justify-center gap-3 mb-4"
        >
          <MessageSquare size={26} />
          Stuur mijn locatie per sms
        </a>
      )}

      <div className="text-center text-slate-500 font-medium mb-4">
        Telefoonnummer: {contactPhone}
      </div>

      <button onClick={() => setView('home')} className="mt-auto bg-slate-200 text-slate-800 w-full py-4 rounded-xl font-bold text-lg">
        Terug naar Menu
      </button>
    </div>
  );

  const renderSettings = () => (
    <div className="flex flex-col h-full bg-slate-50 p-4 overflow-y-auto">
       <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setView('home')} className="p-2 bg-white rounded-full shadow-sm">
            <Home size={24} />
          </button>
          <h2 className="text-2xl font-bold text-slate-800">Instellingen</h2>
       </div>

       <div className="space-y-4">
         {/* Nieuw blok: Persoonlijke Gegevens */}
         <div className="bg-white p-4 rounded-xl shadow-sm space-y-4 border-l-4 border-blue-500">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <User size={20} className="text-blue-500" />
              Persoonlijke Gegevens
            </h3>
            
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">Thuisadres</label>
              <div className="relative">
                <Home size={20} className="absolute left-3 top-3.5 text-slate-400" />
                <input 
                  type="text" 
                  value={homeAddress}
                  onChange={(e) => setHomeAddress(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">Naam Noodcontact</label>
              <div className="relative">
                <User size={20} className="absolute left-3 top-3.5 text-slate-400" />
                <input 
                  type="text" 
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none font-medium"
                />
              </div>
            </div>

             <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">Telefoonnummer Noodcontact</label>
              <div className="relative">
                <Phone size={20} className="absolute left-3 top-3.5 text-slate-400" />
                <input 
                  type="tel" 
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none font-medium"
                />
              </div>
            </div>
         </div>

         <div className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center">
            <span className="text-lg font-medium">Tekstgrootte</span>
            <div className="flex gap-2 items-center">
              <button
                onClick={() => changeTextScale(-0.1)}
                disabled={textScale <= TEXT_SCALE_MIN}
                aria-label="Tekst kleiner"
                className="p-2 bg-slate-100 rounded-lg active:bg-slate-200 disabled:opacity-40"
              ><Minus size={20}/></button>
              <span className="w-14 text-center font-bold tabular-nums">{Math.round(textScale * 100)}%</span>
              <button
                onClick={() => changeTextScale(0.1)}
                disabled={textScale >= TEXT_SCALE_MAX}
                aria-label="Tekst groter"
                className="p-2 bg-slate-100 rounded-lg active:bg-slate-200 disabled:opacity-40"
              ><Plus size={20}/></button>
            </div>
         </div>

         <div className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-lg font-medium">Spraakbegeleiding</span>
              <span className="text-slate-500 text-sm">Routes hardop voorlezen</span>
            </div>
            <button
              role="switch"
              aria-checked={voiceEnabled}
              aria-label="Spraakbegeleiding"
              onClick={toggleVoice}
              className={`w-14 h-8 rounded-full relative cursor-pointer transition-colors ${voiceEnabled ? 'bg-green-500' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-1 bg-white w-6 h-6 rounded-full shadow-md transition-all ${voiceEnabled ? 'right-1' : 'left-1'}`}></span>
            </button>
         </div>

         <div className="bg-white p-4 rounded-xl shadow-sm">
            <span className="text-lg font-medium block mb-2">Vervoerstype</span>
            <div className="flex gap-2">
               {[['scootmobiel', 'Scootmobiel'], ['fiets', 'Elektrische Fiets']].map(([value, label]) => (
                 <button
                   key={value}
                   onClick={() => setVehicleType(value)}
                   aria-pressed={vehicleType === value}
                   className={`flex-1 py-2 rounded-lg font-medium ${vehicleType === value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                 >{label}</button>
               ))}
            </div>
         </div>

         <button
            onClick={() => {
              // Instellingen worden al automatisch bewaard bij elke wijziging
              alert("Instellingen zijn opgeslagen!");
              setView('home');
            }}
            className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg shadow-md mt-4 hover:bg-green-700 active:scale-95 transition-transform"
         >
            Opslaan & Terug
         </button>
       </div>
    </div>
  );

  return (
    <div className="h-screen w-full bg-slate-100 flex items-center justify-center font-sans">
      <div className="w-full max-w-md h-full sm:h-[90vh] sm:rounded-[30px] overflow-hidden bg-white shadow-2xl relative flex flex-col border-4 border-slate-800">
        
        {/* Main Content Area */}
        <div className="flex-grow overflow-hidden relative">
          {view === 'home' && renderHome()}
          {view === 'map' && renderMap()}
          {view === 'sos' && renderSOS()}
          {view === 'settings' && renderSettings()}
        </div>

      </div>
    </div>
  );
}