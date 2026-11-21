import React, { useState, useEffect, useRef } from 'react';
import { Battery, Navigation, AlertTriangle, Settings, Home, MapPin, Phone, Minus, Plus, Search, User, LocateFixed, X, MessageSquare, Play, Loader2, ChevronRight, Clock, Octagon, ArrowLeft, Accessibility, ShieldAlert, Volume2, Type, Bike, Sparkles, Gauge, HelpCircle } from 'lucide-react';
import logo from './assets/logo.svg';
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { App as NativeApp } from '@capacitor/app';

// Draait de app als Android-app (APK) in plaats van in de browser?
const isNativeApp = Capacitor.isNativePlatform();
import RealMap from './RealMap';
import Splash from './Splash';
import Onboarding, { RANGE_MIN, RANGE_MAX } from './Onboarding';
import BatteryPrompt from './BatteryPrompt';
import { useLocation } from './useLocation';
import { searchAddress, reverseGeocode, fetchRoute, fetchHazards, fetchKnooppunten, fetchKnooppuntNetwerk, loadStaticKnooppunten, staticKnooppuntenReady, knooppuntenIn } from './services';
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
  vehicleType: 'scootmobiel',
  fullRangeKm: 40,     // hoe ver de scootmobiel komt met een volle accu
  batteryLevel: 85,    // laatst opgegeven accustand (voorstel bij de volgende start)
  introSeen: false     // uitleg al bekeken?
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
const KP_LOAD_DELAY_MS = 600;

// Waarschuw voor een gevaarlijke oversteek als u er zo dichtbij bent (meters)
const HAZARD_WARN_M = 80;

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

// Grote actieknop (o.a. "Start Route", "Bereken route")
const BigButton = ({ icon: Icon, label, onClick, color = "blue", fullWidth = false, disabled = false }) => {
  const colorClasses = {
    blue: "bg-gradient-to-b from-brand-500 to-brand-700 text-white shadow-glow hover:from-brand-600 hover:to-brand-800",
    red: "bg-gradient-to-b from-red-500 to-red-700 text-white shadow-float",
    green: "bg-gradient-to-b from-emerald-500 to-emerald-700 text-white shadow-float",
    gray: "bg-white text-ink border border-slate-200 shadow-card"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${colorClasses[color]} ${fullWidth ? 'w-full' : 'flex-1'}
      min-h-[64px] px-5 rounded-2xl transition active:scale-[0.98] flex items-center justify-center gap-3
      font-display text-lg font-bold tracking-tight disabled:opacity-45 disabled:shadow-none disabled:active:scale-100`}
    >
      <Icon size={26} strokeWidth={2.4} />
      <span>{label}</span>
    </button>
  );
};

// Tegel op het startscherm: icoon, titel en korte uitleg
const Tile = ({ icon: Icon, title, subtitle, onClick, tone = 'white', disabled = false }) => {
  const tones = {
    white: { box: 'bg-white text-ink border border-slate-200/80 shadow-card', icon: 'bg-brand-50 text-brand-700', sub: 'text-slate-500' },
    brand: { box: 'bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-glow', icon: 'bg-white/15 text-white', sub: 'text-brand-100' },
    green: { box: 'bg-white text-ink border border-slate-200/80 shadow-card', icon: 'bg-emerald-50 text-emerald-700', sub: 'text-slate-500' },
    red: { box: 'bg-gradient-to-br from-red-500 to-red-700 text-white shadow-float', icon: 'bg-white/15 text-white', sub: 'text-red-100' }
  }[tone];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${tones.box} rounded-3xl p-4 text-left flex flex-col gap-3 min-h-[132px] transition active:scale-[0.98] disabled:opacity-45`}
    >
      <span className={`${tones.icon} w-12 h-12 rounded-2xl flex items-center justify-center`}>
        <Icon size={26} strokeWidth={2.2} />
      </span>
      <span className="mt-auto">
        <span className="block font-display text-lg font-bold leading-tight tracking-tight">{title}</span>
        <span className={`block text-sm font-medium leading-snug ${tones.sub}`}>{subtitle}</span>
      </span>
    </button>
  );
};

// Ronde zwevende knop boven de kaart
const FloatButton = ({ onClick, label, children, className = '' }) => (
  <button
    onClick={onClick}
    aria-label={label}
    className={`w-12 h-12 rounded-full bg-white/95 backdrop-blur shadow-float flex items-center justify-center text-ink active:scale-95 transition ${className}`}
  >
    {children}
  </button>
);

const greeting = () => {
  const h = new Date().getHours();
  if (h < 6) return 'Goedenacht';
  if (h < 12) return 'Goedemorgen';
  if (h < 18) return 'Goedemiddag';
  return 'Goedenavond';
};

// Aan/uit-schakelaar in huisstijl
const Switch = ({ id, checked, onClick, label }) => (
  <button
    id={id}
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={onClick}
    className={`w-[3.25rem] h-8 shrink-0 rounded-full relative transition-colors ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}
  >
    <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${checked ? 'left-[1.5rem]' : 'left-1'}`}></span>
  </button>
);

const Toggle = ({ id, checked, onChange, label }) => (
  <label htmlFor={id} className="flex items-center justify-between gap-3 py-2.5 cursor-pointer">
    <span className="font-semibold text-ink">{label}</span>
    <Switch id={id} checked={checked} onClick={() => onChange(!checked)} label={label} />
  </label>
);

