(function(){
  "use strict";

  // ---------- helpers ----------
  function mulberry32(a){
    return function(){
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hashSeed(s){
    var h = 2166136261;
    for (var i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function newSeed(){ return Math.random().toString(36).slice(2, 8); }
  function f(n){ return Math.round(n * 10) / 10; }
  function pick(r, a){ return a[Math.floor(r() * a.length)]; }
  function range(r, a, b){ return a + r() * (b - a); }

  var PALETTES = {
    sunset:  ["#2B1B3F","#E93233","#FBA806","#FFDB56","#FF7A59"],
    ocean:   ["#03162F","#0B4F8A","#1D8FCF","#6DD3E5","#D6F6F0"],
    forest:  ["#10241A","#1F5E3B","#4B9B5C","#A8D18B","#F0E9B8"],
    candy:   ["#FF5C8A","#FFB3C7","#B28DFF","#6CD4FF","#FFF1A8"],
    mono:    ["#0E0E10","#2A2A30","#5B5B66","#A3A3AE","#EDEDF2"],
    aurora:  ["#0B1026","#2D1E6B","#2BC4A9","#7CF29B","#C26BFF"],
    earth:   ["#2A1F18","#7A4A2B","#C98B4E","#E9CDA0","#6B7F5A"]
  };
  var PALETTE_NAMES = Object.keys(PALETTES);

  function resolvePalette(o, r){
    var key = o.palette === "random" ? PALETTE_NAMES[Math.floor(r() * PALETTE_NAMES.length)] : o.palette;
    return PALETTES[key].slice();
  }
  function hex2rgb(h){ return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]; }
  function mix(a, b, t){
    var x = hex2rgb(a), y = hex2rgb(b);
    return "rgb(" + [0,1,2].map(function(i){ return Math.round(x[i] + (y[i] - x[i]) * t); }).join(",") + ")";
  }
  function grad(pal, t){
    t = Math.max(0, Math.min(0.9999, t)) * (pal.length - 1);
    var i = Math.floor(t);
    return mix(pal[i], pal[i + 1], t - i);
  }

  // Closed smooth curve through points (Catmull-Rom converted to cubic Beziers).
  function smooth(p){
    var n = p.length, d = "M" + f(p[0][0]) + " " + f(p[0][1]);
    for (var i = 0; i < n; i++){
      var p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
      d += "C" + f(p1[0] + (p2[0] - p0[0]) / 6) + " " + f(p1[1] + (p2[1] - p0[1]) / 6) + " " +
                 f(p2[0] - (p3[0] - p1[0]) / 6) + " " + f(p2[1] - (p3[1] - p1[1]) / 6) + " " +
                 f(p2[0]) + " " + f(p2[1]);
    }
    return d + "Z";
  }
  function blobPoints(r, cx, cy, rad, n, wobble){
    var pts = [], off = r() * Math.PI * 2;
    for (var i = 0; i < n; i++){
      var a = off + i / n * Math.PI * 2, k = rad * (1 - wobble + r() * wobble * 2);
      pts.push([cx + Math.cos(a) * k, cy + Math.sin(a) * k]);
    }
    return pts;
  }
  function wrap(w, h, inner, defs){
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
      (defs ? "<defs>" + defs + "</defs>" : "") + inner + "</svg>";
  }

  // ---------- generators ----------
  function genShapes(o, r){
    var W = 800, H = 800, pal = resolvePalette(o, r), out = "";
    var bg = o.background === "dark" ? pal[0] : o.background === "light" ? pal[pal.length - 1] : "none";
    if (bg !== "none") out += '<rect width="800" height="800" fill="' + bg + '"/>';
    var fills = pal.filter(function(c){ return c !== bg; });
    for (var i = 0; i < +o.count; i++){
      var x = range(r, 0, W), y = range(r, 0, H), s = range(r, 40, 190), c = pick(r, fills);
      var op = f(range(r, 0.55, 1)), t = o.kind === "mixed" ? pick(r, ["blob","circle","poly","ring","rect"]) : o.kind;
      if (t === "blob") out += '<path d="' + smooth(blobPoints(r, x, y, s, 7, 0.35)) + '" fill="' + c + '" opacity="' + op + '"/>';
      else if (t === "circle") out += '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(s * 0.8) + '" fill="' + c + '" opacity="' + op + '"/>';
      else if (t === "ring") out += '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(s * 0.8) + '" fill="none" stroke="' + c + '" stroke-width="' + f(range(r, 4, 18)) + '" opacity="' + op + '"/>';
      else if (t === "rect") out += '<rect x="' + f(x - s / 2) + '" y="' + f(y - s / 2) + '" width="' + f(s) + '" height="' + f(s * range(r, 0.5, 1.2)) + '" rx="' + f(range(r, 0, s / 3)) + '" fill="' + c + '" opacity="' + op + '" transform="rotate(' + f(range(r, 0, 90)) + ' ' + f(x) + ' ' + f(y) + ')"/>';
      else {
        var n = 3 + Math.floor(r() * 4), pts = blobPoints(r, x, y, s, n, 0.15).map(function(p){ return f(p[0]) + "," + f(p[1]); });
        out += '<polygon points="' + pts.join(" ") + '" fill="' + c + '" opacity="' + op + '"/>';
      }
    }
    return { svg: wrap(W, H, out), w: W, h: H };
  }

  function genWallpaper(o, r){
    var sz = o.size.split("x"), W = +sz[0], H = +sz[1], pal = resolvePalette(o, r), defs = "", out = "", i, j;
    if (o.style === "mesh"){
      var sd = f(Math.min(W, H) * 0.12);
      defs = '<filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="' + sd + '"/></filter>';
      out = '<rect width="' + W + '" height="' + H + '" fill="' + pal[0] + '"/><g filter="url(#b)">';
      for (i = 0; i < 9; i++)
        out += '<circle cx="' + f(range(r, 0, W)) + '" cy="' + f(range(r, 0, H)) + '" r="' + f(range(r, 0.15, 0.4) * Math.min(W, H)) + '" fill="' + pick(r, pal.slice(1)) + '" opacity="' + f(range(r, 0.6, 1)) + '"/>';
      out += "</g>";
    } else if (o.style === "waves"){
      defs = '<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + pal[0] + '"/><stop offset="1" stop-color="' + pal[1] + '"/></linearGradient>';
      out = '<rect width="' + W + '" height="' + H + '" fill="url(#g)"/>';
      var layers = 6;
      for (i = 0; i < layers; i++){
        var base = H * (0.3 + i * 0.12), amp = H * range(r, 0.04, 0.1), pts = [], n = 6;
        for (j = 0; j <= n; j++) pts.push([-W * 0.1 + j / n * W * 1.2, base + range(r, -amp, amp)]);
        var d = "M" + f(pts[0][0]) + " " + f(pts[0][1]);
        for (j = 0; j < n; j++){
          var p0 = pts[Math.max(j - 1, 0)], p1 = pts[j], p2 = pts[j + 1], p3 = pts[Math.min(j + 2, n)];
          d += "C" + f(p1[0] + (p2[0] - p0[0]) / 6) + " " + f(p1[1] + (p2[1] - p0[1]) / 6) + " " +
                     f(p2[0] - (p3[0] - p1[0]) / 6) + " " + f(p2[1] - (p3[1] - p1[1]) / 6) + " " + f(p2[0]) + " " + f(p2[1]);
        }
        d += "L" + f(W * 1.1) + " " + H + "L" + f(-W * 0.1) + " " + H + "Z";
        out += '<path d="' + d + '" fill="' + pal[2 + (i % (pal.length - 2))] + '" opacity="0.75"/>';
      }
    } else { // lowpoly
      var cols = Math.round(W / Math.min(W, H) * 9), rows = Math.round(H / Math.min(W, H) * 9);
      var cw = W / cols, ch = H / rows, grid = [];
      for (j = 0; j <= rows; j++){
        grid.push([]);
        for (i = 0; i <= cols; i++){
          var edge = i === 0 || j === 0 || i === cols || j === rows;
          grid[j].push([i * cw + (edge ? 0 : range(r, -0.35, 0.35) * cw), j * ch + (edge ? 0 : range(r, -0.35, 0.35) * ch)]);
        }
      }
      out = '<rect width="' + W + '" height="' + H + '" fill="' + pal[0] + '"/>';
      function tri(a, b, c){
        var t = ((a[0] + b[0] + c[0]) / 3 / W + (a[1] + b[1] + c[1]) / 3 / H) / 2 + range(r, -0.08, 0.08), col = grad(pal, t);
        return '<polygon points="' + [a, b, c].map(function(p){ return f(p[0]) + "," + f(p[1]); }).join(" ") + '" fill="' + col + '" stroke="' + col + '" stroke-width="1"/>';
      }
      for (j = 0; j < rows; j++) for (i = 0; i < cols; i++){
        var a = grid[j][i], b = grid[j][i + 1], c = grid[j + 1][i], d2 = grid[j + 1][i + 1];
        if (r() < 0.5) out += tri(a, b, c) + tri(b, d2, c); else out += tri(a, b, d2) + tri(a, d2, c);
      }
    }
    if (o.grain){
      defs += '<filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.35 0"/></filter>';
      out += '<rect width="' + W + '" height="' + H + '" filter="url(#n)" opacity="0.5"/>';
    }
    return { svg: wrap(W, H, out, defs), w: W, h: H };
  }

  function genAnimation(o, r){
    var W = 800, H = 800, pal = resolvePalette(o, r), out = "", i, defs = "", sp = +o.speed;
    var fills = pal.slice(1);
    function dur(a, b){ return f(range(r, a, b) / sp) + "s"; }
    out = '<rect width="800" height="800" fill="' + pal[0] + '"/>';
    if (o.style === "bubbles"){
      for (i = 0; i < +o.count; i++){
        var x = range(r, 40, 760), y = range(r, 200, 800), rad = range(r, 14, 70), dy = range(r, 150, 400), dx = range(r, -60, 60), du = dur(5, 12);
        out += '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(rad) + '" fill="' + pick(r, fills) + '" opacity="0.8">' +
          '<animateTransform attributeName="transform" type="translate" values="0 0;' + f(dx) + ' ' + f(-dy) + ';0 0" dur="' + du + '" repeatCount="indefinite" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" keyTimes="0;.5;1"/>' +
          '<animate attributeName="opacity" values=".35;.9;.35" dur="' + du + '" repeatCount="indefinite"/></circle>';
      }
    } else if (o.style === "pulse"){
      var n = Math.max(3, Math.round(+o.count / 3)), du2 = f(5 / sp), col = pick(r, fills);
      for (i = 0; i < n; i++)
        out += '<circle cx="400" cy="400" r="0" fill="none" stroke="' + fills[i % fills.length] + '" stroke-width="6">' +
          '<animate attributeName="r" values="0;380" dur="' + du2 + 's" begin="' + f(i * 5 / sp / n) + 's" repeatCount="indefinite"/>' +
          '<animate attributeName="opacity" values="1;0" dur="' + du2 + 's" begin="' + f(i * 5 / sp / n) + 's" repeatCount="indefinite"/></circle>';
      out += '<circle cx="400" cy="400" r="26" fill="' + col + '"><animate attributeName="r" values="22;34;22" dur="' + f(2 / sp) + 's" repeatCount="indefinite"/></circle>';
    } else if (o.style === "orbit"){
      out += '<circle cx="400" cy="400" r="44" fill="' + fills[0] + '"/>';
      var rings = Math.max(3, Math.round(+o.count / 4));
      for (i = 0; i < rings; i++){
        var R = 90 + i * (300 / rings), dir = r() < 0.5 ? 1 : -1, du3 = f((6 + i * 3) / sp), a0 = f(range(r, 0, 360));
        out += '<circle cx="400" cy="400" r="' + f(R) + '" fill="none" stroke="' + fills[(i + 1) % fills.length] + '" stroke-opacity=".3"/>' +
          '<g><circle cx="' + f(400 + R) + '" cy="400" r="' + f(range(r, 8, 20)) + '" fill="' + fills[(i + 1) % fills.length] + '"/>' +
          '<animateTransform attributeName="transform" type="rotate" from="' + a0 + ' 400 400" to="' + f(a0 + 360 * dir) + ' 400 400" dur="' + du3 + 's" repeatCount="indefinite"/></g>';
      }
    } else { // morph
      var k = 8, frames = [], t;
      for (t = 0; t < 4; t++) frames.push(smooth(blobPoints(r, 400, 400, 230, k, 0.38)));
      frames.push(frames[0]);
      defs = '<linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + fills[0] + '"/><stop offset="1" stop-color="' + fills[fills.length - 1] + '"/></linearGradient>';
      out += '<path fill="url(#m)" d="' + frames[0] + '">' +
        '<animate attributeName="d" dur="' + dur(8, 12) + '" repeatCount="indefinite" values="' + frames.join(";") + '" calcMode="spline" keyTimes="0;.25;.5;.75;1" keySplines="' + [1,2,3,4].map(function(){ return ".45 0 .55 1"; }).join(";") + '"/>' +
        '<animateTransform attributeName="transform" type="rotate" from="0 400 400" to="360 400 400" dur="' + dur(24, 36) + '" repeatCount="indefinite"/></path>';
    }
    return { svg: wrap(W, H, out, defs), w: W, h: H, animated: true };
  }

  // ---------- tool definitions (controls are rendered from these) ----------
  function paletteField(){
    return { name: "palette", label: "Palette", type: "select", value: "random", options: [["random", "Random"]].concat(PALETTE_NAMES.map(function(n){ return [n, n[0].toUpperCase() + n.slice(1)]; })) };
  }
  var TOOLS = {
    shapes: { gen: genShapes, png: true, file: "random-shapes", fields: [
      { name: "kind", label: "Shapes", type: "select", value: "mixed", options: [["mixed","Mixed"],["blob","Blobs"],["circle","Circles"],["ring","Rings"],["poly","Polygons"],["rect","Rounded squares"]] },
      { name: "count", label: "Count", type: "range", min: 3, max: 60, value: 18 },
      paletteField(),
      { name: "background", label: "Background", type: "select", value: "dark", options: [["dark","Dark"],["light","Light"],["none","Transparent"]] }
    ]},
    wallpaper: { gen: genWallpaper, png: true, file: "wallpaper", fields: [
      { name: "style", label: "Style", type: "select", value: "mesh", options: [["mesh","Gradient mesh"],["waves","Layered waves"],["lowpoly","Low poly"]] },
      { name: "size", label: "Size", type: "select", value: "1920x1080", options: [["1920x1080","1920 x 1080 (Full HD)"],["2560x1440","2560 x 1440 (QHD)"],["3840x2160","3840 x 2160 (4K)"],["1080x1920","1080 x 1920 (phone)"],["1080x1080","1080 x 1080 (square)"]] },
      paletteField(),
      { name: "grain", label: "Film grain", type: "check", value: false }
    ]},
    animation: { gen: genAnimation, png: false, video: true, file: "animation", fields: [
      { name: "style", label: "Style", type: "select", value: "bubbles", options: [["bubbles","Floating bubbles"],["pulse","Pulse rings"],["orbit","Orbits"],["morph","Morphing blob"]] },
      { name: "count", label: "Amount", type: "range", min: 6, max: 40, value: 20 },
      { name: "speed", label: "Speed", type: "range", min: 0.5, max: 3, step: 0.1, value: 1 },
      paletteField(),
      { name: "secs", label: "Video length", type: "select", value: "10", options: [["5","5 seconds"],["10","10 seconds"],["20","20 seconds"],["30","30 seconds"]] },
      { name: "res", label: "Video size", type: "select", value: "720", options: [["540","540 x 540"],["720","720 x 720"],["1080","1080 x 1080"]] }
    ]}
  };

  // ---------- UI ----------
  var $ = function(id){ return document.getElementById(id); };
  var form = $("controls"), preview = $("preview"), status = $("status");
  var state = {}, current = null, result = null;
  Object.keys(TOOLS).forEach(function(k){ state[k] = { seed: newSeed() }; TOOLS[k].fields.forEach(function(fl){ state[k][fl.name] = fl.value; }); });

  function buildForm(){
    var t = TOOLS[current], s = state[current], html = "";
    t.fields.forEach(function(fl){
      var v = s[fl.name], id = "f-" + fl.name;
      if (fl.type === "select")
        html += '<label>' + fl.label + '<select name="' + fl.name + '">' + fl.options.map(function(op){ return '<option value="' + op[0] + '"' + (op[0] === v ? " selected" : "") + ">" + op[1] + "</option>"; }).join("") + "</select></label>";
      else if (fl.type === "range")
        html += '<label>' + fl.label + ' <output id="o-' + fl.name + '">' + v + '</output><input type="range" name="' + fl.name + '" min="' + fl.min + '" max="' + fl.max + '" step="' + (fl.step || 1) + '" value="' + v + '"></label>';
      else
        html += '<label class="check"><input type="checkbox" name="' + fl.name + '"' + (v ? " checked" : "") + '> ' + fl.label + "</label>";
    });
    html += '<label>Seed<input type="text" name="seed" value="' + s.seed + '" spellcheck="false"></label>';
    form.innerHTML = html;
    $("dl-png").hidden = !t.png;
    $("rec").hidden = !t.video;
  }

  function readForm(){
    var s = state[current];
    TOOLS[current].fields.forEach(function(fl){
      var el = form.elements[fl.name];
      s[fl.name] = fl.type === "check" ? el.checked : el.value;
      var out = $("o-" + fl.name); if (out) out.textContent = el.value;
    });
    s.seed = form.elements.seed.value || newSeed();
  }

  function render(){
    var s = state[current], t = TOOLS[current];
    result = t.gen(s, mulberry32(hashSeed(String(s.seed))));
    preview.style.aspectRatio = result.w + " / " + result.h;
    preview.innerHTML = result.svg;
    status.textContent = result.w + " x " + result.h + (result.animated ? " · animated" : "") + " · " + Math.max(1, Math.round(result.svg.length / 1024)) + " KB";
  }

  function select(tool){
    current = tool;
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function(b){
      var on = b.dataset.tool === tool; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1;
    });
    buildForm(); render();
  }

  function flash(msg){ status.textContent = msg; setTimeout(function(){ if (result) render(); }, 1600); }
  function save(blob, ext){
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = TOOLS[current].file + "-" + state[current].seed + "." + ext;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 2000);
  }

  form.addEventListener("input", function(){ readForm(); render(); });
  $("shuffle").addEventListener("click", function(){
    state[current].seed = newSeed(); form.elements.seed.value = state[current].seed; render();
  });
  $("copy").addEventListener("click", function(){
    var done = function(){ flash("Copied to clipboard"); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(result.svg).then(done, function(){ flash("Copy failed"); });
    else flash("Copy not supported here");
  });
  $("dl-svg").addEventListener("click", function(){ save(new Blob([result.svg], { type: "image/svg+xml" }), "svg"); });
  $("dl-png").addEventListener("click", function(){
    var url = URL.createObjectURL(new Blob([result.svg], { type: "image/svg+xml" })), img = new Image();
    img.onload = function(){
      var c = document.createElement("canvas"); c.width = result.w; c.height = result.h;
      c.getContext("2d").drawImage(img, 0, 0, result.w, result.h);
      URL.revokeObjectURL(url);
      c.toBlob(function(b){ if (b) save(b, "png"); else flash("PNG export failed"); }, "image/png");
    };
    img.onerror = function(){ URL.revokeObjectURL(url); flash("PNG export failed"); };
    img.src = url;
  });
  var recording = false;
  $("rec").addEventListener("click", function(){
    var s = state[current];
    if (recording || !result || !window.MediaRecorder) { if (!window.MediaRecorder) flash("Video recording isn't supported in this browser"); return; }
    var size = +s.res, secs = +s.secs, c = document.createElement("canvas"), ctx = c.getContext("2d");
    c.width = c.height = size;
    var type = ["video/webm;codecs=vp9", "video/webm", "video/mp4"].filter(function(t){ return MediaRecorder.isTypeSupported(t); })[0];
    if (!type) { flash("No supported video format"); return; }
    var img = new Image(), url = URL.createObjectURL(new Blob([result.svg], { type: "image/svg+xml" }));
    img.style.cssText = "position:fixed;left:0;top:0;opacity:.01;pointer-events:none;z-index:-1;width:" + size + "px;height:" + size + "px";
    img.onerror = function(){ URL.revokeObjectURL(url); flash("Recording failed"); };
    img.onload = function(){
      document.body.appendChild(img);
      var chunks = [], rec = new MediaRecorder(c.captureStream(30), { mimeType: type, videoBitsPerSecond: 8e6 });
      var t0 = performance.now(), raf;
      recording = true; $("rec").disabled = true;
      function draw(){
        ctx.drawImage(img, 0, 0, size, size);
        var left = secs - (performance.now() - t0) / 1000;
        if (left > 0){ status.textContent = "Recording… " + Math.ceil(left) + "s"; raf = requestAnimationFrame(draw); } else rec.stop();
      }
      rec.ondataavailable = function(e){ if (e.data.size) chunks.push(e.data); };
      rec.onstop = function(){
        cancelAnimationFrame(raf); img.remove(); URL.revokeObjectURL(url);
        recording = false; $("rec").disabled = false;
        save(new Blob(chunks, { type: type }), type.indexOf("mp4") === 0 ? "mp4" : "webm");
        flash("Saved video");
      };
      rec.start(); draw();
    };
    img.src = url;
  });
  select(document.body.dataset.tool);
})();
