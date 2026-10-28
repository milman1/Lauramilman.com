/**
 * Turns a search-bar phrase such as "1 ct oval" or "natural 1.51ct round F VS1"
 * into a diamond-filter link. Jewelry, watches, and brand searches return null
 * so they stay on the product search.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LMNYDiamondQuery = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var DIAMOND_API = 'https://smwdrjpmuvwosepphufj.supabase.co/functions/v1/diamonds';
  /* Public anon key already shipped in the diamond-filter section settings. */
  var DIAMOND_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtd2RyanBtdXZ3b3NlcHBodWZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2NTM0ODYsImV4cCI6MjEwMTIyOTQ4Nn0.WDkghovX7j1rJkzM9gD-oHxSayKKiPltM1-gjld-2bQ';

  /* Longer names first so "Oval Step Cut" wins over "Oval". */
  var SHAPES = [
    'Dutch Marquise Step', 'Oval Step Cut', 'Cushion Brilliant', 'Cushion Modified',
    'Dutch Marquise', 'Marquise Step', 'European Cut', 'Old European',
    'Oldmine Pear', 'Oldmine Oval', 'Horse Head', 'Half Moon', 'Lady Heart',
    'Oval Step', 'Pear Step', 'Criss Cut', 'Old Miner', 'Portuguese',
    'Princess', 'Trilliant', 'Triangle', 'Butterfly', 'Hexagonal', 'Pentagonal',
    'Trapezoid', 'Marquise', 'Radiant', 'Asscher', 'Cushion', 'Emerald',
    'Octagonal', 'Cadillac', 'Lozenge', 'Capsule', 'Ashoka', 'Shield',
    'Bullet', 'Moval', 'Round', 'Heart', 'Pear', 'Kite', 'Horse', 'Oval',
  ];
  SHAPES.sort(function (a, b) { return b.length - a.length || a.localeCompare(b); });

  var SHAPE_QUERY = {
    'Half Moon': ['Halfmoon', 'Half Moon'],
    Hexagonal: ['Hexagonal', 'Hexagonal Step'],
    Lozenge: ['Lozenge', 'Lozenge Step', 'Lozenge Step Cut'],
    Pentagonal: ['Pentagonal', 'Pentagonal Step'],
    Kite: ['Kite', 'Kite Step Cut', 'Kite Step'],
    'European Cut': ['Europeancut', 'European Cut'],
  };

  var PRODUCT_WORD =
    /\b(?:rings?|necklaces?|bracelets?|earrings?|settings?|chains?|watches?|bands?|pendants?|brooches?|hoops?|studs?|tennis|engagement|wedding|jewelry|jewellery|rolex|cartier|tiffany|chopard|bulgari|bvlgari|omega|patek)\b/i;
  var CLARITY = /\b(FL|IF|VVS1|VVS2|VS1|VS2|SI1|SI2)\b/gi;
  var COLOR = /\b([D-M])\b/gi;
  var SIZE = /(\d+(?:\.\d+)?)[\s-]*(?:ct|carats?)/i;

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function formatCarat(n) {
    var rounded = round2(n);
    return String(rounded);
  }

  function queryValues(shape) {
    return (SHAPE_QUERY[shape] || [shape]).slice();
  }

  function plural(label) {
    var word = String(label || '').toLowerCase();
    if (!word) return 'diamonds';
    if (/s$/i.test(word)) return word + 'es';
    return word + 's';
  }

  function parseDiamondQuery(raw) {
    var text = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!text || PRODUCT_WORD.test(text)) return null;

    var size = text.match(SIZE);
    if (!size) return null;
    var anchor = Number(size[1]);
    if (!Number.isFinite(anchor) || anchor <= 0 || anchor > 30) return null;
    var precise = /\.\d*[1-9]/.test(size[1]);
    var minCarat = precise ? round2(anchor - 0.05) : round2(anchor * 0.9);
    var maxCarat = precise ? round2(anchor + 0.05) : round2(anchor * 1.1);
    if (minCarat < 0.01) minCarat = 0.01;

    var shapes = [];
    var lower = text.replace(SIZE, ' ').toLowerCase();
    var index = 0;
    while (index < lower.length) {
      var match = null;
      for (var i = 0; i < SHAPES.length; i++) {
        var name = SHAPES[i];
        var needle = name.toLowerCase();
        if (lower.indexOf(needle, index) !== index) continue;
        var before = index === 0 || !/[a-z]/i.test(lower.charAt(index - 1));
        var afterAt = index + needle.length;
        var after = afterAt >= lower.length || !/[a-z]/i.test(lower.charAt(afterAt));
        if (before && after) {
          match = name;
          break;
        }
      }
      if (match) {
        shapes.push(match);
        index += match.length;
      } else {
        index += 1;
      }
    }
    if (!shapes.length) return null;

    var clarities = [];
    var clarityMatch;
    var clarityPattern = new RegExp(CLARITY.source, 'gi');
    while ((clarityMatch = clarityPattern.exec(text))) {
      var grade = clarityMatch[1].toUpperCase();
      if (clarities.indexOf(grade) === -1) clarities.push(grade);
    }

    var withoutClarity = text.replace(clarityPattern, ' ');
    var colors = [];
    var colorMatch;
    var colorPattern = new RegExp(COLOR.source, 'gi');
    while ((colorMatch = colorPattern.exec(withoutClarity))) {
      var color = colorMatch[1].toUpperCase();
      if (colors.indexOf(color) === -1) colors.push(color);
    }

    var kind = /\b(?:natural|mined)\b/i.test(text) && !/\blab\b/i.test(text) ? 'natural' : 'lab';
    var shapeQuery = [];
    shapes.forEach(function (shape) {
      queryValues(shape).forEach(function (value) {
        if (shapeQuery.indexOf(value) === -1) shapeQuery.push(value);
      });
    });

    var shapeWords = shapes.length === 1 ? shapes[0] : shapes.join(' and ');
    var title = precise
      ? shapeWords + ' diamonds, ' + formatCarat(minCarat) + '\u2013' + formatCarat(maxCarat) + ' ct'
      : shapeWords + ' diamonds around ' + formatCarat(anchor) + ' ct';

    var detail = colors.concat(clarities).join(' \u00b7 ');
    var params = new URLSearchParams();
    params.set('shape', shapeQuery.join(','));
    params.set('min_carat', minCarat.toFixed(2));
    params.set('max_carat', maxCarat.toFixed(2));
    if (colors.length) params.set('color', colors.join(','));
    if (clarities.length) params.set('clarity', clarities.join(','));
    var path = kind === 'natural' ? '/collections/natural-diamonds' : '/collections/lab-grown-diamonds';

    var count = new URLSearchParams();
    count.set('kind', kind);
    count.set('page', '1');
    count.set('per_page', '12');
    count.set('sort', 'price_asc');
    count.set('shapes', shapeQuery.join(','));
    count.set('min_carat', minCarat.toFixed(2));
    count.set('max_carat', maxCarat.toFixed(2));
    if (colors.length) count.set('colors', colors.join(','));
    if (clarities.length) count.set('clarities', clarities.join(','));

    return {
      kind: kind,
      shapes: shapes,
      shapeQuery: shapeQuery,
      minCarat: minCarat,
      maxCarat: maxCarat,
      around: !precise,
      anchorCarat: anchor,
      colors: colors,
      clarities: clarities,
      title: title,
      detail: detail,
      href: path + '?' + params.toString(),
      countQuery: count.toString(),
    };
  }

  function shapeLabel(value) {
    var raw = String(value || '');
    var known = Object.keys(SHAPE_QUERY);
    for (var i = 0; i < known.length; i++) {
      if (SHAPE_QUERY[known[i]].join(',') === raw) return known[i];
    }
    return raw;
  }

  /**
   * Tokens from a ?shape= link, already lowercased, back into the strings
   * the diamond API stores.
   */
  function queryShapes(tokens) {
    var out = [];
    (tokens || []).forEach(function (token) {
      var key = String(token || '').trim().toLowerCase();
      if (!key) return;
      var canonical = null;
      for (var i = 0; i < SHAPES.length; i++) {
        if (SHAPES[i].toLowerCase() === key) {
          canonical = SHAPES[i];
          break;
        }
      }
      var values = canonical ? queryValues(canonical) : [key.replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); })];
      values.forEach(function (value) {
        if (out.indexOf(value) === -1) out.push(value);
      });
    });
    return out;
  }

  function diamondResultSummary(options) {
    var total = Number(options && options.total) || 0;
    var kind = options && options.kind === 'natural' ? 'natural' : 'lab-grown';
    var labels = (options && options.shapes) || [];
    var noun = !labels.length
      ? 'diamonds'
      : labels.length === 1
        ? plural(labels[0])
        : labels.map(plural).join(' and ');
    var text = total.toLocaleString('en-US') + ' ' + kind + ' ' + noun;
    if (options && options.minCarat != null && options.maxCarat != null) {
      text += ', ' + Number(options.minCarat).toFixed(2) + '\u2013' + Number(options.maxCarat).toFixed(2) + ' ct';
    }
    var grades = ((options && options.colors) || []).concat((options && options.clarities) || []);
    if (grades.length) text += ', ' + grades.join(' ');
    return text;
  }

  return {
    DIAMOND_API: DIAMOND_API,
    DIAMOND_ANON_KEY: DIAMOND_ANON_KEY,
    parseDiamondQuery: parseDiamondQuery,
    queryShapes: queryShapes,
    shapeLabel: shapeLabel,
    diamondResultSummary: diamondResultSummary,
  };
});