// Kop van een scherm met terugknop
const ScreenHeader = ({ title, tone = 'light', onBack }) => (
  <div className="flex items-center gap-3 px-4 pt-4 pb-3">
    <button
      onClick={onBack}
      aria-label="Terug naar menu"
      className={`w-11 h-11 rounded-full flex items-center justify-center transition active:scale-95 ${tone === 'light' ? 'bg-white shadow-card text-ink' : 'bg-white/15 text-white'}`}
    >
      <ArrowLeft size={22} />
    </button>
    <h2 className={`font-display text-2xl font-extrabold tracking-tight ${tone === 'light' ? 'text-ink' : 'text-white'}`}>{title}</h2>
  </div>
);

const SettingsGroup = ({ title, children }) => (
  <section>
    <h3 className="px-1 mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{title}</h3>
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card divide-y divide-slate-100">{children}</div>
  </section>
);

const RowIcon = ({ icon: Icon, tone = 'brand' }) => (
  <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone === 'brand' ? 'bg-brand-50 text-brand-700' : 'bg-emerald-50 text-emerald-700'}`}>
    <Icon size={20} />
  </span>
);


export default function ScootNavApp() {
  const [view, setView] = useState('home'); // home, map, settings, sos
  // Opstarten: opstartscherm -> uitleg (alleen de eerste keer) -> accuvraag -> app
  const [stage, setStage] = useState('splash'); // 'splash' | 'intro' | 'battery' | 'app'
  const [showExitModal, setShowExitModal] = useState(false);

  // Persoonlijke instellingen (worden bewaard in de browser)
  const [saved] = useState(loadSettings);
  const [homeAddress, setHomeAddress] = useState(saved.homeAddress);
  const [contactName, setContactName] = useState(saved.contactName);
  const [contactPhone, setContactPhone] = useState(saved.contactPhone);
  const [textScale, setTextScale] = useState(saved.textScale);
  const [voiceEnabled, setVoiceEnabled] = useState(saved.voiceEnabled);
  const [vehicleType, setVehicleType] = useState(saved.vehicleType);
  const [fullRangeKm, setFullRangeKm] = useState(saved.fullRangeKm);
  const [introSeen, setIntroSeen] = useState(saved.introSeen);
  const [batteryLevel, setBatteryLevel] = useState(saved.batteryLevel);

  // Bereik in km bij de huidige accustand
  const rangeKm = (batteryLevel / 100) * fullRangeKm;

  const openBatteryPrompt = () => {
    setBatteryLevel((b) => Math.round(b / 5) * 5);
    setStage('battery');
  };

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

  // Accu: er is (nog) geen koppeling met de scootmobiel, dus dit is een schatting.
  // Onderweg loopt de accu terug naar rato van de gereden afstand:
  // een volle accu (100%) is op na het bereik dat u bij Instellingen opgaf.
  const lastBatteryPos = useRef(null);
  useEffect(() => {
    if (!isNavigating || !position) { lastBatteryPos.current = null; return; }
    const prev = lastBatteryPos.current;
    lastBatteryPos.current = position;
    if (!prev) return;
    const meters = distance(prev, position);
    if (meters > 0 && meters < 200) { // grote sprongen zijn GPS-fouten, niet meetellen
      setBatteryLevel((b) => Math.max(0, b - (meters / 1000 / fullRangeKm) * 100));
    }
  }, [position, isNavigating]);

  // Instellingen automatisch bewaren bij elke wijziging
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        homeAddress, contactName, contactPhone, textScale, voiceEnabled, vehicleType,
        fullRangeKm, introSeen, batteryLevel: Math.round(batteryLevel)
      }));
    } catch (e) {
      // Opslag niet beschikbaar (bijv. privévenster): app werkt gewoon door
    }
  }, [homeAddress, contactName, contactPhone, textScale, voiceEnabled, vehicleType, fullRangeKm, introSeen, Math.round(batteryLevel)]);

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
  // queue: achter de lopende melding aan zetten in plaats van die te onderbreken
  const say = (text, force = false, queue = false) => {
    if (!(voiceRef.current || force)) return;
    if (isNativeApp) {
      // In de Android-app: de spraak van Android zelf (de browserspraak werkt daar niet)
      TextToSpeech.speak({ text, lang: 'nl-NL', rate: 0.95, queueStrategy: queue ? 1 : 0 }).catch(() => {});
      return;
    }
    if (!('speechSynthesis' in window)) return;
    if (!queue) window.speechSynthesis.cancel();
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
    } else if (isNativeApp) {
      TextToSpeech.stop().catch(() => {});
    } else if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };


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
    const full = { ...r, waypoints: points, roundTrip: !!dest.roundTrip, hazards: null };
    setDestination(dest);
    setRoute(full);
    setStepIndex(0);
    setFollow(false);
    setMessage(note);
    // Te ver voor de accu? Ook hardop waarschuwen
    if (batteryCheck(r.distance, !!dest.roundTrip).level === 'red') {
      say('Let op: deze route is langer dan het bereik van uw scootmobiel.');
    }
    addHazards(full);
    return full;
  };

  // Gevaarlijke oversteken op de achtergrond opzoeken en aan de route toevoegen
  const addHazards = (r) => {
    fetchHazards(r.coords, vehicleType).then((hazards) => {
      setRoute((current) => (current && current.coords === r.coords ? { ...current, hazards } : current));
    });
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
  const [kpStatus, setKpStatus] = useState(''); // '', 'zoom', 'laden', 'leeg', 'fout'
  const mapView = useRef(null);
  const kpLoaded = useRef(null);

  const [kpError, setKpError] = useState('');
  const kpTimer = useRef(null);
  const kpAbort = useRef(null);

  // Knooppunten ophalen voor het zichtbare gebied. Wacht tot de kaart even stilstaat
  // en doet maar één aanvraag tegelijk (de gratis dienst weigert te veel aanvragen).
  const loadKnooppunten = () => {
    clearTimeout(kpTimer.current);
    // Meegeleverde knooppunten zijn al in het geheugen: meteen tonen, niet wachten
    if (staticKnooppuntenReady()) doLoadKnooppunten();
    else kpTimer.current = setTimeout(doLoadKnooppunten, KP_LOAD_DELAY_MS);
  };

  // De knooppunten al tijdens het opstartscherm inladen, zodat ze direct klaarstaan
  useEffect(() => { loadStaticKnooppunten(); }, []);

  const doLoadKnooppunten = async () => {
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
    const padLat = (b.north - b.south) * 0.25, padLng = (b.east - b.west) * 0.25;
    const area = { south: b.south - padLat, north: b.north + padLat, west: b.west - padLng, east: b.east + padLng };

    kpAbort.current?.abort(); // een oudere aanvraag die nog loopt is niet meer nodig
    const controller = new AbortController();
    kpAbort.current = controller;
    if (!staticKnooppuntenReady()) setKpStatus('laden');
    try {
      // Eerst de meegeleverde knooppunten; alleen als die er niet zijn, live ophalen
      const bundled = await loadStaticKnooppunten();
      const nodes = bundled.length
        ? knooppuntenIn(bundled, area)
        : await fetchKnooppunten(area, controller.signal);
      // Samenvoegen met wat al geladen was, zodat bordjes niet verdwijnen bij schuiven
      setKpNodes((old) => {
        const byId = new Map(old.map((n) => [n.id, n]));
        nodes.forEach((n) => byId.set(n.id, n));
        return [...byId.values()];
      });
      kpLoaded.current = area;
      setKpStatus(nodes.length ? '' : 'leeg');
    } catch (e) {
      if (e.name !== 'AbortError') {
        setKpError(e.message || String(e));
        setKpStatus('fout');
      }
      return;
    }
    // Daarna de groene lijnen; als dat mislukt, werken de knooppunten gewoon
    try {
      const lines = await fetchKnooppuntNetwerk(area, controller.signal);
      setKpLines((old) => {
        const byId = new Map(old.map((w) => [w.id, w]));
        lines.forEach((w) => byId.set(w.id, w));
        return [...byId.values()];
      });
    } catch (e) {
      // lijnen zijn alleen ter ondersteuning
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
  const warnedHazards = useRef(new Set());

  const startNavigation = (r = route, asDemo = false) => {
    if (!r) return;
    announced.current = {};
    warnedHazards.current = new Set();
    minDistToNext.current = Infinity;
    setStepIndex(0);
    setDemo(asDemo);
    setDemoPos(asDemo ? { ...r.coords[0] } : null);
    setIsNavigating(true);
    setFollow(true);
    setView('map');
    const first = r.steps[1];
    say(`Daar gaan we! ${first ? first.text : ''}`);
  };

  const finishNavigation = (arrived) => {
    setIsNavigating(false);
    setDemo(false);
    setDemoPos(null);
    setShowExitModal(false);
    setFollow(true);
    if (arrived) {
      say("We zijn er!");
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

    // Gevaarlijke oversteek in de buurt? Eén keer waarschuwen per oversteek
    for (const h of route.hazards || []) {
      const key = `${h.lat.toFixed(5)},${h.lng.toFixed(5)}`;
      const d = distance(position, h);
      if (d < HAZARD_WARN_M && !warnedHazards.current.has(key)) {
        warnedHazards.current.add(key);
        say(d > 25
          ? `Let op! ${spokenDistance(d)} steekt u een drukke weg over. Kijk goed uit.`
          : 'Let op! U steekt een drukke weg over. Kijk goed uit.', false, true);
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
          const fresh = { ...r, waypoints: [here, ...remainingPoints], roundTrip: route.roundTrip, hazards: null };
          setRoute(fresh);
          addHazards(fresh);
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

  // Terugknop van de Android-telefoon: naar het menu, of de app sluiten vanaf het menu
  const backState = useRef({});
  backState.current = { view, stage, showExitModal };
  useEffect(() => {
    if (!isNativeApp) return;
    const handle = NativeApp.addListener('backButton', () => {
      const st = backState.current;
      if (st.showExitModal) setShowExitModal(false);
      else if (st.stage === 'battery' || st.stage === 'intro') setStage('app');
      else if (st.view !== 'home') setView('home');
      else NativeApp.exitApp();
    });
    return () => { handle.then((h) => h.remove()).catch(() => {}); };
  }, []);

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
  const batteryColor = batteryLevel < 20 ? 'bg-red-400' : batteryLevel < 40 ? 'bg-amber-300' : 'bg-emerald-300';

  const renderHome = () => (
    <div className="flex flex-col h-full overflow-y-auto bg-canvas">
      {/* Kopblok met logo, begroeting, accu en locatie */}
      <header className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 text-white px-5 pt-6 pb-7 rounded-b-[2rem] shadow-card">
        <div className="absolute -right-16 -top-20 w-56 h-56 rounded-full bg-white/5" aria-hidden="true"></div>
        <div className="absolute -right-6 top-20 w-28 h-28 rounded-full bg-white/5" aria-hidden="true"></div>

        <div className="relative flex items-center gap-3">
          <img src={logo} alt="" className="w-11 h-11 rounded-xl ring-2 ring-white/25" />
          <div>
            <div className="font-display text-xl font-extrabold tracking-tight leading-none">ScootNav</div>
            <div className="text-sm text-brand-200 font-medium">Met de scoot van A naar B</div>
          </div>
        </div>

        <h2 className="relative mt-6 font-display text-3xl font-extrabold tracking-tight">{greeting()}!</h2>

        <button
          onClick={openBatteryPrompt}
          aria-label="Accustand aanpassen"
          className="relative mt-4 w-full text-left rounded-2xl bg-white/10 border border-white/15 p-4 backdrop-blur-sm transition hover:bg-white/15 active:scale-[0.99]"
        >
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-2">
              <Battery size={24} className={batteryLevel < 20 ? 'text-red-300' : 'text-emerald-300'} />
              <span className="font-display text-3xl font-extrabold tabular-nums leading-none">{Math.floor(batteryLevel)}%</span>
              <span className="text-brand-200 font-semibold">accu</span>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-brand-200 font-semibold">Bereik</div>
              <div className="font-display text-lg font-bold tabular-nums">± {Math.floor(rangeKm)} km</div>
            </div>
          </div>
          <div className="mt-3 h-2.5 rounded-full bg-white/15 overflow-hidden" aria-hidden="true">
            <div className={`h-full rounded-full ${batteryColor}`} style={{ width: `${Math.max(3, batteryLevel)}%` }}></div>
          </div>
          <div className="mt-2 text-xs font-semibold text-brand-200">Tik om de accustand aan te passen</div>
        </button>

        <div className={`relative mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${gps.status === 'ok' ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-400/15 text-amber-200'}`}>
          <LocateFixed size={16} />
          {gps.status === 'ok'
            ? `Locatie gevonden (nauwkeurig tot ± ${Math.round(gps.position.accuracy)} m)`
            : LOCATION_MESSAGES[gps.status]}
        </div>
      </header>

      {/* Acties */}
      <main className="px-4 py-5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Tile icon={MapPin} title="Nieuwe Rit" subtitle="Zoek een adres" onClick={() => setView('map')} tone="brand" />
          <Tile icon={Home} title="Naar Huis" subtitle="Direct op weg" onClick={goHome} disabled={isNavigating} />
          <Tile icon={Settings} title="Instellingen" subtitle="Contact, tekst, spraak" onClick={() => setView('settings')} />
          <Tile icon={AlertTriangle} title="NOODKNOP" subtitle="Bel of sms hulp" onClick={() => setView('sos')} tone="red" />
        </div>

        <button
          onClick={openKnooppunten}
          disabled={isNavigating}
          className="w-full bg-white border border-slate-200/80 shadow-card rounded-3xl p-4 flex items-center gap-4 text-left transition active:scale-[0.98] disabled:opacity-45"
        >
          <span className="kp-icon shrink-0" aria-hidden="true">12</span>
          <span className="flex-grow min-w-0">
            <span className="block font-display text-lg font-bold tracking-tight text-ink">Knooppuntroute maken</span>
            <span className="block text-sm font-medium text-slate-500">Tik zelf de fietsknooppunten aan</span>
          </span>
          <ChevronRight size={24} className="text-slate-400 shrink-0" />
        </button>
      </main>
    </div>
  );

  const switchPlanMode = (mode) => {
    setPlanMode(mode);
    setMessage('');
    setResults(null);
    // Knooppunten liggen kilometers uit elkaar: kaart iets uitzoomen en niet meer volgen
    if (mode === 'knooppunt') setFollow(false);
  };

  // Vanaf het startscherm direct naar het plannen met knooppunten
  const openKnooppunten = () => {
    setRoute(null);
    setDestination(null);
    switchPlanMode('knooppunt');
    setView('map');
  };

  const secondaryBtn = 'flex-1 min-h-[48px] bg-slate-100 hover:bg-slate-200 rounded-2xl font-semibold text-ink transition active:scale-[0.98] disabled:opacity-40';

  const renderKnooppuntPlanner = () => (
    <div className="space-y-3">
      {kpSelected.length === 0 ? (
        <p className="text-slate-600 font-medium leading-relaxed">
          Tik op de <span className="inline-block bg-green-700 text-white rounded-full px-2 font-bold">groene bordjes</span> op
          de kaart, in de volgorde waarin u wilt rijden.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Gekozen knooppunten">
          {kpStartAtMe && <span className="px-2.5 py-1 rounded-full bg-slate-100 font-semibold text-slate-600">Ik</span>}
          {kpSelected.map((n, i) => (
            <React.Fragment key={i}>
              {(i > 0 || kpStartAtMe) && <ChevronRight size={16} className="text-slate-400" />}
              <span className="min-w-[2.25rem] text-center px-2.5 py-1 rounded-full bg-brand-700 text-white font-bold tabular-nums">{n.ref}</span>
            </React.Fragment>
          ))}
          {kpRoundTrip && <><ChevronRight size={16} className="text-slate-400" /><span className="px-2.5 py-1 rounded-full bg-slate-100 font-semibold text-slate-600">Start</span></>}
        </div>
      )}

      <div className="rounded-2xl bg-slate-50 border border-slate-200/80 px-4 divide-y divide-slate-200/80">
        <Toggle id="kp-start" checked={kpStartAtMe} onChange={setKpStartAtMe} label="Start bij mijn locatie" />
        <Toggle id="kp-rond" checked={kpRoundTrip} onChange={setKpRoundTrip} label="Rondrit: terug naar start" />
      </div>

      <div className="flex gap-2">
        <button onClick={() => setKpSelected((s) => s.slice(0, -1))} disabled={!kpSelected.length} className={secondaryBtn}>Laatste weg</button>
        <button onClick={() => setKpSelected([])} disabled={!kpSelected.length} className={secondaryBtn}>Alles wissen</button>
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
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={22} />
        <input
          id="bestemming"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Waar wilt u heen?"
          enterKeyHint="search"
          className="w-full pl-12 pr-24 h-14 text-lg font-medium bg-slate-50 border border-slate-200 rounded-2xl placeholder:text-slate-400 focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none transition"
        />
        <button type="submit" disabled={busy} className="absolute right-2 top-2 bottom-2 px-4 bg-brand-700 hover:bg-brand-800 text-white rounded-xl font-bold disabled:opacity-50 transition">
          Zoek
        </button>
      </form>
      {results && results.length > 0 && (
        <ul className="rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100 bg-white">
          {results.map((r, i) => (
            <li key={i}>
              <button onClick={() => planRoute(r)} className="w-full text-left p-3.5 flex gap-3 items-center hover:bg-brand-50 active:bg-brand-100 transition">
                <span className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0"><MapPin size={20} /></span>
                <span className="font-medium text-ink leading-snug flex-grow min-w-0">{r.label}</span>
                <ChevronRight size={20} className="text-slate-300 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  const BATTERY_STYLE = {
    green: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    red: 'bg-red-50 border-red-200 text-red-900'
  };

  const renderPlanner = () => (
    <div className="px-4 pb-4 space-y-3 max-h-[55vh] overflow-y-auto">
      {!route && (
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-2xl" role="tablist" aria-label="Manier van plannen">
          {[['adres', 'Adres zoeken'], ['knooppunt', 'Knooppunten']].map(([mode, label]) => (
            <button
              key={mode}
              role="tab"
              aria-selected={planMode === mode}
              onClick={() => switchPlanMode(mode)}
              className={`h-11 rounded-xl font-bold transition ${planMode === mode ? 'bg-white shadow-float text-brand-700' : 'text-slate-500 hover:text-ink'}`}
            >{label}</button>
          ))}
        </div>
      )}

      {!route && (planMode === 'adres' ? renderAdresPlanner() : renderKnooppuntPlanner())}

      {busy && (
        <div className="flex items-center gap-2 text-brand-700 font-semibold">
          <Loader2 size={20} className="animate-spin" /> Even geduld…
        </div>
      )}

      {message && <p className="text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl p-3.5 font-medium">{message}</p>}

      {route && (() => {
        const check = batteryCheck(route.distance, route.roundTrip);
        return (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0"><MapPin size={24} /></span>
              <div className="flex-grow min-w-0">
                <div className="font-display font-bold text-lg leading-tight break-words text-ink">{destination?.label}</div>
                <div className="mt-1.5 flex flex-wrap gap-2 text-sm font-semibold">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-ink tabular-nums"><Navigation size={14} /> {formatDistance(route.distance)}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-ink tabular-nums"><Clock size={14} /> ± {minutesFor(route.distance)} min</span>
                </div>
              </div>
              <button onClick={clearRoute} aria-label={planMode === 'knooppunt' ? 'Route aanpassen' : 'Andere bestemming'} className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center shrink-0 transition">
                <X size={20} />
              </button>
            </div>

            <p className={`border rounded-2xl p-3.5 font-semibold flex gap-2.5 items-start ${BATTERY_STYLE[check.level]}`}>
              <Battery size={22} className="shrink-0 mt-0.5" /> <span>{check.text}</span>
            </p>

            {route.hazards && (
              <p className={`border rounded-2xl p-3.5 font-semibold flex gap-2.5 items-start ${route.hazards.length ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                <ShieldAlert size={22} className="shrink-0 mt-0.5" />
                <span>{route.hazards.length
                  ? `${route.hazards.length === 1 ? '1 drukke oversteek' : `${route.hazards.length} drukke oversteken`} op deze route. U krijgt onderweg een gesproken waarschuwing.`
                  : 'Geen drukke oversteken gevonden op deze route.'}</span>
              </p>
            )}

            {vehicleType === 'scootmobiel' && (
              <p className="text-sm text-slate-500 flex gap-2 items-start"><Accessibility size={18} className="shrink-0 text-brand-600" /> Scootmobielroute: zonder trappen, onverharde paden en pontjes, met zo weinig mogelijk hellingen en drukke wegen.</p>
            )}
            <BigButton label="Start Route" icon={Navigation} onClick={() => startNavigation(route, false)} fullWidth color="blue" disabled={!gps.position} />
            {!gps.position && <p className="text-sm text-slate-500">Starten kan zodra uw locatie bekend is. Probeer intussen de demo-rit.</p>}
            <button onClick={() => startNavigation(route, true)} className="w-full min-h-[52px] bg-slate-100 hover:bg-slate-200 text-ink rounded-2xl font-bold flex items-center justify-center gap-2 transition active:scale-[0.98]">
              <Play size={20} /> Demo-rit (zonder rijden)
            </button>
          </div>
        );
      })()}
    </div>
  );

  // Dichtstbijzijnde gevaarlijke oversteek tijdens het rijden (binnen 150 m)
  const nearHazard = isNavigating && position && route?.hazards?.length
    ? Math.min(...route.hazards.map((h) => distance(position, h)))
    : Infinity;

  const renderMap = () => (
    <div className="relative h-full w-full flex flex-col bg-canvas">
      {/* Zwevende knoppen bovenin */}
      <div className="absolute top-3 left-3 right-3 z-[20] flex items-center gap-2">
        <FloatButton onClick={() => setView('home')} label="Naar menu"><ArrowLeft size={24} /></FloatButton>
        <div className="flex-grow min-w-0 h-12 rounded-full bg-white/95 backdrop-blur shadow-float flex items-center justify-center px-4">
          <span className="font-display font-bold text-ink truncate">
            {isNavigating ? (demo ? "Demo-rit" : "Onderweg") : (planMode === 'knooppunt' ? "Plan uw route" : "Kies Bestemming")}
          </span>
        </div>
        <div className={`h-12 rounded-full bg-white/95 backdrop-blur shadow-float flex items-center gap-1.5 px-3.5 font-bold tabular-nums ${batteryLevel < 20 ? 'text-red-600' : 'text-emerald-700'}`}>
          <Battery size={20} /> {Math.floor(batteryLevel)}%
        </div>
      </div>

      {/* Instructiekaart tijdens het rijden */}
      {isNavigating && upcomingStep && (
        <div className="absolute top-[4.5rem] left-3 right-3 z-[20] space-y-2">
          <div className="bg-gradient-to-br from-brand-700 to-brand-950 text-white rounded-3xl shadow-float p-4 flex items-center gap-4">
            {upcomingStep.kind === 'node'
              ? <span className="kp-icon shrink-0" aria-hidden="true">{upcomingStep.ref}</span>
              : <span className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center shrink-0"><Navigation size={32} /></span>}
            <div className="min-w-0">
              <div className="font-display text-3xl font-extrabold leading-none tabular-nums">{formatDistance(distToUpcoming)}</div>
              <div className="mt-1 text-lg font-semibold leading-snug break-words text-brand-100">{upcomingStep.text}</div>
            </div>
          </div>
          {nearHazard < 150 && (
            <div className="bg-amber-400 text-amber-950 rounded-2xl shadow-float px-4 py-3 flex items-center gap-3 font-bold" role="alert">
              <AlertTriangle size={26} className="shrink-0" />
              <span>Drukke oversteek over {formatDistance(nearHazard)}. Kijk goed uit!</span>
            </div>
          )}
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
          hazards={route?.hazards || []}
        />
        {planMode === 'knooppunt' && !route && !isNavigating && kpStatus && (
          <div className="absolute left-3 right-3 top-[4.5rem] z-[500] bg-white/95 backdrop-blur border border-slate-200 text-ink rounded-2xl p-3.5 font-semibold shadow-float flex items-center gap-2">
            {kpStatus === 'laden' && <><Loader2 size={20} className="animate-spin text-brand-600" /> Knooppunten laden…</>}
            {kpStatus === 'zoom' && 'Zoom verder in om de knooppunten te zien.'}
            {kpStatus === 'leeg' && 'Hier zijn geen knooppunten gevonden. Schuif de kaart of zoom iets uit.'}
            {kpStatus === 'fout' && <span>De knooppuntendienst is nu druk of niet bereikbaar. <span className="block text-xs font-normal text-slate-500">({kpError})</span> <button onClick={() => { kpLoaded.current = null; doLoadKnooppunten(); }} className="underline text-brand-700">Opnieuw proberen</button></span>}
          </div>
        )}
        {!follow && position && (
          <FloatButton onClick={() => setFollow(true)} label="Naar mijn locatie" className={`absolute right-3 z-[500] w-14 h-14 ${isNavigating ? 'bottom-4' : 'bottom-8'}`}>
            <LocateFixed size={28} className="text-brand-600" />
          </FloatButton>
        )}
        {!position && gps.status !== 'ok' && !demo && (
          <div className="absolute left-3 right-3 top-[4.5rem] z-[500] bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-3.5 font-medium shadow-float">
            {LOCATION_MESSAGES[gps.status]}
          </div>
        )}
      </div>

      {/* Paneel onderin */}
      <div className="relative z-[20] -mt-5 bg-white rounded-t-[1.75rem] shadow-sheet">
        <div className="flex justify-center pt-2.5 pb-2" aria-hidden="true"><span className="w-10 h-1.5 rounded-full bg-slate-200"></span></div>
        {!isNavigating ? renderPlanner() : (
          <div className="flex items-stretch gap-3 px-4 pb-4">
            <div className="flex-1 rounded-2xl bg-slate-50 border border-slate-200/80 p-3 flex flex-col items-center justify-center">
              <span className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Snelheid</span>
              <span className="font-display text-3xl font-extrabold text-ink tabular-nums leading-tight">{speed}<span className="text-sm font-bold text-slate-500 ml-1">km/u</span></span>
            </div>
            <div className="flex-1 rounded-2xl bg-slate-50 border border-slate-200/80 p-3 flex flex-col items-center justify-center">
              <span className="text-slate-500 font-semibold text-xs uppercase tracking-wider">Nog te gaan</span>
              <span className="font-display text-2xl font-extrabold text-ink tabular-nums leading-tight">{formatDistance(remaining)}</span>
              <span className="text-slate-500 font-semibold text-sm tabular-nums">± {minutesFor(remaining || 0)} min</span>
            </div>
            <button
              onClick={() => setShowExitModal(true)}
              className="w-[5.5rem] rounded-2xl bg-gradient-to-b from-red-500 to-red-700 text-white font-display font-extrabold text-lg flex flex-col items-center justify-center gap-1 shadow-float active:scale-95 transition"
            >
              <Octagon size={24} strokeWidth={2.6} />
              STOP
            </button>
          </div>
        )}
      </div>

      {/* Bevestigen: route stoppen */}
      {showExitModal && (
        <div className="absolute inset-0 z-[1000] bg-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl">
            <span className="mx-auto w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center"><Octagon size={30} /></span>
            <h3 className="mt-3 font-display text-2xl font-extrabold text-ink">Route stoppen?</h3>
            <p className="mt-1 text-slate-500 font-medium">U kunt daarna een nieuwe route kiezen.</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setShowExitModal(false)} className="flex-1 min-h-[56px] bg-slate-100 hover:bg-slate-200 rounded-2xl font-bold text-lg text-ink transition">Nee, doorgaan</button>
              <button onClick={() => finishNavigation(false)} className="flex-1 min-h-[56px] bg-gradient-to-b from-red-500 to-red-700 text-white rounded-2xl font-bold text-lg shadow-float transition">Ja, stop</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderSOS = () => (
    <div className="flex flex-col h-full overflow-y-auto bg-gradient-to-b from-red-600 via-red-700 to-red-900">
      <ScreenHeader title="Noodoproep" tone="dark" onBack={() => setView('home')} />

      <div className="px-4 pb-4 flex flex-col gap-4 flex-grow">
        <div className="bg-white rounded-3xl p-5 shadow-card">
          <div className="flex items-center gap-4">
            <span className="w-14 h-14 rounded-2xl bg-red-50 text-red-700 font-display text-2xl font-extrabold flex items-center justify-center shrink-0">
              {(contactName.trim()[0] || '?').toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Uw noodcontact</p>
              <p className="font-display text-2xl font-extrabold text-ink leading-tight break-words">{contactName}</p>
              <p className="text-slate-500 font-medium tabular-nums">{contactPhone}</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 flex gap-3 items-start">
            <MapPin size={22} className="text-red-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-500">Uw locatie nu</p>
              <p className="text-ink font-semibold break-words">
                {position
                  ? (sosAddress || `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`)
                  : 'Uw locatie is nog niet bekend'}
              </p>
              {position && (
                <a href={osmLink(position)} target="_blank" rel="noreferrer" className="text-brand-700 font-semibold underline text-sm">
                  Bekijk op de kaart
                </a>
              )}
            </div>
          </div>
        </div>

        <a
          href={toTelHref(contactPhone)}
          className="relative bg-white text-red-700 w-full min-h-[96px] rounded-3xl font-display text-2xl font-extrabold shadow-float flex items-center justify-center gap-3 active:scale-[0.98] transition"
        >
          <span className="absolute inset-0 rounded-3xl ring-4 ring-white/60 animate-ping opacity-30" aria-hidden="true"></span>
          <span className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center"><Phone size={26} /></span>
          BEL {contactName.toUpperCase()}
        </a>

        {position && (
          <a
            href={`sms:${cleanPhone(contactPhone)}?body=${encodeURIComponent(`Ik heb hulp nodig. Mijn locatie: ${sosAddress ? sosAddress + ' - ' : ''}${osmLink(position)}`)}`}
            className="bg-white/10 border-2 border-white/40 text-white w-full min-h-[64px] rounded-3xl text-xl font-bold flex items-center justify-center gap-3 active:scale-[0.98] transition"
          >
            <MessageSquare size={24} />
            Stuur mijn locatie per sms
          </a>
        )}

        <button onClick={() => setView('home')} className="mt-auto bg-white/15 hover:bg-white/25 text-white w-full min-h-[56px] rounded-2xl font-bold text-lg transition">
          Terug naar Menu
        </button>
      </div>
    </div>
  );

  const inputClass = 'w-full pl-11 pr-3 h-12 bg-slate-50 border border-slate-200 rounded-xl font-medium text-ink focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none transition';

  const renderSettings = () => (
    <div className="flex flex-col h-full bg-canvas overflow-y-auto">
       <ScreenHeader title="Instellingen" onBack={() => setView('home')} />

       <div className="px-4 pb-6 space-y-6">
         <SettingsGroup title="Persoonlijke gegevens">
            {[
              ['set-home', 'Thuisadres', Home, 'text', homeAddress, setHomeAddress],
              ['set-contact', 'Naam noodcontact', User, 'text', contactName, setContactName],
              ['set-phone', 'Telefoonnummer noodcontact', Phone, 'tel', contactPhone, setContactPhone]
            ].map(([id, label, Icon, type, value, setter]) => (
              <div key={id} className="p-4">
                <label htmlFor={id} className="block text-sm font-semibold text-slate-600 mb-1.5">{label}</label>
                <div className="relative">
                  <Icon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input id={id} type={type} value={value} onChange={(e) => setter(e.target.value)} className={inputClass} />
                </div>
              </div>
            ))}
         </SettingsGroup>

         <SettingsGroup title="Weergave en geluid">
            <div className="p-4 flex items-center gap-3">
              <RowIcon icon={Type} />
              <span className="flex-grow font-semibold text-ink">Tekstgrootte</span>
              <div className="flex items-center rounded-xl bg-slate-100 p-1">
                <button
                  onClick={() => changeTextScale(-0.1)}
                  disabled={textScale <= TEXT_SCALE_MIN}
                  aria-label="Tekst kleiner"
                  className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center active:scale-95 disabled:opacity-40 transition"
                ><Minus size={18}/></button>
                <span className="w-14 text-center font-bold tabular-nums text-ink">{Math.round(textScale * 100)}%</span>
                <button
                  onClick={() => changeTextScale(0.1)}
                  disabled={textScale >= TEXT_SCALE_MAX}
                  aria-label="Tekst groter"
                  className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center active:scale-95 disabled:opacity-40 transition"
                ><Plus size={18}/></button>
              </div>
            </div>

            <div className="p-4 flex items-center gap-3">
              <RowIcon icon={Volume2} />
              <div className="flex-grow min-w-0">
                <span className="block font-semibold text-ink">Spraakbegeleiding</span>
                <span className="block text-slate-500 text-sm">Routes hardop voorlezen</span>
              </div>
              <Switch checked={voiceEnabled} onClick={toggleVoice} label="Spraakbegeleiding" />
            </div>
         </SettingsGroup>

         <SettingsGroup title="Accu">
            <div className="p-4 flex items-center gap-3">
              <RowIcon icon={Battery} tone="green" />
              <div className="flex-grow min-w-0">
                <span className="block font-semibold text-ink">Bereik met volle accu</span>
                <span className="block text-slate-500 text-sm">Hoe ver komt u op één lading?</span>
              </div>
              <div className="flex items-center rounded-xl bg-slate-100 p-1">
                <button
                  onClick={() => setFullRangeKm(Math.max(RANGE_MIN, fullRangeKm - 5))}
                  disabled={fullRangeKm <= RANGE_MIN}
                  aria-label="Bereik 5 km minder"
                  className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center active:scale-95 disabled:opacity-40 transition"
                ><Minus size={18}/></button>
                <span className="w-16 text-center font-bold tabular-nums text-ink">{fullRangeKm} km</span>
                <button
                  onClick={() => setFullRangeKm(Math.min(RANGE_MAX, fullRangeKm + 5))}
                  disabled={fullRangeKm >= RANGE_MAX}
                  aria-label="Bereik 5 km meer"
                  className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center active:scale-95 disabled:opacity-40 transition"
                ><Plus size={18}/></button>
              </div>
            </div>
            <button onClick={openBatteryPrompt} className="w-full p-4 flex items-center gap-3 text-left hover:bg-slate-50 transition rounded-b-3xl">
              <RowIcon icon={Gauge} tone="green" />
              <span className="flex-grow min-w-0">
                <span className="block font-semibold text-ink">Accustand nu: {Math.round(batteryLevel)}%</span>
                <span className="block text-slate-500 text-sm tabular-nums">Bereik ± {Math.floor(rangeKm)} km · tik om aan te passen</span>
              </span>
              <ChevronRight size={20} className="text-slate-300" />
            </button>
         </SettingsGroup>

         <SettingsGroup title="Vervoerstype">
            <div className="p-2 grid grid-cols-2 gap-2">
               {[['scootmobiel', 'Scootmobiel', Accessibility], ['fiets', 'Elektrische Fiets', Bike]].map(([value, label, Icon]) => (
                 <button
                   key={value}
                   onClick={() => setVehicleType(value)}
                   aria-pressed={vehicleType === value}
                   className={`min-h-[72px] rounded-2xl font-bold flex flex-col items-center justify-center gap-1 transition ${vehicleType === value ? 'bg-brand-700 text-white shadow-glow' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                 >
                   <Icon size={24} />
                   {label}
                 </button>
               ))}
            </div>
         </SettingsGroup>

         <SettingsGroup title="Hulp">
            <button onClick={() => setStage('intro')} className="w-full p-4 flex items-center gap-3 text-left hover:bg-slate-50 transition rounded-3xl">
              <RowIcon icon={HelpCircle} />
              <span className="flex-grow font-semibold text-ink">Uitleg over de app opnieuw bekijken</span>
              <ChevronRight size={20} className="text-slate-300" />
            </button>
         </SettingsGroup>

         <BigButton
            icon={Sparkles}
            label="Opslaan & Terug"
            color="green"
            fullWidth
            onClick={() => {
              // Instellingen worden al automatisch bewaard bij elke wijziging
              alert("Instellingen zijn opgeslagen!");
              setView('home');
            }}
         />
       </div>
    </div>
  );

  return (
    <div
      className="h-[100dvh] w-full bg-[#e6ebf3] flex items-center justify-center font-sans text-ink antialiased"
      // Ruimte voor de statusbalk en navigatiebalk van de telefoon (Android 15+ toont apps schermvullend)
      style={{
        paddingTop: 'var(--safe-area-inset-top, env(safe-area-inset-top, 0px))',
        paddingBottom: 'var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))'
      }}
    >
      <div className="w-full max-w-md h-full sm:h-[92vh] sm:max-h-[920px] sm:rounded-[2.75rem] sm:border-[10px] sm:border-slate-900 overflow-hidden bg-canvas sm:shadow-2xl relative flex flex-col">

        {stage === 'splash' && <Splash onDone={() => setStage(introSeen ? 'battery' : 'intro')} />}
        {stage === 'intro' && (
          <Onboarding
            fullRangeKm={fullRangeKm}
            setFullRangeKm={setFullRangeKm}
            onDone={() => { setIntroSeen(true); setStage('battery'); }}
          />
        )}
        {stage === 'battery' && (
          <BatteryPrompt
            level={Math.round(batteryLevel)}
            setLevel={setBatteryLevel}
            fullRangeKm={fullRangeKm}
            onDone={() => setStage('app')}
          />
        )}

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
