// Recherche par mot-clé sur tout le site (page /recherche/).
// L'index (assets/search-index.json) est chargé uniquement sur cette page ; la recherche se fait dans le navigateur.
(function () {
  "use strict";
  var zone = document.getElementById("recherche");
  if (!zone) return;
  var champ = document.getElementById("recherche-q");
  var sortie = document.getElementById("recherche-resultats");
  var etat = document.getElementById("recherche-etat");
  var PAR_PAGE = 20;
  var index = null, chargement = null, derniere = "", affiches = PAR_PAGE, resultats = [], mots = [];

  // Minuscules et sans accents, en gardant exactement la même longueur (pour retrouver les positions dans le texte d'origine).
  function plat(s) {
    return String(s || "").toLowerCase().replace(/[À-ſ]/g, function (c) {
      var d = c.normalize ? c.normalize("NFD").charAt(0) : c;
      if (c === "œ" || c === "æ") return "o";
      return d && d.charCodeAt(0) < 128 ? d : c;
    });
  }
  function jetons(q) {
    return plat(q).split(/[^a-z0-9']+/).map(function (m) { return m.replace(/^'+|'+$/g, ""); }).filter(function (m) { return m.length >= 2; });
  }
  function charger() {
    if (index) return Promise.resolve(index);
    if (chargement) return chargement;
    etat.textContent = "Chargement de l'index de recherche…";
    chargement = fetch(zone.getAttribute("data-index")).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (d) {
      index = d.pages.map(function (p) {
        return { u: p[0], t: p[1], d: p[2], x: p[3], k: p[4], tp: plat(p[1]), dp: plat(p[2]), xp: plat(p[3]) };
      });
      return index;
    });
    return chargement;
  }
  function compter(hay, m, plafond) {
    var n = 0, i = hay.indexOf(m);
    while (i !== -1 && n < plafond) { n++; i = hay.indexOf(m, i + m.length); }
    return n;
  }
  function chercher(q) {
    mots = jetons(q);
    var phrase = plat(q).replace(/\s+/g, " ").trim();
    var out = [];
    index.forEach(function (p) {
      var score = 0;
      for (var i = 0; i < mots.length; i++) {
        var m = mots[i], a = compter(p.tp, m, 3), b = compter(p.dp, m, 3), c = compter(p.xp, m, 12);
        if (!a && !b && !c) return;                       // tous les mots doivent être présents
        score += a * 12 + b * 5 + c;
      }
      if (mots.length > 1 && (p.tp.indexOf(phrase) !== -1 || p.xp.indexOf(phrase) !== -1)) score += 15;
      if (p.tp === phrase) score += 40;
      out.push({ p: p, s: score });
    });
    out.sort(function (a, b) { return b.s - a.s || a.p.t.localeCompare(b.p.t, "fr"); });
    return out;
  }
  function extrait(p) {
    var pos = -1, i, t;
    for (i = 0; i < mots.length; i++) { t = p.xp.indexOf(mots[i]); if (t !== -1 && (pos === -1 || t < pos)) pos = t; }
    if (pos === -1) return { txt: p.d || p.x.slice(0, 200), debut: 0 };
    var a = Math.max(0, pos - 70), b = Math.min(p.x.length, pos + 190);
    if (a > 0) { var e = p.x.indexOf(" ", a); if (e !== -1 && e < pos) a = e + 1; }
    return { txt: (a > 0 ? "… " : "") + p.x.slice(a, b) + (b < p.x.length ? " …" : ""), debut: a > 0 ? 2 : 0, base: a };
  }
  function surligner(el, texte) {
    var pl = plat(texte), marques = [];
    mots.forEach(function (m) {
      var i = pl.indexOf(m);
      while (i !== -1) { marques.push([i, i + m.length]); i = pl.indexOf(m, i + m.length); }
    });
    marques.sort(function (a, b) { return a[0] - b[0]; });
    var pos = 0;
    marques.forEach(function (r) {
      if (r[0] < pos) return;
      if (r[0] > pos) el.appendChild(document.createTextNode(texte.slice(pos, r[0])));
      var mk = document.createElement("mark");
      mk.textContent = texte.slice(r[0], r[1]);
      el.appendChild(mk);
      pos = r[1];
    });
    if (pos < texte.length) el.appendChild(document.createTextNode(texte.slice(pos)));
  }
  function afficher() {
    sortie.innerHTML = "";
    var lot = resultats.slice(0, affiches);
    lot.forEach(function (r) {
      var li = document.createElement("li");
      li.className = "rech-resultat";
      var lien = document.createElement("a");
      lien.href = r.p.u;
      surligner(lien, r.p.t);
      var type = document.createElement("span");
      type.className = "rech-type";
      type.textContent = r.p.k;
      var titre = document.createElement("h2");
      titre.appendChild(lien);
      titre.appendChild(type);
      var ex = extrait(r.p), para = document.createElement("p");
      para.className = "rech-extrait";
      surligner(para, ex.txt);
      var adr = document.createElement("span");
      adr.className = "rech-adresse";
      adr.textContent = decodeURI(r.p.u);
      li.appendChild(titre); li.appendChild(para); li.appendChild(adr);
      sortie.appendChild(li);
    });
    var reste = resultats.length - lot.length;
    var plus = document.getElementById("recherche-plus");
    plus.hidden = reste <= 0;
    plus.textContent = "Afficher " + Math.min(PAR_PAGE, reste) + " résultats de plus (" + reste + " restants)";
  }
  function lancer(q, pousser) {
    q = q.trim();
    derniere = q;
    if (pousser) { try { history.replaceState(null, "", q ? "?q=" + encodeURIComponent(q) : location.pathname); } catch (e) { /* ignoré */ } }
    if (jetons(q).length === 0) {
      resultats = []; afficher();
      etat.textContent = q ? "Saisissez au moins un mot de 2 lettres." : "Saisissez un ou plusieurs mots-clés : les pages qui les contiennent tous s'affichent.";
      return;
    }
    charger().then(function () {
      if (q !== derniere) return;
      resultats = chercher(q);
      affiches = PAR_PAGE;
      afficher();
      etat.textContent = resultats.length === 0 ? "Aucun résultat pour « " + q + " ». Essayez un mot plus court ou une autre orthographe."
        : resultats.length + (resultats.length > 1 ? " pages trouvées" : " page trouvée") + " pour « " + q + " »";
    }).catch(function () {
      etat.textContent = "La recherche est momentanément indisponible. Vous pouvez réessayer plus tard ou utiliser le menu.";
    });
  }
  var minuteur = null;
  champ.addEventListener("input", function () { clearTimeout(minuteur); minuteur = setTimeout(function () { lancer(champ.value, true); }, 220); });
  document.getElementById("recherche-form").addEventListener("submit", function (e) { e.preventDefault(); lancer(champ.value, true); });
  document.getElementById("recherche-plus").addEventListener("click", function () { affiches += PAR_PAGE; afficher(); });

  var m = /[?&]q=([^&]*)/.exec(location.search);
  if (m) { try { champ.value = decodeURIComponent(m[1].replace(/\+/g, " ")); } catch (e) { champ.value = m[1]; } }
  champ.focus();
  if (champ.value) lancer(champ.value, false); else lancer("", false);
})();
