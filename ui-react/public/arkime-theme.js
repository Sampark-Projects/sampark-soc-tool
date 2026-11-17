// Runs inside the Arkime pages: follows the theme chosen in the Sampark UI, swaps the Malcolm footer wording and
// adds a way back to the Sampark SOC Tool.
(function () {
  try {
    var t = localStorage.getItem('sampark-theme')
    document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark')
  } catch (e) {}
  var LABELS = { 'arkime.com': 'PCAP & Indexing', 'Dashboards': 'threat hunting and data visualization', 'NetBox': 'IRM/IPAM/DCIM', 'Sampark SOC Tool': 'network traffic analysis suite' }
  function relabel() {
    var map = [['arkime.com', 'PCAP & Indexing'], ['Dashboards', 'threat hunting and data visualization'], ['NetBox', 'IRM/IPAM/DCIM'], ['Arkime', 'PCAP & Indexing']]
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null)
    var n
    while ((n = w.nextNode())) {
      var v = n.nodeValue
      if (!v || !/Arkime|arkime\.com|NetBox|Dashboards/.test(v)) continue
      var p = n.parentNode && n.parentNode.nodeName
      if (p === 'SCRIPT' || p === 'STYLE' || p === 'TEXTAREA' || p === 'INPUT') continue
      var o = v
      map.forEach(function (m) { o = o.split(m[0]).join(m[1]) })
      if (o !== v) n.nodeValue = o
    }
    if (/Arkime/.test(document.title)) document.title = document.title.replace(/Arkime/g, 'PCAP & Indexing')
  }
  function fix() {
    if (document.body) relabel()
    var ft = document.querySelector('.footer small')
    if (ft && !ft.getAttribute('data-sam')) {
      ft.setAttribute('data-sam', '1')
      ft.querySelectorAll('a').forEach(function (a) {
        var t = (a.textContent || '').replace(/[^\w. ]/g, '').trim()
        var k = Object.keys(LABELS).filter(function (x) { return t.indexOf(x) === 0 })[0]
        if (k) a.title = LABELS[k]
      })
    }
    document.querySelectorAll('.footer a').forEach(function (a) {
      if (/Malc.?.?lm/i.test(a.textContent || '')) {
        a.textContent = 'Sampark SOC Tool 📄'
        a.setAttribute('href', '/ui/')
      }
      if (a.getAttribute('href') === '/dashboards/') a.setAttribute('href', '/ui/dashboards')
    })
    if (!document.querySelector('.sam-theme') && document.body) {
      var t = document.createElement('button')
      t.className = 'sam-theme'
      t.type = 'button'
      var paint = function () { t.textContent = document.documentElement.getAttribute('data-theme') === 'light' ? '☾ Dark' : '☀ Light'; t.title = 'Switch light / dark theme' }
      t.onclick = function () {
        var n = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light'
        document.documentElement.setAttribute('data-theme', n)
        try { localStorage.setItem('sampark-theme', n) } catch (e) {}
        paint()
      }
      paint()
      document.body.appendChild(t)
    }
    if (!document.querySelector('.sam-back') && document.body) {
      var b = document.createElement('a')
      b.className = 'sam-back'
      b.href = '/ui/'
      b.textContent = '← Sampark SOC Tool'
      document.body.appendChild(b)
    }
  }
  new MutationObserver(fix).observe(document.documentElement, { childList: true, subtree: true })
  document.addEventListener('DOMContentLoaded', fix)
})()
