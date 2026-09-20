/* Progression du travail : pourcentage de chaque État et tableau comparatif (données : data/progression-etats.json, injectées par build.py).
   Le pourcentage compte les sections rédactionnelles ; la zone et les races sur la carte sont des outils affichés à part. */
(function () {
  var brut = document.getElementById('donnees-progression'), dlg = document.getElementById('pg'), corps = document.getElementById('pg-corps');
  if (!brut || !dlg) return;
  var D = JSON.parse(brut.textContent);
  function pct(e) { var t = 0, n = 0; D.sections.forEach(function (s, i) { if (s.type === 'redac' && e.v[i] !== null) { n++; t += e.v[i]; } }); return Math.round(100 * t / n); }
  function get(id) { return D.etats.filter(function (x) { return x.id === id; })[0]; }
  document.querySelectorAll('.pb-mini, .pb-ouvrir').forEach(function (b) { b.hidden = false; });
  document.querySelectorAll('.pb-mini').forEach(function (b) { var e = get(b.dataset.etat), p = pct(e); b.style.setProperty('--p', p + '%'); b.style.setProperty('--c', e.couleur); b.querySelector('.pb-val').textContent = p + ' %'; });
  function icone(v) { return v === 1 ? '<span class="st s1">✓</span>' : v === 0.5 ? '<span class="st s05">½</span>' : v === 0 ? '<span class="st s0">·</span>' : '<span class="st sn">–</span>'; }
  function ouvrir(focus) {
    var h = '<div class="pb-titre"><img class="pg-plume" src="/assets/img/pages/de3be8_2ed8809a508347c1a0902895f2298f5d.png" alt=""><h2>Progression du travail</h2></div>';
    h += '<ul class="pb-legende"><li><span class="st s1">✓</span> terminé</li><li><span class="st s05">½</span> partiel</li><li><span class="st s0">·</span> à écrire</li><li><span class="st sn">–</span> sans objet</li></ul>';
    h += '<div class="pb-cadre"><table class="pb-table"><thead><tr><th class="pb-sec">Section</th>';
    D.etats.forEach(function (e) {
      var p = pct(e);
      h += '<th style="--c:' + e.couleur + '" class="' + (e.id === focus ? 'pb-focus' : '') + '"><div class="pb-tete"><div class="pg-anneau" style="--t:52px;--p:' + p + ';--c:' + e.couleur + '"><b>' + p + '%</b></div><span>' + e.court + '</span></div></th>';
    });
    h += '</tr></thead><tbody>';
    ['redac', 'outil'].forEach(function (type) {
      h += '<tr class="pb-sep"><th colspan="' + (D.etats.length + 1) + '">' + (type === 'redac' ? 'Contenu à rédiger' : 'Outils de la carte') + '</th></tr>';
      D.sections.forEach(function (s, i) {
        if (s.type !== type) return;
        h += '<tr><th class="pb-sec">' + s.nom + '</th>';
        D.etats.forEach(function (e) {
          var v = e.v[i], n = e.notes[s.id];
          h += '<td class="' + (v === 1 ? 'c1' : v === 0.5 ? 'c05' : v === null ? 'cn' : '') + (e.id === focus ? ' pb-focus' : '') + '">' + icone(v) + (n ? '<small>' + n + '</small>' : '') + '</td>';
        });
        h += '</tr>';
      });
    });
    h += '</tbody></table></div><p class="pb-pied">Le pourcentage compte les 12 sections rédactionnelles (page dédiée + sections 1 à 11) ; la zone et les races sur la carte sont des outils, affichés à part. Chaque texte envoyé sur le Discord du Temple du Savoir fait avancer le tableau.</p>';
    corps.innerHTML = h; dlg.showModal();
    var f = corps.querySelector('th.pb-focus'); if (f) f.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  document.querySelectorAll('.pb-mini, .pb-ouvrir').forEach(function (b) { b.addEventListener('click', function () { ouvrir(b.dataset.etat); }); });
  dlg.querySelector('.pg-fermer').addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
})();
