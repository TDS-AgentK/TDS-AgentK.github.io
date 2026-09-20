/* Économie : convertisseur de pièces, prix de référence (avec sélection et total) et propositions de nouveaux prix.
   Les données viennent de data/prix.json (voir « moderation-prix.bat » pour les modifier) ; tout le calcul se fait dans le navigateur.
   Les propositions d'un visiteur restent dans SON navigateur (localStorage) et lui sont proposées sous forme d'un code à envoyer à l'équipe. */
(function () {
  var racine = document.getElementById("economie-outils");
  var brut = document.getElementById("donnees-prix");
  if (!racine || !brut) return;
  var DATA;
  try { DATA = JSON.parse(brut.textContent); } catch (e) { return; }

  var M = DATA.monnaie;
  var CU_ARG = M.cuivre_par_argent;
  var CU_OR = M.cuivre_par_argent * M.argent_par_or;
  var G_PIECE = M.grammes_par_piece;
  var CU_JOUR = M.cuivre_par_heure * M.heures_par_jour;
  var MASSE = { g: 1, kg: 1000 };
  var CLE_LOCAL = "tds-prix-propositions";
  var ICONES = DATA.icones || { monnaie: {}, categories: {} };
  function cheminIcone(nom) { return /^[A-Za-z0-9_]{1,40}$/.test(nom || "") ? "/assets/img/icones/" + nom + ".png" : ""; }

  // ---- outils -----------------------------------------------------------------------------------------
  function el(tag, attrs, contenu) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) { if (k === "class") e.className = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (contenu != null) (Array.isArray(contenu) ? contenu : [contenu]).forEach(function (c) {
      if (c != null) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }
  function vider(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function nb(n, max) { return Number(n).toLocaleString("fr-FR", { maximumFractionDigits: max == null ? 2 : max }); }
  function decomposer(cu) {
    cu = Math.round(cu * 100) / 100;
    var or = Math.floor(cu / CU_OR), reste = cu - or * CU_OR;
    var ar = Math.floor(reste / CU_ARG);
    return { or: or, argent: ar, cuivre: Math.round((reste - ar * CU_ARG) * 100) / 100 };
  }
  function pastille(monnaie) {                                   // icône de pièce (pixel art) ou, à défaut, pastille de couleur
    var src = cheminIcone(ICONES.monnaie[monnaie]);
    return src ? el("img", { "class": "coin coin-" + monnaie, src: src, alt: "", width: "22", height: "22" }) : el("i", { "class": "p-" + monnaie, "aria-hidden": "true" });
  }
  function bourse(cu) {                                          // « 1 or 50 cuivre » avec des pastilles de pièces
    var d = decomposer(cu), span = el("span", { "class": "bourse" }), n = 0;
    [["or", d.or], ["argent", d.argent], ["cuivre", d.cuivre]].forEach(function (p) {
      if (!p[1] && !(p[0] === "cuivre" && n === 0)) return;
      span.appendChild(el("span", { "class": "piece" }, [pastille(p[0]), nb(p[1]) + " " + p[0]]));
      n++;
    });
    return span;
  }
  function jours(cu) {
    var j = cu / CU_JOUR;
    return "≈ " + nb(j, j < 10 ? 2 : 0) + (j >= 2 ? " jours" : " jour") + " de travail d'un travailleur lambda";
  }
  function poids(g) { return g >= 1000 ? nb(g / 1000) + " kg" : nb(g, 0) + " g"; }
  function quantite(q, unite) { return unite === "kg" && q < 1 ? nb(q * 1000, 0) + " g" : nb(q) + " " + unite; }
  function versUniteArticle(a, q, u) { return MASSE[a.unite] && MASSE[u] ? q * MASSE[u] / MASSE[a.unite] : q; }
  function prixDe(champs) {                                       // {or, argent, cuivre} (champs <input>) -> pièces de cuivre
    return (parseFloat(champs.or.value) || 0) * CU_OR + (parseFloat(champs.argent.value) || 0) * CU_ARG + (parseFloat(champs.cuivre.value) || 0);
  }
  function champsBourse(idPrefixe, valeurs) {
    var champs = {}, boite = el("div", { "class": "eco-bourse" });
    [["or", "Or"], ["argent", "Argent"], ["cuivre", "Cuivre"]].forEach(function (p) {
      var input = el("input", { type: "number", min: "0", step: "any", inputmode: "decimal", id: idPrefixe + p[0] });
      if (valeurs) input.value = valeurs[p[0]];
      champs[p[0]] = input;
      boite.appendChild(el("label", { "for": idPrefixe + p[0] }, [el("span", { "class": "libelle" }, [pastille(p[0]), p[1]]), input]));
    });
    return { champs: champs, boite: boite };
  }

  // ---- propositions locales ---------------------------------------------------------------------------
  function propositionValide(p) {
    return p && typeof p.id === "string" && typeof p.nom === "string" && typeof p.unite === "string" && typeof p.prix === "number" && p.prix > 0;
  }
  function lireLocal() {
    try {
      var v = JSON.parse(localStorage.getItem(CLE_LOCAL) || "[]");
      v = Array.isArray(v) ? v.filter(propositionValide) : [];
    } catch (e) { v = []; }
    // une proposition déjà validée par l'équipe (elle porte le même identifiant) n'a plus besoin d'être gardée
    return v.filter(function (p) { return !DATA.articles.some(function (a) { return a.id_proposition === p.id; }); });
  }
  function ecrireLocal(liste) { try { localStorage.setItem(CLE_LOCAL, JSON.stringify(liste)); } catch (e) { /* stockage bloqué : tant pis */ } }
  var locales = lireLocal();
  ecrireLocal(locales);

  function b64url(texte) {
    var octets = new TextEncoder().encode(texte), bin = "";
    for (var i = 0; i < octets.length; i++) bin += String.fromCharCode(octets[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function codeProposition(p) {
    return "TDS1:" + b64url(JSON.stringify({ v: 1, i: p.id, n: p.nom, c: p.categorie, p: p.prix, u: p.unite, t: p.note || "", a: p.pseudo || "" }));
  }
  function copier(texte, bouton) {
    var libelle = bouton.textContent;
    function ok() { bouton.textContent = "Copié ✓"; setTimeout(function () { bouton.textContent = libelle; }, 1800); }
    function secours() {
      var ta = el("textarea", { "aria-hidden": "true" });
      ta.value = texte; ta.style.cssText = "position:fixed;left:-999px;top:0";
      document.body.appendChild(ta); ta.select();
      try { if (document.execCommand("copy")) ok(); } catch (e) { /* rien */ }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(texte).then(ok, secours); else secours();
  }

  // ---- structure de la page ---------------------------------------------------------------------------
  vider(racine);
  racine.classList.add("actif");
  function carte(titre, id) {
    var c = el("section", { "class": "eco-carte", "aria-labelledby": id });
    c.appendChild(el("h3", { id: id }, titre));
    return c;
  }

  // ===== 1. Convertisseur de pièces =====================================================================
  var c1 = carte("Convertisseur de pièces", "eco-t1");
  c1.appendChild(el("p", { "class": "eco-aide" }, "Indiquez une somme (dans une seule monnaie ou dans plusieurs) : elle est convertie dans les autres monnaies. "
    + "Règles : 100 cuivre = 1 argent ; 100 argent = 1 or ; chaque pièce pèse " + G_PIECE + " g de métal pur."));
  var b = champsBourse("eco-c-", { or: "", argent: "", cuivre: "" });
  var resultats = el("dl", { "class": "eco-resultats", "aria-live": "polite" });
  c1.appendChild(el("div", { "class": "eco-conv" }, [b.boite, resultats]));

  function ligneResultat(titre, contenu) { resultats.appendChild(el("dt", null, titre)); resultats.appendChild(el("dd", null, contenu)); }
  function majConvertisseur() {
    var or = parseFloat(b.champs.or.value) || 0, ar = parseFloat(b.champs.argent.value) || 0, cu = parseFloat(b.champs.cuivre.value) || 0;
    var total = or * CU_OR + ar * CU_ARG + cu;
    vider(resultats);
    if (!(total > 0)) { resultats.appendChild(el("dd", { "class": "eco-vide" }, "Saisissez un montant pour voir la conversion.")); return; }
    ligneResultat("Valeur totale", nb(total) + " cuivre  ·  " + nb(total / CU_ARG) + " argent  ·  " + nb(total / CU_OR, 4) + " or");
    ligneResultat("En pièces", bourse(total));
    if (or % 1 === 0 && ar % 1 === 0 && cu % 1 === 0) {
      var morceaux = [];
      if (or) morceaux.push(poids(or * G_PIECE) + " d'or");
      if (ar) morceaux.push(poids(ar * G_PIECE) + " d'argent");
      if (cu) morceaux.push(poids(cu * G_PIECE) + " de cuivre");
      ligneResultat("Poids des pièces", morceaux.join(" + ") + "  (" + poids((or + ar + cu) * G_PIECE) + " au total)");
    }
    ligneResultat("Équivaut à", jours(total));
    var achats = DATA.articles.filter(function (a) { return a.prix > 0 && (a.unite === "kg" || a.unite === "g" || a.unite === "pièce"); })
      .map(function (a) { return { a: a, q: total / a.prix }; })
      .filter(function (x) { return x.a.unite === "pièce" ? x.q >= 1 : x.q * (MASSE[x.a.unite] || 1) >= 1; })
      .slice(0, 6);
    if (achats.length) {
      var ul = el("ul", { "class": "eco-achats" });
      achats.forEach(function (x) {
        var q = x.a.unite === "pièce" ? nb(Math.floor(x.q), 0) + " × " : "≈ " + quantite(x.q, x.a.unite) + " · ";
        ul.appendChild(el("li", null, [q, el("strong", null, x.a.nom)]));
      });
      ligneResultat("Avec cette somme", ul);
    }
  }
  ["or", "argent", "cuivre"].forEach(function (k) { b.champs[k].addEventListener("input", majConvertisseur); });
  majConvertisseur();

  // ===== 2. Prix de référence ===========================================================================
  var c2 = carte("Prix de référence", "eco-t2");
  c2.appendChild(el("p", { "class": "eco-aide" }, "Tous les prix sont exprimés en pièces et calculés d'après les règles de la page. Saisissez une quantité pour additionner votre sélection."));
  var recherche = el("input", { type: "search", placeholder: "Chercher un article…", "aria-label": "Chercher un article" });
  var filtreCat = el("select", { "aria-label": "Filtrer par catégorie" });
  var barre = el("div", { "class": "eco-barre" }, [recherche, filtreCat]);
  var liste = el("ul", { "class": "prix-liste" });
  var totalBoite = el("div", { "class": "eco-total", hidden: "hidden", "aria-live": "polite" });
  c2.appendChild(barre); c2.appendChild(liste); c2.appendChild(totalBoite);
  var panier = {};                                                // id -> { q, u }

  function tousLesArticles() {
    return DATA.articles.map(function (a) { return a; }).concat(locales.map(function (p) {
      return { id: p.id, nom: p.nom, categorie: p.categorie, unite: p.unite, prix: p.prix, note: p.note || "", source: "local" };
    }));
  }
  function sousTotal(a) {
    var l = panier[a.id];
    return l && l.q > 0 ? versUniteArticle(a, l.q, l.u) * a.prix : 0;
  }
  function majTotal() {
    var total = 0, n = 0;
    tousLesArticles().forEach(function (a) { var s = sousTotal(a); if (s > 0) { total += s; n++; } });
    vider(totalBoite);
    if (!n) { totalBoite.hidden = true; return; }
    totalBoite.hidden = false;
    var vide = el("button", { type: "button", "class": "eco-bouton discret" }, "Vider la sélection");
    vide.addEventListener("click", function () { panier = {}; rendreListe(); majTotal(); });
    totalBoite.appendChild(el("div", null, [el("strong", null, "Total de la sélection : "), bourse(total), el("span", { "class": "eco-jours" }, jours(total))]));
    totalBoite.appendChild(vide);
  }
  var LIBELLE_SOURCE = { officiel: "Officiel", deduit: "Déduit", communaute: "Communauté", local: "Ma proposition (en attente)" };
  function ligne(a) {
    var li = el("li", { "class": "prix-ligne source-" + a.source, "data-id": a.id });
    var srcIcone = cheminIcone(a.icone || ICONES.categories[a.categorie]);
    var info = el("div", { "class": "pl-info" }, [
      el("strong", { "class": "pl-nom" }, a.nom),
      el("span", { "class": "pl-etiquettes" }, [el("span", { "class": "pl-cat" }, a.categorie), el("span", { "class": "pl-source" }, LIBELLE_SOURCE[a.source] || a.source)])
    ]);
    if (a.note) info.appendChild(el("span", { "class": "pl-note" }, a.note));
    var prix = el("div", { "class": "pl-prix" }, [bourse(a.prix), el("span", { "class": "pl-unite" }, " par " + a.unite), el("span", { "class": "pl-jours" }, jours(a.prix))]);
    var etat = panier[a.id] || { q: "", u: a.unite };
    var q = el("input", { type: "number", min: "0", step: "any", inputmode: "decimal", "aria-label": "Quantité de " + a.nom, placeholder: "0" });
    if (etat.q) q.value = etat.q;
    var uniteChamp;
    if (MASSE[a.unite]) {
      uniteChamp = el("select", { "aria-label": "Unité" }, ["g", "kg"].map(function (u) { return el("option", { value: u }, u); }));
      uniteChamp.value = etat.u;
    } else uniteChamp = el("span", { "class": "pl-u" }, a.unite);
    var sous = el("div", { "class": "pl-total" });
    function maj() {
      panier[a.id] = { q: parseFloat(q.value) || 0, u: uniteChamp.value || a.unite };
      vider(sous);
      var s = sousTotal(a);
      if (s > 0) sous.appendChild(bourse(s));
      majTotal();
    }
    q.addEventListener("input", maj);
    if (uniteChamp.tagName === "SELECT") uniteChamp.addEventListener("change", maj);
    if (etat.q) { var s0 = sousTotal(a); if (s0 > 0) sous.appendChild(bourse(s0)); }
    var tete = el("div", { "class": "pl-tete" }, [srcIcone ? el("img", { "class": "pl-icone", src: srcIcone, alt: "", width: "34", height: "34" }) : null, info]);
    li.appendChild(tete); li.appendChild(prix);
    li.appendChild(el("div", { "class": "pl-qte" }, [q, uniteChamp]));
    li.appendChild(sous);
    return li;
  }
  function rendreListe() {
    vider(liste);
    var mot = recherche.value.trim().toLowerCase(), cat = filtreCat.value;
    var ordre = DATA.categories;
    var articles = tousLesArticles().filter(function (a) {
      return (!cat || a.categorie === cat) && (!mot || (a.nom + " " + a.categorie + " " + (a.note || "")).toLowerCase().indexOf(mot) >= 0);
    }).sort(function (x, y) {
      var d = ordre.indexOf(x.categorie) - ordre.indexOf(y.categorie);
      return d || x.nom.localeCompare(y.nom, "fr");
    });
    if (!articles.length) liste.appendChild(el("li", { "class": "eco-vide" }, "Aucun article ne correspond."));
    articles.forEach(function (a) { liste.appendChild(ligne(a)); });
  }
  function remplirCategories() {
    var courant = filtreCat.value;
    vider(filtreCat);
    filtreCat.appendChild(el("option", { value: "" }, "Toutes les catégories"));
    var vues = {};
    tousLesArticles().forEach(function (a) { vues[a.categorie] = true; });
    DATA.categories.filter(function (c) { return vues[c]; }).forEach(function (c) { filtreCat.appendChild(el("option", { value: c }, c)); });
    filtreCat.value = courant;
  }
  recherche.addEventListener("input", rendreListe);
  filtreCat.addEventListener("change", rendreListe);
  remplirCategories(); rendreListe();

  // ===== 3. Proposer un prix ============================================================================
  var c3 = carte("Proposer un prix", "eco-t3");
  c3.appendChild(el("p", { "class": "eco-aide" }, "Un prix manque ? Proposez-le : il reste d'abord dans votre navigateur (vous le voyez dans la liste ci-dessus), "
    + "puis vous envoyez le code généré à l'équipe. Après vérification, il rejoint la liste pour tout le monde."));
  var form = el("form", { "class": "eco-form", novalidate: "novalidate" });
  var nom = el("input", { type: "text", maxlength: "80", required: "required", id: "eco-f-nom", placeholder: "Ex. : Nuit à l'auberge (chambre simple)" });
  var cat = el("select", { id: "eco-f-cat" }, DATA.categories.map(function (c) { return el("option", { value: c }, c); }));
  var unite = el("select", { id: "eco-f-unite" }, DATA.unites.map(function (u) { return el("option", { value: u }, u); }));
  var bf = champsBourse("eco-f-");
  var note = el("textarea", { id: "eco-f-note", maxlength: "400", rows: "3", placeholder: "Pourquoi ce prix ? (calcul, comparaison avec un prix de la liste, contexte…)" });
  var pseudo = el("input", { type: "text", maxlength: "40", id: "eco-f-pseudo", placeholder: "Facultatif" });
  var indice = el("p", { "class": "eco-indice", "aria-live": "polite" });
  var erreur = el("p", { "class": "eco-erreur", role: "alert" });
  function rang(label, champ, id, large) { return el("div", { "class": "eco-rang" + (large ? " large" : "") }, [el("label", { "for": id }, label), champ]); }
  form.appendChild(rang("Nom de l'article", nom, "eco-f-nom", true));
  form.appendChild(el("div", { "class": "eco-duo" }, [rang("Catégorie", cat, "eco-f-cat"), rang("Prix pour une…", unite, "eco-f-unite")]));
  form.appendChild(el("div", { "class": "eco-rang large" }, [el("span", { "class": "eco-etiquette" }, "Prix"), bf.boite]));
  form.appendChild(indice);
  form.appendChild(rang("Justification (facultatif)", note, "eco-f-note", true));
  form.appendChild(rang("Votre pseudo (facultatif)", pseudo, "eco-f-pseudo", true));
  form.appendChild(erreur);
  form.appendChild(el("button", { type: "submit", "class": "eco-bouton" }, "Préparer ma proposition"));
  c3.appendChild(form);
  var sortie = el("div", { "class": "eco-sortie", "aria-live": "polite" });
  c3.appendChild(sortie);

  function majIndice() {
    var p = prixDe(bf.champs), morceaux = [];
    if (p > 0) morceaux.push(jours(p));
    var deja = DATA.articles.filter(function (a) { return a.nom.toLowerCase() === nom.value.trim().toLowerCase() && a.unite === unite.value; })[0];
    if (deja) morceaux.push("Un prix existe déjà pour cet article (" + LIBELLE_SOURCE[deja.source].toLowerCase() + ") : " + nb(deja.prix) + " cuivre par " + deja.unite + ".");
    indice.textContent = morceaux.join(" — ");
  }
  [nom, unite, bf.champs.or, bf.champs.argent, bf.champs.cuivre].forEach(function (c) { c.addEventListener("input", majIndice); });

  function afficherCode(p) {
    vider(sortie);
    var code = codeProposition(p);
    var zone = el("textarea", { readonly: "readonly", rows: "3", "aria-label": "Code de proposition" });
    zone.value = code;
    zone.addEventListener("focus", function () { zone.select(); });
    var copie = el("button", { type: "button", "class": "eco-bouton" }, "Copier le code");
    copie.addEventListener("click", function () { copier(code, copie); });
    var liens = el("p", { "class": "eco-liens" }, [
      "Collez-le ensuite dans un message à l'équipe : ",
      el("a", { href: racine.getAttribute("data-discord") || "#", target: "_blank", rel: "noopener" }, "Discord"),
      " ou ",
      el("a", { href: racine.getAttribute("data-forum") || "#", target: "_blank", rel: "noopener" }, "forum"),
      "."
    ]);
    sortie.appendChild(el("div", { "class": "eco-code" }, [
      el("p", null, [el("strong", null, "Proposition enregistrée dans votre navigateur. "), "Pour qu'elle soit étudiée, copiez ce code et envoyez-le à l'équipe :"]),
      zone, copie, liens
    ]));
    sortie.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function rendreLocales() {
    var zoneLocale = document.getElementById("eco-locales");
    if (!zoneLocale) { zoneLocale = el("div", { id: "eco-locales", "class": "eco-locales" }); c3.appendChild(zoneLocale); }
    vider(zoneLocale);
    if (!locales.length) return;
    zoneLocale.appendChild(el("h4", null, "Mes propositions en attente (visibles seulement chez vous)"));
    var ul = el("ul");
    locales.forEach(function (p) {
      var voir = el("button", { type: "button", "class": "eco-bouton discret" }, "Afficher le code");
      var suppr = el("button", { type: "button", "class": "eco-bouton discret danger" }, "Retirer");
      voir.addEventListener("click", function () { afficherCode(p); });
      suppr.addEventListener("click", function () {
        locales = locales.filter(function (x) { return x.id !== p.id; });
        ecrireLocal(locales); rendreLocales(); remplirCategories(); rendreListe(); majTotal();
      });
      ul.appendChild(el("li", null, [el("span", { "class": "el-nom" }, p.nom), bourse(p.prix), " par " + p.unite, el("span", { "class": "eco-actions" }, [voir, suppr])]));
    });
    zoneLocale.appendChild(ul);
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    erreur.textContent = "";
    var n = nom.value.trim().replace(/\s+/g, " "), prix = prixDe(bf.champs);
    if (n.length < 2) { erreur.textContent = "Indiquez le nom de l'article."; nom.focus(); return; }
    if (!(prix > 0)) { erreur.textContent = "Indiquez un prix (en or, argent et/ou cuivre)."; bf.champs.cuivre.focus(); return; }
    if (prix > 1e9) { erreur.textContent = "Ce prix est démesuré : vérifiez les chiffres."; return; }
    var p = { id: "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), nom: n, categorie: cat.value, unite: unite.value,
              prix: Math.round(prix * 100) / 100, note: note.value.trim(), pseudo: pseudo.value.trim() };
    locales.push(p);
    ecrireLocal(locales);
    remplirCategories(); rendreListe(); rendreLocales(); afficherCode(p);
    form.reset(); majIndice();
  });
  rendreLocales();

  racine.appendChild(c1); racine.appendChild(c2); racine.appendChild(c3);
})();
