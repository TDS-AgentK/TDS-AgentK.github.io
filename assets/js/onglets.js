/* Ouvre l'onglet qui contient l'ancre demandée (sommaire, lien direct « #grades-de-l-armee »...). Sans JavaScript, les onglets restent utilisables. */
(function () {
  function ouvrir() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    var cible = document.getElementById(id);
    var panneau = cible && cible.closest ? cible.closest(".hier-panneau") : null;
    if (!panneau) return;
    var radio = document.getElementById("o-" + panneau.getAttribute("data-onglet"));
    if (radio && !radio.checked) { radio.checked = true; }
    cible.scrollIntoView();
  }
  window.addEventListener("hashchange", ouvrir);
  ouvrir();
})();
