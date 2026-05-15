// タスク管理 Service Worker
const CACHE = 'task-kanri-v1';
const FIREBASE_URL = 'https://task-kanri-92960-default-rtdb.firebaseio.com/tasks.json';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['./index.html']))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('firebase') || e.request.url.includes('qrserver')) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => cached))
  );
});

// Periodic Background Sync（対応ブラウザのみ）
self.addEventListener('periodicsync', e => {
  if (e.tag === 'check-tasks') {
    e.waitUntil(checkUpcomingTasks());
  }
});

async function checkUpcomingTasks() {
  try {
    const res  = await fetch(FIREBASE_URL);
    const data = await res.json();
    let tasks  = Array.isArray(data) ? data.filter(Boolean) : Object.values(data || {}).filter(Boolean);

    const today = new Date(); today.setHours(0,0,0,0);
    const tmrw  = new Date(today); tmrw.setDate(tmrw.getDate() + 1);
    const tmrwStr  = tmrw.toISOString().slice(0,10);
    const todayStr = today.toISOString().slice(0,10);

    const targets = tasks.filter(t =>
      t.status !== '完了' &&
      (t.dueDate === tmrwStr || t.dueDate === todayStr)
    );

    for (const t of targets) {
      const isToday = t.dueDate === todayStr;
      await self.registration.showNotification(
        '📋 ' + (isToday ? '【今日が期日】' : '【明日が期日】'),
        {
          body: t.content + (t.note ? '\n' + t.note : ''),
          icon:  './icon.png',
          badge: './icon.png',
          tag:   t.id,
          requireInteraction: true,
          data:  { url: 'https://snstbutterfly-del.github.io/task-kanri/' }
        }
      );
    }
  } catch (err) {
    console.error('通知チェックエラー:', err);
  }
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || 'https://snstbutterfly-del.github.io/task-kanri/';
  e.waitUntil(clients.matchAll({ type: 'window' }).then(cs => {
    const c = cs.find(c => c.url.includes('task-kanri'));
    if (c) return c.focus();
    return clients.openWindow(url);
  }));
});
