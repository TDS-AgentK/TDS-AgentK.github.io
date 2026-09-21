/* « Le saviez-vous ? » : une anecdote au hasard, tirée de /assets/saviez-vous.json (fichier reconstruit à chaque build.py :
   chaque lieu, divinité, événement, sort, personnage publié ou État renseigné en devient une). Sans JavaScript, le bouton reste caché. */
(function () {
  var bouton = document.querySelector(".sv-bouton"), fenetre = document.getElementById("sv-fenetre");
  if (!bouton || !fenetre) return;
  bouton.hidden = false;
  var faits = null, pioches = {}, derniere = "";

  function charger(suite) {
    if (faits) { suite(); return; }
    fetch("/assets/saviez-vous.json?v=" + encodeURIComponent(bouton.getAttribute("data-v") || ""))
      .then(function (r) { return r.json(); })
      .then(function (j) { faits = j; suite(); })
      .catch(function () { montrer(null); });
  }
  function melanger(t) {
    for (var i = t.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = t[i]; t[i] = t[j]; t[j] = x; }
    return t;
  }
  /* on tire d'abord une catégorie (lieu, divinité, sort…), puis un fait de cette catégorie sans répéter tant que la pioche n'est pas vide :
     sinon les catégories les plus fournies (événements, sorts) écraseraient les autres */
  function tirer() {
    var cats = {};
    faits.forEach(function (f, i) { (cats[f.k] = cats[f.k] || []).push(i); });
    var noms = Object.keys(cats);
    if (!noms.length) return null;
    var cat = noms[Math.floor(Math.random() * noms.length)];
    if (!pioches[cat] || !pioches[cat].length) pioches[cat] = melanger(cats[cat].slice());
    var f = faits[pioches[cat].pop()];
    if (f.t + f.x === derniere && faits.length > 1) return tirer();
    derniere = f.t + f.x;
    return f;
  }
  function el(tag, cls, texte) { var e = document.createElement(tag); if (cls) e.className = cls; if (texte) e.textContent = texte; return e; }

  function montrer(f) {
    fenetre.textContent = "";
    var tete = el("div", "sv-tete");
    tete.appendChild(el("span", "sv-cat", f ? "Le saviez-vous ? · " + f.k : "Le saviez-vous ?"));
    var fermer = el("button", "sv-fermer", "×"); fermer.type = "button"; fermer.setAttribute("aria-label", "Fermer");
    fermer.addEventListener("click", fermerFenetre);
    tete.appendChild(fermer);
    fenetre.appendChild(tete);
    if (!f) { fenetre.appendChild(el("p", "sv-texte", "Impossible de charger les anecdotes pour le moment.")); return; }
    fenetre.appendChild(el("p", "sv-titre", f.t));
    fenetre.appendChild(el("p", "sv-texte", f.x));
    var actions = el("div", "sv-actions");
    var autre = el("button", "sv-autre", "Un autre"); autre.type = "button";
    autre.addEventListener("click", function () { montrer(tirer()); });
    actions.appendChild(autre);
    if (f.u) { var a = el("a", "sv-lien", "Lire la page →"); a.href = f.u; actions.appendChild(a); }
    fenetre.appendChild(actions);
  }
  function ouvrir() { charger(function () { montrer(tirer()); fenetre.hidden = false; bouton.setAttribute("aria-expanded", "true"); }); }
  function fermerFenetre() { fenetre.hidden = true; bouton.setAttribute("aria-expanded", "false"); bouton.focus(); }

  bouton.addEventListener("click", function () { if (fenetre.hidden) ouvrir(); else fermerFenetre(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !fenetre.hidden) fermerFenetre(); });
  document.addEventListener("click", function (e) {
    if (!fenetre.hidden && !fenetre.contains(e.target) && !bouton.contains(e.target)) { fenetre.hidden = true; bouton.setAttribute("aria-expanded", "false"); }
  });
})();
