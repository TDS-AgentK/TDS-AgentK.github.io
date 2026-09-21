// Scripts du site : menu mobile, filtres de la liste des races, sommaire.
// Tout est facultatif : sans JavaScript, le site reste entièrement lisible.
(function () {
  "use strict";

  /* ---- Menu : bouton "Menu" sur mobile + sous-menus au toucher ---------------------- */
  var bouton = document.querySelector(".menu-bouton");
  var liste = document.getElementById("menu-liste");
  if (bouton && liste) {
    bouton.addEventListener("click", function () {
      var ouvert = liste.classList.toggle("ouvert");
      bouton.setAttribute("aria-expanded", ouvert ? "true" : "false");
    });
    liste.querySelectorAll("li.a-sous-menu, li.a-sous-sous").forEach(function (li) {
      var fleche = document.createElement("button");
      fleche.type = "button";
      fleche.className = "sm-fleche";
      fleche.setAttribute("aria-label", "Afficher le sous-menu");
      fleche.setAttribute("aria-expanded", "false");
      fleche.textContent = "▾";
      fleche.addEventListener("click", function () {
        var ouvert = li.classList.toggle("ouvert");
        fleche.setAttribute("aria-expanded", ouvert ? "true" : "false");
      });
      li.insertBefore(fleche, li.querySelector(".sous-menu, .sous-sous-menu"));
    });
  }

  /* ---- Liste des races : filtres --------------------------------------------------- */
  var filtres = document.querySelector(".filtres");
  if (filtres) {
    var cartes = Array.prototype.slice.call(document.querySelectorAll(".grille-races li"));
    var groupes = Array.prototype.slice.call(document.querySelectorAll(".groupe-races"));
    var compteur = document.querySelector(".compteur");
    filtres.hidden = false;
    if (compteur) compteur.hidden = false;

    var appliquer = function (critere) {
      var visibles = 0;
      cartes.forEach(function (li) {
        var tags = (li.getAttribute("data-tags") || "").split(" ");
        var ok = critere === "toutes" || li.getAttribute("data-cat") === critere || tags.indexOf(critere) !== -1;
        li.hidden = !ok;
        if (ok) visibles++;
      });
      groupes.forEach(function (g) {
        g.hidden = !g.querySelector("li:not([hidden])");
      });
      if (compteur) compteur.textContent = visibles + (visibles > 1 ? " races affichées" : " race affichée");
      filtres.querySelectorAll("button").forEach(function (b) {
        var actif = b.getAttribute("data-filtre") === critere;
        b.classList.toggle("actif", actif);
        b.setAttribute("aria-pressed", actif ? "true" : "false");
      });
    };
    filtres.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-filtre]");
      if (b) appliquer(b.getAttribute("data-filtre"));
    });
    appliquer("toutes");
  }

  /* ---- Blog : filtre par catégorie ------------------------------------------------------------- */
  var blog = document.querySelector("[data-blog]");
  if (blog) {
    var blogPuces = blog.querySelector(".blog-cats");
    if (blogPuces) {
      blogPuces.hidden = false;
      blogPuces.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-cat]");
        if (!b) return;
        var cat = b.getAttribute("data-cat");
        blogPuces.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        blog.querySelectorAll(".blog-liste li").forEach(function (li) {
          li.hidden = !!cat && (li.getAttribute("data-cats") || "").split("|").indexOf(cat) === -1;
        });
      });
    }
  }

  /* ---- Grimoire : recherche + filtres (énergie, catégorie, niveau, école, courant) ------------ */
  var gr = document.querySelector("[data-grimoire]");
  if (gr) {
    var sorts = Array.prototype.slice.call(gr.querySelectorAll(".sort"));
    var outilsGr = gr.querySelector(".gr-outils");
    var rech = gr.querySelector(".gr-recherche");
    var selE = gr.querySelector(".gr-sel-ecole");
    var selC = gr.querySelector(".gr-sel-courant");
    var cptr = gr.querySelector(".gr-compteur");
    var etat = { q: "", energie: "", cat: "", niveau: "", ecole: "", courant: "" };
    var normGr = function (t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); };
    var majGr = function () {
      var n = 0;
      sorts.forEach(function (li) {
        var sec = li.closest(".gr-courant");
        var ok = (!etat.energie || li.getAttribute("data-energie") === etat.energie) &&
                 (!etat.cat || (li.getAttribute("data-cat") || "").indexOf(etat.cat) !== -1) &&
                 (!etat.niveau || (li.getAttribute("data-niveaux") || "").split("|").indexOf(etat.niveau) !== -1) &&
                 (!etat.ecole || !sec || sec.getAttribute("data-ecole") === etat.ecole) &&
                 (!etat.courant || !sec || sec.getAttribute("data-courant") === etat.courant) &&
                 (!etat.q || (li.getAttribute("data-texte") || "").indexOf(etat.q) !== -1);
        li.hidden = !ok;
        if (ok) n++;
      });
      gr.querySelectorAll(".gr-courant").forEach(function (sec) { sec.hidden = !sec.querySelector(".sort:not([hidden])"); });
      gr.querySelectorAll(".gr-ecole").forEach(function (sec) { sec.hidden = !sec.querySelector(".gr-courant:not([hidden])"); });
      if (cptr) cptr.textContent = n + (n > 1 ? " sorts" : " sort") + (n === 0 ? " — essayez d'élargir les filtres" : "");
    };
    if (outilsGr) outilsGr.hidden = false;
    if (rech) rech.addEventListener("input", function () { etat.q = normGr(rech.value.trim()); majGr(); });
    gr.querySelectorAll(".gr-groupe").forEach(function (g) {
      var cle = g.getAttribute("data-groupe");
      g.addEventListener("click", function (e) {
        var b = e.target.closest("button");
        if (!b) return;
        var val = b.getAttribute("data-" + cle);
        var deja = b.getAttribute("aria-pressed") === "true";
        g.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        etat[cle] = deja ? "" : val;
        if (!deja) b.setAttribute("aria-pressed", "true");
        majGr();
      });
    });
    if (selE) selE.addEventListener("change", function () {
      etat.ecole = selE.value; etat.courant = "";
      if (selC) {
        selC.value = "";
        Array.prototype.forEach.call(selC.options, function (o) { o.hidden = !!(etat.ecole && o.value && o.getAttribute("data-ecole") !== etat.ecole); });
      }
      majGr();
    });
    if (selC) selC.addEventListener("change", function () { etat.courant = selC.value; majGr(); });
    var reset = gr.querySelector(".gr-reset");
    if (reset) reset.addEventListener("click", function () {
      etat = { q: "", energie: "", cat: "", niveau: "", ecole: "", courant: "" };
      if (rech) rech.value = "";
      if (selE) selE.value = "";
      if (selC) { selC.value = ""; Array.prototype.forEach.call(selC.options, function (o) { o.hidden = false; }); }
      gr.querySelectorAll(".gr-groupe button").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
      majGr();
    });
  }

  /* ---- Frise chronologique : filtres, recherche, année, et barres qui montrent la durée des périodes ---- */
  var frise = document.querySelector("[data-frise]");
  if (frise) {
    var evs = Array.prototype.slice.call(frise.querySelectorAll(".ev"));
    var puces = frise.querySelector(".frise-puces");
    var champ = frise.querySelector(".frise-recherche");
    var etiquetteAn = frise.querySelector(".frise-annee");
    var champAn = etiquetteAn ? etiquetteAn.querySelector("input") : null;
    var total = frise.querySelector(".frise-compteur");
    var legende = frise.querySelector(".frise-legende");
    var barres = Array.prototype.slice.call(frise.querySelectorAll(".barre"));
    var petit = window.matchMedia("(max-width: 760px)");
    var chronoActive = "toutes", requete = "", annee = null;
    var norm = function (t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); };
    var textes = evs.map(function (li) { return norm(li.textContent); });

    // « En l'an N » : les événements de cette année et les périodes en cours cette année-là
    var couvre = function (li, y) {
      var d = li.getAttribute("data-debut");
      if (d !== null && d !== "") {
        var f = li.getAttribute("data-fin");
        return y >= parseInt(d, 10) && (f === "" || y <= parseInt(f, 10));
      }
      var an = li.getAttribute("data-an");
      return an !== null && an !== "" && parseInt(an, 10) === y;
    };

    // Barres : une par période, dans un « couloir » à gauche de la ligne ; les périodes qui se chevauchent prennent des couloirs différents.
    var attribuer = function (poses) {
      poses.forEach(function (p) { p.y0 = p.a.offsetTop + 26; p.y1 = p.z.offsetTop + 26; });
      poses.sort(function (u, v) { return u.y0 - v.y0; });
      var fins = [];
      poses.forEach(function (p) {
        var k = 0;
        while (k < fins.length && fins[k] > p.y0 - 4) k++;
        fins[k] = p.y1;
        p.b.style.top = p.y0 + "px";
        p.b.style.height = (p.y1 - p.y0) + "px";
        p.b.style.left = (148 + 12 * k) + "px";
      });
      return fins.length;
    };
    var placerBarres = function () {
      barres.forEach(function (b) { b.hidden = true; });
      frise.style.setProperty("--gout", "0px");
      if (legende) legende.hidden = true;
      if (!barres.length || petit.matches || requete || annee !== null) return;
      var visibles = evs.filter(function (li) { return !li.hidden; });
      var poses = [];
      barres.forEach(function (b) {
        if (chronoActive !== "toutes" && b.getAttribute("data-chrono") !== chronoActive) return;
        var i0 = parseInt(b.getAttribute("data-i0"), 10), i1 = parseInt(b.getAttribute("data-i1"), 10), premier = null, dernier = null;
        visibles.forEach(function (li) {
          var i = parseInt(li.getAttribute("data-i"), 10);
          if (i >= i0 && i <= i1) { if (!premier) premier = li; dernier = li; }
        });
        if (premier && dernier && premier !== dernier) poses.push({ b: b, a: premier, z: dernier });
      });
      var couloirs = attribuer(poses);                        // 1re passe : combien de couloirs ?
      frise.style.setProperty("--gout", (couloirs * 12) + "px");
      attribuer(poses);                                       // 2e passe : positions exactes avec la nouvelle largeur
      poses.forEach(function (p) { p.b.hidden = false; });
      if (legende) legende.hidden = !poses.length;
    };

    var majFrise = function () {
      var n = 0;
      evs.forEach(function (li, i) {
        var ok = (chronoActive === "toutes" || li.getAttribute("data-chrono") === chronoActive ||
                   (" " + (li.getAttribute("data-aussi") || "") + " ").indexOf(" " + chronoActive + " ") !== -1) &&
                 (!requete || textes[i].indexOf(requete) !== -1) &&
                 (annee === null || couvre(li, annee));
        li.hidden = !ok;
        if (ok) n++;
      });
      if (total) total.textContent = n + (n > 1 ? " événements" : " événement");
      placerBarres();
    };
    if (champ) {
      champ.hidden = false;
      champ.addEventListener("input", function () { requete = norm(champ.value.trim()); majFrise(); });
    }
    if (champAn) {
      etiquetteAn.hidden = false;
      champAn.addEventListener("input", function () {
        var v = parseInt(champAn.value, 10);
        annee = isNaN(v) ? null : v;
        majFrise();
      });
    }
    if (puces) {
      puces.hidden = false;
      puces.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-chrono]");
        if (!b) return;
        chronoActive = b.getAttribute("data-chrono");
        puces.querySelectorAll("button").forEach(function (x) {
          x.setAttribute("aria-pressed", x === b ? "true" : "false");
        });
        majFrise();
      });
    }
    var retard;
    window.addEventListener("resize", function () { clearTimeout(retard); retard = setTimeout(placerBarres, 120); });
    window.addEventListener("load", placerBarres);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(placerBarres);
    placerBarres();
  }

  /* ---- Sommaire : ouvert sur grand écran + surlignage de la section lue -------------- */
  var sommaire = document.querySelector(".sommaire");
  if (sommaire) {
    var large = window.matchMedia("(min-width: 1480px)");
    var reglerOuverture = function () { sommaire.open = large.matches; };
    reglerOuverture();
    if (large.addEventListener) large.addEventListener("change", reglerOuverture);

    var liens = {};
    sommaire.querySelectorAll("a[href^='#']").forEach(function (a) {
      liens[a.getAttribute("href").slice(1)] = a;
    });
    var titres = Object.keys(liens).map(function (id) { return document.getElementById(id); }).filter(Boolean);
    if ("IntersectionObserver" in window && titres.length) {
      var courant = null;
      var obs = new IntersectionObserver(function (entrees) {
        entrees.forEach(function (en) {
          if (en.isIntersecting) {
            if (courant) courant.classList.remove("en-cours");
            courant = liens[en.target.id];
            courant.classList.add("en-cours");
          }
        });
      }, { rootMargin: "0px 0px -70% 0px" });
      titres.forEach(function (t) { obs.observe(t); });
    }
  }
})();
