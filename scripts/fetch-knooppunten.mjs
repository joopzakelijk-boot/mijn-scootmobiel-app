// Haalt alle fietsknooppunten van Nederland en België op uit OpenStreetMap
// en schrijft ze naar public/knooppunten.json. Draait bij het online zetten
// (GitHub Actions), zodat de app ze niet zelf bij de drukke dienst hoeft op te vragen.
//
// Gebruik: node scripts/fetch-knooppunten.mjs
// Mislukt het ophalen, dan stopt het script zonder fout: de app valt dan terug
// op het live ophalen van knooppunten.
import { writeFile, mkdir } from 'node:fs/promises';

const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter'
];

// Compacte CSV: id, breedtegraad, lengtegraad, knooppuntnummer
const QUERY = `[out:csv(::id,::lat,::lon,rcn_ref;false;"\\t")][timeout:180];
(
  area["ISO3166-1"="NL"][admin_level=2];
  area["ISO3166-1"="BE"][admin_level=2];
)->.landen;
node["rcn_ref"](area.landen);
out;`;

async function fetchFrom(url) {
  const res = await fetch(url, {
    method: 'POST',
    body: new URLSearchParams({ data: QUERY }),
    headers: { 'User-Agent': 'scootnav-build (GitHub Actions)' },
    signal: AbortSignal.timeout(240_000)
  });
  if (!res.ok) throw new Error(`${url} antwoordde met ${res.status}`);
  return res.text();
}

let csv = null;
for (const url of SERVERS) {
  try {
    console.log(`Knooppunten ophalen bij ${url} ...`);
    csv = await fetchFrom(url);
    break;
  } catch (e) {
    console.warn(`Mislukt: ${e.message}`);
  }
}

if (!csv) {
  console.warn('::warning::Knooppunten konden niet worden opgehaald; de app haalt ze dan live op.');
  process.exit(0);
}

const nodes = [];
for (const line of csv.split('\n')) {
  const [id, lat, lon, ref] = line.split('\t');
  if (!id || !ref || isNaN(parseFloat(lat))) continue;
  // [id, nummer, lat, lng], coördinaten op ± 1 meter nauwkeurig
  nodes.push([Number(id), ref.trim(), Math.round(parseFloat(lat) * 1e5) / 1e5, Math.round(parseFloat(lon) * 1e5) / 1e5]);
}

if (nodes.length < 1000) {
  console.warn(`::warning::Maar ${nodes.length} knooppunten gevonden; bestand niet geschreven.`);
  process.exit(0);
}

await mkdir('public', { recursive: true });
await writeFile('public/knooppunten.json', JSON.stringify({ updated: new Date().toISOString(), nodes }));
console.log(`${nodes.length} knooppunten opgeslagen in public/knooppunten.json`);
