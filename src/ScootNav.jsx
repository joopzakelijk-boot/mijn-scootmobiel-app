import React, { useState, useEffect, useRef } from 'react';
import { Battery, Navigation, AlertTriangle, Settings, Home, MapPin, Phone, Minus, Plus, Search, User } from 'lucide-react';

// We gebruiken een simpele SVG kaart ipv externe libraries om errors te voorkomen
// Dit simuleert een route in een abstracte wijk
const ROUTE_POINTS = [
  { x: 20, y: 80 },  // Start
  { x: 30, y: 70 },
  { x: 30, y: 50 },
  { x: 50, y: 40 },
  { x: 70, y: 40 },
  { x: 80, y: 20 }   // Eind
];

// Helper om punt op lijnstuk te vinden
const getPointOnLine = (p1, p2, t) => ({
  x: p1.x + (p2.x - p1.x) * t,
  y: p1.y + (p2.y - p1.y) * t
});

const SimpleMap = ({ isNavigating, progress }) => {
  // Bereken huidige positie op basis van progress (0-100)
  const totalSegments = ROUTE_POINTS.length - 1;
  const segmentProgress = 100 / totalSegments;
  
  let currentPos = ROUTE_POINTS[0];
  
  if (isNavigating && progress > 0) {
    const currentSegmentIndex = Math.min(
      Math.floor(progress / segmentProgress), 
      totalSegments - 1
    );
    const segmentPercent = (progress % segmentProgress) / segmentProgress;
    
    currentPos = getPointOnLine(
      ROUTE_POINTS[currentSegmentIndex],
      ROUTE_POINTS[currentSegmentIndex + 1],
      segmentPercent
    );
  }

  return (
    <div className="w-full h-full bg-slate-100 relative overflow-hidden">
      {/* Achtergrond stratenpatroon (decoratief) */}
      <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none">
        <pattern id="grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="black" strokeWidth="1"/>
        </pattern>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* De Kaart */}
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* Park gebied */}
        <path d="M 70 10 L 90 10 L 90 30 L 70 30 Z" fill="#bbf7d0" stroke="none" />
        
        {/* Gebouwen (abstract) */}
        <rect x="10" y="75" width="10" height="10" fill="#e2e8f0" />
        <rect x="40" y="20" width="15" height="15" fill="#e2e8f0" />
        
        {/* De Route Lijn */}
        <polyline 
          points={ROUTE_POINTS.map(p => `${p.x},${p.y}`).join(' ')} 
          fill="none" 
          stroke={isNavigating ? "#3b82f6" : "#94a3b8"} 
          strokeWidth="3" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="transition-colors duration-500"
        />

        {/* Start Punt */}
        <circle cx={ROUTE_POINTS[0].x} cy={ROUTE_POINTS[0].y} r="2" fill="#22c55e" />
        
        {/* Eind Punt */}
        <circle cx={ROUTE_POINTS[ROUTE_POINTS.length-1].x} cy={ROUTE_POINTS[ROUTE_POINTS.length-1].y} r="2" fill="#ef4444" />

        {/* Huidige Positie Marker (De Scootmobiel) */}
        <g transform={`translate(${currentPos.x}, ${currentPos.y})`}>
          <circle r="4" fill="#2563eb" stroke="white" strokeWidth="1.5" className="shadow-lg drop-shadow-md" />
          <circle r="8" fill="#2563eb" opacity="0.2" className="animate-ping" />
        </g>
      </svg>

      {/* Straatnamen (statisch) */}
      <div className="absolute top-[80%] left-[10%] text-[10px] text-slate-500 font-bold rotate-45">Dorpsstraat</div>
      <div className="absolute top-[40%] left-[50%] text-[10px] text-slate-500 font-bold">Kerkplein</div>
      <div className="absolute top-[20%] right-[10%] text-[10px] text-green-600 font-bold">Het Park</div>
    </div>
  );
};

const BigButton = ({ icon: Icon, label, onClick, color = "blue", fullWidth = false }) => {
  const colorClasses = {
    blue: "bg-blue-600 hover:bg-blue-700 text-white",
    red: "bg-red-600 hover:bg-red-700 text-white",
    green: "bg-green-600 hover:bg-green-700 text-white",
    gray: "bg-slate-200 hover:bg-slate-300 text-slate-800"
  };

  return (
    <button
      onClick={onClick}
      className={`${colorClasses[color]} ${fullWidth ? 'w-full' : 'flex-1'} 
      p-4 rounded-xl shadow-md transition-transform active:scale-95 flex flex-col items-center justify-center gap-2 min-h-[100px]`}
    >
      <Icon size={40} strokeWidth={2} />
      <span className="text-lg font-bold">{label}</span>
    </button>
  );
};

