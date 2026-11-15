import React, { useState } from 'react';
import { MapPin, Navigation, Volume2, AlertTriangle, Battery, Minus, Plus, ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';
import logo from './assets/logo.svg';

export const RANGE_MIN = 5;
export const RANGE_MAX = 80;

// Uitleg over de app, de eerste keer na het opstartscherm (en later via Instellingen).
// Op het laatste scherm vult u in hoe ver uw scootmobiel komt met een volle accu.
export default function Onboarding({ fullRangeKm, setFullRangeKm, onDone }) {
  const [step, setStep] = useState(0);

  const slides = [
    {
      visual: <img src={logo} alt="" className="w-28 h-28 rounded-[1.75rem] shadow-glow ring-4 ring-white" />,
      title: 'Welkom bij ScootNav',
      text: 'Met de scoot van A naar B. Deze app helpt u veilig en ontspannen op weg met uw scootmobiel.'
    },
    {
      icon: MapPin, tone: 'bg-brand-50 text-brand-700',
      title: 'Route naar een adres',
      text: 'Tik op "Nieuwe Rit", zoek een adres en tik op "Start Route". De route vermijdt trappen, onverharde paden en drukke wegen. Met "Naar Huis" gaat u in één tik naar huis.'
    },
    {
      visual: <span className="kp-icon !w-24 !h-24 !text-4xl !border-[5px]" aria-hidden="true">12</span>,
      title: 'Plan met fietsknooppunten',
      text: 'Tik op "Knooppuntroute maken" en daarna op de groene bordjes op de kaart, in de volgorde waarin u wilt rijden. Ook een rondrit is mogelijk.'
    },
    {
      icon: Volume2, tone: 'bg-emerald-50 text-emerald-700',
      title: 'Gesproken hulp onderweg',
      text: 'De app leest de afslagen voor en zegt "Daar gaan we!" en "We zijn er!". U kunt spraak aan- of uitzetten bij Instellingen.'
    },
    {
      icon: ShieldAlert, tone: 'bg-amber-50 text-amber-700',
      title: 'Veilig oversteken',
      text: 'Kruist uw route een drukke weg, dan ziet u een oranje bordje op de kaart en waarschuwt de app u vooraf: "Kijk goed uit."'
    },
    {
      icon: AlertTriangle, tone: 'bg-red-50 text-red-600',
      title: 'De noodknop',
      text: 'Met de rode noodknop belt u direct uw noodcontact of stuurt u uw locatie per sms. Vul uw noodcontact in bij Instellingen.'
    },
    {
      icon: Battery, tone: 'bg-emerald-50 text-emerald-700',
      title: 'Uw accu en bereik',
      text: 'Bij elke start vraagt de app hoe vol uw accu is. Zo weet de app of een rit haalbaar is. Hoe ver komt u met een volle accu?',
      range: true
    }
  ];

  const s = slides[step];
  const last = step === slides.length - 1;
  const Icon = s.icon;

  return (
    <div className="absolute inset-0 z-[1900] bg-canvas flex flex-col" role="dialog" aria-modal="true" aria-label="Uitleg over de app">
      <div className="flex justify-between items-center px-4 pt-4">
        <span className="text-sm font-semibold text-slate-500 tabular-nums">{step + 1} van {slides.length}</span>
        {!last && (
          <button onClick={() => setStep(slides.length - 1)} className="px-3 py-2 rounded-full text-brand-700 font-bold hover:bg-brand-50">
            Overslaan
          </button>
        )}
      </div>

      <div key={step} className="onboard-slide flex-grow flex flex-col items-center justify-center text-center px-7 overflow-y-auto">
        <div className="mb-7">
          {s.visual || (
            <span className={`w-24 h-24 rounded-[1.75rem] flex items-center justify-center ${s.tone}`}>
              <Icon size={48} strokeWidth={2} />
            </span>
          )}
        </div>
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink text-balance">{s.title}</h2>
        <p className="mt-3 text-lg text-slate-600 leading-relaxed max-w-sm">{s.text}</p>

        {s.range && (
          <div className="mt-6 w-full max-w-xs bg-white rounded-3xl border border-slate-200/80 shadow-card p-4">
            <div className="text-sm font-semibold text-slate-500">Bereik met een volle accu</div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <button
                onClick={() => setFullRangeKm(Math.max(RANGE_MIN, fullRangeKm - 5))}
                disabled={fullRangeKm <= RANGE_MIN}
                aria-label="Bereik 5 km minder"
                className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center active:scale-95 disabled:opacity-40"
              ><Minus size={24} /></button>
              <span className="font-display text-4xl font-extrabold text-ink tabular-nums">{fullRangeKm}<span className="text-xl text-slate-500 ml-1">km</span></span>
              <button
                onClick={() => setFullRangeKm(Math.min(RANGE_MAX, fullRangeKm + 5))}
                disabled={fullRangeKm >= RANGE_MAX}
                aria-label="Bereik 5 km meer"
                className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center active:scale-95 disabled:opacity-40"
              ><Plus size={24} /></button>
            </div>
            <p className="mt-2 text-sm text-slate-500">Weet u het niet precies? Kijk in de handleiding van uw scootmobiel. U kunt dit later wijzigen bij Instellingen.</p>
          </div>
        )}
      </div>

      <div className="px-5 pb-6 pt-3">
        <div className="flex justify-center gap-2 mb-5" aria-hidden="true">
          {slides.map((_, i) => (
            <span key={i} className={`h-2.5 rounded-full transition-all ${i === step ? 'w-7 bg-brand-700' : 'w-2.5 bg-slate-300'}`}></span>
          ))}
        </div>
        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="min-h-[60px] px-5 rounded-2xl bg-white border border-slate-200 shadow-card font-bold text-ink flex items-center gap-1 active:scale-[0.98]"
            >
              <ChevronLeft size={22} /> Vorige
            </button>
          )}
          <button
            onClick={() => (last ? onDone() : setStep(step + 1))}
            className="flex-grow min-h-[60px] rounded-2xl bg-gradient-to-b from-brand-500 to-brand-700 text-white shadow-glow font-display text-lg font-bold flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {last ? <>Aan de slag <Navigation size={22} /></> : <>Volgende <ChevronRight size={22} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
