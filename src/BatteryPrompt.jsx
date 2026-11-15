import React from 'react';
import { Battery, Minus, Plus } from 'lucide-react';

const QUICK = [25, 50, 75, 100];

// Vraag bij elke start hoe vol de accu is; het bereik rekent mee.
export default function BatteryPrompt({ level, setLevel, fullRangeKm, onDone }) {
  const range = Math.floor((level / 100) * fullRangeKm);
  const color = level < 20 ? 'bg-red-500' : level < 40 ? 'bg-amber-400' : 'bg-emerald-500';

  return (
    <div className="absolute inset-0 z-[1800] bg-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="accu-titel">
      <div className="onboard-slide w-full max-w-sm bg-white rounded-[2rem] shadow-2xl p-6">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><Battery size={26} /></span>
          <h2 id="accu-titel" className="font-display text-2xl font-extrabold tracking-tight text-ink">Hoe vol is uw accu?</h2>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            onClick={() => setLevel(Math.max(0, level - 5))}
            disabled={level <= 0}
            aria-label="5 procent minder"
            className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center active:scale-95 disabled:opacity-40"
          ><Minus size={24} /></button>
          <div className="text-center">
            <div className="font-display text-5xl font-extrabold text-ink tabular-nums leading-none">{level}%</div>
            <div className="mt-1 font-semibold text-slate-500 tabular-nums">Bereik ± {range} km</div>
          </div>
          <button
            onClick={() => setLevel(Math.min(100, level + 5))}
            disabled={level >= 100}
            aria-label="5 procent meer"
            className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center active:scale-95 disabled:opacity-40"
          ><Plus size={24} /></button>
        </div>

        <div className="mt-4 h-3 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
          <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.max(2, level)}%` }}></div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => setLevel(q)}
              aria-pressed={level === q}
              className={`min-h-[52px] rounded-2xl font-bold tabular-nums transition ${level === q ? 'bg-brand-700 text-white shadow-glow' : 'bg-slate-100 text-ink hover:bg-slate-200'}`}
            >{q}%</button>
          ))}
        </div>

        <button
          onClick={onDone}
          className="mt-5 w-full min-h-[60px] rounded-2xl bg-gradient-to-b from-brand-500 to-brand-700 text-white shadow-glow font-display text-lg font-bold active:scale-[0.98]"
        >
          Klaar
        </button>
        <p className="mt-3 text-center text-sm text-slate-500">Met een volle accu komt u ± {fullRangeKm} km ver. Wijzigen kan bij Instellingen.</p>
      </div>
    </div>
  );
}
