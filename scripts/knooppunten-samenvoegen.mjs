// Voegt dubbele fietsknooppunten samen. In OpenStreetMap staat één knooppunt soms
// meerdere keren (bijvoorbeeld bij elke tak van een rotonde). Bordjes met hetzelfde
// nummer die dichter dan 150 meter bij elkaar liggen, worden één bordje, in het midden.
//
// Los te gebruiken op het bestaande bestand:
//   node scripts/knooppunten-samenvoegen.mjs [public/knooppunten.json]
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const MAX_M = 150;
const rad = (d) => (d * Math.PI) / 180;
const meters = (a, b) => {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};

// nodes: [[id, nummer, lat, lng], ...] -> samengevoegde lijst in hetzelfde formaat
export function samenvoegen(nodes) {
  const perNummer = new Map();
  for (const n of [...nodes].sort((a, b) => a[0] - b[0])) {
    if (!perNummer.has(n[1])) perNummer.set(n[1], []);
    perNummer.get(n[1]).push(n);
  }
  const uit = [];
  for (const [nummer, lijst] of perNummer) {
    const groepen = []; // { id, som-lat, som-lng, aantal }
    for (const [id, , lat, lng] of lijst) {
      const g = groepen.find((g) => meters({ lat: g.lat / g.n, lng: g.lng / g.n }, { lat, lng }) < MAX_M);
      if (g) { g.lat += lat; g.lng += lng; g.n += 1; }
      else groepen.push({ id, lat, lng, n: 1 });
    }
    for (const g of groepen) {
      uit.push([g.id, nummer, Math.round((g.lat / g.n) * 1e5) / 1e5, Math.round((g.lng / g.n) * 1e5) / 1e5]);
    }
  }
  return uit.sort((a, b) => a[0] - b[0]);
}

// Los aangeroepen: het opgegeven bestand samenvoegen
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2] || 'public/knooppunten.json';
  const data = JSON.parse(await readFile(file, 'utf8'));
  const voor = data.nodes.length;
  data.nodes = samenvoegen(data.nodes);
  await writeFile(file, JSON.stringify(data));
  console.log(`${voor} knooppunten -> ${data.nodes.length} na samenvoegen van dubbele bordjes`);
}
