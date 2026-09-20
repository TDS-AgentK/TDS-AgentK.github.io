/* Calendrier : date en jeu d'aujourd'hui + convertisseur date réelle <-> date en jeu.
   Les noms des mois, des jours et des saisons sont lus dans les tableaux de la page (attributs data-m, data-j, data-mois) :
   pour corriger une correspondance, il suffit de modifier content/calendrier.html.
   Le décalage d'années (769) se règle dans l'attribut data-decalage de la section #date-jeu. */
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

  // ---- construction de l'interface -----------------------------------------------------------------
  var haut = el("div", { "class": "dj-aujourdhui", "aria-live": "polite" });
  var etiquette = el("p", { "class": "dj-etiquette" }, "Aujourd'hui, à Vesperae");
  var dateJeu = el("p", { "class": "dj-date" });
  var lignes = el("p", { "class": "dj-details" });
  var reel = el("p", { "class": "dj-reel" });
  [etiquette, dateJeu, lignes, reel].forEach(function (x) { haut.appendChild(x); });

  var outils = el("div", { "class": "dj-outils" });

  // sens 1 : date réelle -> date en jeu
  var f1 = el("form", { "class": "dj-conv", "aria-labelledby": "dj-t1" });
  f1.appendChild(el("h3", { id: "dj-t1" }, "Date réelle → date en jeu"));
  var l1 = el("label", null, "Date réelle ");
  var champReel = el("input", { type: "date", required: "required" });
  l1.appendChild(champReel);
  var res1 = el("output", { "class": "dj-resultat", "aria-live": "polite" });
  f1.appendChild(l1); f1.appendChild(res1);

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
  [l2a, l2b, l2c, res2].forEach(function (x) { f2.appendChild(x); });

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
  }
  function majSens2() {
    var j = parseInt(champJour.value, 10), m = parseInt(champMois.value, 10), a = parseInt(champAnnee.value, 10);
    if (!(j >= 1) || isNaN(a)) { res2.textContent = "Indiquez un jour et une année."; return; }
    var reelle = new Date(a + decalage, m - 1, j);
    if (reelle.getMonth() !== m - 1 || reelle.getDate() !== j) { res2.textContent = "Cette date n'existe pas : " + mois[m].nom + " n'a pas " + j + " jours cette année-là."; return; }
    res2.textContent = "Date réelle : " + texteReel(reelle) + " (" + jours[reelle.getDay() || 7] + ")";
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
  [champReel].forEach(function (c) { c.addEventListener("input", majSens1); });
  [champJour, champMois, champAnnee].forEach(function (c) { c.addEventListener("input", majSens2); });
  f1.addEventListener("submit", function (e) { e.preventDefault(); });
  f2.addEventListener("submit", function (e) { e.preventDefault(); });
})();
