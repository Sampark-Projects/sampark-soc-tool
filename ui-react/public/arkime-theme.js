// Runs inside the Arkime pages: follows the theme chosen in the Sampark UI, swaps the Malcolm footer wording and
// adds a way back to the Sampark SOC Tool.
(function () {
  try {
    var t = localStorage.getItem('sampark-theme')
    document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark')
  } catch (e) {}
  // product name -> the name shown to users (same table as the React app)
  var NAMES = [['Arkime', 'PacketVault'], ['Moloch', 'PacketVault'], ['Zeek', 'ProtocolInspector'], ['Suricata', 'ThreatGuard IDS'], ['Hedgehog Linux', 'EdgeSensor OS'], ['OpenSearch', 'LogAnalytics Engine'], ['CyberChef', 'DataDecoder Workbench'], ['Vega', 'GraphStudio'], ['Filebeat', 'LogCollector'], ['Fluent Bit', 'StreamRouter'], ['NetBox', 'AssetRegistry'], ['Valkey', 'FastCache Store'], ['GeoLite2', 'GeoMapper'], ['Strelka', 'FileExtractor'], ['YARA', 'SignatureMatcher'], ['Capa', 'BehaviorAnalyzer'], ['ClamAV', 'MalwareScanner'], ['FilePond', 'ArtifactUploader'], ['Keycloak', 'IdentityGateway'], ['Malcolm', 'NetSight Core']]
  var LABELS = { 'arkime.com': 'PacketVault', 'Dashboards': 'LogAnalytics Engine', 'NetBox': 'AssetRegistry' }
  var ALT = NAMES.map(function (m) { return m[0].replace(/ /g, '[ _]') }).join('|')
  var RE = new RegExp('(?<![A-Za-z0-9])(' + ALT + ')(?![A-Za-z0-9])', 'gi')
  var HAS = new RegExp('(?<![A-Za-z0-9])(' + ALT + ')(?![A-Za-z0-9])|arkime\\.com|Dashboards', 'i')
  function nice(v) {
    v = v.split('arkime.com').join('PacketVault').split('Dashboards').join('LogAnalytics Engine')
    return v.replace(RE, function (m) {
      var k = m.replace(/_/g, ' ').toLowerCase()
      var hit = NAMES.filter(function (x) { return x[0].toLowerCase() === k })[0]
      if (!hit) return m
      return m === m.toLowerCase() ? hit[1].toLowerCase().replace(/ /g, '_') : hit[1]
    })
  }
  function relabel() {
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null)
    var n
    while ((n = w.nextNode())) {
      var v = n.nodeValue
      if (!v || !HAS.test(v)) continue
      var pe = n.parentElement
      var p = pe && pe.nodeName
      if (p === 'SCRIPT' || p === 'STYLE' || p === 'TEXTAREA' || p === 'INPUT' || p === 'PRE' || p === 'CODE') continue
      var o = nice(v)
      if (o !== v) n.nodeValue = o
    }
    document.querySelectorAll('[title],[aria-label],[placeholder]').forEach(function (e) {
      ;['title', 'aria-label', 'placeholder'].forEach(function (a) {
        var v = e.getAttribute(a)
        if (v && HAS.test(v)) e.setAttribute(a, nice(v))
      })
    })
    if (HAS.test(document.title)) document.title = nice(document.title)
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
      if (/Malc.?.?lm|NetSight Core/i.test(a.textContent || '')) {
        if (a.textContent !== 'NetSight Core 📄') a.textContent = 'NetSight Core 📄'
        if (a.getAttribute('href') !== '/ui/') a.setAttribute('href', '/ui/')
      }
      if (a.getAttribute('href') === '/dashboards/') a.setAttribute('href', '/ui/dashboards')
    })
    // product logo: replace the original tool logo (navbar brand, login pages, favicon) with the Sampark logo
    var LOGO = '/ui/sampark-logo.png'
    var imgs = document.querySelectorAll('.navbar-brand img, a.brand img, img[src*="alcolm" i], img[src*="logo" i]')
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i]
      var cur = im.getAttribute('src') || ''
      if (im.closest('.sam-back, .sam-theme')) continue
      if (cur === LOGO || /sampark/i.test(cur)) { im.classList.add('sam-logo'); continue }
      im.setAttribute('src', LOGO)
      im.removeAttribute('srcset')
      im.classList.add('sam-logo')
      im.style.objectFit = 'contain'
      im.style.height = '40px'
      im.style.width = 'auto'
    }
    var ic = document.querySelectorAll('link[rel~="icon"]')
    for (var j = 0; j < ic.length; j++) if (ic[j].getAttribute('href') !== LOGO) { ic[j].setAttribute('href', LOGO); ic[j].removeAttribute('type') }
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
  // run once the page has settled; fix() changes nothing when there is nothing left to change, so this always stops
  var timer = null
  var safeFix = function () { if (timer) return; timer = setTimeout(function () { timer = null; fix() }, 60) }
  new MutationObserver(safeFix).observe(document.documentElement, { childList: true, subtree: true })
  document.addEventListener('DOMContentLoaded', safeFix)
})()
