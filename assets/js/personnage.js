/* Pages « Personnages » : onglets des fiches longues et filtre par lieu de l'annuaire.
   Sans JavaScript, tous les panneaux s'affichent à la suite et l'annuaire montre tout. */
(function () {
  'use strict';
  var racine = document.querySelector('.p-a-onglets');
  if (racine) {
    var onglets = racine.querySelector('.p-onglets');
    var panneaux = racine.querySelectorAll('.p-panneau');
    if (onglets && panneaux.length > 1) {
      document.documentElement.classList.add('p-js');
      onglets.hidden = false;
      var boutons = onglets.querySelectorAll('button');
      var afficher = function (id) {
        boutons.forEach(function (b) { b.setAttribute('aria-selected', b.dataset.p === id ? 'true' : 'false'); });
        panneaux.forEach(function (p) { p.hidden = p.id !== id; });
      };
      boutons.forEach(function (b) {
        b.addEventListener('click', function () { afficher(b.dataset.p); history.replaceState(null, '', '#' + b.dataset.p); });
      });
      var depart = location.hash.slice(1);
      afficher(document.getElementById(depart) && Array.prototype.some.call(panneaux, function (p) { return p.id === depart; }) ? depart : boutons[0].dataset.p);
    }
  }
  var filtres = document.querySelectorAll('.p-filtres button');
  filtres.forEach(function (b) {
    b.addEventListener('click', function () {
      filtres.forEach(function (x) { x.classList.toggle('on', x === b); });
      document.querySelectorAll('[data-l]').forEach(function (e) {
        if (e.tagName === 'BUTTON') return;
        e.hidden = b.dataset.l !== 'tous' && (' ' + e.dataset.l + ' ').indexOf(' ' + b.dataset.l + ' ') === -1;
      });
    });
  });
})();
