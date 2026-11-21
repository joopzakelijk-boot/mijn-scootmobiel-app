# ScootNav in de Google Play Store: stappenplan

Alles wat technisch nodig is, staat klaar in deze repository. De stappen hieronder moet je zelf doen, omdat Google eist dat de eigenaar van het ontwikkelaarsaccount ze uitvoert.

**Belangrijk om te weten:**
- Heb je een **persoonlijk** ontwikkelaarsaccount (aangemaakt na november 2023)? Dan moet je de app eerst **14 dagen laten testen door minstens 12 testers** voordat hij openbaar in de Play Store mag. Zie stap 5.
- Bij een account voor een **organisatie** geldt die testperiode niet.

---

## Stap 1 – De geheime uploadsleutel in GitHub zetten (eenmalig)

Je hebt van Claude twee tekstbestanden gekregen: `PLAY_KEYSTORE_BASE64.txt` en `PLAY_KEYSTORE_PASSWORD.txt`, plus het sleutelbestand `scootnav-play-upload.jks`.

1. Ga op je computer naar https://github.com/joopzakelijk-boot/mijn-scootmobiel-app/settings/secrets/actions
2. Klik op **New repository secret**.
   - Name: `PLAY_KEYSTORE_BASE64`
   - Secret: de volledige inhoud van `PLAY_KEYSTORE_BASE64.txt` (één lange regel)
   - Klik op **Add secret**.
3. Klik nogmaals op **New repository secret**.
   - Name: `PLAY_KEYSTORE_PASSWORD`
   - Secret: de inhoud van `PLAY_KEYSTORE_PASSWORD.txt`
   - Klik op **Add secret**.
4. **Bewaar `scootnav-play-upload.jks` en het wachtwoord veilig**, bijvoorbeeld in een wachtwoordkluis of op een USB-stick. Zet ze nooit in de repository en deel ze met niemand.

## Stap 2 – Het app-bestand voor de Play Store laten bouwen

1. Merge de openstaande pull request.
2. Wacht ongeveer 10 minuten. GitHub bouwt dan `ScootNav.aab`.
3. Download het bestand op je computer:
   https://github.com/joopzakelijk-boot/mijn-scootmobiel-app/releases/latest/download/ScootNav.aab

Zie je bij die link "Not Found"? Controleer dan of stap 1 goed is gegaan, en start de bouw opnieuw via **Actions → Android-app bouwen → Run workflow**.

## Stap 3 – De app aanmaken in de Play Console

1. Ga naar https://play.google.com/console en klik op **App maken**.
2. Vul in:
   - App-naam: `ScootNav – scootmobiel route`
   - Standaardtaal: **Nederlands – nl-NL**
   - App of game: **App**
   - Gratis of betaald: **Gratis**
3. Vink de verklaringen aan en klik op **App maken**.

## Stap 4 – Winkelvermelding en app-inhoud invullen

### Winkelvermelding (Groeien → Winkelvermelding)
Neem de teksten over uit `store/STORE-TEKSTEN.md` en upload:
- het app-icoon: `store/icon-512.png`
- de grafische weergave: `store/feature-graphic.png`
- de schermafbeeldingen voor de telefoon: alle bestanden in `store/screenshots/`

### App-inhoud (Beleid → App-content)

| Onderdeel | Antwoord |
|---|---|
| **Privacybeleid** | `https://joopzakelijk-boot.github.io/mijn-scootmobiel-app/privacy.html` |
| **App-toegang** | Alle functionaliteit is beschikbaar zonder speciale toegang (geen inlog) |
| **Advertenties** | Nee, de app bevat geen advertenties |
| **Contentbeoordeling** | Vragenlijst invullen. Categorie: *Alle andere app-typen* (hulpprogramma). Op alle vragen over geweld, seks, taal, drugs, gokken en dergelijke: **Nee**. "Deelt de app de locatie van de gebruiker met andere gebruikers?": **Nee**. Geen onbeperkte internettoegang, geen aankopen. |
| **Doelgroep** | **18 jaar en ouder**. De app spreekt kinderen niet aan. |
| **Nieuws-app** | Nee |
| **Overheids-app** | Nee |
| **Financiële functies** | Geen |
| **Gezondheid** | Geen gezondheidsfuncties |

### Gegevensveiligheid (Beleid → App-content → Gegevensveiligheid)

| Vraag | Antwoord |
|---|---|
| Verzamelt of deelt de app gebruikersgegevens? | **Ja** |
| Worden alle gegevens versleuteld tijdens verzending? | **Ja** (alles via https) |
| Kunnen gebruikers verzoeken om verwijdering? | Er worden geen gegevens op een server bewaard; alles staat op de telefoon en verdwijnt bij het verwijderen van de app |

Gegevenstypen om aan te vinken:

| Gegevenstype | Verzameld | Gedeeld | Tijdelijk verwerkt | Verplicht? | Doel |
|---|---|---|---|---|---|
| **Locatie → Precieze locatie** | Ja | Nee | Ja | Verplicht | App-functionaliteit |
| **Locatie → Geschatte locatie** | Ja | Nee | Ja | Verplicht | App-functionaliteit |
| **Persoonlijke gegevens → Adres** | Ja | Nee | Ja | Optioneel | App-functionaliteit |

Uitleg: de app stuurt coördinaten en (bij "Naar Huis") het thuisadres naar de routeplanner en adreszoeker van OpenStreetMap om de route te berekenen. Dat gebeurt op verzoek van de gebruiker en wordt niet bewaard. Naam en telefoonnummer van het noodcontact blijven op de telefoon en worden **niet** verzameld.

## Stap 5 – Gesloten test met 12 testers (14 dagen)

1. Ga naar **Testen → Gesloten testen** en maak een testtrack (bijvoorbeeld "Testgroep").
2. Bij **Testers**: maak een e-maillijst met minstens **12 Gmail-adressen** van mensen met een Android-telefoon, zoals familie, vrienden of iemand van een scootmobielclub.
3. Klik op **Nieuwe release maken**:
   - Accepteer **Play App Signing**: Google beheert de definitieve ondertekening. Je uploadsleutel uit stap 1 is alleen om te uploaden.
   - Upload `ScootNav.aab`.
   - Releasenotities, bijvoorbeeld: `Eerste testversie van ScootNav.`
4. Kies de landen **Nederland** en **België**, controleer alles en klik op **Publiceren**.
5. Stuur de testers de **aanmeldlink** van de test. Ze moeten zich aanmelden en de app installeren via de Play Store.
6. Laat minstens 12 testers **14 dagen achter elkaar** aangemeld blijven en de app af en toe gebruiken.

**Let op:** heb je de zelf-geïnstalleerde APK op je telefoon? Verwijder die eerst. De Play Store-versie heeft een andere handtekening en kan er niet overheen installeren.

## Stap 6 – Openbaar maken (productie)

1. Na 14 dagen verschijnt op het **Dashboard** de knop **Toegang tot productie aanvragen**. Beantwoord daar de vragen over de test.
2. Google beoordeelt dat binnen enkele dagen.
3. Daarna: **Productie → Nieuwe release maken** → dezelfde of een nieuwere `ScootNav.aab` uploaden → **Publiceren**.
4. De eerste beoordeling door Google duurt meestal een paar dagen. Daarna staat ScootNav in de Play Store.

## Later: een nieuwe versie uitbrengen

Bij elke wijziging die in `main` komt, bouwt GitHub automatisch een nieuwe `ScootNav.aab` met een hoger versienummer. Download hem via de link uit stap 2 en upload hem in de Play Console als nieuwe release.