export default function ScootNavApp() {
  const [view, setView] = useState('home'); // home, map, settings, sos
  const [isNavigating, setIsNavigating] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(85);
  const [speed, setSpeed] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showExitModal, setShowExitModal] = useState(false);
  
  // Nieuwe state voor persoonlijke instellingen
  const [homeAddress, setHomeAddress] = useState("Kerkplein 1, Het Dorp");
  const [contactName, setContactName] = useState("Dochter Emma");
  const [contactPhone, setContactPhone] = useState("06-12345678");
  
  // Simulatie interval
  useEffect(() => {
    let interval;
    if (isNavigating && progress < 100) {
      interval = setInterval(() => {
        setSpeed(Math.floor(Math.random() * (18 - 12) + 12)); // Snelheid tussen 12-18 km/u
        setBatteryLevel(prev => Math.max(0, prev - 0.1));
        
        setProgress(prev => {
          const next = prev + 1; // 1% per tick
          if (next >= 100) {
            return 100;
          }
          return next;
        });
      }, 100); // Snellere update voor vloeiendere beweging
    } else if (progress >= 100 && isNavigating) {
      setSpeed(0);
      setIsNavigating(false);
      setProgress(0);
      // Gebruik timeout om alert uit de render loop te halen
      setTimeout(() => alert("Bestemming bereikt!"), 100);
    } else {
      setSpeed(0);
    }
    return () => clearInterval(interval);
  }, [isNavigating, progress]);

  const toggleNavigation = () => {
    if (isNavigating) {
      setShowExitModal(true);
    } else {
      setIsNavigating(true);
      setProgress(0);
      setView('map');
    }
  };

  const confirmStop = () => {
    setIsNavigating(false);
    setSpeed(0);
    setShowExitModal(false);
    setProgress(0);
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
      </div>

      <div className="grid grid-cols-2 gap-4 flex-grow">
        <BigButton icon={MapPin} label="Nieuwe Rit" onClick={() => setView('map')} color="blue" />
        <BigButton icon={Home} label="Naar Huis" onClick={() => { setView('map'); toggleNavigation(); }} color="green" />
        <BigButton icon={Settings} label="Instellingen" onClick={() => setView('settings')} color="gray" />
        <BigButton icon={AlertTriangle} label="NOODKNOP" onClick={() => setView('sos')} color="red" />
      </div>
    </div>
  );

  const renderMap = () => (
    <div className="relative h-full w-full flex flex-col bg-slate-100">
      {/* Top Bar Overlay */}
      <div className="absolute top-0 left-0 right-0 z-[20] bg-white/90 backdrop-blur-sm p-2 shadow-md flex justify-between items-center px-4">
        <button onClick={() => setView('home')} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200">
          <Home size={24} className="text-slate-700" />
        </button>
        <div className="text-xl font-bold text-slate-800">
          {isNavigating ? "Onderweg..." : "Kies Bestemming"}
        </div>
        <div className={`font-bold ${batteryLevel < 20 ? 'text-red-600' : 'text-green-600'}`}>
          {Math.floor(batteryLevel)}%
        </div>
      </div>

      {/* Map */}
      <div className="flex-grow relative z-10">
        <SimpleMap isNavigating={isNavigating} progress={progress} />
      </div>

      {/* Bottom Dashboard Overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-[20] bg-white border-t-2 border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        {!isNavigating ? (
          <div className="p-4 space-y-3">
             <div className="relative">
                <Search className="absolute left-3 top-3.5 text-slate-400" size={24} />
                <input 
                  type="text" 
                  placeholder="Waar wilt u heen?" 
                  className="w-full pl-12 pr-4 py-4 text-lg border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
                />
             </div>
             <BigButton label="Start Navigatie Demo" icon={Navigation} onClick={toggleNavigation} fullWidth color="blue" />
          </div>
        ) : (
          <div className="flex flex-row items-center justify-between p-4 bg-slate-50">
            <div className="flex flex-col items-center w-24">
               <span className="text-slate-500 font-semibold text-xs uppercase">Snelheid</span>
               <span className="text-3xl font-bold text-slate-800">{speed} <span className="text-sm">km/u</span></span>
            </div>

            <div className="flex flex-col items-center px-4 border-l border-r border-slate-200 flex-grow">
               <Navigation size={40} className="text-blue-600 mb-1" />
               <span className="text-xl font-bold text-center leading-tight">Over 50m<br/>rechtsaf</span>
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
              <button onClick={confirmStop} className="flex-1 py-4 bg-red-600 text-white rounded-xl font-bold text-lg">Ja, stop</button>
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
        <p className="text-slate-600 text-lg mb-2">Uw locatie wordt gedeeld met:</p>
        <p className="text-2xl font-bold text-slate-900">{contactName}</p>
        <p className="text-slate-500 mt-1">Dorpsstraat 12</p>
      </div>

      <button className="bg-red-600 text-white w-full py-8 rounded-2xl text-2xl font-bold shadow-lg animate-pulse flex items-center justify-center gap-3 mb-4 active:scale-95 transition-transform">
        <Phone size={32} />
        BEL {contactName.toUpperCase()}
      </button>

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
            <div className="flex gap-2">
              <button className="p-2 bg-slate-100 rounded-lg"><Minus size={20}/></button>
              <button className="p-2 bg-slate-100 rounded-lg"><Plus size={20}/></button>
            </div>
         </div>

         <div className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-lg font-medium">Spraakbegeleiding</span>
              <span className="text-slate-500 text-sm">Routes hardop voorlezen</span>
            </div>
            <div className="w-14 h-8 bg-green-500 rounded-full relative cursor-pointer">
              <div className="absolute right-1 top-1 bg-white w-6 h-6 rounded-full shadow-md"></div>
            </div>
         </div>

         <div className="bg-white p-4 rounded-xl shadow-sm">
            <span className="text-lg font-medium block mb-2">Vervoerstype</span>
            <div className="flex gap-2">
               <button className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium">Scootmobiel</button>
               <button className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg font-medium">Elektrische Fiets</button>
            </div>
         </div>

         <button 
            onClick={() => {
              // In een echte app zou je hier opslaan naar een database
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