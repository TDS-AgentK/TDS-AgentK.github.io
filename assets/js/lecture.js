/* Fil d'or de lecture (secours si le navigateur ne gère pas animation-timeline) et temps de lecture estimé.
   Estimation : mots ÷ 200 par minute (lecture attentive d'un texte documentaire en français, un peu plus lente
   que le roman : ~230-250 mots/min) + 4 s par image de contenu. Les menus, sommaires, boutons et widgets sont ignorés.
   Pages à onglets : le temps affiché est celui de l'onglet ouvert (et se met à jour au changement d'onglet). */
(function () {
  'use strict';

  // ---- Fil d'or ----
  var fil = document.querySelector('.fil-defilement i');
  var natif = window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()') &&
    !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (fil && !natif) {
    var maj = function () {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      fil.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, window.scrollY / h) : 0) + ')';
    };
    window.addEventListener('scroll', maj, { passive: true });
    window.addEventListener('resize', maj);
    maj();
  }

  // ---- Temps de lecture ----
  var main = document.getElementById('contenu');
  var h1 = main && main.querySelector('h1');
  if (!h1 || document.body.classList.contains('accueil')) return;
  if (/^\/(calendrier|economie|recherche|liste-de-magies|magie-2|histoire-chronologie|chronologie-historique|blog|bibliotheque|quizz-1|anciensquizz)\/?$/.test(location.pathname)) return;
  if (main.querySelector('canvas, .grimoire, [data-sans-lecture]')) return;

  var MOTS_PAR_MIN = 200, SEC_PAR_IMAGE = 4, SEUIL_MOTS = 250;
  var EXCLU = 'script, style, noscript, nav, form, button, select, aside, iframe, canvas, svg, .sommaire, .navigation, .musique, .p-onglets, .hier-barre, .dx-barre, .temps-lecture, .titre-race';

  function secondes(noeud) {
    var copie = noeud.cloneNode(true);
    Array.prototype.forEach.call(copie.querySelectorAll(EXCLU), function (e) { e.remove(); });
    Array.prototype.forEach.call(copie.querySelectorAll('h1'), function (e) { e.remove(); });
    var mots = (copie.textContent.match(/[\wÀ-ÿœŒ'’-]+/g) || []).length;
    var images = copie.querySelectorAll('img:not([width="52"])').length;
    return { mots: mots, s: mots / MOTS_PAR_MIN * 60 + images * SEC_PAR_IMAGE };
  }
  function libelle(s) {
    if (s < 45) return 'moins d\u2019une minute';
    return '\u2248 ' + Math.round(s / 60) + ' min';
  }

  var panneaux = main.querySelectorAll('[data-onglet], .p-panneau');
  var p = document.createElement('p');
  p.className = 'temps-lecture';
  var ancre = h1.closest('.titre-race') || h1;
  ancre.insertAdjacentElement('afterend', p);

  if (panneaux.length > 1) {
    var tout = secondes(main);
    var actif = function () {
      return Array.prototype.filter.call(panneaux, function (x) {
        return !x.hidden && getComputedStyle(x).display !== 'none';
      })[0];
    };
    var afficher = function () {
      var a = actif();
      if (!a) { p.hidden = true; return; }
      var t = secondes(a);
      p.hidden = false;
      p.textContent = 'Lecture de cet onglet : ' + libelle(t.s);
      p.title = 'Page entière : ' + libelle(tout.s);
    };
    main.addEventListener('change', afficher);
    main.addEventListener('click', function () { setTimeout(afficher, 0); });
    window.addEventListener('hashchange', function () { setTimeout(afficher, 0); });
    afficher();
  } else {
    var t = secondes(main);
    if (t.mots < SEUIL_MOTS) { p.remove(); return; }
    p.textContent = 'Lecture : ' + libelle(t.s);
  }
})();
