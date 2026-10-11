#!/usr/bin/env python3
"""Regenerates every page under website/tools/ and the tools entries in website/sitemap.xml.

    python website/tools/build.py

Content lives in catalog.py. The site itself has no build step; run this only after editing the
catalog or the templates below, and commit the generated HTML.
"""
import sys
sys.dont_write_bytecode = True
import html, json, os, re, warnings

warnings.filterwarnings("ignore", category=SyntaxWarning)
from catalog import TOOLS, GROUPS, APPCAT

HERE = os.path.dirname(os.path.abspath(__file__))
SITE_DIR = os.path.dirname(HERE)
SITE = "https://otm.sabaoon.dev"
E = html.escape

index_html = open(os.path.join(SITE_DIR, "index.html"), encoding="utf-8").read()
BRAND = re.search(r'<a class="brand".*?</a>', index_html, re.S).group(0)

NAV = [("/#full-demo", "Live demo"), ("/#features", "Features"), ("/#terminal", "Terminal"), ("/#install", "Install"),
       ("/#download", "Download"), ("/#specs", "Specs"), ("/#roadmap", "Roadmap"), ("/releases.html", "What's new"),
       ("/tools/", "Tools"), ("/blog/", "Blog")]
GH = ('<a class="gh" href="https://github.com/sabaoongfx/Open-Task-Manager" target="_blank" rel="noopener">'
      '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg> GitHub</a>')
CUR = ' aria-current="page"'

FOOT = '''<footer>
  <span>Open Task Manager &middot; open source on <a href="https://github.com/sabaoongfx/Open-Task-Manager" target="_blank" rel="noopener">GitHub</a> &middot; built by <a href="https://sabaoon.dev" target="_blank" rel="noopener">sabaoon.dev</a></span>
  <span><a href="/tools/">All tools</a> &middot; <a href="/">Home</a></span>
</footer>'''

CONTROLS = '''<section class="tool-panel" id="panel">
    <form class="controls" id="controls" onsubmit="return false" autocomplete="off" aria-label="Generator settings"></form>
    <div class="stage">
      <div class="preview" id="preview" aria-live="polite"></div>
      <div class="actions">
        <button class="btn btn-primary" id="shuffle" type="button">Randomize</button>
        <button class="btn btn-ghost" id="copy" type="button">Copy SVG</button>
        <button class="btn btn-ghost" id="dl-svg" type="button">Download SVG</button>
        <button class="btn btn-ghost" id="dl-png" type="button">Download PNG</button>
        <button class="btn btn-ghost" id="rec" type="button">Record video</button>
        <span class="status" id="status"></span>
      </div>
    </div>
  </section>'''

BY = dict((t["slug"], t) for t in TOOLS)
GROUP_NAME = dict(GROUPS)


def topbar():
    links = "".join('<a href="%s"%s>%s</a>' % (h, CUR if h == "/tools/" else "", E(n)) for h, n in NAV)
    return '<div class="topbar">\n  %s\n  <nav class="topnav">%s%s</nav>\n</div>' % (BRAND, links, GH)


def head(title, desc, path, lds):
    url = SITE + path
    ld = "".join('<script type="application/ld+json">%s</script>\n' % json.dumps(x, ensure_ascii=False, separators=(",", ":")) for x in lds)
    return '''<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>%(t)s</title>
<meta name="description" content="%(d)s">
<link rel="canonical" href="%(u)s">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#F6F4EF" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#16130F" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="website"><meta property="og:site_name" content="Open Task Manager">
<meta property="og:title" content="%(t)s"><meta property="og:description" content="%(d)s">
<meta property="og:url" content="%(u)s"><meta property="og:image" content="%(s)s/og.png">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="%(t)s"><meta name="twitter:description" content="%(d)s"><meta name="twitter:image" content="%(s)s/og.png">
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;900&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>:root{color-scheme:light;box-sizing:border-box}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#faf9f5;color:#141413}[hidden]:not([hidden=until-found i]){display:none!important}</style>
<link rel="stylesheet" href="/site.css"><link rel="stylesheet" href="/tools/tools.css">
%(ld)s</head>''' % dict(t=E(title), d=E(desc), u=url, s=SITE, ld=ld)


def crumbs(name, path):
    items = [("Home", "/"), ("Tools", "/tools/")] + ([(name, path)] if name else [])
    parts = []
    for i, (n, u) in enumerate(items):
        parts.append(E(n) if i == len(items) - 1 else '<a href="%s">%s</a>' % (u, E(n)))
    ld = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": SITE + u} for i, (n, u) in enumerate(items)]}
    return '<nav class="crumbs" aria-label="Breadcrumb">%s</nav>' % " / ".join(parts), ld


def card(tag, t):
    return ('<a class="card" href="/tools/%s/"><%s>%s</%s><p>%s</p><span class="go">Open tool &rarr;</span></a>'
            % (t["slug"], tag, E(t["name"]), tag, E(t["short"])))


def related(t):
    same = [x for x in TOOLS if x["group"] == t["group"] and x["slug"] != t["slug"]]
    rest = [x for x in TOOLS if x["group"] != t["group"]]
    # neighbours in the same group first, then a few from elsewhere
    return (same + rest)[:3]


