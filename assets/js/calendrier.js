/* Calendrier : date en jeu d'aujourd'hui + convertisseur date réelle <-> date en jeu + les deux lunes (Davos et Amarante).
   Les noms des mois, des jours et des saisons sont lus dans les tableaux de la page (attributs data-m, data-j, data-mois) :
   pour corriger une correspondance, il suffit de modifier content/calendrier.html.
   Le décalage d'années (769) se règle dans l'attribut data-decalage de la section #date-jeu.
   Lunes : calcul repris de « Chroniques du Temps » (mêmes formules, mêmes images) ; les phases et les images sont dans
   data/lunes.json (injecté dans la page par build.py) ; les images sont dans assets/img/lunes/. */
(function () {
  var racine = document.getElementById("date-jeu");
  if (!racine) return;
  var decalage = parseInt(racine.getAttribute("data-decalage"), 10) || 769;

  var mois = [], jours = [], saisons = [];
  Array.prototype.forEach.call(document.querySelectorAll(".cal-bloc [data-m]"), function (li) {
    var num = parseInt(li.getAttribute("data-m"), 10);
    mois[num] = { nom: li.querySelector("strong").textContent.replace(/[\s:]+$/, ""), signe: li.getAttribute("data-signe") || "", lien: "/mythes/#" + li.id.replace("mois-", ""),
                  reel: li.childNodes[1] ? li.childNodes[1].textContent.trim() : "" };
  });
  Array.prototype.forEach.call(document.querySelectorAll(".cal-bloc [data-j]"), function (li) {
    jours[parseInt(li.getAttribute("data-j"), 10)] = li.querySelector("strong").textContent.replace(/[\s:]+$/, "");
  });
  Array.prototype.forEach.call(document.querySelectorAll(".cal-bloc [data-mois]"), function (li) {
    saisons.push({ nom: li.querySelector("strong").textContent.replace(/[\s:]+$/, ""), reel: li.textContent.replace(/^[^:]*:/, "").trim().toLowerCase(),
                   mois: li.getAttribute("data-mois").split(",").map(Number) });
  });
  if (mois.length < 13 || jours.length < 8) return;                 // tableaux introuvables : on n'affiche rien

  function saisonDuMois(m) {
    for (var i = 0; i < saisons.length; i++) if (saisons[i].mois.indexOf(m) >= 0) return saisons[i];
    return null;
  }
  function el(tag, attrs, texte) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (texte != null) e.textContent = texte;
    return e;
  }
  function quantieme(n) { return n === 1 ? "1er" : String(n); }
  function enJeu(d) {                                                // d : Date locale
    return { jour: d.getDate(), mois: d.getMonth() + 1, annee: d.getFullYear() - decalage, semaine: d.getDay() || 7 };
  }
  function texteJeu(j) { return jours[j.semaine] + " " + quantieme(j.jour) + " " + mois[j.mois].nom + " " + j.annee; }
  function texteReel(d) {
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
  function details(j) {
    var s = saisonDuMois(j.mois), morceaux = [];
    if (s) morceaux.push("Saison de " + s.nom + " (" + s.reel + ")");
    if (mois[j.mois].signe) morceaux.push("mois du signe " + mois[j.mois].signe);
    return morceaux.join(" · ");
  }

  // ---- lunes -----------------------------------------------------------------------------------------
  var lunesData = null;
  try { lunesData = JSON.parse(document.getElementById("donnees-lunes").textContent); } catch (e) { lunesData = null; }
  function pourcent(l, n) { return (Math.sin((n + 1) * l.facteur * Math.PI / l.periode) + 1) / 2 * 100; }
  function phaseDe(actuel, prec, suiv) {
    if (actuel < 6) return "Nouvelle lune";
    if (actuel > 95) return "Pleine lune";
    if (actuel > prec && actuel < suiv) return "Phase croissante";
    if (actuel < prec && actuel > suiv) return "Phase décroissante";
    return "Phase inconnue";
  }
  function imageLune(l, phase, pct) {
    if (phase === "Nouvelle lune") return l.nouvelle;
    if (phase === "Pleine lune") return l.pleine;
    var table = phase === "Phase décroissante" ? l.decroissante : l.croissante, url = "";
    table.forEach(function (i) { if (pct >= i[0] && pct < i[1]) url = i[2]; });
    return url;
  }
  // Comme sur Chroniques du Temps : seul le mois et le jour comptent (année fixée à 1255), le jour lunaire est compté depuis le 1er janvier -7000.
  function jourLunaire(mois, jour) { return Math.floor((Date.UTC(1255, mois - 1, jour) - Date.UTC(-7000, 0, 1)) / 86400000); }
  function lunes(mois, jour) {
    if (!lunesData) return [];
    var n = jourLunaire(mois, jour);
    return Object.keys(lunesData).map(function (nom) {
      var l = lunesData[nom], p = pourcent(l, n), phase = phaseDe(p, pourcent(l, n - 1), pourcent(l, n + 1));
      return { nom: nom, pct: p, phase: phase, image: imageLune(l, phase, p) };
    });
  }
  function pctTexte(p) { return p.toFixed(1).replace(".", ",") + " %"; }
  function texteLunes(mois, jour) {
    return lunes(mois, jour).map(function (x) { return x.nom + " " + pctTexte(x.pct) + " (" + x.phase.toLowerCase() + ")"; }).join(" · ");
  }

  // ---- construction de l'interface -----------------------------------------------------------------
  var haut = el("div", { "class": "dj-aujourdhui", "aria-live": "polite" });
  var etiquette = el("p", { "class": "dj-etiquette" }, "Aujourd'hui, à Vesperae");
  var dateJeu = el("p", { "class": "dj-date" });
  var lignes = el("p", { "class": "dj-details" });
  var reel = el("p", { "class": "dj-reel" });
  [etiquette, dateJeu, lignes, reel].forEach(function (x) { haut.appendChild(x); });
  var blocLunes = el("div", { "class": "dj-lunes", "aria-label": "Les deux lunes de Vesperae" });
  haut.appendChild(blocLunes);
  var jourLun = el("p", { "class": "dj-jourlunaire" });
  haut.appendChild(jourLun);

  var outils = el("div", { "class": "dj-outils" });

  // sens 1 : date réelle -> date en jeu
  var f1 = el("form", { "class": "dj-conv", "aria-labelledby": "dj-t1" });
  f1.appendChild(el("h3", { id: "dj-t1" }, "Date réelle → date en jeu"));
  var l1 = el("label", null, "Date réelle ");
  var champReel = el("input", { type: "date", required: "required" });
  l1.appendChild(champReel);
  var res1 = el("output", { "class": "dj-resultat", "aria-live": "polite" });
  var lunes1 = el("p", { "class": "dj-lunes-ligne" });
  f1.appendChild(l1); f1.appendChild(res1); f1.appendChild(lunes1);

  // sens 2 : date en jeu -> date réelle
  var f2 = el("form", { "class": "dj-conv", "aria-labelledby": "dj-t2" });
  f2.appendChild(el("h3", { id: "dj-t2" }, "Date en jeu → date réelle"));
  var l2a = el("label", null, "Jour ");
  var champJour = el("input", { type: "number", min: "1", max: "31", inputmode: "numeric", required: "required" });
  l2a.appendChild(champJour);
  var l2b = el("label", null, "Mois ");
  var champMois = el("select");
  for (var m = 1; m <= 12; m++) champMois.appendChild(el("option", { value: m }, mois[m].nom + " (" + mois[m].reel.toLowerCase() + ")"));
  l2b.appendChild(champMois);
  var l2c = el("label", null, "Année ");
  var champAnnee = el("input", { type: "number", inputmode: "numeric", required: "required" });
  l2c.appendChild(champAnnee);
  var res2 = el("output", { "class": "dj-resultat", "aria-live": "polite" });
  var lunes2 = el("p", { "class": "dj-lunes-ligne" });
  [l2a, l2b, l2c, res2, lunes2].forEach(function (x) { f2.appendChild(x); });

  outils.appendChild(f1); outils.appendChild(f2);
  racine.insertBefore(haut, racine.querySelector(".dj-principe"));
  racine.appendChild(outils);

  // ---- calculs ---------------------------------------------------------------------------------------
  function lireDateReelle(valeur) {                                   // "2026-09-20" -> Date locale (sans décalage de fuseau)
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valeur || "");
    if (!p) return null;
    var d = new Date(+p[1], +p[2] - 1, +p[3]);
    return d.getFullYear() === +p[1] && d.getMonth() === +p[2] - 1 && d.getDate() === +p[3] ? d : null;
  }
  function majSens1() {
    var d = lireDateReelle(champReel.value);
    res1.textContent = d ? "En Vesperae : " + texteJeu(enJeu(d)) : "Choisissez une date valide.";
    lunes1.textContent = d && lunesData ? "Lunes ce jour-là : " + texteLunes(d.getMonth() + 1, d.getDate()) : "";
  }
  function majSens2() {
    var j = parseInt(champJour.value, 10), m = parseInt(champMois.value, 10), a = parseInt(champAnnee.value, 10);
    lunes2.textContent = "";
    if (!(j >= 1) || isNaN(a)) { res2.textContent = "Indiquez un jour et une année."; return; }
    var reelle = new Date(a + decalage, m - 1, j);
    if (reelle.getMonth() !== m - 1 || reelle.getDate() !== j) { res2.textContent = "Cette date n'existe pas : " + mois[m].nom + " n'a pas " + j + " jours cette année-là."; return; }
    res2.textContent = "Date réelle : " + texteReel(reelle) + " (" + jours[reelle.getDay() || 7] + ")";
    if (lunesData) lunes2.textContent = "Lunes ce jour-là : " + texteLunes(reelle.getMonth() + 1, reelle.getDate());
  }

  var auj = new Date();
  var j0 = enJeu(auj);
  dateJeu.textContent = texteJeu(j0);
  lignes.textContent = details(j0);
  reel.textContent = "Nous sommes le " + texteReel(auj) + ".";
  var iso = auj.getFullYear() + "-" + ("0" + (auj.getMonth() + 1)).slice(-2) + "-" + ("0" + auj.getDate()).slice(-2);
  champReel.value = iso;
  champJour.value = j0.jour; champMois.value = j0.mois; champAnnee.value = j0.annee;
  majSens1(); majSens2();
  if (lunesData) jourLun.textContent = "Jour lunaire n° " + jourLunaire(auj.getUTCMonth() + 1, auj.getUTCDate()).toLocaleString("fr-FR");
  lunes(auj.getUTCMonth() + 1, auj.getUTCDate()).forEach(function (x) {
    var fig = el("figure", { "class": "dj-lune" });
    if (x.image) fig.appendChild(el("img", { src: x.image, alt: "Lune " + x.nom + " : " + pctTexte(x.pct) + ", " + x.phase.toLowerCase(), width: "128", height: "130", loading: "lazy" }));
    var leg = el("figcaption");
    leg.appendChild(el("strong", null, x.nom));
    leg.appendChild(el("span", { "class": "dj-lune-pct" }, pctTexte(x.pct)));
    leg.appendChild(el("span", { "class": "dj-lune-phase" }, x.phase));
    fig.appendChild(leg);
    blocLunes.appendChild(fig);
  });
  [champReel].forEach(function (c) { c.addEventListener("input", majSens1); });
  [champJour, champMois, champAnnee].forEach(function (c) { c.addEventListener("input", majSens2); });
  f1.addEventListener("submit", function (e) { e.preventDefault(); });
  f2.addEventListener("submit", function (e) { e.preventDefault(); });

  // ---- calendrier lunaire (fenêtre) --------------------------------------------------------------------
  // Prochaines « conjonctions » des deux lunes (double pleine lune, double nouvelle lune, nouvelle + pleine dans les deux sens)
  // et vue mois par mois. Mêmes règles que les lunes du haut de page : pleine lune au-dessus de 95 %, nouvelle lune sous 6 %.
  if (lunesData) {
    var TYPES = [
      { cle: "pp", titre: "Double pleine lune", detail: "Davos et Amarante sont pleines le même jour", a: "P", b: "P" },
      { cle: "nn", titre: "Double nouvelle lune", detail: "Davos et Amarante sont nouvelles le même jour", a: "N", b: "N" },
      { cle: "np", titre: "Davos nouvelle · Amarante pleine", detail: "Davos disparaît pendant qu'Amarante brille", a: "N", b: "P" },
      { cle: "pn", titre: "Davos pleine · Amarante nouvelle", detail: "Davos brille pendant qu'Amarante disparaît", a: "P", b: "N" }
    ];
    function codePhase(x) { return x.phase === "Pleine lune" ? "P" : x.phase === "Nouvelle lune" ? "N" : ""; }
    function lunesDuJour(d) {
      var l = lunes(d.getMonth() + 1, d.getDate()), r = {};
      l.forEach(function (x) { r[x.nom] = x; });
      return r;
    }
    function typeDuJour(d) {
      var r = lunesDuJour(d), a = r.Davos ? codePhase(r.Davos) : "", b = r.Amarante ? codePhase(r.Amarante) : "";
      for (var i = 0; i < TYPES.length; i++) if (TYPES[i].a === a && TYPES[i].b === b) return TYPES[i].cle;
      return "";
    }
    function midi(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); }
    function ajouterJours(d, n) { var x = midi(d); x.setDate(x.getDate() + n); return x; }
    function dateCourte(d) { return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); }
    function plage(deb, fin) {
      if (deb.getTime() === fin.getTime()) return dateCourte(deb);
      if (deb.getMonth() === fin.getMonth() && deb.getFullYear() === fin.getFullYear())
        return "du " + deb.getDate() + " au " + fin.getDate() + " " + fin.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      return "du " + dateCourte(deb) + " au " + dateCourte(fin);
    }
    function plageJeu(deb, fin) {
      var a = enJeu(deb), b = enJeu(fin);
      if (deb.getTime() === fin.getTime()) return quantieme(a.jour) + " " + mois[a.mois].nom + " " + a.annee;
      return quantieme(a.jour) + " " + mois[a.mois].nom + " " + a.annee + " → " + quantieme(b.jour) + " " + mois[b.mois].nom + " " + b.annee;
    }
    function prochaines(aujourdhui) {
      var res = {};
      TYPES.forEach(function (ty) { res[ty.cle] = []; });
      var courant = null;
      for (var i = 0; i <= 800; i++) {
        var d = ajouterJours(aujourdhui, i), ty = typeDuJour(d);
        if (courant && courant.cle === ty && courant.fin.getTime() === ajouterJours(d, -1).getTime()) { courant.fin = d; continue; }
        courant = ty ? { cle: ty, debut: d, fin: d } : null;
        if (courant) res[ty].push(courant);
      }
      return res;
    }

    var dlg = el("dialog", { "class": "lune-dialog", "aria-labelledby": "ld-titre" });
    var fermer = el("button", { type: "button", "class": "ld-fermer", "aria-label": "Fermer" }, "×");
    var titreD = el("h2", { id: "ld-titre" }, "Calendrier lunaire");
    var onglets = el("div", { "class": "ld-onglets", role: "tablist" });
    var oListe = el("button", { type: "button", role: "tab", "aria-selected": "true" }, "Prochaines conjonctions");
    var oMois = el("button", { type: "button", role: "tab", "aria-selected": "false" }, "Mois par mois");
    onglets.appendChild(oListe); onglets.appendChild(oMois);
    var pListe = el("div", { "class": "ld-panneau" });
    var pMois = el("div", { "class": "ld-panneau", hidden: "hidden" });
    [fermer, titreD, onglets, pListe, pMois].forEach(function (x) { dlg.appendChild(x); });
    document.body.appendChild(dlg);

    function afficherOnglet(liste) {
      oListe.setAttribute("aria-selected", liste ? "true" : "false");
      oMois.setAttribute("aria-selected", liste ? "false" : "true");
      pListe.hidden = !liste; pMois.hidden = liste;
    }
    oListe.addEventListener("click", function () { afficherOnglet(true); });
    oMois.addEventListener("click", function () { afficherOnglet(false); });
    fermer.addEventListener("click", function () { dlg.close ? dlg.close() : dlg.removeAttribute("open"); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg && dlg.close) dlg.close(); });

    // -- liste des prochaines conjonctions
    function remplirListe() {
      pListe.innerHTML = "";
      var auj0 = midi(new Date()), res = prochaines(auj0);
      pListe.appendChild(el("p", { "class": "ld-intro" }, "À partir d'aujourd'hui (" + dateCourte(auj0) + "). Comme sur Chroniques du Temps, les phases se répètent à l'identique chaque année."));
      TYPES.forEach(function (ty) {
        var bloc = el("section", { "class": "ld-type ld-" + ty.cle });
        bloc.appendChild(el("h3", null, ty.titre));
        bloc.appendChild(el("p", { "class": "ld-detail" }, ty.detail));
        var ul = el("ul");
        res[ty.cle].slice(0, 4).forEach(function (r) {
          var jours0 = Math.round((r.debut.getTime() - auj0.getTime()) / 86400000);
          var li = el("li");
          li.appendChild(el("strong", null, plage(r.debut, r.fin)));
          li.appendChild(el("span", { "class": "ld-jeu" }, plageJeu(r.debut, r.fin)));
          li.appendChild(el("em", null, jours0 === 0 ? "aujourd'hui" : jours0 === 1 ? "demain" : "dans " + jours0 + " jours"));
          ul.appendChild(li);
        });
        if (!res[ty.cle].length) ul.appendChild(el("li", null, "Aucune dans les deux prochaines années."));
        bloc.appendChild(ul);
        pListe.appendChild(bloc);
      });
    }

    // -- vue mois par mois
    var moisAffiche = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    function remplirMois() {
      pMois.innerHTML = "";
      var an = moisAffiche.getFullYear(), m = moisAffiche.getMonth();
      var nav = el("div", { "class": "ld-nav" });
      var prec = el("button", { type: "button", "aria-label": "Mois précédent" }, "◂");
      var suiv = el("button", { type: "button", "aria-label": "Mois suivant" }, "▸");
      var enTete = el("p", { "class": "ld-mois-titre" });
      var gj = enJeu(new Date(an, m, 15));
      enTete.appendChild(el("strong", null, moisAffiche.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })));
      enTete.appendChild(el("span", null, mois[gj.mois].nom + " " + gj.annee));
      prec.addEventListener("click", function () { moisAffiche = new Date(an, m - 1, 1); remplirMois(); });
      suiv.addEventListener("click", function () { moisAffiche = new Date(an, m + 1, 1); remplirMois(); });
      nav.appendChild(prec); nav.appendChild(enTete); nav.appendChild(suiv);
      pMois.appendChild(nav);
      var grille = el("div", { "class": "ld-grille", role: "grid" });
      for (var k = 1; k <= 7; k++) grille.appendChild(el("span", { "class": "ld-jour-nom" }, jours[k]));
      var premier = new Date(an, m, 1), decal = (premier.getDay() || 7) - 1, nb = new Date(an, m + 1, 0).getDate();
      for (var v = 0; v < decal; v++) grille.appendChild(el("span", { "class": "ld-vide" }));
      var aujourdhui0 = midi(new Date());
      for (var j = 1; j <= nb; j++) {
        var d = new Date(an, m, j, 12), r = lunesDuJour(d), ty = typeDuJour(d);
        var cell = el("div", { "class": "ld-case" + (ty ? " ld-" + ty : "") + (d.getTime() === aujourdhui0.getTime() ? " ld-auj" : ""), role: "gridcell" });
        cell.appendChild(el("b", null, String(j)));
        var lunesCell = el("span", { "class": "ld-lunes" });
        ["Davos", "Amarante"].forEach(function (nom) {
          if (!r[nom]) return;
          lunesCell.appendChild(el("img", { src: r[nom].image, alt: nom + " " + pctTexte(r[nom].pct) + " (" + r[nom].phase.toLowerCase() + ")", title: nom + " : " + pctTexte(r[nom].pct) + " · " + r[nom].phase, width: "22", height: "22", loading: "lazy" }));
        });
        cell.appendChild(lunesCell);
        if (ty) cell.setAttribute("title", TYPES.filter(function (x) { return x.cle === ty; })[0].titre);
        grille.appendChild(cell);
      }
      pMois.appendChild(grille);
      var leg = el("ul", { "class": "ld-legende" });
      TYPES.forEach(function (ty) { var li = el("li"); li.appendChild(el("i", { "class": "ld-pastille ld-" + ty.cle })); li.appendChild(document.createTextNode(ty.titre)); leg.appendChild(li); });
      pMois.appendChild(leg);
    }

    var ouvrir = el("button", { type: "button", "class": "dj-bouton-lunes" }, "Calendrier lunaire : prochaines conjonctions");
    ouvrir.addEventListener("click", function () {
      remplirListe(); remplirMois(); afficherOnglet(true);
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "open");
    });
    haut.appendChild(ouvrir);
  }
})();
