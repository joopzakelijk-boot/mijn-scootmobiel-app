# ScootNav

Navigatie-app voor scootmobielen (demo). Gebouwd met React, Tailwind CSS en Vite.

## Starten

Je hebt [Node.js](https://nodejs.org) (versie 18 of nieuwer) nodig.

```bash
npm install
npm run dev
```

Open daarna http://localhost:5173 in je browser.

## Kaart en locatie

- De kaart komt van [OpenStreetMap](https://www.openstreetmap.org).
- Adressen zoeken gaat via Nominatim, routes via de OSRM-routeplanner op routing.openstreetmap.de
  (voetgangersroute voor de scootmobiel, fietsroute voor de elektrische fiets).
- Deze gratis diensten zijn bedoeld voor licht gebruik. Voor een app met veel gebruikers is een eigen of betaalde dienst nodig.
- De browser geeft de GPS-locatie alleen via **https** of op **localhost**. Op je telefoon testen via
  `http://<ip-adres>:5173` geeft dus geen locatie; zet de app daarvoor online (https).
- Met **Demo-rit** kun je een route uitproberen zonder te rijden.

## Overige commando's

- `npm run build`: maakt een versie om online te zetten in de map `dist/`
- `npm run preview`: bekijk die gebouwde versie

## Bestanden

- `src/ScootNav.jsx`: de app zelf (schermen, navigatie, instellingen)
- `src/RealMap.jsx`: de kaart
- `src/useLocation.js`: GPS-locatie volgen
- `src/services.js`: adres zoeken en route berekenen
- `src/geo.js`: afstanden en routeaanwijzingen
- `src/main.jsx`: start de app (en toont meldingen als balkje onderin)
- `src/index.css`: Tailwind-stijlen
