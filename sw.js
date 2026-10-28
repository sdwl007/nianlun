/* 年轮 PWA 离线缓存
 * 策略：页面（文档）网络优先——升级后立即拿到新版本，缓存仅作断网兜底；
 *       静态资源缓存优先——文件名带内容哈希， immutable，缓存安全。
 * 教训：曾用 cache-first 缓存页面，导致升级后永远加载旧版本（安卓端白屏根因）。 */
const CACHE = 'nianlun-pwa-v2'

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(['./', './index.html']))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return

  // 页面导航：网络优先，离线才回退缓存（保证发版后能立刻用上新版）
  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then(c => c.put('./index.html', copy))
        }
        return res
      }).catch(() => caches.match('./index.html')),
    )
    return
  }

  // 静态资源：缓存优先，运行时按需缓存同源 GET
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      if (hit) return hit
      return fetch(e.request).then(res => {
        if (res.ok && new URL(e.request.url).origin === self.location.origin) {
          const copy = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, copy))
        }
        return res
      }).catch(() => caches.match('./index.html'))
    }),
  )
})
