// Maakt schermafbeeldingen voor de Google Play Store (1080 x 1920, staand).
// Gebruik: start eerst de gebouwde app (npx vite preview --port 4173), dan:
//   node scripts/store-screenshots.mjs [adres-van-de-app] [map-voor-afbeeldingen]
// Werkt met de echte kaart, adreszoeker en routeplanner, dus internet is nodig.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const APP = process.argv[2] || 'http://localhost:4173/';
const OUT = process.argv[3] || 'store/screenshots';
const START = { latitude: 52.0115, longitude: 4.7105 }; // Markt, Gouda

// Voorbeeldinstellingen, zodat de schermen er gevuld uitzien
const SETTINGS = {
  introSeen: true,
  fullRangeKm: 30,
  batteryLevel: 80,
  homeAddress: 'Markt 1, Gouda',
  contactName: 'Dochter Emma',
  contactPhone: '06-12345678',
  voiceEnabled: true
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPage(browser, settings = SETTINGS) {
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3,
    geolocation: { ...START, accuracy: 6 },
    permissions: ['geolocation'],
    locale: 'nl-NL',
    reducedMotion: 'reduce'
  });
  await ctx.addInitScript((s) => {
    try { localStorage.setItem('scootnav-instellingen', JSON.stringify(s)); } catch (e) {}
    // Geen geluid tijdens het maken van de afbeeldingen
    if (window.speechSynthesis) window.speechSynthesis.speak = () => {};
  }, settings);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.warn('Fout in de app:', e.message));
  await page.goto(APP);
  return page;
}

// Opstartscherm overslaan en de accuvraag beantwoorden
async function toHome(page) {
  await page.waitForSelector('.splash');
  await page.locator('.splash').click();
  await page.getByText('Klaar', { exact: true }).click();
  await page.getByText('Nieuwe Rit').waitFor();
}

const shot = async (page, name) => {
  await wait(600);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('Gemaakt:', name);
};

// Wacht tot de kaarttegels geladen zijn
async function tilesLoaded(page) {
  await page.waitForFunction(() => {
    const tiles = [...document.querySelectorAll('.leaflet-tile')];
    return tiles.length > 4 && tiles.every((t) => t.complete && t.classList.contains('leaflet-tile-loaded'));
  }, null, { timeout: 30000 }).catch(() => console.warn('Niet alle kaarttegels geladen'));
  await wait(800);
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

// 1. Startscherm
{
  const page = await newPage(browser);
  await toHome(page);
  await shot(page, '1-startscherm');
  await page.context().close();
}

// 2 + 3. Knooppuntroute plannen en onderweg
{
  const page = await newPage(browser);
  await toHome(page);
  await page.getByText('Knooppuntroute maken').click();
  await page.locator('.leaflet-marker-icon .kp-icon').first().waitFor({ timeout: 30000 });
  await tilesLoaded(page);

  // Drie verschillende knooppunten in de buurt kiezen, met de klok mee rond het midden
  const markers = page.locator('.leaflet-marker-icon:has(.kp-icon)');
  const cx = 160, cy = 165;
  const choose = async () => {
    const boxes = await markers.evaluateAll((els) => els.map((el, i) => {
      const r = el.getBoundingClientRect();
      return { i, ref: el.textContent.trim(), x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }));
    // Alleen bordjes in het zichtbare kaartdeel, niet onder de knoppen of het paneel
    const inView = boxes.filter((b) => b.y > 80 && b.y < 240 && b.x > 30 && b.x < 290)
      .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
    const pick = [];
    for (const b of inView) {
      if (pick.length === 3) break;
      if (pick.some((p) => p.ref === b.ref || Math.hypot(p.x - b.x, p.y - b.y) < 50)) continue;
      pick.push(b);
    }
    return pick;
  };
  let pick = await choose();
  for (let stap = 0; stap < 2 && pick.length < 3; stap++) {
    // Te weinig bordjes in beeld: een stapje uitzoomen
    await page.locator('.leaflet-container').focus();
    await page.keyboard.press('-');
    await wait(2000);
    pick = await choose();
  }
  pick.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  // Via een klik-gebeurtenis op het bordje zelf (een gewone klik laat de kaart verschuiven)
  for (const b of pick) await markers.nth(b.i).evaluate((el) => el.click());
  console.log('Gekozen knooppunten:', pick.map((p) => p.ref).join(' → '));
  await page.getByRole('switch', { name: 'Rondrit: terug naar start' }).click();
  await shot(page, '2-knooppunten-kiezen');

  await page.getByText('Bereken route').click();
  await page.getByText('Start Route').waitFor({ timeout: 30000 });
  await page.getByText(/oversteek|oversteken/).first().waitFor({ timeout: 20000 }).catch(() => {});
  await tilesLoaded(page);
  await shot(page, '3-route-overzicht');

  await page.getByText('Demo-rit (zonder rijden)').click();
  await wait(5000);
  await tilesLoaded(page);
  await shot(page, '4-onderweg');
  await page.context().close();
}

// 5. Accuvraag
{
  const page = await newPage(browser);
  await page.waitForSelector('.splash');
  await page.locator('.splash').click();
  await page.getByText('Hoe vol is uw accu?').waitFor();
  await page.getByRole('button', { name: '75%', exact: true }).click();
  await shot(page, '5-accu');
  await page.context().close();
}

// 6. Uitleg bij de eerste start
{
  const page = await newPage(browser, { ...SETTINGS, introSeen: false });
  await page.waitForSelector('.splash');
  await page.locator('.splash').click();
  await page.getByText('Volgende').click();
  await page.getByText('Volgende').click();
  await shot(page, '6-uitleg-knooppunten');
  await page.context().close();
}

// 7. Noodknop
{
  const page = await newPage(browser);
  await toHome(page);
  await page.getByText('NOODKNOP').click();
  await page.getByText('Uw locatie nu').waitFor();
  await page.waitForFunction(() => !/\d+\.\d{5}, \d+\.\d{5}/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  await shot(page, '7-noodknop');
  await page.context().close();
}

await browser.close();
