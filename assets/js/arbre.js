/* Arbres généalogiques : bouton « Agrandir » ouvrant l'image en taille réelle (déplaçable à la souris, zoom + / −). */
(function () {
  var fenetre = null, image = null, zone = null, echelle = 1, natif = { w: 0, h: 0 }, precedent = null;

  function creer() {
    fenetre = document.createElement('div');
    fenetre.className = 'arbre-zoom';
    fenetre.hidden = true;
    fenetre.setAttribute('role', 'dialog');
    fenetre.setAttribute('aria-modal', 'true');
    fenetre.setAttribute('aria-label', 'Arbre généalogique agrandi');
    fenetre.innerHTML =
      '<div class="arbre-zoom-barre">' +
      '<button type="button" data-a="moins" aria-label="Zoom arrière">−</button>' +
      '<span class="arbre-zoom-pct" aria-live="polite"></span>' +
      '<button type="button" data-a="plus" aria-label="Zoom avant">+</button>' +
      '<button type="button" data-a="reel">Taille réelle</button>' +
      '<button type="button" data-a="ecran">Ajuster à l’écran</button>' +
      '<button type="button" data-a="fermer" class="arbre-zoom-fermer">Fermer ✕</button>' +
      '</div>' +
      '<div class="arbre-zoom-zone" tabindex="0"><img alt=""></div>' +
      '<p class="arbre-zoom-aide">Glissez pour vous déplacer · molette ou +/− pour zoomer · Échap pour fermer</p>';
    document.body.appendChild(fenetre);
    zone = fenetre.querySelector('.arbre-zoom-zone');
    image = zone.querySelector('img');

    fenetre.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) { action(b.dataset.a); return; }
      if (e.target === fenetre) fermer();
    });
    document.addEventListener('keydown', function (e) {
      if (fenetre.hidden) return;
      if (e.key === 'Escape') fermer();
      else if (e.key === '+' || e.key === '=') action('plus');
      else if (e.key === '-') action('moins');
    });
    zone.addEventListener('wheel', function (e) {
      e.preventDefault();
      zoomer(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX, e.clientY);
    }, { passive: false });

    var glisse = null;
    zone.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      glisse = { x: e.clientX, y: e.clientY, l: zone.scrollLeft, t: zone.scrollTop };
      zone.setPointerCapture(e.pointerId);
      zone.classList.add('glisse');
    });
    zone.addEventListener('pointermove', function (e) {
      if (!glisse) return;
      zone.scrollLeft = glisse.l - (e.clientX - glisse.x);
      zone.scrollTop = glisse.t - (e.clientY - glisse.y);
    });
    function fin() { glisse = null; zone.classList.remove('glisse'); }
    zone.addEventListener('pointerup', fin);
    zone.addEventListener('pointercancel', fin);
  }

  function appliquer(x, y) {
    var avant = { w: image.width || 1, h: image.height || 1 };
    var cx = x === undefined ? zone.clientWidth / 2 : x - zone.getBoundingClientRect().left;
    var cy = y === undefined ? zone.clientHeight / 2 : y - zone.getBoundingClientRect().top;
    var rx = (zone.scrollLeft + cx) / avant.w, ry = (zone.scrollTop + cy) / avant.h;
    image.style.width = Math.round(natif.w * echelle) + 'px';
    image.style.height = Math.round(natif.h * echelle) + 'px';
    zone.scrollLeft = rx * image.width - cx;
    zone.scrollTop = ry * image.height - cy;
    fenetre.querySelector('.arbre-zoom-pct').textContent = Math.round(echelle * 100) + ' %';
  }

  function zoomer(f, x, y) {
    echelle = Math.min(4, Math.max(0.1, echelle * f));
    appliquer(x, y);
  }

  function ajuster() {
    echelle = Math.min(1, Math.min((zone.clientWidth - 8) / natif.w, (zone.clientHeight - 8) / natif.h)) || 1;
    appliquer();
    zone.scrollLeft = 0; zone.scrollTop = 0;
  }

  function action(a) {
    if (a === 'fermer') fermer();
    else if (a === 'plus') zoomer(1.25);
    else if (a === 'moins') zoomer(1 / 1.25);
    else if (a === 'reel') { echelle = 1; appliquer(); }
    else if (a === 'ecran') ajuster();
  }

  function ouvrir(src, alt) {
    if (!fenetre) creer();
    precedent = document.activeElement;
    image.onload = function () {
      natif = { w: image.naturalWidth, h: image.naturalHeight };
      /* départ en taille réelle (100 %) : texte et pixels nets ; « Ajuster à l'écran » donne la vue d'ensemble */
      echelle = 1;
      image.style.width = natif.w + 'px'; image.style.height = natif.h + 'px';
      appliquer(0, 0);
      zone.scrollLeft = 0; zone.scrollTop = 0;
    };
    image.style.width = image.style.height = '';
    image.alt = alt || '';
    image.src = src;
    fenetre.hidden = false;
    document.body.classList.add('arbre-zoom-ouvert');
    zone.focus();
  }

  function fermer() {
    fenetre.hidden = true;
    document.body.classList.remove('arbre-zoom-ouvert');
    if (precedent && precedent.focus) precedent.focus();
  }

  function init() {
    document.querySelectorAll('figure.arbre').forEach(function (fig) {
      var img = fig.querySelector('img');
      if (!img) return;
      var lien = fig.querySelector('a');
      var src = (lien && lien.getAttribute('href')) || img.getAttribute('src');
      var bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'arbre-agrandir';
      bouton.textContent = '🔍 Agrandir';
      bouton.addEventListener('click', function () { ouvrir(src, img.alt); });
      fig.appendChild(bouton);
      if (lien) lien.addEventListener('click', function (e) { e.preventDefault(); ouvrir(src, img.alt); });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
