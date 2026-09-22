/* Mini-fenêtre d'aperçu (façon Wikipédia) sur les liens internes dans le texte des pages : au survol (ordinateur) ou
   au clic (tactile), affiche le titre, une image et un extrait de la page visée, sans y aller. Cliquer dedans (ou sur
   le lien une seconde fois) y va vraiment. Ne lit que ce que la page cible envoie déjà (titre, <meta description>,
   première image du corps) : rien à construire côté serveur. */
(function () {
  'use strict';
  var SANS_HOVER = matchMedia('(hover: none)').matches;
  var DELAI = 550;                                    // temps de survol avant l'affichage ; l'anneau se remplit pendant ce délai
  var CIRCONFERENCE = 2 * Math.PI * 13;
  var cache = {};                                    // href -> {titre, desc, image} | 'erreur' | Promise
  var carte = null, anneau = null, lienActif = null, minuteurOuverture = null, minuteurFermeture = null;

  function creerAnneau() {
    if (anneau) return anneau;
    anneau = document.createElement('div');
    anneau.className = 'apercu-anneau';
    anneau.hidden = true;
    anneau.innerHTML =
      '<svg viewBox="0 0 32 32" aria-hidden="true">' +
      '<circle class="apercu-fond" cx="16" cy="16" r="13"></circle>' +
      '<circle class="apercu-progres" cx="16" cy="16" r="13" stroke-dasharray="' + CIRCONFERENCE + '" stroke-dashoffset="' + CIRCONFERENCE + '"></circle>' +
      '</svg><img src="/assets/img/icones/I_Clock.png" alt="" width="14" height="14">';
    document.body.appendChild(anneau);
    return anneau;
  }
  function positionnerAnneau(lien) {
    var r = lien.getBoundingClientRect();
    anneau.style.left = (window.scrollX + r.right + 4) + 'px';
    anneau.style.top = (window.scrollY + r.top + r.height / 2 - 11) + 'px';
  }
  function cacherAnneau() {
    if (!anneau) return;
    anneau.hidden = true;
    anneau.classList.remove('en-cours');
    var p = anneau.querySelector('.apercu-progres');
    if (p) p.style.animation = 'none';
  }

  function creerCarte() {
    if (carte) return carte;
    carte = document.createElement('div');
    carte.className = 'apercu-carte';
    carte.hidden = true;
    carte.addEventListener('mouseenter', function () { clearTimeout(minuteurFermeture); });
    carte.addEventListener('mouseleave', function () { programmerFermeture(); });
    document.body.appendChild(carte);
    return carte;
  }

  function extraire(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var titre = (doc.querySelector('title') || {}).textContent || '';
    titre = titre.replace(/\s*\|\s*Temple du Savoir\s*$/, '').trim();
    var m = doc.querySelector('meta[name="description"]');
    var desc = m ? (m.getAttribute('content') || '').trim() : '';
    // on évite les petites icônes/ornements décoratifs (plumes de section, sprites de dieu/race, icônes...) : seule une vraie
    // illustration de contenu (portrait, capture, carte...) sert d'aperçu ; sinon la carte reste juste texte.
    var candidats = doc.querySelectorAll('#contenu img[src]');
    var image = '';
    for (var i = 0; i < candidats.length; i++) {
      var src = candidats[i].getAttribute('src') || '';
      if (!src || /\/assets\/img\/(icones|pages)\//.test(src) || /-sprite\.\w+$/.test(src) || candidats[i].closest('.p-hero, header, nav')) continue;
      image = src;
      break;
    }
    if (image && image.indexOf('http') !== 0 && image.indexOf('/') !== 0) image = '';
    return { titre: titre, desc: desc, image: image };
  }

  function charger(href) {
    if (cache[href]) return Promise.resolve(cache[href]).then(function (v) { return v === 'erreur' ? Promise.reject() : v; });
    var p = fetch(href, { credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw 0; return r.text(); })
      .then(function (t) { var v = extraire(t); cache[href] = v; return v; })
      .catch(function (e) { cache[href] = 'erreur'; throw e; });
    return p;
  }

  function positionner(c, lien) {
    var r = lien.getBoundingClientRect(), cw = 300, marge = 10;
    c.style.maxWidth = cw + 'px';
    var gauche = Math.min(Math.max(r.left, marge), innerWidth - cw - marge);
    var haut = r.bottom + 8;
    c.style.left = gauche + 'px';
    c.style.top = (window.scrollY + haut) + 'px';
    var rc = c.getBoundingClientRect();
    if (rc.bottom > innerHeight - marge) c.style.top = (window.scrollY + r.top - rc.height - 8) + 'px';
  }

  function afficher(lien) {
    lienActif = lien;
    cacherAnneau();
    var c = creerCarte();
    var href = lien.getAttribute('href');
    charger(href).then(function (info) {
      if (lienActif !== lien) return;                // le survol a déjà changé de lien : pas d'affichage périmé
      if (!info.titre && !info.desc && !info.image) { c.hidden = true; return; }
      c.innerHTML = (info.image ? '<img class="apercu-img" src="' + info.image + '" alt="" loading="lazy">' : '')
        + '<div class="apercu-txt"><b>' + esc(info.titre) + '</b>' + (info.desc ? '<p>' + esc(info.desc) + '</p>' : '') + '</div>';
      c.hidden = false;
      positionner(c, lien);
    }).catch(function () { if (lienActif === lien) c.hidden = true; });
  }

  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  function programmerOuverture(lien) {
    clearTimeout(minuteurFermeture); clearTimeout(minuteurOuverture);
    var a = creerAnneau();
    positionnerAnneau(lien);
    a.hidden = false;
    var p = a.querySelector('.apercu-progres');
    p.style.animation = 'none';
    void p.offsetWidth;                                // force le navigateur à relancer l'animation à zéro à chaque survol
    p.style.animation = 'apercu-remplir ' + DELAI + 'ms steps(10, end) forwards';
    minuteurOuverture = setTimeout(function () { afficher(lien); }, DELAI);
  }
  function programmerFermeture() {
    clearTimeout(minuteurFermeture);
    cacherAnneau();
    minuteurFermeture = setTimeout(function () { if (carte) carte.hidden = true; lienActif = null; }, 220);
  }

  function estUnLienDePage(a) {
    var href = a.getAttribute('href') || '';
    if (a.dataset.sansApercu !== undefined) return false;
    if (!href.startsWith('/') || href.startsWith('//')) return false;
    if (/\.(pdf|zip|jpg|jpeg|png|gif|webp|svg|mp3)$/i.test(href)) return false;
    if (href.indexOf('/assets/') === 0) return false;
    return true;
  }

  function init() {
    var liens = document.querySelectorAll('#contenu :is(p, li, dd, dt, blockquote, td) a[href]');
    liens.forEach(function (a) {
      if (!estUnLienDePage(a)) return;
      a.classList.add('lien-apercu');
      if (SANS_HOVER) {
        a.addEventListener('click', function (ev) {
          if (a.dataset.apercuVu) return;               // déjà montré : ce clic-ci va vraiment sur la page
          ev.preventDefault();
          a.dataset.apercuVu = '1';
          afficher(a);
        });
      } else {
        a.addEventListener('mouseenter', function () { programmerOuverture(a); });
        a.addEventListener('mouseleave', function () { clearTimeout(minuteurOuverture); programmerFermeture(); });
        a.addEventListener('focus', function () { afficher(a); });
        a.addEventListener('blur', function () { programmerFermeture(); });
      }
    });
    if (SANS_HOVER) {
      document.addEventListener('click', function (ev) {
        if (carte && !carte.hidden && !carte.contains(ev.target) && ev.target !== lienActif) { carte.hidden = true; lienActif = null; }
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