def tool_page(t):
    path = "/tools/%s/" % t["slug"]
    cb, bc = crumbs(t["name"], path)
    faq_ld = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in t["faq"]]}
    app_ld = {"@context": "https://schema.org", "@type": "WebApplication", "name": t["name"], "url": SITE + path,
              "description": t["desc"], "applicationCategory": APPCAT[t["group"]],
              "operatingSystem": "Any (runs in a web browser)", "browserRequirements": "Requires JavaScript",
              "isAccessibleForFree": True, "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
              "isPartOf": {"@type": "WebSite", "name": "Open Task Manager", "url": SITE + "/"},
              "author": {"@type": "Person", "name": "sabaoongfx", "url": "https://sabaoon.dev"}}
    steps = "".join("<li>%s</li>" % s for s in t["steps"])
    uses = "".join("<li>%s</li>" % E(u) for u in t["uses"])
    faq = "".join("<details><summary>%s</summary><p>%s</p></details>" % (E(q), E(a)) for q, a in t["faq"])
    others = "".join(card("h3", x) for x in related(t))
    if t["kind"] == "gen":
        body = CONTROLS
        scripts = '<script src="/tools/tools.js" defer></script>'
        tool_attr = t["tool"]
    else:
        body = '<section class="tool-ui" id="app" aria-label="%s">%s</section>' % (E(t["name"]), t["ui"])
        scripts = ('<script src="/tools/vendor/qrcode.js" defer></script>\n' if t["slug"] == "qr-code-generator" else "") + '<script src="/tools/utils.js" defer></script>'
        tool_attr = t["tool"]
    return head(t["title"], t["desc"], path, [app_ld, bc, faq_ld]) + '''
<body data-tool="%(tool)s">
%(top)s
%(cb)s
<header class="hero tool-hero">
  <p class="eyebrow">free online tool</p>
  <h1>%(h1)s</h1>
  <p class="lede">%(lede)s</p>
</header>

<main class="tools">
  %(body)s
  <noscript><p class="hero-note">This tool needs JavaScript. It runs entirely in your browser; nothing is sent to a server.</p></noscript>

  <div class="prose">
    <h2>How to use the %(lname)s</h2>
    <ol>%(steps)s</ol>
    <h2>What it is good for</h2>
    <ul>%(uses)s</ul>
    <h2>Frequently asked questions</h2>
    %(faq)s
  </div>

  <section class="others">
    <h2>More free tools</h2>
    <div class="cards">%(others)s</div>
  </section>
</main>

%(foot)s
%(scripts)s
</body></html>
''' % dict(tool=tool_attr, top=topbar(), cb=cb, h1=t["h1"], lede=t["lede"], body=body, lname=E(t["name"]),
           steps=steps, uses=uses, faq=faq, others=others, foot=FOOT, scripts=scripts)


def hub():
    path = "/tools/"
    title = "Free Online Tools: SVG, Color, JSON, QR Code and More"
    desc = "%d free tools that run in your browser: SVG and wallpaper generators, color and CSS tools, JSON, QR codes and more. No sign-up, no uploads." % len(TOOLS)
    cb, bc = crumbs(None, path)
    lst = {"@context": "https://schema.org", "@type": "ItemList", "name": "Free online tools", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "url": "%s/tools/%s/" % (SITE, t["slug"]), "name": t["name"]} for i, t in enumerate(TOOLS)]}
    page = {"@context": "https://schema.org", "@type": "CollectionPage", "name": title, "url": SITE + path,
            "description": desc, "isPartOf": {"@type": "WebSite", "name": "Open Task Manager", "url": SITE + "/"}}
    groups = ""
    for gid, gname in GROUPS:
        cards = "".join(card("h3", t) for t in TOOLS if t["group"] == gid)
        groups += '<section class="hubgroup"><h2>%s</h2><div class="cards">%s</div></section>' % (E(gname), cards)
    return head(title, desc, path, [page, lst, bc]) + '''
<body>
%(top)s
%(cb)s
<header class="hero tools-hero">
  <p class="eyebrow">tools</p>
  <h1>Free online <em>tools</em></h1>
  <p class="lede">Small, fast tools that run entirely in your browser. No server, no uploads, no account: just open one and use it.</p>
</header>
<main class="tools">
  %(groups)s
  <div class="prose">
    <h2>Why these run in your browser</h2>
    <p>Every tool here is plain JavaScript that runs on your device. The images, text and files you work with are processed locally, so nothing you enter is uploaded, logged or stored. They keep working on a slow connection once the page has loaded.</p>
    <p>These tools come from the <a href="/" style="text-decoration:underline">Open Task Manager</a> project, a free, open-source task manager and system monitor for Linux, Windows and macOS.</p>
  </div>
</main>
%(foot)s
</body></html>
''' % dict(top=topbar(), cb=cb, groups=groups, foot=FOOT)


def write(rel, text):
    full = os.path.join(HERE, rel)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, "w", encoding="utf-8", newline="\n").write(text)


def update_sitemap():
    p = os.path.join(SITE_DIR, "sitemap.xml")
    s = open(p, encoding="utf-8").read()
    s = re.sub(r"  <url>\s*<loc>%s/tools/[^<]*</loc>\s*</url>\n?" % re.escape(SITE), "", s)
    locs = [SITE + "/tools/"] + ["%s/tools/%s/" % (SITE, t["slug"]) for t in TOOLS]
    block = "".join("  <url>\n    <loc>%s</loc>\n  </url>\n" % l for l in locs)
    anchor = "<loc>%s/releases.html</loc>\n  </url>\n" % SITE
    assert anchor in s, "releases.html entry not found in sitemap.xml"
    s = s.replace(anchor, anchor + block, 1)
    open(p, "w", encoding="utf-8", newline="\n").write(s)


write("index.html", hub())
for t in TOOLS:
    write("%s/index.html" % t["slug"], tool_page(t))
update_sitemap()
print("built %d tool pages + hub" % len(TOOLS))
