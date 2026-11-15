// Haalt alle fietsknooppunten van Nederland en België op uit OpenStreetMap
// en schrijft ze naar public/knooppunten.json. De app levert dat bestand mee.
//
// Gebruik: node scripts/fetch-knooppunten.mjs
// Het gebied wordt in vier stukken opgevraagd (lichter voor de drukke dienst),
// met meerdere pogingen. Lukt één stuk niet, dan wordt er niets geschreven,
// zodat er nooit een half bestand ontstaat.
import { writeFile, mkdir } from 'node:fs/promises';

const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];
const ROUNDS = 4;            // zo vaak alle servers proberen per stuk
const PAUSE_MS = 30_000;     // wachttijd tussen rondes
const TIMEOUT_MS = 150_000;  // maximale wachttijd per aanvraag

// Nederland + België (ruim), in 2 x 2 stukken: [zuid, west, noord, oost]
const SOUTH = 49.4, WEST = 2.5, NORTH = 53.7, EAST = 7.3;
const MID_LAT = (SOUTH + NORTH) / 2, MID_LON = (WEST + EAST) / 2;
const TILES = [
  [SOUTH, WEST, MID_LAT, MID_LON], [SOUTH, MID_LON, MID_LAT, EAST],
  [MID_LAT, WEST, NORTH, MID_LON], [MID_LAT, MID_LON, NORTH, EAST]
];

// Compacte CSV: id, breedtegraad, lengtegraad, knooppuntnummer
const queryFor = ([s, w, n, e]) =>
  `[out:csv(::id,::lat,::lon,rcn_ref;false;"\\t")][timeout:120];node["rcn_ref"](${s},${w},${n},${e});out;`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchTile(tile, label) {
  for (let round = 1; round <= ROUNDS; round++) {
    for (const url of SERVERS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          body: new URLSearchParams({ data: queryFor(tile) }),
          headers: { 'User-Agent': 'scootnav-build (GitHub Actions)' },
          signal: AbortSignal.timeout(TIMEOUT_MS)
        });
        if (!res.ok) throw new Error(`antwoordde met ${res.status}`);
        const text = await res.text();
        if (/runtime error|Dispatcher_Client/i.test(text)) throw new Error('server te druk');
        console.log(`${label}: gelukt via ${new URL(url).host} (ronde ${round})`);
        return text;
      } catch (e) {
        console.warn(`${label}: ${new URL(url).host} mislukt (${e.message})`);
      }
    }
    if (round < ROUNDS) {
      console.log(`${label}: even wachten en opnieuw proberen...`);
      await sleep(PAUSE_MS);
    }
  }
  return null;
}

const byId = new Map();
for (const [i, tile] of TILES.entries()) {
  const csv = await fetchTile(tile, `Stuk ${i + 1}/${TILES.length}`);
  if (csv == null) {
    console.warn('::warning::Niet alle knooppunten konden worden opgehaald; het bestaande bestand blijft staan.');
    process.exit(0);
  }
  for (const line of csv.split('\n')) {
    const [id, lat, lon, ref] = line.split('\t');
    if (!id || !ref || isNaN(parseFloat(lat))) continue;
    // [id, nummer, lat, lng], coördinaten op ± 1 meter nauwkeurig
    byId.set(Number(id), [Number(id), ref.trim(), Math.round(parseFloat(lat) * 1e5) / 1e5, Math.round(parseFloat(lon) * 1e5) / 1e5]);
  }
}

const nodes = [...byId.values()];
if (nodes.length < 1000) {
  console.warn(`::warning::Maar ${nodes.length} knooppunten gevonden; bestand niet geschreven.`);
  process.exit(0);
}

// Vaste volgorde, zodat er alleen een wijziging is als de knooppunten echt veranderen
nodes.sort((a, b) => a[0] - b[0]);
await mkdir('public', { recursive: true });
await writeFile('public/knooppunten.json', JSON.stringify({ nodes }));
console.log(`${nodes.length} knooppunten opgeslagen in public/knooppunten.json`);
