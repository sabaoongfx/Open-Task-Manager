/* Client-side utility tools. Each tool is T["<slug>"] = init(); the page's
   <body data-tool="<slug>"> picks which one runs. Markup comes from the page. */
(function () {
  "use strict";
  var T = {};
  var $ = function (id) { return document.getElementById(id); };
  var enc = new TextEncoder(), dec = new TextDecoder("utf-8", { fatal: true });

  // ---------- shared helpers ----------
  function flash(btn, msg) {
    if (!btn) return;
    var o = btn.getAttribute("data-label") || btn.textContent;
    btn.setAttribute("data-label", o);
    btn.textContent = msg;
    clearTimeout(btn._t);
    btn._t = setTimeout(function () { btn.textContent = o; }, 1300);
  }
  function copyText(text, btn) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
      ta.remove(); flash(btn, ok ? "Copied" : "Copy failed");
    }
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(text).then(function () { flash(btn, "Copied"); }, fallback);
    else fallback();
  }
  function download(blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function setMsg(el, text, kind) {
    el.textContent = text || ""; el.className = "msg" + (kind ? " " + kind : "");
  }
  function esc(s) {
    return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  function bytesToB64(bytes) {
    var s = "", i, CH = 0x8000;
    for (i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }
  function b64ToBytes(b64) {
    var bin = atob(b64), out = new Uint8Array(bin.length), i;
    for (i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function human(n) {
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    return (n / 1048576).toFixed(2) + " MB";
  }
  function rnd(n) { // unbiased random integer in [0, n)
    var lim = Math.floor(4294967296 / n) * n, a = new Uint32Array(1);
    do { crypto.getRandomValues(a); } while (a[0] >= lim);
    return a[0] % n;
  }
  function onAll(ids, ev, fn) { ids.forEach(function (i) { $(i).addEventListener(ev, fn); }); }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-copy]");
    if (!b) return;
    var t = $(b.getAttribute("data-copy"));
    copyText("value" in t ? t.value : t.textContent, b);
  });

  // ---------- JSON formatter ----------
  T["json-formatter"] = function () {
    var inp = $("in"), out = $("out"), msg = $("msg"), mode = "fmt";
    function sortKeys(v) {
      if (Array.isArray(v)) return v.map(sortKeys);
      if (v && typeof v === "object") { var o = {}; Object.keys(v).sort().forEach(function (k) { o[k] = sortKeys(v[k]); }); return o; }
      return v;
    }
    function run() {
      var src = inp.value;
      if (!src.trim()) { out.value = ""; setMsg(msg, "Paste JSON above to format it.", ""); return; }
      try {
        var v = JSON.parse(src);
        if ($("sort").checked) v = sortKeys(v);
        var ind = $("indent").value;
        out.value = mode === "min" ? JSON.stringify(v) : JSON.stringify(v, null, ind === "tab" ? "\t" : +ind);
        setMsg(msg, "Valid JSON · " + out.value.length.toLocaleString() + " characters", "ok");
      } catch (e) {
        out.value = "";
        var m = /position (\d+)/.exec(e.message), where = "";
        if (m) {
          var pre = src.slice(0, +m[1]).split("\n");
          where = " (line " + pre.length + ", column " + (pre[pre.length - 1].length + 1) + ")";
        }
        setMsg(msg, "Invalid JSON: " + e.message.replace(/ in JSON at position \d+.*/, "") + where, "err");
      }
    }
    inp.addEventListener("input", run);
    onAll(["indent", "sort"], "change", run);
    $("fmt").addEventListener("click", function () { mode = "fmt"; run(); });
    $("min").addEventListener("click", function () { mode = "min"; run(); });
    $("clear").addEventListener("click", function () { inp.value = ""; run(); inp.focus(); });
    $("sample").addEventListener("click", function () {
      inp.value = '{"name":"Open Task Manager","free":true,"platforms":["Linux","Windows","macOS"],"stats":{"cpu":12.5,"memory":{"used":4.2,"total":16}}}';
      mode = "fmt"; run();
    });
    run();
  };

  // ---------- Base64 ----------
  T["base64"] = function () {
    var inp = $("in"), out = $("out"), msg = $("msg");
    function run() {
      var decode = $("mode").value === "decode", s = inp.value;
      if (!s) { out.value = ""; setMsg(msg, "", ""); return; }
      try {
        if (!decode) {
          var r = bytesToB64(enc.encode(s));
          if ($("urlsafe").checked) r = r.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
          out.value = r;
        } else {
          var c = s.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
          while (c.length % 4) c += "=";
          out.value = dec.decode(b64ToBytes(c));
        }
        setMsg(msg, "", "");
      } catch (e) {
        out.value = "";
        setMsg(msg, decode ? "That isn't valid Base64 text (or it doesn't decode to UTF-8 text)." : "Could not encode that text.", "err");
      }
    }
    inp.addEventListener("input", run);
    onAll(["mode", "urlsafe"], "change", run);
    $("swap").addEventListener("click", function () {
      var o = out.value; $("mode").value = $("mode").value === "decode" ? "encode" : "decode"; inp.value = o; run();
    });
    run();
  };

  // ---------- URL encoder ----------
  T["url-encoder"] = function () {
    var inp = $("in"), out = $("out"), msg = $("msg");
    function run() {
      var s = inp.value, m = $("mode").value;
      if (!s) { out.value = ""; setMsg(msg, "", ""); return; }
      try {
        out.value = m === "component" ? encodeURIComponent(s) : m === "full" ? encodeURI(s) : decodeURIComponent(s.replace(/\+/g, $("plus").checked ? " " : "+"));
        setMsg(msg, "", "");
      } catch (e) { out.value = ""; setMsg(msg, "Can't decode that: it contains a broken % sequence.", "err"); }
    }
    inp.addEventListener("input", run);
    onAll(["mode", "plus"], "change", run);
    run();
  };

  // ---------- UUID generator ----------
  T["uuid-generator"] = function () {
    var out = $("out");
    function bytes() { var b = new Uint8Array(16); crypto.getRandomValues(b); return b; }
    function fmt(b) {
      var h = Array.prototype.map.call(b, function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
      return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
    }
    function v4() { var b = bytes(); b[6] = b[6] & 15 | 64; b[8] = b[8] & 63 | 128; return fmt(b); }
    function v7() {
      var b = bytes(), t = Date.now(), i;
      for (i = 5; i >= 0; i--) { b[i] = t % 256; t = Math.floor(t / 256); }
      b[6] = b[6] & 15 | 112; b[8] = b[8] & 63 | 128; return fmt(b);
    }
    function run() {
      var n = Math.max(1, Math.min(500, +$("count").value || 1)), list = [], i, u;
      for (i = 0; i < n; i++) {
        u = $("ver").value === "7" ? v7() : v4();
        if ($("nohy").checked) u = u.replace(/-/g, "");
        if ($("upper").checked) u = u.toUpperCase();
        list.push(u);
      }
      if ($("ver").value === "7") list.sort();
      out.value = list.join("\n");
    }
    $("gen").addEventListener("click", run);
    onAll(["ver", "count", "nohy", "upper"], "change", run);
    run();
  };

  // ---------- Hash generator ----------
  T["hash-generator"] = function () {
    var algos = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"], inp = $("in"), msg = $("msg"), token = 0;
    function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }
    function show(data) {
      var t = ++token;
      algos.forEach(function (a) {
        crypto.subtle.digest(a, data).then(function (h) {
          if (t === token) {
            var v = hex(h); $("h-" + a).value = $("upper").checked ? v.toUpperCase() : v;
          }
        });
      });
    }
    function fromText() { setMsg(msg, "", ""); show(enc.encode(inp.value)); }
    if (!window.crypto || !crypto.subtle) { setMsg(msg, "Hashing needs a secure (HTTPS) page.", "err"); return; }
    inp.addEventListener("input", fromText);
    $("upper").addEventListener("change", function () { if ($("file").files[0]) $("file").dispatchEvent(new Event("change")); else fromText(); });
    $("file").addEventListener("change", function () {
      var f = $("file").files[0]; if (!f) return;
      f.arrayBuffer().then(function (b) { setMsg(msg, "Hashed file: " + f.name + " (" + human(f.size) + ")", "ok"); show(b); });
    });
    fromText();
  };

  // ---------- JWT decoder ----------
  T["jwt-decoder"] = function () {
    var inp = $("in"), msg = $("msg"), claims = $("claims");
    function part(s) {
      var c = s.replace(/-/g, "+").replace(/_/g, "/"); while (c.length % 4) c += "=";
      return JSON.parse(dec.decode(b64ToBytes(c)));
    }
    function when(sec) { return new Date(sec * 1000).toISOString().replace("T", " ").replace(/\.\d+Z/, " UTC"); }
    function run() {
      var tok = inp.value.trim().replace(/^bearer\s+/i, ""), p;
      claims.innerHTML = "";
      if (!tok) { $("hdr").value = $("pay").value = ""; setMsg(msg, "Paste a token to decode it.", ""); return; }
      p = tok.split(".");
      if (p.length < 2 || p.length > 3) { $("hdr").value = $("pay").value = ""; setMsg(msg, "A JWT has three dot-separated parts.", "err"); return; }
      try {
        var h = part(p[0]), b = part(p[1]);
        $("hdr").value = JSON.stringify(h, null, 2); $("pay").value = JSON.stringify(b, null, 2);
        var now = Date.now() / 1000, rows = [], status = "ok", text = "Decoded. The signature is not verified.";
        [["iat", "Issued at"], ["nbf", "Not before"], ["exp", "Expires"]].forEach(function (k) {
          if (typeof b[k[0]] === "number") rows.push("<tr><th>" + k[1] + "</th><td>" + when(b[k[0]]) + "</td></tr>");
        });
        if (typeof b.exp === "number" && b.exp < now) { status = "err"; text = "Expired " + when(b.exp) + ". The signature is not verified."; }
        if (rows.length) claims.innerHTML = "<table class='kv'>" + rows.join("") + "</table>";
        setMsg(msg, text, status);
      } catch (e) { $("hdr").value = $("pay").value = ""; setMsg(msg, "Couldn't decode the header or payload as Base64URL JSON.", "err"); }
    }
    inp.addEventListener("input", run); run();
  };

  // ---------- Regex tester ----------
  T["regex-tester"] = function () {
    var pat = $("pat"), txt = $("txt"), msg = $("msg"), hl = $("hl"), list = $("matches");
    function run() {
      var flags = ["g", "i", "m", "s", "u"].filter(function (f) { return $("f-" + f).checked; }).join(""), re;
      list.innerHTML = ""; hl.innerHTML = esc(txt.value);
      if (!pat.value) { setMsg(msg, "Enter a pattern to start.", ""); return; }
      try { re = new RegExp(pat.value, flags.indexOf("g") < 0 ? flags + "g" : flags); }
      catch (e) { setMsg(msg, e.message, "err"); return; }
      var all = [], m, it = txt.value.matchAll(re), n = 0;
      while (!(m = it.next()).done && n < 1000) { all.push(m.value); n++; if (flags.indexOf("g") < 0) break; }
      var html = "", last = 0, rows = [];
      all.forEach(function (x, i) {
        html += esc(txt.value.slice(last, x.index)) + "<mark>" + esc(x[0]) + "</mark>"; last = x.index + x[0].length;
        var g = "";
        for (var k = 1; k < x.length; k++) g += "<div class='grp'>Group " + k + ": <code>" + (x[k] === undefined ? "undefined" : esc(x[k])) + "</code></div>";
        if (x.groups) Object.keys(x.groups).forEach(function (nm) { g += "<div class='grp'>" + esc(nm) + ": <code>" + esc(String(x.groups[nm])) + "</code></div>"; });
        rows.push("<li><span class='idx'>#" + (i + 1) + " at " + x.index + "</span> <code>" + (esc(x[0]) || "(empty)") + "</code>" + g + "</li>");
      });
      hl.innerHTML = html + esc(txt.value.slice(last));
      list.innerHTML = rows.join("");
      setMsg(msg, all.length ? all.length + (all.length === 1000 ? "+" : "") + (all.length === 1 ? " match" : " matches") : "No matches", all.length ? "ok" : "");
    }
    pat.addEventListener("input", run); txt.addEventListener("input", run);
    ["g", "i", "m", "s", "u"].forEach(function (f) { $("f-" + f).addEventListener("change", run); });
    run();
  };

  // ---------- Timestamp converter ----------
  T["timestamp-converter"] = function () {
    var ts = $("ts"), res = $("res"), msg = $("msg");
    function rel(d) {
      var s = Math.round((d - Date.now()) / 1000), a = Math.abs(s), u = [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1]], i;
      for (i = 0; i < u.length; i++) if (a >= u[i][1] || i === u.length - 1) {
        var n = Math.floor(a / u[i][1]); return n + " " + u[i][0] + (n === 1 ? "" : "s") + (s < 0 ? " ago" : " from now");
      }
    }
    function show(ms) {
      var d = new Date(ms);
      if (isNaN(d)) { res.innerHTML = ""; setMsg(msg, "That's not a valid timestamp.", "err"); return; }
      setMsg(msg, "", "");
      var rows = [["Seconds", Math.floor(ms / 1000)], ["Milliseconds", ms], ["ISO 8601 (UTC)", d.toISOString()], ["UTC", d.toUTCString()],
        ["Your time zone", d.toString()], ["Relative", rel(d)]];
      res.innerHTML = "<table class='kv'>" + rows.map(function (r) { return "<tr><th>" + r[0] + "</th><td>" + esc(String(r[1])) + "</td></tr>"; }).join("") + "</table>";
    }
    function fromTs() {
      var v = ts.value.trim();
      if (!v) { res.innerHTML = ""; setMsg(msg, "", ""); return; }
      if (!/^-?\d+(\.\d+)?$/.test(v)) { var p = Date.parse(v); return show(p); }
      var n = Number(v); show(Math.abs(n) >= 1e11 ? n : n * 1000);
    }
    ts.addEventListener("input", fromTs);
    $("now").addEventListener("click", function () { ts.value = String(Math.floor(Date.now() / 1000)); fromTs(); });
    $("dt").addEventListener("input", function () { if ($("dt").value) { ts.value = String(Math.floor(new Date($("dt").value).getTime() / 1000)); fromTs(); } });
    setInterval(function () { $("live").textContent = Math.floor(Date.now() / 1000); }, 1000);
    $("live").textContent = Math.floor(Date.now() / 1000);
    ts.value = String(Math.floor(Date.now() / 1000)); fromTs();
  };

  // ---------- Diff checker ----------
  T["diff-checker"] = function () {
    var a = $("a"), b = $("b"), out = $("out"), msg = $("msg");
    function norm(l) { if ($("ws").checked) l = l.replace(/\s+/g, " ").trim(); if ($("ic").checked) l = l.toLowerCase(); return l; }
    function run() {
      var A = a.value ? a.value.split("\n") : [], B = b.value ? b.value.split("\n") : [];
      var NA = A.map(norm), NB = B.map(norm), s = 0, ea = A.length, eb = B.length;
      while (s < ea && s < eb && NA[s] === NB[s]) s++;
      while (ea > s && eb > s && NA[ea - 1] === NB[eb - 1]) { ea--; eb--; }
      var n = ea - s, m = eb - s, ops = [], i, j;
      if (n * m > 6e6) { out.innerHTML = ""; setMsg(msg, "These texts are too different and too long to compare in the browser. Try smaller sections.", "err"); return; }
      var w = m + 1, L = new Uint32Array((n + 1) * w);
      for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--)
        L[i * w + j] = NA[s + i] === NB[s + j] ? L[(i + 1) * w + j + 1] + 1 : Math.max(L[(i + 1) * w + j], L[i * w + j + 1]);
      for (i = 0; i < s; i++) ops.push([" ", A[i]]);
      i = 0; j = 0;
      while (i < n && j < m) {
        if (NA[s + i] === NB[s + j]) { ops.push([" ", A[s + i]]); i++; j++; }
        else if (L[(i + 1) * w + j] >= L[i * w + j + 1]) { ops.push(["-", A[s + i]]); i++; }
        else { ops.push(["+", B[s + j]]); j++; }
      }
      while (i < n) { ops.push(["-", A[s + i]]); i++; }
      while (j < m) { ops.push(["+", B[s + j]]); j++; }
      for (i = ea; i < A.length; i++) ops.push([" ", A[i]]);
      var add = 0, del = 0;
      out.innerHTML = ops.map(function (o) {
        if (o[0] === "+") add++; if (o[0] === "-") del++;
        return "<div class='d" + (o[0] === "+" ? " add" : o[0] === "-" ? " del" : "") + "'><span>" + o[0] + "</span>" + (esc(o[1]) || "&nbsp;") + "</div>";
      }).join("");
      setMsg(msg, add + del === 0 ? (A.length || B.length ? "The texts are identical." : "Paste text into both boxes.") : "+" + add + " added · −" + del + " removed", add + del ? "ok" : "");
    }
    onAll(["a", "b"], "input", run); onAll(["ws", "ic"], "change", run);
    $("swap").addEventListener("click", function () { var t = a.value; a.value = b.value; b.value = t; run(); });
    run();
  };

  // ---------- Lorem ipsum ----------
  T["lorem-ipsum"] = function () {
    var W = ("lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum").split(" ");
    var out = $("out");
    function word() { return W[Math.floor(Math.random() * W.length)]; }
    function sentence() {
      var n = 8 + Math.floor(Math.random() * 10), p = [], i;
      for (i = 0; i < n; i++) p.push(word());
      if (n > 11) p[Math.floor(n / 2)] += ",";
      return p.join(" ").replace(/^./, function (c) { return c.toUpperCase(); }) + ".";
    }
    function para() { var n = 4 + Math.floor(Math.random() * 3), s = []; while (n--) s.push(sentence()); return s.join(" "); }
    function run() {
      var n = Math.max(1, Math.min(200, +$("count").value || 1)), u = $("unit").value, r = [], i;
      if (u === "words") { for (i = 0; i < n; i++) r.push(word()); r = [r.join(" ")]; }
      else if (u === "sentences") { for (i = 0; i < n; i++) r.push(sentence()); r = [r.join(" ")]; }
      else for (i = 0; i < n; i++) r.push(para());
      if ($("start").checked) {
        var classic = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
        if (u === "words") r[0] = "lorem ipsum dolor sit amet consectetur".split(" ").slice(0, n).concat(r[0].split(" ").slice(6)).join(" ");
        else if (u === "sentences") r[0] = classic + r[0].replace(/^[^.]*\./, "");
        else r[0] = classic + r[0].replace(/^[^.]*\./, "");
      }
      out.value = $("html").checked ? r.map(function (p) { return "<p>" + p + "</p>"; }).join("\n") : r.join("\n\n");
    }
    $("gen").addEventListener("click", run); onAll(["count", "unit", "start", "html"], "change", run);
    run();
  };

  // ---------- Color helpers ----------
  var cctx = document.createElement("canvas").getContext("2d");
  function parseColor(s) {
    s = (s || "").trim(); if (!s) return null;
    cctx.fillStyle = "#010203"; cctx.fillStyle = s;
    var v = cctx.fillStyle, m;
    if (v === "#010203") { cctx.fillStyle = "#fefdfc"; cctx.fillStyle = s; if (cctx.fillStyle === "#fefdfc") return null; v = cctx.fillStyle; }
    if ((m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(v))) return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16), a: 1 };
    if ((m = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/.exec(v))) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
    return null;
  }
  function toHsl(c) {
    var r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, s = 0, l = (mx + mn) / 2, d = mx - mn;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360;
    }
    return { h: h, s: s * 100, l: l * 100 };
  }
  function fromHsl(h, s, l) {
    h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100;
    var k = function (n) { return (n + h / 30) % 12; }, a = s * Math.min(l, 1 - l);
    var f = function (n) { return l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); };
    return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255), a: 1 };
  }
  function hex(c) { return "#" + [c.r, c.g, c.b].map(function (x) { return ("0" + Math.round(x).toString(16)).slice(-2); }).join(""); }
  function lum(c) {
    var f = function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function inkFor(c) { return lum(c) > 0.4 ? "#1C1A17" : "#ffffff"; }
  function randHex() { return hex(fromHsl(Math.random() * 360, 55 + Math.random() * 35, 40 + Math.random() * 25)); }

  // ---------- Color converter ----------
  T["color-converter"] = function () {
    var inp = $("in"), pick = $("pick"), msg = $("msg");
    function row(id, v) { $(id).value = v; }
    function run(src) {
      var c = parseColor(src);
      if (!c) { setMsg(msg, "Couldn't read that color. Try #1a73e8, rgb(26 115 232) or hsl(217 80% 51%).", "err"); return; }
      setMsg(msg, "", "");
      var h = toHsl(c), r = c.r / 255, g = c.g / 255, bl = c.b / 255, mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
      var k = 1 - mx, C = k === 1 ? 0 : (1 - r - k) / (1 - k), M = k === 1 ? 0 : (1 - g - k) / (1 - k), Y = k === 1 ? 0 : (1 - bl - k) / (1 - k);
      var al = c.a < 1 ? Math.round(c.a * 255) : null;
      row("o-hex", hex(c) + (al === null ? "" : ("0" + al.toString(16)).slice(-2)));
      row("o-rgb", c.a < 1 ? "rgba(" + Math.round(c.r) + ", " + Math.round(c.g) + ", " + Math.round(c.b) + ", " + c.a + ")" : "rgb(" + Math.round(c.r) + ", " + Math.round(c.g) + ", " + Math.round(c.b) + ")");
      row("o-hsl", "hsl(" + Math.round(h.h) + ", " + Math.round(h.s) + "%, " + Math.round(h.l) + "%)");
      row("o-hsv", "hsv(" + Math.round(h.h) + ", " + Math.round(mx ? (mx - mn) / mx * 100 : 0) + "%, " + Math.round(mx * 100) + "%)");
      row("o-cmyk", "cmyk(" + [C, M, Y, k].map(function (x) { return Math.round(x * 100) + "%"; }).join(", ") + ")");
      pick.value = hex(c); $("sw").style.background = hex(c);
      var w = contrast(c, { r: 255, g: 255, b: 255 }), bk = contrast(c, { r: 0, g: 0, b: 0 });
      $("cw").textContent = w.toFixed(2) + ":1 " + (w >= 7 ? "AAA" : w >= 4.5 ? "AA" : w >= 3 ? "AA large text only" : "fails");
      $("cb").textContent = bk.toFixed(2) + ":1 " + (bk >= 7 ? "AAA" : bk >= 4.5 ? "AA" : bk >= 3 ? "AA large text only" : "fails");
    }
    inp.addEventListener("input", function () { run(inp.value); });
    pick.addEventListener("input", function () { inp.value = pick.value; run(pick.value); });
    $("rand").addEventListener("click", function () { inp.value = randHex(); run(inp.value); });
    inp.value = "#e93233"; run(inp.value);
  };

  // ---------- Color palette generator ----------
  T["color-palette-generator"] = function () {
    var base = $("base"), sw = $("swatches"), cur = [];
    function build() {
      var c = parseColor(base.value) || parseColor("#e93233"), h = toHsl(c), hues, out = [], i;
      var kind = $("kind").value;
      hues = { complementary: [0, 180], analogous: [-30, 0, 30], triadic: [0, 120, 240], tetradic: [0, 90, 180, 270], split: [0, 150, 210], mono: [0] }[kind];
      if (kind === "mono") [20, 35, 50, 65, 80].forEach(function (l) { out.push(fromHsl(h.h, h.s, l)); });
      else {
        hues.forEach(function (d) { out.push(fromHsl(h.h + d, h.s, h.l)); });
        var tints = [[h.h, h.s, Math.min(92, h.l + 30)], [h.h, h.s, Math.max(10, h.l - 30)], [h.h + hues[hues.length - 1], h.s * 0.6, Math.min(88, h.l + 22)]], t = 0;
        while (out.length < 5) { out.push(fromHsl(tints[t][0], tints[t][1], tints[t][2])); t++; }
      }
      cur = out.map(hex); render();
    }
    function render() {
      sw.innerHTML = cur.map(function (x) {
        var c = parseColor(x);
        return "<button type='button' class='sw' data-hex='" + x + "' style='background:" + x + ";color:" + inkFor(c) + "'><span>" + x.toUpperCase() + "</span><small>click to copy</small></button>";
      }).join("");
      $("css").value = ":root {\n" + cur.map(function (x, i) { return "  --color-" + (i + 1) + ": " + x + ";"; }).join("\n") + "\n}";
      $("json").value = JSON.stringify(cur);
    }
    sw.addEventListener("click", function (e) {
      var b = e.target.closest(".sw"); if (!b) return;
      copyText(b.getAttribute("data-hex"), b.querySelector("small"));
    });
    base.addEventListener("input", build); $("kind").addEventListener("change", build);
    $("rand").addEventListener("click", function () { base.value = randHex(); build(); });
    build();
  };

  // ---------- CSS gradient generator ----------
  T["css-gradient-generator"] = function () {
    var stops = [{ c: "#e93233", p: 0 }, { c: "#fba806", p: 55 }, { c: "#ffdb56", p: 100 }], box = $("stops");
    function css() {
      var st = stops.slice().sort(function (a, b) { return a.p - b.p; }).map(function (s) { return s.c + " " + s.p + "%"; }).join(", "), t = $("type").value;
      return t === "linear" ? "linear-gradient(" + $("angle").value + "deg, " + st + ")" : t === "radial" ? "radial-gradient(circle at center, " + st + ")" : "conic-gradient(from " + $("angle").value + "deg at center, " + st + ")";
    }
    function paint() {
      var g = css(); $("prev").style.background = g; $("out").value = "background: " + g + ";"; $("av").textContent = $("angle").value + "°";
      $("angle").disabled = $("type").value === "radial";
    }
    function list() {
      box.innerHTML = stops.map(function (s, i) {
        return "<div class='stop'><input type='color' value='" + s.c + "' data-i='" + i + "' data-k='c' aria-label='Stop " + (i + 1) + " color'>" +
          "<input type='range' min='0' max='100' value='" + s.p + "' data-i='" + i + "' data-k='p' aria-label='Stop " + (i + 1) + " position'><span class='pos'>" + s.p + "%</span>" +
          "<button type='button' class='btn btn-ghost sm' data-del='" + i + "'" + (stops.length < 3 ? " disabled" : "") + ">Remove</button></div>";
      }).join("");
      $("add").disabled = stops.length >= 6;
    }
    box.addEventListener("input", function (e) {
      var i = e.target.getAttribute("data-i"); if (i === null) return;
      var k = e.target.getAttribute("data-k"); stops[i][k] = k === "p" ? +e.target.value : e.target.value;
      if (k === "p") e.target.nextElementSibling.textContent = e.target.value + "%"; paint();
    });
    box.addEventListener("click", function (e) {
      var d = e.target.getAttribute("data-del"); if (d === null || stops.length < 3) return;
      stops.splice(+d, 1); list(); paint();
    });
    $("add").addEventListener("click", function () { stops.push({ c: randHex(), p: 100 }); list(); paint(); });
    $("rand").addEventListener("click", function () {
      var n = 2 + Math.floor(Math.random() * 3); stops = [];
      for (var i = 0; i < n; i++) stops.push({ c: randHex(), p: Math.round(i / (n - 1) * 100) });
      $("angle").value = Math.floor(Math.random() * 360); list(); paint();
    });
    onAll(["type", "angle"], "input", paint);
    list(); paint();
  };

  // ---------- Box shadow generator ----------
  T["box-shadow-generator"] = function () {
    var ids = ["x", "y", "blur", "spread", "color", "op", "inset", "bg", "boxc", "radius"];
    function paint() {
      var c = parseColor($("color").value) || { r: 0, g: 0, b: 0 }, a = +$("op").value / 100;
      var sh = ($("inset").checked ? "inset " : "") + $("x").value + "px " + $("y").value + "px " + $("blur").value + "px " + $("spread").value + "px rgba(" + c.r + ", " + c.g + ", " + c.b + ", " + a + ")";
      $("stage").style.background = $("bg").value; var bx = $("box");
      bx.style.boxShadow = sh; bx.style.background = $("boxc").value; bx.style.borderRadius = $("radius").value + "px";
      $("out").value = "box-shadow: " + sh + ";";
      ["x", "y", "blur", "spread", "op", "radius"].forEach(function (i) { $("v-" + i).textContent = $(i).value + (i === "op" ? "%" : "px"); });
    }
    onAll(ids, "input", paint);
    var presets = {
      subtle: [0, 2, 8, 0, "#000000", 15, false], layered: [0, 10, 30, -5, "#000000", 25, false],
      hard: [8, 8, 0, 0, "#000000", 80, false], glow: [0, 0, 30, 4, "#e93233", 60, false], inner: [0, 4, 12, 0, "#000000", 35, true]
    };
    document.querySelectorAll("[data-preset]").forEach(function (b) {
      b.addEventListener("click", function () {
        var p = presets[b.getAttribute("data-preset")];
        ["x", "y", "blur", "spread", "color", "op"].forEach(function (id, i) { $(id).value = p[i]; }); $("inset").checked = p[6]; paint();
      });
    });
    paint();
  };

  // ---------- Image compressor ----------
  T["image-compressor"] = function () {
    var file = null, drop = $("drop"), msg = $("msg"), result = null, token = 0, bmp = null;
    function pickFile(f) {
      if (!f) return;
      if (!/^image\//.test(f.type)) { setMsg(msg, "That isn't an image file.", "err"); return; }
      file = f; bmp = null; run();
    }
    function run() {
      if (!file) return;
      var t = ++token, fmt = $("fmt").value, q = +$("q").value / 100, mw = parseInt($("mw").value, 10);
      $("qv").textContent = $("q").value + "%";
      var ready = bmp ? Promise.resolve(bmp) : createImageBitmap(file).then(function (b) { bmp = b; return b; });
      ready.then(function (b) {
        var sc = mw > 0 && b.width > mw ? mw / b.width : 1, w = Math.round(b.width * sc), h = Math.round(b.height * sc);
        var c = document.createElement("canvas"); c.width = w; c.height = h;
        var x = c.getContext("2d");
        if (fmt === "image/jpeg") { x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); }
        x.drawImage(b, 0, 0, w, h);
        c.toBlob(function (blob) {
          if (t !== token) return;
          if (!blob || blob.type !== fmt) { setMsg(msg, "Your browser can't export that format. Try JPEG or PNG.", "err"); return; }
          result = blob;
          var pct = Math.round((1 - blob.size / file.size) * 100);
          $("stats").innerHTML = "<table class='kv'><tr><th>Original</th><td>" + human(file.size) + " · " + b.width + " x " + b.height + "</td></tr><tr><th>Compressed</th><td>" + human(blob.size) + " · " + w + " x " + h + "</td></tr><tr><th>Saved</th><td>" + (pct >= 0 ? pct + "%" : "Larger than the original (" + (-pct) + "% bigger)") + "</td></tr></table>";
          var im = $("prev"); if (im.src) URL.revokeObjectURL(im.src); im.src = URL.createObjectURL(blob); im.hidden = false; $("dl").disabled = false;
          setMsg(msg, pct < 0 ? "The result is bigger than the original. Lower the quality, shrink the width or try WebP." : "Done. Nothing was uploaded.", pct < 0 ? "" : "ok");
        }, fmt, q);
      }, function () { setMsg(msg, "Couldn't read that image.", "err"); });
    }
    $("file").addEventListener("change", function () { pickFile($("file").files[0]); });
    ["dragover", "dragenter"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
    ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function () { drop.classList.remove("over"); }); });
    drop.addEventListener("drop", function (e) { e.preventDefault(); pickFile(e.dataTransfer.files[0]); });
    onAll(["fmt", "q", "mw"], "input", run);
    $("dl").addEventListener("click", function () {
      if (!result || !file) return;
      var ext = { "image/jpeg": "jpg", "image/webp": "webp", "image/png": "png" }[result.type];
      download(result, file.name.replace(/\.[^.]+$/, "") + "-compressed." + ext);
    });
  };

  // ---------- SVG to PNG ----------
  T["svg-to-png"] = function () {
    var inp = $("in"), msg = $("msg"), cnv = $("cnv"), info = null;
    function prepare() {
      var src = inp.value.trim();
      if (!src) { info = null; setMsg(msg, "Paste SVG code or choose a file.", ""); cnv.hidden = true; return null; }
      var doc = new DOMParser().parseFromString(src, "image/svg+xml"), svg = doc.documentElement;
      if (doc.querySelector("parsererror") || svg.nodeName.toLowerCase() !== "svg") { info = null; cnv.hidden = true; setMsg(msg, "That isn't valid SVG.", "err"); return null; }
      var vb = (svg.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number), w = parseFloat(svg.getAttribute("width")), h = parseFloat(svg.getAttribute("height"));
      if (!(w > 0) || /%/.test(svg.getAttribute("width") || "")) w = vb.length === 4 && vb[2] > 0 ? vb[2] : 300;
      if (!(h > 0) || /%/.test(svg.getAttribute("height") || "")) h = vb.length === 4 && vb[3] > 0 ? vb[3] : 150;
      if (!svg.getAttribute("xmlns")) svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      if (!svg.getAttribute("viewBox")) svg.setAttribute("viewBox", "0 0 " + w + " " + h);
      var scale = +$("scale").value, cw = $("cw").value ? parseInt($("cw").value, 10) : 0;
      var W = cw > 0 ? cw : Math.round(w * scale), H = Math.round(W * h / w);
      svg.setAttribute("width", W); svg.setAttribute("height", H);
      return { svg: new XMLSerializer().serializeToString(svg), W: W, H: H };
    }
    function run() {
      info = prepare(); if (!info) return;
      if (info.W * info.H > 16384 * 16384 || info.W > 16384) { setMsg(msg, "That size is too large for a browser canvas. Pick a smaller one.", "err"); info = null; return; }
      var img = new Image(), url = URL.createObjectURL(new Blob([info.svg], { type: "image/svg+xml" }));
      img.onload = function () {
        cnv.width = info.W; cnv.height = info.H; var x = cnv.getContext("2d");
        x.clearRect(0, 0, cnv.width, cnv.height);
        if ($("bgon").checked) { x.fillStyle = $("bg").value; x.fillRect(0, 0, cnv.width, cnv.height); }
        x.drawImage(img, 0, 0, info.W, info.H); URL.revokeObjectURL(url); cnv.hidden = false;
        setMsg(msg, "Output size: " + info.W + " x " + info.H + " px", "ok");
      };
      img.onerror = function () { URL.revokeObjectURL(url); cnv.hidden = true; info = null; setMsg(msg, "The browser couldn't draw that SVG. Remove external images or fonts and try again.", "err"); };
      img.src = url;
    }
    inp.addEventListener("input", run); onAll(["scale", "cw", "bgon", "bg"], "input", run);
    $("file").addEventListener("change", function () {
      var f = $("file").files[0]; if (f) f.text().then(function (t) { inp.value = t; run(); });
    });
    $("dl").addEventListener("click", function () {
      if (!info) { run(); }
      if (info) cnv.toBlob(function (b) { if (b) download(b, "image.png"); }, "image/png");
    });
    $("sample").addEventListener("click", function () {
      inp.value = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e93233"/><stop offset="1" stop-color="#fba806"/></linearGradient></defs><circle cx="100" cy="100" r="80" fill="url(#g)"/><path d="M60 110l25 25 55-70" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      run();
    });
    run();
  };

  // ---------- QR code generator ----------
  T["qr-code-generator"] = function () {
    var out = $("qr"), msg = $("msg"), qrObj = null;
    if (typeof qrcode === "undefined") { setMsg(msg, "The QR library failed to load.", "err"); return; }
    qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
    function wifiEsc(s) { return s.replace(/([\\;,:"])/g, "\\$1"); }
    function payload() {
      if ($("kind").value === "wifi") {
        var sec = $("sec").value;
        return "WIFI:T:" + (sec === "nopass" ? "nopass" : sec) + ";S:" + wifiEsc($("ssid").value) + ";" + (sec === "nopass" ? "" : "P:" + wifiEsc($("pw").value) + ";") + ";";
      }
      return $("text").value;
    }
    function run() {
      var w = $("kind").value === "wifi";
      $("f-text").hidden = w; $("f-wifi").hidden = !w;
      var data = payload();
      if (!data || (w && !$("ssid").value)) { out.innerHTML = ""; qrObj = null; setMsg(msg, w ? "Enter the network name." : "Type some text or a link.", ""); return; }
      try {
        var q = qrcode(0, $("ec").value); q.addData(data, "Byte"); q.make(); qrObj = q;
      } catch (e) { out.innerHTML = ""; qrObj = null; setMsg(msg, "That's too much data for a QR code at this error-correction level. Shorten it or lower the level.", "err"); return; }
      out.innerHTML = svg(256); setMsg(msg, qrObj.getModuleCount() + " x " + qrObj.getModuleCount() + " modules", "ok");
    }
    function svg(px) {
      var n = qrObj.getModuleCount(), m = +$("margin").value, tot = n + 2 * m, d = "", r, c;
      for (r = 0; r < n; r++) for (c = 0; c < n; c++) if (qrObj.isDark(r, c)) d += "M" + (c + m) + " " + (r + m) + "h1v1h-1z";
      return '<svg xmlns="http://www.w3.org/2000/svg" width="' + px + '" height="' + px + '" viewBox="0 0 ' + tot + ' ' + tot + '" shape-rendering="crispEdges"><rect width="' + tot + '" height="' + tot + '" fill="' + $("bg").value + '"/><path d="' + d + '" fill="' + $("fg").value + '"/></svg>';
    }
    onAll(["kind", "text", "ssid", "pw", "sec", "ec", "margin", "fg", "bg"], "input", run);
    $("dl-svg").addEventListener("click", function () { if (qrObj) download(new Blob([svg(512)], { type: "image/svg+xml" }), "qr-code.svg"); });
    $("dl-png").addEventListener("click", function () {
      if (!qrObj) return;
      var n = qrObj.getModuleCount(), m = +$("margin").value, tot = n + 2 * m, s = Math.max(1, Math.ceil(1024 / tot)), c = document.createElement("canvas"), x, r, k;
      c.width = c.height = tot * s; x = c.getContext("2d"); x.fillStyle = $("bg").value; x.fillRect(0, 0, c.width, c.height); x.fillStyle = $("fg").value;
      for (r = 0; r < n; r++) for (k = 0; k < n; k++) if (qrObj.isDark(r, k)) x.fillRect((k + m) * s, (r + m) * s, s, s);
      c.toBlob(function (b) { if (b) download(b, "qr-code.png"); }, "image/png");
    });
    $("text").value = "https://otm.sabaoon.dev/"; run();
  };

  // ---------- Word counter ----------
  T["word-counter"] = function () {
    var inp = $("in"), STOP = "the and for are but not you all any can had her was one our out has have this that with from they will would there their what about which when your said each she how its who been were than them these some into only other then more also just like over such".split(" ");
    function run() {
      var s = inp.value, words = s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || [], n = words.length;
      var sent = s.split(/[.!?]+(?:\s|$)/).filter(function (x) { return /\S/.test(x); }).length;
      var para = s.split(/\n\s*\n/).filter(function (x) { return /\S/.test(x); }).length;
      $("s-words").textContent = n.toLocaleString(); $("s-chars").textContent = s.length.toLocaleString();
      $("s-nosp").textContent = s.replace(/\s/g, "").length.toLocaleString(); $("s-sent").textContent = sent.toLocaleString();
      $("s-para").textContent = para.toLocaleString();
      $("s-read").textContent = n ? Math.max(1, Math.round(n / 225)) + " min" : "0 min";
      $("s-speak").textContent = n ? Math.max(1, Math.round(n / 130)) + " min" : "0 min";
      var freq = {}; words.forEach(function (w) { w = w.toLowerCase(); if (w.length > 2 && STOP.indexOf(w) < 0) freq[w] = (freq[w] || 0) + 1; });
      var top = Object.keys(freq).sort(function (a, b) { return freq[b] - freq[a] || (a < b ? -1 : 1); }).slice(0, 8);
      $("kw").innerHTML = top.length ? top.map(function (w) { return "<li><span>" + esc(w) + "</span><b>" + freq[w] + "</b></li>"; }).join("") : "<li class='none'>Keywords appear here as you type.</li>";
    }
    inp.addEventListener("input", run);
    $("clear").addEventListener("click", function () { inp.value = ""; run(); inp.focus(); });
    run();
  };

  // ---------- Case converter ----------
  T["case-converter"] = function () {
    var inp = $("in"), out = $("out"), last = "upper";
    function words(l) { return l.replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, "$1 $2").split(/[^\p{L}\p{N}]+/u).filter(Boolean); }
    var SMALL = "a an and as at but by for in nor of on or the to up via".split(" ");
    var F = {
      upper: function (s) { return s.toUpperCase(); },
      lower: function (s) { return s.toLowerCase(); },
      title: function (s) {
        var first = true;
        return s.toLowerCase().replace(/[\p{L}\p{N}][\p{L}\p{N}'’]*/gu, function (w, i) {
          var small = SMALL.indexOf(w) >= 0 && !first; first = false;
          return small ? w : w.charAt(0).toUpperCase() + w.slice(1);
        });
      },
      sentence: function (s) { return s.toLowerCase().replace(/(^\s*|[.!?]\s+|\n\s*)(\p{L})/gu, function (m, a, b) { return a + b.toUpperCase(); }); },
      camel: function (s) { return perLine(s, function (w) { return w.map(function (x, i) { x = x.toLowerCase(); return i ? x.charAt(0).toUpperCase() + x.slice(1) : x; }).join(""); }); },
      pascal: function (s) { return perLine(s, function (w) { return w.map(function (x) { x = x.toLowerCase(); return x.charAt(0).toUpperCase() + x.slice(1); }).join(""); }); },
      snake: function (s) { return perLine(s, function (w) { return w.join("_").toLowerCase(); }); },
      kebab: function (s) { return perLine(s, function (w) { return w.join("-").toLowerCase(); }); },
      constant: function (s) { return perLine(s, function (w) { return w.join("_").toUpperCase(); }); },
      dot: function (s) { return perLine(s, function (w) { return w.join(".").toLowerCase(); }); },
      alt: function (s) { var i = 0; return s.replace(/\p{L}/gu, function (c) { return i++ % 2 ? c.toUpperCase() : c.toLowerCase(); }); }
    };
    function perLine(s, f) { return s.split("\n").map(function (l) { return f(words(l)); }).join("\n"); }
    function apply(k) { last = k; out.value = F[k](inp.value); }
    document.querySelectorAll("[data-case]").forEach(function (b) { b.addEventListener("click", function () { apply(b.getAttribute("data-case")); }); });
    inp.addEventListener("input", function () { apply(last); });
    apply("upper");
  };

  // ---------- Password generator ----------
  T["password-generator"] = function () {
    var SETS = { lower: "abcdefghijklmnopqrstuvwxyz", upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", num: "0123456789", sym: "!@#$%^&*()-_=+[]{};:,.?/~" };
    var out = $("out");
    function make() {
      var len = +$("len").value, amb = $("amb").checked, sets = [], k;
      for (k in SETS) if ($("c-" + k).checked) sets.push(amb ? SETS[k].replace(/[Il1O0o|]/g, "") : SETS[k]);
      if (!sets.length) return null;
      var pool = sets.join(""), pw = [], i;
      sets.forEach(function (s) { pw.push(s.charAt(rnd(s.length))); });
      while (pw.length < len) pw.push(pool.charAt(rnd(pool.length)));
      pw.length = Math.max(len, sets.length);
      for (i = pw.length - 1; i > 0; i--) { var j = rnd(i + 1), t = pw[i]; pw[i] = pw[j]; pw[j] = t; }
      return { text: pw.join(""), bits: pw.length * Math.log2(pool.length) };
    }
    function run() {
      $("lv").textContent = $("len").value;
      var n = +$("count").value, list = [], first = null, i, r;
      for (i = 0; i < n; i++) { r = make(); if (!r) break; if (!first) first = r; list.push(r.text); }
      if (!first) { out.value = ""; setMsg($("msg"), "Select at least one character type.", "err"); $("meter").style.width = "0"; return; }
      out.value = list.join("\n");
      var b = first.bits, lvl = b < 40 ? ["Weak", "#e93233", 20] : b < 60 ? ["Fair", "#fba806", 45] : b < 90 ? ["Strong", "#5aa84f", 75] : ["Very strong", "#2f8f4a", 100];
      $("meter").style.width = lvl[2] + "%"; $("meter").style.background = lvl[1];
      setMsg($("msg"), lvl[0] + " · about " + Math.round(b) + " bits of entropy", b < 40 ? "err" : "ok");
    }
    $("gen").addEventListener("click", run);
    onAll(["len", "count", "c-lower", "c-upper", "c-num", "c-sym", "amb"], "input", run);
    run();
  };

  var init = T[document.body.getAttribute("data-tool")];
  if (init) init();
})();
