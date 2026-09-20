/* Quiz du Temple du Savoir : choix d'un quiz, questions une à une avec correction immédiate, score final, rang et révision.
   Données : <script type="application/json" id="donnees-quizz"> (data/quizz.json, injecté par build.py). À chaque partie, les questions
   sont tirées au hasard dans la réserve du quiz et les réponses sont mélangées. Le meilleur score est gardé dans le navigateur (localStorage). */
(function () {
  "use strict";
  var racine = document.getElementById("quizz-app"), brut = document.getElementById("donnees-quizz");
  if (!racine || !brut) return;
  var D;
  try { D = JSON.parse(brut.textContent); } catch (e) { return; }

  function el(tag, attrs, texte) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) { if (k === "class") e.className = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (texte != null) e.textContent = texte;
    return e;
  }
  function melanger(t) {
    var a = t.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; }
    return a;
  }
  function meilleur(id) { try { return parseInt(localStorage.getItem("tds-quizz-" + id), 10) || 0; } catch (e) { return 0; } }
  function garder(id, pct) { try { if (pct > meilleur(id)) localStorage.setItem("tds-quizz-" + id, String(pct)); } catch (e) { /* ignoré */ } }
  function rang(pct) { var r = D.rangs[0]; D.rangs.forEach(function (x) { if (pct >= x.min) r = x; }); return r; }
  var LETTRES = ["A", "B", "C", "D", "E", "F"];

  /* ---------- accueil : la liste des quiz ---------- */
  function accueil() {
    racine.innerHTML = "";
    var grille = el("div", { "class": "qz-liste" });
    D.quizz.forEach(function (z) {
      var b = el("button", { type: "button", "class": "qz-carte", "data-niveau": z.niveau });
      b.appendChild(el("img", { src: "/assets/img/icones/" + z.icone + ".png", alt: "", width: "34", height: "34" }));
      b.appendChild(el("h2", null, z.titre));
      b.appendChild(el("p", null, z.description));
      var pied = el("p", { "class": "qz-meta" });
      pied.appendChild(el("span", { "class": "qz-niveau" }, z.niveau));
      pied.appendChild(document.createTextNode(Math.min(z.tirage, z.questions.length) + " questions"));
      var m = meilleur(z.id);
      if (m) pied.appendChild(el("span", { "class": "qz-record" }, "Meilleur : " + m + " %"));
      b.appendChild(pied);
      b.addEventListener("click", function () { jouer(z); });
      grille.appendChild(b);
    });
    racine.appendChild(grille);
  }

  /* ---------- une partie ---------- */
  function jouer(z) {
    var qs = melanger(z.questions).slice(0, z.tirage).map(function (q) {
      var ordre = melanger(q.choix.map(function (c, i) { return i; }));
      return { q: q.q, choix: ordre.map(function (i) { return q.choix[i]; }), bonne: ordre.indexOf(q.bonne), explication: q.explication, lien: q.lien };
    });
    var n = 0, score = 0, rates = [];
    function question() {
      var q = qs[n], repondu = false;
      racine.innerHTML = "";
      var carte = el("section", { "class": "qz-jeu", "aria-labelledby": "qz-q" });
      var haut = el("div", { "class": "qz-haut" });
      haut.appendChild(el("button", { type: "button", "class": "qz-quitter" }, "← Quitter"));
      haut.appendChild(el("span", { "class": "qz-titre" }, z.titre));
      haut.appendChild(el("span", { "class": "qz-score" }, "Score : " + score));
      haut.firstChild.addEventListener("click", accueil);
      var barre = el("div", { "class": "qz-barre", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(qs.length), "aria-valuenow": String(n) });
      barre.appendChild(el("span", { style: "width:" + (100 * n / qs.length) + "%" }));
      carte.appendChild(haut); carte.appendChild(barre);
      carte.appendChild(el("p", { "class": "qz-num" }, "Question " + (n + 1) + " sur " + qs.length));
      var titre = el("h2", { id: "qz-q", "class": "qz-question" }, q.q);
      carte.appendChild(titre);
      var liste = el("div", { "class": "qz-choix", role: "group", "aria-labelledby": "qz-q" });
      var retour = el("div", { "class": "qz-retour", "aria-live": "polite" });
      var boutons = q.choix.map(function (c, i) {
        var b = el("button", { type: "button", "class": "qz-reponse" });
        b.appendChild(el("span", { "class": "qz-lettre" }, LETTRES[i]));
        b.appendChild(el("span", null, c));
        b.addEventListener("click", function () { repondre(i); });
        liste.appendChild(b);
        return b;
      });
      function repondre(i) {
        if (repondu) return;
        repondu = true;
        var ok = i === q.bonne;
        if (ok) score++; else rates.push({ q: q.q, donnee: q.choix[i], bonne: q.choix[q.bonne], explication: q.explication, lien: q.lien });
        boutons.forEach(function (b, k) {
          b.disabled = true;
          if (k === q.bonne) b.classList.add("juste");
          else if (k === i) b.classList.add("faux");
        });
        retour.className = "qz-retour " + (ok ? "ok" : "ko");
        retour.appendChild(el("strong", null, ok ? "Bonne réponse !" : "Raté. La bonne réponse était : " + q.choix[q.bonne]));
        if (q.explication) retour.appendChild(el("span", null, q.explication));
        if (q.lien) { var a = el("a", { href: q.lien }, "Voir la page"); retour.appendChild(a); }
        var suite = el("button", { type: "button", "class": "qz-suite" }, n + 1 < qs.length ? "Question suivante →" : "Voir mon résultat");
        suite.addEventListener("click", function () { n++; if (n < qs.length) question(); else fin(); });
        retour.appendChild(suite);
        suite.focus();
        haut.querySelector(".qz-score").textContent = "Score : " + score;
      }
      carte.appendChild(liste); carte.appendChild(retour);
      racine.appendChild(carte);
      document.addEventListener("keydown", touche);
      function touche(e) {
        if (!document.body.contains(carte)) { document.removeEventListener("keydown", touche); return; }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        var k = parseInt(e.key, 10);
        if (k >= 1 && k <= boutons.length && !repondu) { repondre(k - 1); e.preventDefault(); }
      }
      titre.setAttribute("tabindex", "-1"); titre.focus({ preventScroll: true });
      carte.scrollIntoView({ block: "nearest" });
    }

    function fin() {
      var pct = Math.round(100 * score / qs.length), r = rang(pct), avant = meilleur(z.id);
      garder(z.id, pct);
      racine.innerHTML = "";
      var carte = el("section", { "class": "qz-fin" });
      var anneau = el("div", { "class": "qz-anneau", style: "--p:" + pct }); anneau.appendChild(el("b", null, pct + " %"));
      carte.appendChild(anneau);
      carte.appendChild(el("p", { "class": "qz-etiquette" }, z.titre));
      carte.appendChild(el("h2", null, r.nom));
      carte.appendChild(el("p", { "class": "qz-bilan" }, score + " bonne" + (score > 1 ? "s" : "") + " réponse" + (score > 1 ? "s" : "") + " sur " + qs.length + ". " + r.texte));
      if (pct > avant && avant) carte.appendChild(el("p", { "class": "qz-record-neuf" }, "Nouveau record personnel ! (précédent : " + avant + " %)"));
      var actions = el("p", { "class": "qz-actions" });
      var rejouer = el("button", { type: "button", "class": "qz-suite" }, "Rejouer (nouvelles questions)");
      rejouer.addEventListener("click", function () { jouer(z); });
      var autres = el("button", { type: "button", "class": "qz-autre" }, "Autres quiz");
      autres.addEventListener("click", accueil);
      var copier = el("button", { type: "button", "class": "qz-autre" }, "Copier mon résultat");
      copier.addEventListener("click", function () {
        var t = "Quiz du Temple du Savoir : « " + z.titre + " » : " + score + "/" + qs.length + " (" + pct + " %) — " + r.nom + " — " + location.href.split("#")[0];
        var ok = function () { copier.textContent = "Résultat copié ✓"; };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { window.prompt("Copiez votre résultat :", t); });
        else window.prompt("Copiez votre résultat :", t);
      });
      [rejouer, autres, copier].forEach(function (b) { actions.appendChild(b); });
      carte.appendChild(actions);
      if (rates.length) {
        var rev = el("div", { "class": "qz-revision" });
        rev.appendChild(el("h3", null, "À revoir (" + rates.length + ")"));
        rates.forEach(function (x) {
          var li = el("article", { "class": "qz-rate" });
          li.appendChild(el("strong", null, x.q));
          li.appendChild(el("span", { "class": "qz-vous" }, "Votre réponse : " + x.donnee));
          li.appendChild(el("span", { "class": "qz-juste" }, "Bonne réponse : " + x.bonne));
          if (x.explication) li.appendChild(el("span", { "class": "qz-expl" }, x.explication));
          if (x.lien) li.appendChild(el("a", { href: x.lien }, "Voir la page"));
          rev.appendChild(li);
        });
        carte.appendChild(rev);
      }
      racine.appendChild(carte);
      carte.scrollIntoView({ block: "nearest" });
    }
    question();
  }
  accueil();
})();
