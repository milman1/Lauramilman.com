(function () {
  'use strict';
  var hues = ['Blue', 'Pink', 'Yellow', 'Green', 'Orange', 'Brown'];
  function eligible(s) {
    return s.image && s.video && s.certificate && s.tags.includes('colored-stone-feed') && Number(s.carat) > 0 && Number(s.price) > 0;
  }
  function hue(s) { return hues.find(function (c) { return s.tags.includes(c); }) || ''; }
  function intensity(s) { return String(s.color || '').replace(new RegExp('\\s+' + hue(s) + '$'), ''); }
  function filterStones(stones, filters, sort) {
    var result = stones.filter(function (s) {
      if (!eligible(s)) return false;
      var fields = { shape:s.shape, color:hue(s), intensity:intensity(s), clarity:s.clarity };
      if (!Object.keys(fields).every(function (key) { return !filters[key]?.length || filters[key].includes(fields[key]); })) return false;
      return ['carat','price'].every(function (key) {
        var value = Number(s[key]);
        return (filters['min_'+key] == null || value >= filters['min_'+key]) && (filters['max_'+key] == null || value <= filters['max_'+key]);
      });
    });
    var key = sort.startsWith('carat') ? 'carat' : 'price', direction = sort.endsWith('desc') ? -1 : 1;
    return result.sort(function (a,b) { return direction * (Number(a[key])-Number(b[key])) || String(a.id).localeCompare(String(b.id)); });
  }
  if (typeof module !== 'undefined') module.exports = {filterStones:filterStones};
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-colored-diamonds]').forEach(async function (root) {
    if (root.dataset.initialized) return;
    root.dataset.initialized = 'true';
    var form = root.querySelector('[data-colored-form]'), count = root.querySelector('[data-colored-count]');
    var results = root.querySelector('[data-colored-results]'), pager = root.querySelector('[data-colored-pager]'), sort = root.querySelector('[data-colored-sort]');
    var apply = root.querySelector('[data-colored-apply]'), stones = [], page = 1, ready = false;
    var params = new URLSearchParams(location.search);
    ['shape','color','intensity','clarity'].forEach(function (name) {
      var selected = (params.get(name) || '').split(',');
      form.querySelectorAll('input[name="'+name+'"]').forEach(function (input) { input.checked = selected.includes(input.value); });
    });
    ['min_carat','max_carat','min_price','max_price'].forEach(function (name) { if (params.has(name)) form.elements[name].value = params.get(name); });
    if (Array.from(sort.options).some(function (o) { return o.value === params.get('sort'); })) sort.value = params.get('sort');
    function filters() {
      var f = {}, data = new FormData(form);
      ['shape','color','intensity','clarity'].forEach(function (name) { f[name] = data.getAll(name); });
      var bounds = { carat: [0, 30], price: [0, 250000] };
      ['carat','price'].forEach(function (key) {
        var min = data.get('min_'+key), max = data.get('max_'+key);
        var minN = min === '' ? null : Number(min), maxN = max === '' ? null : Number(max);
        f['min_'+key] = minN == null || minN <= bounds[key][0] ? null : minN;
        f['max_'+key] = maxN == null || maxN >= bounds[key][1] ? null : maxN;
      });
      return f;
    }
    function syncUrl(f) {
      var url = new URL(location.href);
      ['shape','color','intensity','clarity','min_carat','max_carat','min_price','max_price','sort','page'].forEach(function (name) { url.searchParams.delete(name); });
      Object.keys(f).forEach(function (key) { var value = Array.isArray(f[key]) ? f[key].join(',') : f[key]; if (value !== null && value !== '') url.searchParams.set(key,String(value)); });
      url.searchParams.set('sort',sort.value);
      history.replaceState(null,'',url);
    }
    function render(updateUrl) {
      if (!ready) return;
      var f = filters(), matched = filterStones(stones,f,sort.value), pages = Math.max(1,Math.ceil(matched.length/24));
      page = Math.min(page,pages);
      if (updateUrl) syncUrl(f);
      count.textContent = matched.length ? matched.length+' '+count.dataset.countLabel : count.dataset.empty;
      results.replaceChildren();
      var money = new Intl.NumberFormat(document.documentElement.lang || 'en-US',{style:'currency',currency:root.dataset.currency || 'USD'});
      matched.slice((page-1)*24,page*24).forEach(function (s) {
        var card = document.createElement('article'); card.className = 'product-card';
        var link = document.createElement('a'); link.className = 'product-card__image-wrapper'; link.href = s.url;
        var wrap = document.createElement('div'); wrap.className = 'product-card__image-container';
        var img = document.createElement('img'); img.src = s.image; img.alt = s.title; img.loading = 'lazy'; img.width = 600; img.height = 600; img.className = 'product-card__image product-card__image--primary'; wrap.append(img);
        var body = document.createElement('div'); body.className = 'product-card__content';
        var title = document.createElement('h2'); title.className = 'product-card__title'; var titleLink = document.createElement('a'); titleLink.href = s.url; titleLink.textContent = s.title; title.append(titleLink);
        var price = document.createElement('p'); price.className = 'product-card__price'; price.textContent = money.format(s.price);
        body.append(title,price); link.append(img); card.append(link,body); results.append(card);
      });
      pager.replaceChildren();
      if (pages > 1) {
        [['prev',-1,page===1],['next',1,page===pages]].forEach(function (entry) {
          var button = document.createElement('button'); button.type = 'button'; button.textContent = pager.dataset[entry[0]]; button.disabled = entry[2];
          button.addEventListener('click',function () { page += entry[1]; render(false); results.scrollIntoView({block:'start'}); }); pager.append(button);
          if (entry[0] === 'prev') { var label = document.createElement('span'); label.textContent = pager.dataset.page+' '+page+' / '+pages; pager.append(label); }
        });
      }
      form.querySelectorAll('.lm-shape').forEach(function (label) { label.classList.toggle('is-active',label.querySelector('input').checked); });
    }
    form.addEventListener('submit',function (event) { event.preventDefault(); page = 1; render(true); });
    function paintScale(scale) {
      var stops = Array.prototype.slice.call(scale.querySelectorAll('[data-grade]'));
      var fill = scale.querySelector('[data-scale-fill]');
      var hint = scale.parentNode.querySelector('[data-scale-hint]');
      var noun = scale.dataset.hintNoun || (hint ? hint.textContent : '');
      scale.dataset.hintNoun = noun;
      var picked = [];
      stops.forEach(function (stop) {
        var on = stop.querySelector('input').checked;
        stop.classList.toggle('is-in-range', on);
        stop.classList.toggle('is-floor', on);
        if (on) picked.push(stop.dataset.grade);
      });
      if (fill) { fill.style.left = '0%'; fill.style.right = '100%'; }
      if (hint) hint.textContent = picked.length ? picked.join(', ') : noun;
    }
    function paintRange(wrap) {
      var minEl = wrap.querySelector('[data-range-min]');
      var maxEl = wrap.querySelector('[data-range-max]');
      var fill = wrap.querySelector('[data-range-fill]');
      if (!fill || !minEl || !maxEl) return;
      var floor = Number(wrap.dataset.floor || 0);
      var ceil = Number(wrap.dataset.ceil || 100);
      var min = minEl.value === '' ? floor : Number(minEl.value);
      var max = maxEl.value === '' ? ceil : Number(maxEl.value);
      if (!Number.isFinite(min)) min = floor;
      if (!Number.isFinite(max)) max = ceil;
      var span = ceil - floor || 1;
      var left = Math.max(0, Math.min(100, ((min - floor) / span) * 100));
      var right = Math.max(0, Math.min(100, ((max - floor) / span) * 100));
      fill.style.left = Math.min(left, right) + '%';
      fill.style.right = (100 - Math.max(left, right)) + '%';
    }
    form.querySelectorAll('[data-scale]').forEach(function (scale) {
      if (scale.dataset.wired) return;
      scale.dataset.wired = 'true';
      scale.querySelectorAll('[data-grade]').forEach(function (stop) {
        stop.addEventListener('click', function (event) {
          event.preventDefault();
          var input = stop.querySelector('input');
          input.checked = !input.checked;
          paintScale(scale);
        });
      });
      paintScale(scale);
    });
    form.querySelectorAll('[data-range]').forEach(function (wrap) {
      wrap.querySelectorAll('input').forEach(function (input) {
        input.addEventListener('input', function () { paintRange(wrap); });
      });
      paintRange(wrap);
    });
    form.addEventListener('reset',function () { setTimeout(function () { sort.value = 'price_asc'; page = 1; form.querySelectorAll('[data-scale]').forEach(paintScale); form.querySelectorAll('[data-range]').forEach(paintRange); render(true); },0); });
    sort.addEventListener('change',function () { page = 1; render(true); });
    count.textContent = count.dataset.loading;
    try {
      var initial = JSON.parse(root.querySelector('[data-colored-data]').textContent), expectedPages = initial.pages;
      var collected = initial.stones;
      for (var i = 1; i <= expectedPages; i++) {
        if (i === initial.page) continue;
        var url = new URL(location.href); url.search = ''; url.searchParams.set('section_id',root.dataset.section); url.searchParams.set('page',i);
        if (params.has('preview_theme_id')) url.searchParams.set('preview_theme_id',params.get('preview_theme_id'));
        var response = await fetch(url,{headers:{Accept:'text/html'}});
        if (!response.ok) throw new Error('Catalog unavailable');
        var doc = new DOMParser().parseFromString(await response.text(),'text/html'), node = doc.querySelector('[data-colored-data]');
        if (!node) throw new Error('Catalog incomplete');
        var next = JSON.parse(node.textContent);
        if (next.page !== i || next.pages !== expectedPages) throw new Error('Catalog changed');
        collected = collected.concat(next.stones);
      }
      stones = Array.from(new Map(collected.map(function (s) { return [s.id,s]; })).values());
      ready = true; apply.disabled = false; render(false);
    } catch (error) { count.textContent = count.dataset.error; }
  });
})();
