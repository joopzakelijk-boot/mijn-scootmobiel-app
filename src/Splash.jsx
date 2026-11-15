import React, { useEffect, useRef, useState } from 'react';
import logo from './assets/logo.svg';

const SHOW_MS = 2800;   // zo lang blijft het opstartscherm staan
const FADE_MS = 450;    // daarna vervaagt het

// Wit scootmobieltje dat over de route van A naar B rijdt
const Rider = ({ className }) => (
  <svg viewBox="22 28 86 78" className={className} aria-hidden="true">
    <g fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round">
      <path d="M86 80 L79 38" strokeWidth="7" />
      <path d="M71 37 L88 34" strokeWidth="6" />
      <path d="M85 47 H104 L100 61 H88 Z" strokeWidth="4" />
      <circle cx="40" cy="91" r="12" strokeWidth="6" />
      <circle cx="95" cy="93" r="10" strokeWidth="6" />
    </g>
    <g fill="#fff">
      <rect x="26" y="31" width="10" height="31" rx="5" />
      <rect x="28" y="54" width="34" height="10" rx="5" />
      <rect x="41" y="62" width="7" height="14" rx="2" />
      <rect x="30" y="72" width="66" height="10" rx="5" />
      <rect x="34" y="45" width="22" height="5" rx="2.5" />
    </g>
  </svg>
);

// Opstartscherm met logo en slogan. Verdwijnt vanzelf, of eerder met een tik.
export default function Splash({ onDone }) {
  const [leaving, setLeaving] = useState(false);
  const closed = useRef(false);

  const close = () => {
    if (closed.current) return; // niet dubbel sluiten (tik én tijd om)
    closed.current = true;
    setLeaving(true);
    setTimeout(onDone, FADE_MS);
  };

  useEffect(() => {
    const id = setTimeout(close, SHOW_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <button
      type="button"
      onClick={close}
      aria-label="Opstartscherm sluiten en beginnen"
      className={`splash absolute inset-0 z-[2000] w-full h-full flex flex-col items-center justify-center text-white text-center px-6 ${leaving ? 'splash-leave' : ''}`}
    >
      <img src={logo} alt="" className="splash-logo w-40 h-40 rounded-[2.2rem] shadow-2xl ring-4 ring-white/40" />

      <h1 className="splash-title mt-8 text-5xl font-extrabold tracking-tight">ScootNav</h1>

      <p className="splash-slogan mt-3 text-2xl font-semibold text-blue-100 text-balance">
        Met de scoot van A naar B
      </p>

      {/* Route van A naar B met een rijdend scootmobieltje */}
      <div className="splash-route mt-10 w-64 max-w-full relative h-10" aria-hidden="true">
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-green-500 border-[3px] border-white font-extrabold flex items-center justify-center">A</span>
        <span className="absolute right-0 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-red-500 border-[3px] border-white font-extrabold flex items-center justify-center">B</span>
        <span className="splash-line absolute left-10 right-10 top-[70%] border-t-[3px] border-dotted border-blue-200"></span>
        <Rider className="splash-rider absolute top-1/2 w-11 h-11 drop-shadow" />
      </div>

      <span className="splash-hint absolute bottom-8 text-sm text-blue-200">Tik om te beginnen</span>
    </button>
  );
}
