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
- Adressen zoeken gaat via Nominatim, routes via de Valhalla-routeplanner (valhalla1.openstreetmap.de).
- Scootmobielroutes: geen trappen, geen onverharde paden, geen pontjes, zo min mogelijk hellingen
  en drukke wegen, maximaal 12 km/u.
- **Knooppunten**: kies bij "Nieuwe Rit" het tabblad Knooppunten en tik de groene fietsknooppunten aan
  in de volgorde waarin u wilt rijden. Kan ook als rondrit. De knooppunten komen van OpenStreetMap
  (via de Overpass-dienst). De app controleert of de route binnen het accubereik past.
- Deze gratis diensten zijn bedoeld voor licht gebruik. Voor een app met veel gebruikers is een eigen of betaalde dienst nodig.
- De browser geeft de GPS-locatie alleen via **https** of op **localhost**. Op je telefoon testen via
  `http://<ip-adres>:5173` geeft dus geen locatie; zet de app daarvoor online (https).
- Met **Demo-rit** kun je een route uitproberen zonder te rijden.

## Online

De app staat online op **https://joopzakelijk-boot.github.io/mijn-scootmobiel-app/**
(na elke wijziging op `main` wordt hij automatisch bijgewerkt).

Eenmalig instellen: ga op GitHub naar **Settings → Pages** en kies bij **Source** voor **GitHub Actions**.

## Overige commando's

- `npm run build`: maakt een versie om online te zetten in de map `dist/`
- `npm run preview`: bekijk die gebouwde versie

## Bestanden

- `src/ScootNav.jsx`: de app zelf (schermen, navigatie, instellingen)
- `src/RealMap.jsx`: de kaart
- `src/useLocation.js`: GPS-locatie volgen
- `src/services.js`: adres zoeken, route berekenen en knooppunten ophalen
- `src/geo.js`: afstanden en routeaanwijzingen
- `src/main.jsx`: start de app (en toont meldingen als balkje onderin)
- `src/index.css`: Tailwind-stijlen
