// Ship shapes from the game (48×48 grid). Shared by the demo and the ships section.
(function () {
  function c(x, y, r) {
    return "M" + (x - r) + " " + y + "a" + r + " " + r + " 0 1 0 " + 2 * r + " 0a" + r + " " + r + " 0 1 0 " + -2 * r + " 0z";
  }
  var SHIPS = {
    shooter: {
      name: "Shooter",
      shade: "M6 20h6v16h-6z M36 20h6v16h-6z M7.5 13h3v6h-3z M37.5 13h3v6h-3z",
      main: c(24, 28, 12),
      cut: c(24, 14, 5) + " " + c(24, 29, 3.5)
    },
    scatter: {
      name: "Scatter",
      shade: "M5 34h38v6h-38z M3 22h4v12h-4z M41 22h4v12h-4z",
      main: "M7 34A17 17 0 0 1 41 34Z",
      cut: c(24, 15, 5) + " " + c(14, 29, 2.4) + " " + c(24, 24, 2.8) + " " + c(34, 29, 2.4)
    },
    venom: {
      name: "Venom",
      shade: "M7 23L14 27L14 34L5 34Z M41 23L34 27L34 34L43 34Z",
      main: "M24 10L37 27L24 43L11 27Z",
      cut: c(24, 27, 2.6) + " " + c(24, 18, 1.6)
    }
  };

  // Returns an SVG string. colours: { body, wing, cut }
  function shipSVG(kind, colours, size, label) {
    var s = SHIPS[kind];
    return (
      '<svg viewBox="0 0 48 48" width="' + size + '" height="' + size + '" ' +
      (label ? 'role="img" aria-label="' + label + '"' : 'aria-hidden="true"') + ">" +
      '<path d="' + s.shade + '" fill="' + colours.wing + '" stroke="' + colours.wing + '" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="' + s.main + '" fill="' + colours.body + '" stroke="' + colours.body + '" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="' + s.cut + '" fill="' + colours.cut + '"/>' +
      "</svg>"
    );
  }

  window.SpilloverShips = { SHIPS: SHIPS, shipSVG: shipSVG };
})();
