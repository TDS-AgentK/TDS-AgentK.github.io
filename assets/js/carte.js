// Carte interactive de Vesperae — JavaScript pur, sans bibliothèque.
// Données : <script type="application/json" id="donnees-carte"> (générées depuis data/lieux.json).
// Fonctions : déplacer (glisser), zoomer (Ctrl + molette, pincement, boutons, double-clic), repères par
// catégorie, recherche, filtres, fiche du lieu, plusieurs cartes, lien direct (#lieu=nom), plein écran.
// Zones des royaumes : polygones dessinés (data/royaumes.json), affichés avec la puce « Zones des royaumes ».
// Mode édition : ajouter ?edition à l'adresse ; un clic sur la carte copie les coordonnées du point.
(function () {
  "use strict";

  var racine = document.getElementById("carte-vesperae");
  var brut = document.getElementById("donnees-carte");
  if (!racine || !brut) return;
  var data;
  try { data = JSON.parse(brut.textContent); } catch (e) { return; }

  var EDITION = /[?&]edition/.test(location.search);
  var reduireMouvement = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- petits outils ---------- */
  function h(tag, attrs, enfants) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") el.className = attrs[k];
      else if (k === "text") el.textContent = attrs[k];
      else el.setAttribute(k, attrs[k]);
    });
    (enfants || []).forEach(function (c) { if (c) el.appendChild(c); });
    return el;
  }
  function norm(t) {
    return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  function bornes(v, a, b) { return Math.min(b, Math.max(a, v)); }

  var catNom = {};
  data.categories.forEach(function (c) { catNom[c.id] = c.nom; });
  var lieux = data.lieux;
  var parId = {};
  lieux.forEach(function (l) { parId[l.id] = l; });
  var cartes = {};
  data.cartes.forEach(function (c) { cartes[c.id] = c; });

  /* ---------- structure de l'interface ---------- */
  racine.classList.add("cm");
  racine.innerHTML = "";

  var races = data.races || [];
  var champ = h("input", { type: "search", class: "cm-recherche", placeholder: "Chercher un lieu…", "aria-label": "Chercher un lieu" });
  var puces = h("div", { class: "cm-puces", role: "group", "aria-label": "Filtrer par catégorie" });
  var compteur = h("p", { class: "cm-compteur", "aria-live": "polite" });
  var liste = h("ul", { class: "cm-liste" });
  var noms = h("input", { type: "checkbox", id: "cm-noms" });
  var listeRoyaumes = h("ul", { class: "cm-royaumes-liste", hidden: "" });
  var choixRace = h("select", { class: "cm-races", "aria-label": "Voir où vit une race" }, [h("option", { value: "", text: "Où vit une race ? (choisir)" })]);
  var infoRace = h("p", { class: "cm-race-info", hidden: "", "aria-live": "polite" });
  var blocRaces = h("div", { class: "cm-bloc-races" }, [choixRace, infoRace]);
  if (!races.length) blocRaces.hidden = true;
  var menu = h("div", { class: "cm-menu" }, [
    champ, puces, listeRoyaumes, blocRaces,
    h("label", { class: "cm-option", for: "cm-noms" }, [noms, h("span", { text: " Afficher les noms sur la carte" })]),
    compteur, liste,
  ]);

  var img = h("img", { class: "cm-img", alt: "", draggable: "false" });
  var royaumes = data.royaumes || [];
  var NS = "http://www.w3.org/2000/svg";
  var calque = document.createElementNS(NS, "svg");
  calque.setAttribute("class", "cm-royaumes");
  calque.setAttribute("viewBox", "0 0 100 100");
  calque.setAttribute("preserveAspectRatio", "none");
  calque.setAttribute("aria-hidden", "true");
  var monde = h("div", { class: "cm-monde" }, [img]);
  monde.appendChild(calque);
  var vue = h("div", { class: "cm-vue", tabindex: "0", role: "application",
    "aria-label": "Carte interactive. Flèches pour se déplacer, plus et moins pour zoomer." }, [monde]);

  var onglets = h("div", { class: "cm-onglets", role: "tablist" });
  function bouton(txt, titre, cls) {
    return h("button", { type: "button", class: "cm-btn " + (cls || ""), "aria-label": titre, title: titre, text: txt });
  }
  var bPlus = bouton("+", "Zoom avant"), bMoins = bouton("−", "Zoom arrière");
  var bFit = bouton("⌂", "Tout voir"), bPlein = bouton("⛶", "Plein écran");
  var outils = h("div", { class: "cm-outils" }, [bPlus, bMoins, bFit, bPlein]);
  var astuce = h("div", { class: "cm-astuce", role: "status" });
  var fiche = h("article", { class: "cm-fiche", hidden: "" });

  var zone = h("div", { class: "cm-carte" }, [vue, onglets, outils, astuce, fiche]);
  racine.appendChild(menu);
  racine.appendChild(zone);

  var reserve = document.querySelector(".lieux-texte");
  if (reserve) reserve.hidden = true;        // la version texte (sans JavaScript) n'est plus utile

  /* ---------- état ---------- */
  var carte = null, W = 1, H = 1, s = 1, tx = 0, ty = 0, vw = 0, vh = 0;
  var sMin = 0.1, sMax = 2;
  var selection = null, filtreCat = "toutes", requete = "", royaumeChoisi = null, zonesVisibles = false, raceChoisie = null;
  var anim = null, actif = false;

  function mesurer() { vw = vue.clientWidth; vh = vue.clientHeight; }
  function calculerBornes() {
    var fit = Math.min(vw / W, vh / H);
    sMin = fit;
    sMax = Math.max(fit * 3.5, 1.5);
    return fit;
  }
  function borner() {
    var Ws = W * s, Hs = H * s, m = 80;
    tx = Ws <= vw ? (vw - Ws) / 2 : bornes(tx, vw - Ws - m, m);
    ty = Hs <= vh ? (vh - Hs) / 2 : bornes(ty, vh - Hs - m, m);
  }
  function appliquer() {
    monde.style.transform = "translate(" + tx.toFixed(1) + "px," + ty.toFixed(1) + "px) scale(" + s.toFixed(4) + ")";
    monde.style.setProperty("--inv", (1 / s).toFixed(4));
  }
  function arreterAnim() { if (anim) { cancelAnimationFrame(anim); anim = null; } }
  function aller(ns, ntx, nty, ms) {
    arreterAnim();
    ns = bornes(ns, sMin, sMax);
    if (reduireMouvement || !ms) { s = ns; tx = ntx; ty = nty; borner(); appliquer(); return; }
    var s0 = s, x0 = tx, y0 = ty, t0 = performance.now();
    (function pas(t) {
      var k = bornes((t - t0) / ms, 0, 1), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      s = s0 + (ns - s0) * e; tx = x0 + (ntx - x0) * e; ty = y0 + (nty - y0) * e;
      borner(); appliquer();
      anim = k < 1 ? requestAnimationFrame(pas) : null;
    })(t0);
  }
  function zoomerAutour(cx, cy, facteur, ms) {
    var ns = bornes(s * facteur, sMin, sMax), f = ns / s;
    aller(ns, cx - (cx - tx) * f, cy - (cy - ty) * f, ms || 0);
  }
  function toutVoir(ms) {
    var fit = calculerBornes();
    aller(fit, (vw - W * fit) / 2, (vh - H * fit) / 2, ms || 0);
  }
  function pointCible() {
    var large = vw >= 640;
    return { x: vw * (large ? 0.6 : 0.5), y: vh * (large ? 0.45 : 0.3) };
  }
  function versLieu(l, ms) {
    var ns = bornes(Math.max(s, sMin * 2.8), sMin, sMax), c = pointCible();
    aller(ns, c.x - (l.x / 100) * W * ns, c.y - (l.y / 100) * H * ns, ms === undefined ? 600 : ms);
  }

  /* ---------- repères ---------- */
  var reperes = {};
  lieux.forEach(function (l) {
    if (l.x == null || !cartes[l.carte]) return;
    var b = h("button", { type: "button", class: "cm-repere", "data-cat": l.cat, "data-carte": l.carte,
      style: "left:" + l.x + "%;top:" + l.y + "%", "aria-label": l.nom + " — " + (catNom[l.cat] || "") }, [
      h("span", { class: "cm-pin" }), h("span", { class: "cm-nom", text: l.nom }),
    ]);
    b.addEventListener("click", function (e) { e.stopPropagation(); choisir(l.id); });
    b.addEventListener("mouseenter", function () { surligner(l.id, true); });
    b.addEventListener("mouseleave", function () { surligner(l.id, false); });
    reperes[l.id] = b;
    monde.appendChild(b);
  });

  /* ---------- zones des royaumes ---------- */
  var zones = {}, etiquettes = {}, itemsRoyaumes = {}, parRoyaume = {}, puceZones = null;
  royaumes.forEach(function (r) {
    parRoyaume[r.id] = r;
    var d = r.points.map(function (p, i) { return (i ? "L" : "M") + p[0] + " " + p[1]; }).join(" ") + " Z";
    var chemin = document.createElementNS(NS, "path");
    chemin.setAttribute("d", d);
    chemin.setAttribute("class", "cm-territoire");
    chemin.setAttribute("data-id", r.id);
    chemin.setAttribute("data-carte", r.carte);
    chemin.setAttribute("style", "--c:" + r.couleur);
    calque.appendChild(chemin);
    zones[r.id] = chemin;
    // étiquette au centre de gravité du polygone
    var A = 0, cx = 0, cy = 0, n = r.points.length;
    for (var i = 0; i < n; i++) {
      var a = r.points[i], b = r.points[(i + 1) % n], c = a[0] * b[1] - b[0] * a[1];
      A += c; cx += (a[0] + b[0]) * c; cy += (a[1] + b[1]) * c;
    }
    if (A) { cx /= 3 * A; cy /= 3 * A; } else { cx = r.points[0][0]; cy = r.points[0][1]; }
    if (r.etiquette) { cx = r.etiquette[0]; cy = r.etiquette[1]; }              // position choisie à la main (facultatif)
    var et = h("span", { class: "cm-terr-nom", "data-carte": r.carte, style: "left:" + cx.toFixed(2) + "%;top:" + cy.toFixed(2) + "%;--c:" + r.couleur, text: r.nom, "aria-hidden": "true" });
    monde.appendChild(et);
    etiquettes[r.id] = et;
    var bt = h("button", { type: "button", class: "cm-royaume-btn", "data-carte": r.carte, style: "--c:" + r.couleur }, [h("span", { class: "cm-carre" }), h("span", { text: r.nom })]);
    bt.addEventListener("click", function () { choisirRoyaume(r.id); });
    bt.addEventListener("mouseenter", function () { zones[r.id].classList.add("survol"); });
    bt.addEventListener("mouseleave", function () { zones[r.id].classList.remove("survol"); });
    itemsRoyaumes[r.id] = h("li", {}, [bt]);
    listeRoyaumes.appendChild(itemsRoyaumes[r.id]);
  });
  races.forEach(function (r) { choixRace.appendChild(h("option", { value: r.id, text: r.nom })); });
  var NIVEAU = { principale: "principale", rare: "plus rare" };
  function majRace() {
    var r = raceChoisie;
    Object.keys(zones).forEach(function (k) {
      var de = !!r && !!r.niveaux[k];
      zones[k].classList.toggle("de-race", de);
      zones[k].classList.toggle("hors-race", !!r && !de);
      if (etiquettes[k]) etiquettes[k].classList.toggle("hors-race", !!r && !de);
      if (itemsRoyaumes[k]) itemsRoyaumes[k].classList.toggle("hors-race", !!r && !de);
    });
    infoRace.innerHTML = "";
    infoRace.hidden = !r;
    if (!r) return;
    var noms = Object.keys(r.niveaux).map(function (k) { return (parRoyaume[k] ? parRoyaume[k].nom : k) + (NIVEAU[r.niveaux[k]] ? " (" + NIVEAU[r.niveaux[k]] + ")" : ""); });
    infoRace.appendChild(h("strong", { text: r.nom + " : " }));
    infoRace.appendChild(document.createTextNode(noms.join(", ") + "."));
    if (r.lien) { infoRace.appendChild(document.createTextNode(" ")); infoRace.appendChild(h("a", { href: r.lien, text: "Voir la fiche" })); }
  }
  choixRace.addEventListener("change", function () {
    raceChoisie = null;
    races.forEach(function (r) { if (r.id === choixRace.value) raceChoisie = r; });
    if (raceChoisie && !zonesVisibles) afficherZones(true);
    if (raceChoisie && royaumeChoisi) fermerFiche();
    majRace();
  });
  function afficherZones(oui) {
    zonesVisibles = oui;
    racine.classList.toggle("cm-avec-royaumes", oui);
    listeRoyaumes.hidden = !oui;
    if (puceZones) puceZones.setAttribute("aria-pressed", oui ? "true" : "false");
    if (!oui && royaumeChoisi) fermerFiche();
    if (!oui && raceChoisie) { raceChoisie = null; choixRace.value = ""; majRace(); }
  }
  function royaumeSous(e) {
    if (!zonesVisibles) return null;
    var c = document.elementFromPoint(e.clientX, e.clientY);
    var z = c && c.closest ? c.closest(".cm-territoire") : null;
    return z ? parRoyaume[z.getAttribute("data-id")] : null;
  }
  function choisirRoyaume(id, opts) {
    var r = parRoyaume[id];
    if (!r) return;
    opts = opts || {};
    var suite = function () {
      if (!zonesVisibles) afficherZones(true);
      if (selection && reperes[selection]) reperes[selection].classList.remove("choisi");
      selection = null;
      Object.keys(zones).forEach(function (k) { zones[k].classList.toggle("choisi", k === id); });
      royaumeChoisi = id;
      Array.prototype.forEach.call(liste.querySelectorAll(".cm-item"), function (b) { b.classList.remove("actif"); });
      var xs = r.points.map(function (p) { return p[0]; }), ys = r.points.map(function (p) { return p[1]; });
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
      var largeur = (x1 - x0) / 100 * W, hauteur = (y1 - y0) / 100 * H, large = vw >= 640;
      var ns = bornes(Math.min((vw * (large ? 0.55 : 0.9)) / largeur, (vh * (large ? 0.85 : 0.5)) / hauteur), sMin, sMax);
      var cible = pointCible();
      aller(ns, cible.x - ((x0 + x1) / 2 / 100) * W * ns, cible.y - ((y0 + y1) / 2 / 100) * H * ns, opts.instantane ? 0 : 600);
      ouvrirFicheRoyaume(r);
      try { history.replaceState(null, "", "#royaume=" + id); } catch (e) { /* ignoré */ }
    };
    if (r.carte && carte.id !== r.carte) changerCarte(r.carte, true, suite); else suite();
  }
  function ouvrirFicheRoyaume(r) {
    fiche.innerHTML = "";
    var fermer = bouton("×", "Fermer la fiche", "cm-fermer");
    fermer.addEventListener("click", fermerFiche);
    var corps = h("div", { class: "cm-fiche-corps" });
    corps.appendChild(h("h3", { text: r.nom }));
    corps.appendChild(h("p", { class: "cm-fiche-meta", text: "Territoire · " + (cartes[r.carte] ? cartes[r.carte].nom : "") }));
    var ici = races.filter(function (x) { return x.niveaux[r.id]; });
    if (ici.length) {
      corps.appendChild(h("p", { class: "cm-fiche-etiquette", text: "Races présentes" }));
      var ul = h("ul", { class: "cm-fiche-races" });
      ici.forEach(function (x) {
        var contenu = [x.sprite ? h("img", { src: x.sprite, alt: "", width: "26", height: "31", loading: "lazy" }) : null,
                       h("span", { text: x.nom + (NIVEAU[x.niveaux[r.id]] ? " (" + NIVEAU[x.niveaux[r.id]] + ")" : "") })];
        ul.appendChild(h("li", {}, [x.lien ? h("a", { href: x.lien }, contenu) : h("span", { class: "cm-race-libre" }, contenu)]));
      });
      corps.appendChild(ul);
    }
    var actions = h("p", { class: "cm-fiche-actions" });
    if (r.lien) actions.appendChild(h("a", { class: "cm-lien", href: r.lien, text: "Voir la page" }));
    corps.appendChild(actions);
    fiche.appendChild(fermer);
    fiche.appendChild(corps);
    fiche.hidden = false;
    fiche.scrollTop = 0;
  }

  /* ---------- liste + filtres ---------- */
  var items = {};
  lieux.slice().sort(function (a, b) { return a.nom.localeCompare(b.nom, "fr"); }).forEach(function (l) {
    var b = h("button", { type: "button", class: "cm-item", "data-cat": l.cat }, [
      h("span", { class: "cm-point" }), h("span", { class: "cm-item-nom", text: l.nom }),
      l.x == null ? h("span", { class: "cm-item-note", text: "hors carte" }) : null,
    ]);
    b.addEventListener("click", function () { choisir(l.id); });
    b.addEventListener("mouseenter", function () { surligner(l.id, true); });
    b.addEventListener("mouseleave", function () { surligner(l.id, false); });
    var li = h("li", {}, [b]);
    items[l.id] = li;
    liste.appendChild(li);
  });

  function puce(id, nom) {
    var b = h("button", { type: "button", class: "cm-puce", "data-cat": id, "aria-pressed": id === "toutes" ? "true" : "false" }, [
      id === "toutes" ? null : h("span", { class: "cm-point" }), h("span", { text: nom }),
    ]);
    b.addEventListener("click", function () {
      filtreCat = (filtreCat === id && id !== "toutes") ? "toutes" : id;
      appliquerFiltres();
    });
    puces.appendChild(b);
  }
  puce("toutes", "Tous");
  data.categories.forEach(function (c) { puce(c.id, c.nom); });
  if (royaumes.length) {
    puceZones = h("button", { type: "button", class: "cm-puce cm-puce-zones", "aria-pressed": "false", title: "Afficher ou masquer les territoires des royaumes" }, [
      h("span", { class: "cm-carre" }), h("span", { text: "Zones des royaumes" }),
    ]);
    puceZones.addEventListener("click", function () { afficherZones(!zonesVisibles); });
    puces.appendChild(puceZones);
  }

  function visible(l) {
    if (selection === l.id) return true;
    if (filtreCat !== "toutes" && l.cat !== filtreCat) return false;
    if (requete) {
      var meule = norm(l.nom + " " + l.region + " " + l.description);
      if (meule.indexOf(requete) === -1) return false;
    }
    return true;
  }
  function appliquerFiltres() {
    var n = 0;
    lieux.forEach(function (l) {
      var ok = visible(l);
      if (ok) n++;
      items[l.id].hidden = !ok;
      if (reperes[l.id]) reperes[l.id].hidden = !ok || l.carte !== carte.id;
    });
    Array.prototype.forEach.call(puces.children, function (b) {
      if (b === puceZones) return;
      b.setAttribute("aria-pressed", b.getAttribute("data-cat") === filtreCat ? "true" : "false");
    });
    compteur.textContent = n + (n > 1 ? " lieux" : " lieu");
  }
  champ.addEventListener("input", function () { requete = norm(champ.value.trim()); appliquerFiltres(); });
  noms.addEventListener("change", function () { racine.classList.toggle("cm-avec-noms", noms.checked); });

  function surligner(id, on) {
    if (reperes[id]) reperes[id].classList.toggle("survol", on);
    if (items[id]) items[id].classList.toggle("survol", on);
  }

  /* ---------- cartes (onglets) ---------- */
  data.cartes.forEach(function (c) {
    var b = h("button", { type: "button", role: "tab", class: "cm-onglet", "data-carte": c.id, text: c.nom });
    b.addEventListener("click", function () { changerCarte(c.id, true); });
    onglets.appendChild(b);
  });
  if (data.cartes.length < 2) onglets.hidden = true;

  function changerCarte(id, recentrer, apres) {
    var nouvelle = cartes[id];
    if (!nouvelle) return;
    var change = carte !== nouvelle;
    carte = nouvelle;
    W = carte.largeur; H = carte.hauteur;
    monde.style.width = W + "px"; monde.style.height = H + "px";
    Array.prototype.forEach.call(onglets.children, function (b) {
      var on = b.getAttribute("data-carte") === id;
      b.classList.toggle("actif", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    var fin = function () {
      mesurer(); toutVoir(0); appliquerFiltres();
      Array.prototype.forEach.call(monde.querySelectorAll(".cm-territoire, .cm-terr-nom"), function (e) {
        var ici = e.getAttribute("data-carte") === carte.id;
        if (e.tagName.toLowerCase() === "path") e.style.display = ici ? "" : "none"; else e.hidden = !ici;
      });
      Array.prototype.forEach.call(listeRoyaumes.children, function (li) { li.hidden = li.firstChild.getAttribute("data-carte") !== carte.id; });
      if (apres) apres();
    };
    if (change) {
      racine.classList.add("cm-charge");
      img.onload = function () { racine.classList.remove("cm-charge"); fin(); };
      img.src = carte.image;
      img.alt = "Carte : " + carte.nom;
      if (img.complete && img.naturalWidth) img.onload();
    } else if (recentrer) { fin(); }
  }

  /* ---------- fiche d'un lieu ---------- */
  function choisir(id, opts) {
    var l = parId[id];
    if (!l) return;
    opts = opts || {};
    if (selection && reperes[selection]) reperes[selection].classList.remove("choisi");
    if (royaumeChoisi) { zones[royaumeChoisi].classList.remove("choisi"); royaumeChoisi = null; }
    selection = id;
    var afficher = function () {
      if (reperes[id]) reperes[id].classList.add("choisi");
      Array.prototype.forEach.call(liste.querySelectorAll(".cm-item"), function (b) { b.classList.remove("actif"); });
      var it = items[id] && items[id].firstChild;
      if (it) it.classList.add("actif");
      appliquerFiltres();
      if (l.x != null && !opts.sansCentrage) versLieu(l, opts.instantane ? 0 : 600);
      ouvrirFiche(l);
      try { history.replaceState(null, "", "#lieu=" + id); } catch (e) { /* ignoré */ }
    };
    if (l.carte && carte.id !== l.carte) changerCarte(l.carte, true, afficher); else afficher();
  }

  function ouvrirFiche(l) {
    fiche.innerHTML = "";
    var fermer = bouton("×", "Fermer la fiche", "cm-fermer");
    fermer.addEventListener("click", fermerFiche);
    var corps = h("div", { class: "cm-fiche-corps" });
    if (l.image) corps.appendChild(h("img", { class: "cm-fiche-img", src: l.image, alt: "", loading: "lazy" }));
    corps.appendChild(h("h3", { text: l.nom }));
    corps.appendChild(h("p", { class: "cm-fiche-meta", text: (catNom[l.cat] || "") + (l.region ? " · " + l.region : "") }));
    corps.appendChild(h("p", { text: l.description }));
    var actions = h("p", { class: "cm-fiche-actions" });
    if (l.lien) actions.appendChild(h("a", { class: "cm-lien", href: l.lien, text: "En savoir plus" }));
    var copier = h("button", { type: "button", class: "cm-lien cm-copier", text: "Copier le lien" });
    copier.addEventListener("click", function () {
      var url = location.origin + location.pathname + "#lieu=" + l.id;
      var ok = function () { copier.textContent = "Lien copié ✓"; setTimeout(function () { copier.textContent = "Copier le lien"; }, 1800); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok, function () { window.prompt("Lien :", url); });
      else window.prompt("Lien :", url);
    });
    actions.appendChild(copier);
    corps.appendChild(actions);
    fiche.appendChild(fermer);
    fiche.appendChild(corps);
    fiche.hidden = false;
    fiche.scrollTop = 0;
  }
  function fermerFiche() {
    if (selection && reperes[selection]) reperes[selection].classList.remove("choisi");
    if (royaumeChoisi) { zones[royaumeChoisi].classList.remove("choisi"); royaumeChoisi = null; }
    selection = null;
    fiche.hidden = true;
    Array.prototype.forEach.call(liste.querySelectorAll(".cm-item"), function (b) { b.classList.remove("actif"); });
    appliquerFiltres();
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ignoré */ }
  }

  /* ---------- déplacement et zoom ---------- */
  var pointeurs = {}, glisse = null, pincement = null;
  function relatif(e) {
    var r = vue.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  // Ni sélection de texte/d'image ni « glisser-déposer » de l'image pendant qu'on déplace la carte.
  ["selectstart", "dragstart"].forEach(function (nomEv) {
    vue.addEventListener(nomEv, function (e) { e.preventDefault(); });
  });
  vue.addEventListener("mousedown", function (e) {
    if (e.button === 0 && !e.target.closest(".cm-repere")) {
      e.preventDefault();
      try { vue.focus({ preventScroll: true }); } catch (err) { vue.focus(); }
    }
  });
  vue.addEventListener("pointerdown", function (e) {
    if (e.target.closest(".cm-repere") || (e.button !== undefined && e.button > 0)) return;
    actif = true;
    try { vue.setPointerCapture(e.pointerId); } catch (err) { /* ignoré */ }
    pointeurs[e.pointerId] = { x: e.clientX, y: e.clientY };
    arreterAnim();
    var ids = Object.keys(pointeurs);
    if (ids.length === 1) glisse = { x0: e.clientX, y0: e.clientY, bouge: false };
    else if (ids.length === 2) {
      glisse = null;
      var a = pointeurs[ids[0]], b = pointeurs[ids[1]];
      pincement = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });
  vue.addEventListener("pointermove", function (e) {
    var prec = pointeurs[e.pointerId];
    if (!prec) return;
    pointeurs[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pointeurs);
    if (ids.length === 1 && glisse) {
      if (Math.abs(e.clientX - glisse.x0) + Math.abs(e.clientY - glisse.y0) > 4) { glisse.bouge = true; vue.classList.add("deplace"); }
      if (glisse.bouge) { tx += e.clientX - prec.x; ty += e.clientY - prec.y; borner(); appliquer(); }
    } else if (ids.length === 2 && pincement) {
      var a = pointeurs[ids[0]], b = pointeurs[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y), r = vue.getBoundingClientRect();
      zoomerAutour((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, d / pincement);
      pincement = d;
    }
  });
  function finGeste(e) {
    if (!pointeurs[e.pointerId]) return;
    delete pointeurs[e.pointerId];
    if (Object.keys(pointeurs).length < 2) pincement = null;
    if (glisse && !glisse.bouge && e.type === "pointerup") {
      var zr = royaumeSous(e);
      if (zr) choisirRoyaume(zr.id); else if (EDITION) coordonnees(e);
    }
    if (!Object.keys(pointeurs).length) { glisse = null; vue.classList.remove("deplace"); }
  }
  vue.addEventListener("pointerup", finGeste);
  vue.addEventListener("mousemove", function (e) {
    if (!zonesVisibles || glisse) return;
    var zr = royaumeSous(e);
    Object.keys(zones).forEach(function (k) { zones[k].classList.toggle("survol", !!zr && zr.id === k); });
    vue.classList.toggle("sur-territoire", !!zr);
  });
  vue.addEventListener("mouseleave", function () {
    Object.keys(zones).forEach(function (k) { zones[k].classList.remove("survol"); });
    vue.classList.remove("sur-territoire");
  });
  vue.addEventListener("pointercancel", finGeste);
  vue.addEventListener("dblclick", function (e) {
    if (e.target.closest(".cm-repere")) return;
    var p = relatif(e); zoomerAutour(p.x, p.y, 1.8, 250);
  });
  vue.addEventListener("wheel", function (e) {
    if (!(e.ctrlKey || actif || document.fullscreenElement === racine || racine.classList.contains("cm-plein"))) {
      montrerAstuce("Ctrl + molette pour zoomer (ou cliquez d'abord sur la carte)");
      return;
    }
    e.preventDefault();
    var p = relatif(e);
    zoomerAutour(p.x, p.y, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)));
  }, { passive: false });
  document.addEventListener("pointerdown", function (e) { if (!racine.contains(e.target)) actif = false; });

  vue.addEventListener("keydown", function (e) {
    var pas = 70, k = e.key;
    if (k === "ArrowLeft") tx += pas; else if (k === "ArrowRight") tx -= pas;
    else if (k === "ArrowUp") ty += pas; else if (k === "ArrowDown") ty -= pas;
    else if (k === "+" || k === "=") { zoomerAutour(vw / 2, vh / 2, 1.3, 150); return; }
    else if (k === "-" || k === "_") { zoomerAutour(vw / 2, vh / 2, 1 / 1.3, 150); return; }
    else if (k === "0") { toutVoir(300); return; }
    else if (k === "Escape") { if (selection) fermerFiche(); return; }
    else return;
    e.preventDefault(); borner(); appliquer();
  });
  bPlus.addEventListener("click", function () { zoomerAutour(vw / 2, vh / 2, 1.5, 250); });
  bMoins.addEventListener("click", function () { zoomerAutour(vw / 2, vh / 2, 1 / 1.5, 250); });
  bFit.addEventListener("click", function () { toutVoir(350); });

  /* ---------- plein écran ---------- */
  // Plein écran natif si possible ; sinon (ex. iPhone) la carte est sortie de la page et couvre tout l'écran.
  var repere = null;
  function entrerPleinSecours() {
    repere = document.createComment("carte");
    racine.parentNode.insertBefore(repere, racine);
    document.body.appendChild(racine);
    racine.classList.add("cm-plein");
    redimensionner();
  }
  function sortirPleinSecours() {
    racine.classList.remove("cm-plein");
    if (repere && repere.parentNode) { repere.parentNode.insertBefore(racine, repere); repere.parentNode.removeChild(repere); }
    repere = null;
    redimensionner();
  }
  bPlein.addEventListener("click", function () {
    if (document.fullscreenElement === racine) { document.exitFullscreen(); return; }
    if (racine.classList.contains("cm-plein")) { sortirPleinSecours(); return; }
    if (racine.requestFullscreen) racine.requestFullscreen().catch(entrerPleinSecours);
    else entrerPleinSecours();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && racine.classList.contains("cm-plein")) sortirPleinSecours();
  });
  document.addEventListener("fullscreenchange", function () { setTimeout(redimensionner, 60); });

  function redimensionner() {
    var cx = vw ? (vw / 2 - tx) / s : 0, cy = vh ? (vh / 2 - ty) / s : 0, avait = vw > 0;
    mesurer();
    calculerBornes();
    if (!avait) { toutVoir(0); return; }
    s = bornes(s, sMin, sMax);
    tx = vw / 2 - cx * s; ty = vh / 2 - cy * s;
    borner(); appliquer();
  }
  if (window.ResizeObserver) new ResizeObserver(redimensionner).observe(vue);
  else window.addEventListener("resize", redimensionner);

  /* ---------- messages ---------- */
  var minuteurAstuce = null;
  function montrerAstuce(txt) {
    astuce.textContent = txt;
    astuce.classList.add("visible");
    clearTimeout(minuteurAstuce);
    minuteurAstuce = setTimeout(function () { astuce.classList.remove("visible"); }, 2200);
  }
  function coordonnees(e) {
    var p = relatif(e);
    var x = ((p.x - tx) / (W * s)) * 100, y = ((p.y - ty) / (H * s)) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    var txt = '"x": ' + x.toFixed(1) + ', "y": ' + y.toFixed(1);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).catch(function () {});
    montrerAstuce("Coordonnées copiées : " + txt);
  }
  if (EDITION) racine.classList.add("cm-edition");

  /* ---------- lien direct (#lieu=…) ---------- */
  function depuisAdresse() {
    var m = /#lieu=([\w-]+)/.exec(location.hash);
    if (m && parId[m[1]] && selection !== m[1]) choisir(m[1], { instantane: true });
    var z = /#royaume=([\w-]+)/.exec(location.hash);
    if (z && parRoyaume[z[1]] && royaumeChoisi !== z[1]) choisirRoyaume(z[1], { instantane: true });
  }
  window.addEventListener("hashchange", depuisAdresse);

  /* ---------- démarrage ---------- */
  mesurer();
  changerCarte(data.cartes[0].id, true, function () {
    depuisAdresse();
    if (EDITION) montrerAstuce("Mode édition : cliquez sur la carte pour copier des coordonnées");
  });
})();
