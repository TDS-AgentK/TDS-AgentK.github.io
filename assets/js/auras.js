/* Auras et énergies : choisir un courant pour retrouver tous ses ressentis (toucher, goût/odorat, vue, ouïe, sixième sens).
   Les textes viennent de la page elle-même (lus par build.py) : pour les modifier, corrigez la page « auras-et-énergies ». */
(function () {
  var racine = document.querySelector("[data-auras]");
  var brut = document.getElementById("donnees-auras");
  if (!racine || !brut) return;
  var DATA;
  try { DATA = JSON.parse(brut.textContent); } catch (e) { return; }
  var choix = racine.querySelector(".auras-choix");
  var resultat = racine.querySelector(".auras-resultat");

  // ---- outils ------------------------------------------------------------------------------------------------
  function el(tag, attrs, contenu) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) { if (k === "class") e.className = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (contenu != null) (Array.isArray(contenu) ? contenu : [contenu]).forEach(function (c) { if (c != null) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function vider(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  // couleurs citées dans le paragraphe « La vue » : petites pastilles (lecture des mots de couleur du texte)
  var COULEURS = [
    ["arc-en-ciel", "linear-gradient(90deg,#e74c3c,#f1c40f,#2ecc71,#3498db,#9b59b6)"], ["orange brûlé", "#cc5500"], ["bleu azur", "#3a9be0"],
    ["bleu glace", "#a9dcf5"], ["rouge", "#c0392b"], ["jaune", "#f1c40f"], ["gris", "#8a8f98"], ["brun", "#7a5230"], ["violet", "#7b3fb0"],
    ["argenté", "#c4c8cc"], ["orangé", "#e8801f"], ["vert", "#3f9b4b"], ["corail", "#ff7f6e"], ["tangerine", "#f28500"], ["bis", "#c9b08a"],
    ["cuivre", "#b87333"], ["melon", "#f8b878"], ["saumon", "#fa8072"], ["aubergine", "#5a2a4f"], ["rose", "#f2a7c3"], ["lavande", "#b9a4e3"],
    ["améthyste", "#9966cc"], ["héliotrope", "#df73ff"], ["mauve", "#b784d4"], ["ardoise", "#5c6b7a"], ["doré", "#d4a017"],
    ["blanc", "#f4f4f4"], ["noir", "#1a1a1a"], ["bordeaux", "#6d1a2a"]
  ];
  function teintes(texte) {
    var debut = texte.split(/[.;]/)[0].toLowerCase(), trouvees = [];
    COULEURS.forEach(function (c) {
      var m = new RegExp("(^|[^a-zà-ÿ])" + c[0] + "(s|es|é|ée|és|ées)?(?![a-zà-ÿ])").exec(debut);
      if (m) trouvees.push({ pos: m.index, nom: c[0], css: c[1] });
    });
    trouvees.sort(function (a, b) { return a.pos - b.pos; });
    return trouvees;
  }

  // ---- sélecteur de courant ----------------------------------------------------------------------------------
  var boutons = {};
  var ecoles = [];
  DATA.courants.forEach(function (c) { if (ecoles.indexOf(c.ecole) < 0) ecoles.push(c.ecole); });
  ecoles.forEach(function (ecole) {
    var ligne = el("div", { "class": "auras-ecole" }, [el("span", { "class": "auras-ecole-nom" }, ecole)]);
    DATA.courants.filter(function (c) { return c.ecole === ecole; }).forEach(function (c) {
      var b = el("button", { type: "button", "aria-pressed": "false", "data-courant": c.id }, c.nom);
      b.addEventListener("click", function () { voir(c.id, true); });
      boutons[c.id] = b;
      ligne.appendChild(b);
    });
    choix.appendChild(ligne);
  });

  function carteSens(sens, c) {
    var texte = c.ressentis[sens.id];
    if (!texte) return null;
    var carte = el("section", { "class": "auras-sens", "data-sens": sens.id }, [
      el("div", { "class": "auras-sens-tete" }, [el("span", { "class": "auras-lettre", "aria-hidden": "true" }, sens.lettre), el("h4", null, sens.nom)]),
      el("p", null, texte.charAt(0).toUpperCase() + texte.slice(1))
    ]);
    if (sens.id === "vue") {
      var t = teintes(texte);
      if (t.length) carte.appendChild(el("p", { "class": "auras-teintes", "aria-hidden": "true" }, t.map(function (x) { return el("span", { "class": "auras-teinte", title: x.nom, style: "background:" + x.css }); })));
    }
    return carte;
  }

  function voir(id, majAdresse) {
    var c = DATA.courants.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    Object.keys(boutons).forEach(function (k) { boutons[k].setAttribute("aria-pressed", k === id ? "true" : "false"); });
    vider(resultat);
    var badges = el("p", { "class": "auras-badges" }, [el("span", { "class": "auras-badge" }, c.ecole)]);
    if (c.lien) badges.appendChild(el("a", { "class": "auras-lien", href: c.lien }, c.nb_sorts ? "Voir les " + c.nb_sorts + " sorts de ce courant" : "Voir la page du courant"));
    var grille = el("div", { "class": "auras-grille" });
    DATA.sens.forEach(function (s) { var carte = carteSens(s, c); if (carte) grille.appendChild(carte); });
    var carteCourant = el("article", { "class": "auras-courant" }, [el("h3", null, c.nom), badges, grille]);
    var notes = DATA.notes[c.ecole];
    if (notes && Object.keys(notes).length) {
      var dl = el("dl");
      DATA.sens.forEach(function (s) { if (notes[s.id]) { dl.appendChild(el("dt", null, s.nom)); dl.appendChild(el("dd", null, notes[s.id])); } });
      carteCourant.appendChild(el("details", { "class": "auras-notes" }, [el("summary", null, "Ce que dit la page sur toute l'école « " + c.ecole + " »"), dl]));
    }
    resultat.appendChild(carteCourant);
    if (majAdresse && window.history && history.replaceState) { try { history.replaceState(null, "", "#courant=" + id); } catch (e) { /* adresse non modifiable */ } }
  }

  function depuisAdresse() {
    var m = /courant=([\w-]+)/.exec(location.hash || "");
    if (m && boutons[m[1]]) { voir(m[1], false); return true; }
    return false;
  }
  if (!depuisAdresse()) resultat.appendChild(el("p", { "class": "auras-vide" }, "Aucun courant choisi pour l'instant."));
  window.addEventListener("hashchange", depuisAdresse);
})();
