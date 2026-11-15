// Automatisch bijwerken: kijk of er een nieuwere versie van de app online staat.
// Browsers (en apps op het beginscherm) bewaren de app soms een tijd; zonder deze
// controle zie je nieuwe functies dan pas veel later.
/* global __BUILD_ID__ */

const CHECK_EVERY_MS = 5 * 60 * 1000;

async function check() {
  // Niet tijdens het ontwikkelen, en niet als er net al vernieuwd is
  if (import.meta.env.DEV) return;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const { build } = await res.json();
    if (build && build !== __BUILD_ID__) {
      // Nieuw adres (met ?v=...) zodat de browser de bewaarde oude versie niet gebruikt
      const url = new URL(window.location.href);
      if (url.searchParams.get('v') === build) return; // al geprobeerd; niet blijven herladen
      url.searchParams.set('v', build);
      window.location.replace(url.toString());
    }
  } catch (e) {
    // Geen internet: gewoon de huidige versie blijven gebruiken
  }
}

export function startAutoUpdate() {
  check();
  // Ook controleren als de app weer op de voorgrond komt, en af en toe tussendoor
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  setInterval(check, CHECK_EVERY_MS);
}
