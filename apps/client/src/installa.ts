// App installabile (PWA): l'icona sul telefono deve entrare come sé.
// Android/Chrome legge lo start_url dal manifest, che il server scrive col token (`/manifest.webmanifest?t=`);
// iPhone (Aggiungi alla schermata Home) usa l'indirizzo della pagina e ha un archivio suo: il token deve stare nell'URL.
import { FLAGS } from './flags.ts';

export function preparaInstallazione(): void {
  if (!FLAGS.token || FLAGS.test) return;
  const link = document.getElementById('manifest');
  if (link instanceof HTMLLinkElement) link.href = `/manifest.webmanifest?t=${encodeURIComponent(FLAGS.token)}`;
  const q = new URLSearchParams(location.search);
  if (q.get('t') !== FLAGS.token) {
    q.set('t', FLAGS.token);
    try { history.replaceState(history.state, '', `${location.pathname}?${q.toString()}${location.hash}`); } catch { /* ok */ }
  }
}
