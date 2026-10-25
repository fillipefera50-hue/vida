// Guarda os arquivos do app no aparelho para abrir sem internet, e mostra as notificações.
const CACHE = 'vida-app-v10';
const FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== 'vida-cfg').map(k => caches.delete(k)))));
  self.clients.claim();
});

// Tenta a internet primeiro (pega atualização); sem internet, usa a cópia guardada.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request)
      .then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});

// ---------- Notificações ----------
// O servidor manda um toque vazio; aqui buscamos o texto dos avisos e mostramos.
async function readCfg() {
  const r = await (await caches.open('vida-cfg')).match('cfg');
  return r ? r.json() : null;
}
async function showPending() {
  const opts = { icon: 'icon-192.png', badge: 'icon-192.png' };
  try {
    const cfg = await readCfg();
    const r = await fetch(`${cfg.server}/outbox?id=${cfg.id}&token=${cfg.token}`);
    const { msgs } = await r.json();
    if (msgs && msgs.length) {
      for (const m of msgs) await self.registration.showNotification(m.title, { ...opts, body: m.body, tag: m.k, data: { go: m.go } });
      return;
    }
  } catch (e) {}
  await self.registration.showNotification('Minha Vida', { ...opts, body: 'Você tem avisos. Toque pra ver.', tag: 'vida' });
}
self.addEventListener('push', e => e.waitUntil(showPending()));

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const go = (e.notification.data && e.notification.data.go) || '';
  const url = new URL('./index.html' + (go ? '?go=' + go : ''), self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if (c.url.startsWith(self.registration.scope)) { c.navigate(url); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
