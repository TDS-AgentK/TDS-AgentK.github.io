/* Apprendre la magie : la Sphère d'affinité. Une sphère qui change de couleur selon l'élément, l'école ou l'énergie choisi.
   Les descriptions viennent de la liste écrite de la page (<ul data-sphere>) et les traits de caractère de la théorie du Lien (<ul data-lien>).
   Le dessin est calculé dans le navigateur (aucune image) : voir la section « styles » ci-dessous pour régler les couleurs. */
(function () {
  var racine = document.querySelector("[data-sphere-module]");
  var liste = document.querySelector("ul[data-sphere]");
  if (!racine || !liste) return;
  var listeLien = document.querySelector("ul[data-lien]");
  var canvas0 = document.createElement("canvas");
  if (!canvas0.getContext || !canvas0.getContext("2d")) return;

  function el(tag, attrs, contenu) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) { if (k === "class") e.className = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (contenu != null) (Array.isArray(contenu) ? contenu : [contenu]).forEach(function (c) { if (c != null) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function norm(t) { return String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim(); }
  function lireListe(ul) {
    var res = [];
    Array.prototype.forEach.call(ul.children, function (li) {
      var m = /^\s*([^:]+?)\s*:\s*[.…\s]*([\s\S]*)$/.exec(li.textContent.replace(/\s+/g, " "));
      if (m) res.push({ label: m[1].trim(), cle: norm(m[1]), texte: m[2].trim().replace(/[,;]\s*$/, "") });
    });
    return res;
  }
  var entrees = lireListe(liste), traitsPar = {};
  if (listeLien) lireListe(listeLien).forEach(function (x) { traitsPar[x.cle] = x.texte; });
  if (!entrees.length) return;

  // ---- bruit et couleurs ---------------------------------------------------------------------------------------
  function h3(ix, iy, iz) {
    var h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function noise(x, y, z) {
    var ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
    var a = h3(ix, iy, iz), b = h3(ix + 1, iy, iz), c = h3(ix, iy + 1, iz), d = h3(ix + 1, iy + 1, iz);
    var e = h3(ix, iy, iz + 1), f = h3(ix + 1, iy, iz + 1), g = h3(ix, iy + 1, iz + 1), h = h3(ix + 1, iy + 1, iz + 1);
    var x1 = a + (b - a) * fx, x2 = c + (d - c) * fx, x3 = e + (f - e) * fx, x4 = g + (h - g) * fx;
    var y1 = x1 + (x2 - x1) * fy, y2 = x3 + (x4 - x3) * fy;
    return y1 + (y2 - y1) * fz;
  }
  function fbm(x, y, z, o) {
    var s = 0, a = 0.5;
    for (var i = 0; i < o; i++) { s += a * noise(x, y, z); x *= 2.03; y *= 2.03; z *= 2.03; a *= 0.5; }
    return s / (1 - Math.pow(0.5, o));
  }
  function mix(a, b, t) { return a + (b - a) * t; }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function pal(stops, v, o) {
    v = clamp(v, 0, 1) * (stops.length - 1);
    var i = Math.min(Math.floor(v), stops.length - 2), f = v - i, a = stops[i], b = stops[i + 1];
    o[0] = a[0] + (b[0] - a[0]) * f; o[1] = a[1] + (b[1] - a[1]) * f; o[2] = a[2] + (b[2] - a[2]) * f;
  }
  function hsv(h, s, v, o) {
    h = (h - Math.floor(h)) * 6;
    var i = Math.floor(h), f = h - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f)), r, g, b;
    switch (i % 6) { case 0: r = v; g = t; b = p; break; case 1: r = q; g = v; b = p; break; case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break; case 4: r = t; g = p; b = v; break; default: r = v; g = p; b = q; }
    o[0] = r * 255; o[1] = g * 255; o[2] = b * 255;
  }

  // ---- styles : un par entrée de la sphère (x, y, z = point de la sphère ; t = temps ; o = couleur rouge/vert/bleu 0-255) ----------
  var PAL_FEU = [[18, 2, 2], [120, 12, 4], [220, 60, 8], [255, 140, 20], [255, 220, 110]];
  var PAL_EAU = [[8, 40, 110], [20, 90, 180], [50, 150, 225], [110, 205, 245]];
  var PAL_VENT = [[70, 78, 96], [130, 140, 158], [205, 210, 220], [250, 250, 252]];
  var PAL_TERRE = [[86, 54, 30], [130, 88, 52], [172, 124, 74], [204, 166, 110]];
  var N = (window.innerWidth < 600 || (navigator.hardwareConcurrency || 4) <= 2) ? 128 : 176;
  var cacheTerre = null;

  var STYLES = {
    "feu": { groupe: "Éléments", point: "#e8501a", f: function (x, y, z, t, o) {
      var w = fbm(x * 2.2 + t * 0.05, y * 2.2 - t * 0.9, z * 2.2, 4), q = fbm(x * 3.2 + w * 1.6, y * 3.2 - t * 1.5 + w, z * 3.2 - w, 3);
      pal(PAL_FEU, clamp(q * 1.35 + w * 0.35 - 0.28 - y * 0.1, 0, 1), o); } },
    "eau": { groupe: "Éléments", point: "#2f86d6", f: function (x, y, z, t, o) {
      var w = fbm(x * 1.6 + t * 0.12, y * 1.6, z * 1.6 - t * 0.1, 3);
      var r = 1 - Math.abs(2 * fbm(x * 2.6 + w * 1.2 - t * 0.15, y * 2.6 + w, z * 2.6 + t * 0.1, 4) - 1);
      pal(PAL_EAU, w * 0.9 + 0.05, o);
      var f = sstep(0.8, 0.96, r); o[0] = mix(o[0], 240, f); o[1] = mix(o[1], 250, f); o[2] = mix(o[2], 255, f); } },
    "vent": { groupe: "Éléments", point: "#aab3c4", f: function (x, y, z, t, o) {
      var ang = t * 0.55 + y * 2.2, c = Math.cos(ang), s = Math.sin(ang), xr = x * c - z * s, zr = x * s + z * c;
      pal(PAL_VENT, clamp((fbm(xr * 2.2, y * 2.2 - t * 0.2, zr * 2.2, 4) - 0.25) * 1.8, 0, 1), o); } },
    "terre": { groupe: "Éléments", point: "#8a5a34", statique: true, f: function (x, y, z, t, o, k) {
      if (!cacheTerre) cacheTerre = { ok: new Uint8Array(N * N), rgb: new Uint8ClampedArray(N * N * 3) };
      if (!cacheTerre.ok[k]) {                                            // sol craquelé : cellules brunes séparées par des fissures, grains de sable
        var s = 3.4, px = x * s, py = y * s, pz = z * s, cx = Math.floor(px), cy = Math.floor(py), cz = Math.floor(pz), f1 = 9, f2 = 9, id = 0;
        for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) for (var dz = -1; dz <= 1; dz++) {
          var ax = cx + dx, ay = cy + dy, az = cz + dz;
          var qx = ax + h3(ax, ay, az), qy = ay + h3(ax + 57, ay, az), qz = az + h3(ax, ay + 91, az);
          var d = Math.sqrt((px - qx) * (px - qx) + (py - qy) * (py - qy) + (pz - qz) * (pz - qz));
          if (d < f1) { f2 = f1; f1 = d; id = h3(ax + 13, ay + 7, az + 3); } else if (d < f2) { f2 = d; }
        }
        pal(PAL_TERRE, id * 0.95, o);
        if (id > 0.8) { o[0] = 214; o[1] = 186; o[2] = 132; }              // quelques plaques de sable
        var g = (noise(x * 26, y * 26, z * 26) - 0.5) * 46; o[0] += g; o[1] += g * 0.9; o[2] += g * 0.7;
        var fis = sstep(0.0, 0.13, f2 - f1); o[0] = mix(24, o[0], fis); o[1] = mix(13, o[1], fis); o[2] = mix(8, o[2], fis);
        var b = k * 3; cacheTerre.rgb[b] = o[0]; cacheTerre.rgb[b + 1] = o[1]; cacheTerre.rgb[b + 2] = o[2]; cacheTerre.ok[k] = 1;
      }
      var i = k * 3; o[0] = cacheTerre.rgb[i]; o[1] = cacheTerre.rgb[i + 1]; o[2] = cacheTerre.rgb[i + 2]; } },
    "abjuration": { groupe: "Écoles", point: "#5b6bd6", fixe: true, f: function (x, y, z, t, o) {
      var r = Math.sqrt(x * x + y * y), a = Math.atan2(y, x);
      var h = a / 6.2832 + t * 0.09 + r * 1.3 + 0.3 * fbm(x * 2, y * 2, z * 2 + t * 0.3, 3);
      hsv(h, 0.72, 0.95, o); var noyau = sstep(0.1, 0.72, r); o[0] *= noyau; o[1] *= noyau; o[2] *= noyau; } },
    "psychisme": { groupe: "Écoles", point: "#5a5a66", f: function (x, y, z, t, o) {
      var n = fbm(x * 1.4 + t * 0.05, y * 1.4, z * 1.4, 3);
      pal([[22, 22, 28], [50, 50, 60], [92, 92, 106]], 0.35 + 0.18 * Math.sin(t * 0.9 + n * 5) + n * 0.3, o); } },
    "invocation": { groupe: "Écoles", point: "#f08a1c", fixe: true, f: function (x, y, z, t, o) {
      var n = fbm(x * 2, y * 2 + t * 0.2, z * 2, 3), r2 = x * x + y * y, pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
      pal([[140, 50, 0], [235, 110, 10], [255, 165, 50], [255, 225, 150]], 0.45 + 0.35 * (1 - r2) * (0.6 + 0.4 * pulse) + (n - 0.5) * 0.35, o); } },
    "alteration": { groupe: "Écoles", point: "#8a3fc4", f: function (x, y, z, t, o) {
      var n = fbm(x * 2 + t * 0.1, y * 2, z * 2 - t * 0.12, 4);
      hsv(0.76 + (n - 0.5) * 0.16 + 0.05 * Math.sin(t * 0.7), 0.78 - 0.15 * n, 0.55 + 0.45 * n, o); } },
    "magie noire": { groupe: "Énergies", point: "#3a3f2a", f: function (x, y, z, t, o) {
      var a = fbm(x * 2.4 + t * 0.06, y * 2.4, z * 2.4, 4), b = fbm(x * 3.1 - t * 0.05, y * 3.1 + 7, z * 3.1, 3);
      var g = sstep(0.5, 0.72, a), r = sstep(0.55, 0.78, b), s = noise(x * 28, y * 28, z * 28) * 0.25;
      o[0] = 12 + r * 110 * (1 - g * 0.4) + s * 40; o[1] = 12 + g * 80 + s * 30 - r * 8; o[2] = 14 + g * 20 + s * 20; } },
    "magie blanche": { groupe: "Énergies", point: "#f4ecd0", f: function (x, y, z, t, o) {
      var n = fbm(x * 1.8 + t * 0.08, y * 1.8, z * 1.8 - t * 0.06, 3), v = 0.82 + 0.18 * n + 0.05 * Math.sin(t * 1.1);
      o[0] = 255 * v; o[1] = 250 * v; o[2] = 238 * v + 22 * (1 - v); } },
    "chamanisme": { groupe: "Autre", point: "#7d8f6a", f: function (x, y, z, t, o) {
      var k = Math.floor(t / 1.4), fr = t / 1.4 - k, h1 = h3(k, 3, 7), h2 = h3(k + 1, 3, 7), e = sstep(0.35, 0.65, fr);
      var hesite = 0.5 + 0.5 * Math.sin(t * 5.3) * (1 - Math.abs(2 * e - 1));           // la sphère hésite avant de changer de couleur
      var n = fbm(x * 2 + t * 0.1, y * 2, z * 2, 3);
      hsv(mix(h1, h2, clamp(e + (hesite - 0.5) * 0.5, 0, 1)) + (n - 0.5) * 0.15, 0.7, 0.55 + 0.4 * n, o); } }
  };
  var STYLE_DEFAUT = { groupe: "Autre", point: "#999", f: STYLES["alteration"].f };
  function styleDe(cle) { return STYLES[cle] || STYLE_DEFAUT; }

  // ---- interface ---------------------------------------------------------------------------------------------------
  var canvas = el("canvas", { "class": "sphere-canvas", width: N, height: N, "aria-hidden": "true" });
  var ctx = canvas.getContext("2d");
  var image = ctx.createImageData(N, N);
  var halo = el("div", { "class": "sphere-halo" });
  var scene = el("div", { "class": "sphere-scene" }, [halo, canvas]);
  var titre = el("h4", { "class": "sphere-titre" });
  var desc = el("p", { "class": "sphere-desc" });
  var traits = el("p", { "class": "sphere-traits" });
  var sortieInt = el("output", { "for": "sphere-intensite" }, "85 %");
  var curseur = el("input", { type: "range", min: "5", max: "100", value: "85", id: "sphere-intensite" });
  var auto = el("button", { type: "button", "class": "sphere-auto", "aria-pressed": "false" }, "▶ Faire défiler les couleurs");
  var voirListe = el("button", { type: "button", "class": "sphere-liste-btn", "aria-expanded": "false" }, "Afficher toutes les descriptions écrites");
  var panneau = el("div", { "class": "sphere-panneau", "aria-live": "polite" }, [
    titre, desc, traits,
    el("div", { "class": "sphere-reglage" }, [el("label", { "for": "sphere-intensite" }, "Intensité des couleurs"), curseur, sortieInt]),
    el("p", { "class": "sphere-note" }, "L'intensité des couleurs est proportionnelle aux capacités magiques de la personne qui tient la sphère."),
    el("p", { "class": "sphere-boutons" }, [auto, voirListe])
  ]);
  var choix = el("div", { "class": "sphere-choix", role: "group", "aria-label": "Choisir un élément, une école ou une énergie" });
  var groupes = {}, boutons = [];
  entrees.forEach(function (en, i) {
    var st = styleDe(en.cle);
    if (!groupes[st.groupe]) {
      groupes[st.groupe] = el("div", { "class": "sphere-groupe" }, [el("span", { "class": "sphere-groupe-nom" }, st.groupe)]);
      choix.appendChild(groupes[st.groupe]);
    }
    var b = el("button", { type: "button", "aria-pressed": "false", style: "--point:" + st.point }, [el("i", { "aria-hidden": "true" }), en.label]);
    b.addEventListener("click", function () { arreterAuto(); choisir(i); });
    groupes[st.groupe].appendChild(b);
    boutons.push(b);
  });
  racine.appendChild(scene); racine.appendChild(panneau); racine.appendChild(choix);
  liste.hidden = true;
  voirListe.addEventListener("click", function () {
    liste.hidden = !liste.hidden;
    voirListe.setAttribute("aria-expanded", String(!liste.hidden));
    voirListe.textContent = liste.hidden ? "Afficher toutes les descriptions écrites" : "Masquer les descriptions écrites";
  });

  // ---- animation --------------------------------------------------------------------------------------------------------
  var courant = 0, precedent = null, debutFondu = 0, intensite = 0.85, t0 = performance.now(), visible = true, derniere = 0;
  var reduit = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var c1 = [0, 0, 0], c2 = [0, 0, 0];
  var VERRE = [196, 204, 216];
  var L = (function () { var x = -0.5, y = 0.55, z = 0.65, n = Math.sqrt(x * x + y * y + z * z); return [x / n, y / n, z / n]; })();
  var H = (function () { var x = L[0], y = L[1], z = L[2] + 1, n = Math.sqrt(x * x + y * y + z * z); return [x / n, y / n, z / n]; })();

  function dessiner(t, maintenant) {
    var data = image.data, st = styleDe(entrees[courant].cle), avant = precedent ? styleDe(entrees[precedent.i].cle) : null;
    var fondu = precedent ? clamp((maintenant - debutFondu) / 700, 0, 1) : 1;
    if (fondu >= 1) precedent = null;
    var tourne = function (s) { return !(s.statique || s.fixe); };
    var ang = tourne(st) ? t * 0.14 : 0, cr = Math.cos(ang), sr = Math.sin(ang);
    for (var j = 0, k = 0; j < N; j++) {
      var y = ((j + 0.5) / N) * 2 - 1;
      for (var i = 0; i < N; i++, k++) {
        var x = ((i + 0.5) / N) * 2 - 1, r2 = x * x + y * y, p = k * 4;
        if (r2 >= 1) { data[p + 3] = 0; continue; }
        var z = Math.sqrt(1 - r2), xr = tourne(st) ? x * cr + z * sr : x, zr = tourne(st) ? -x * sr + z * cr : z;
        st.f(xr, -y, zr, t, c1, k);
        if (precedent) {
          avant.f(tourne(avant) ? x * cr + z * sr : x, -y, tourne(avant) ? -x * sr + z * cr : z, t, c2, k);
          c1[0] = mix(c2[0], c1[0], fondu); c1[1] = mix(c2[1], c1[1], fondu); c1[2] = mix(c2[2], c1[2], fondu);
        }
        var s = 0.12 + 0.88 * intensite;                                        // intensité : la sphère est un verre pâle qui se remplit de couleur
        var r = mix(VERRE[0], c1[0], s), g = mix(VERRE[1], c1[1], s), b = mix(VERRE[2], c1[2], s);
        var diff = Math.max(0, x * L[0] - y * L[1] + z * L[2]);
        var shade = 0.42 + 0.78 * diff, rim = Math.pow(1 - z, 2.4);
        var spec = Math.pow(Math.max(0, x * H[0] - y * H[1] + z * H[2]), 70) * 0.8;
        var bord = clamp((1 - Math.sqrt(r2)) * N * 0.5, 0, 1);
        data[p] = clamp(r * shade * (1 - 0.4 * rim) + spec * 255 + rim * 22, 0, 255);
        data[p + 1] = clamp(g * shade * (1 - 0.4 * rim) + spec * 255 + rim * 22, 0, 255);
        data[p + 2] = clamp(b * shade * (1 - 0.4 * rim) + spec * 255 + rim * 30, 0, 255);
        data[p + 3] = bord * 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }
  function boucle(maintenant) {
    requestAnimationFrame(boucle);
    if (!visible || document.hidden || reduit || maintenant - derniere < 33) return;
    derniere = maintenant;
    dessiner((maintenant - t0) / 1000, maintenant);
  }

  function choisir(i) {
    if (i === courant && boutons[i].getAttribute("aria-pressed") === "true") return;
    precedent = { i: courant }; debutFondu = performance.now(); courant = i;
    var en = entrees[i], st = styleDe(en.cle);
    boutons.forEach(function (b, k) { b.setAttribute("aria-pressed", k === i ? "true" : "false"); });
    titre.textContent = en.label; desc.textContent = en.texte.charAt(0).toUpperCase() + en.texte.slice(1);
    var tr = traitsPar[en.cle];
    traits.textContent = ""; if (tr) { traits.appendChild(el("strong", null, "Traits de caractère associés (théorie du Lien) : ")); traits.appendChild(document.createTextNode(tr)); }
    racine.style.setProperty("--halo", st.point);
    if (reduit) dessiner(3, performance.now() + 1000);
    else if (!visible) dessiner((performance.now() - t0) / 1000, performance.now() + 1000);     // sphère hors écran : on met tout de même l'image à jour
  }

  var minuteur = null;
  function arreterAuto() { if (minuteur) { clearInterval(minuteur); minuteur = null; } auto.setAttribute("aria-pressed", "false"); auto.textContent = "▶ Faire défiler les couleurs"; }
  auto.addEventListener("click", function () {
    if (minuteur) { arreterAuto(); return; }
    auto.setAttribute("aria-pressed", "true"); auto.textContent = "❚❚ Arrêter le défilement";
    choisir((courant + 1) % entrees.length);
    minuteur = setInterval(function () { choisir((courant + 1) % entrees.length); }, 3800);
  });
  curseur.addEventListener("input", function () {
    intensite = parseInt(curseur.value, 10) / 100; sortieInt.textContent = curseur.value + " %";
    racine.style.setProperty("--halo-op", String(0.15 + 0.55 * intensite));
    if (reduit) dessiner(3, performance.now() + 1000);
  });
  racine.style.setProperty("--halo-op", String(0.15 + 0.55 * intensite));

  if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0.05 }).observe(scene);
  choisir(0);
  if (reduit) dessiner(3, performance.now() + 1000); else requestAnimationFrame(boucle);
})();
