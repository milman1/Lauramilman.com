/**
 * Laura Milman — Diamond API integration.
 * Functional code cloned from PD; cache keys, brand strings, and
 * generated descriptions rewritten for LM. Cloudflare worker URL is
 * left as a TODO — LM will need its own worker or fall back to
 * direct API.
 */

const DiamondAPI = {
  // ===========================================
  // CONFIGURATION
  // ===========================================

  // TODO: Deploy a dedicated LM Cloudflare Worker and replace this URL.
  // Until then, the JS will fall through to direct API on a 403/HTML response.
  workerUrl: '',

  useWorker: false,

  // TODO: Replace with LM Belgium Dia API key (or proxy via worker).
  apiKey: '',
  baseUrl: 'https://belgiumdia.com/api/developer-api/diamond',

  markup: 4,

  currentPage: 1,
  totalPages: 1,
  filters: {
    shapes: [],
    minCarat: 0.5,
    maxCarat: 30,
    minPrice: 0,
    maxPrice: 100000,
    colors: ['D', 'E', 'F', 'G', 'H', 'I', 'J'],
    clarities: ['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2'],
    cut: ['EX', 'VG', 'GD']
  },

  cacheKey: 'laura_milman_diamonds_cache',
  cacheExpiry: 5 * 60 * 1000,

  diamondsData: new Map(),
  lastCacheStatus: null,

  isInRingBuilderMode() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('ring_builder') === 'true';
  },

  _ringBuilderShapeAllowlist: null,

  applyRingBuilderUrlShapeLocks() {
    document.querySelectorAll('.shape-btn.shape-btn--rb-locked').forEach(btn => {
      btn.classList.remove('shape-btn--rb-locked');
      btn.disabled = false;
      btn.removeAttribute('aria-disabled');
    });

    const params = new URLSearchParams(window.location.search);
    const rawSingle = (params.get('shape') || '').trim().toLowerCase();
    const rawList = (params.get('shapes') || '').trim();

    const fromUrl = [];
    if (rawSingle) fromUrl.push(rawSingle);
    if (rawList) {
      rawList.split(',').forEach(s => {
        const t = s.trim().toLowerCase();
        if (t) fromUrl.push(t);
      });
    }
    const unique = [...new Set(fromUrl)];

    const knownShapes = Array.from(document.querySelectorAll('.shape-btn'))
      .map(b => b.dataset.shape).filter(Boolean);
    const valid = unique.filter(s => knownShapes.includes(s));

    if (!this.isInRingBuilderMode() || valid.length === 0) {
      this._ringBuilderShapeAllowlist = null;
      return false;
    }

    this._ringBuilderShapeAllowlist = valid;
    this.filters.shapes = [...valid];

    document.querySelectorAll('.shape-btn').forEach(btn => {
      const id = btn.dataset.shape;
      const allowed = valid.includes(id);
      btn.classList.toggle('active', allowed);
      if (!allowed) {
        btn.disabled = true;
        btn.classList.add('shape-btn--rb-locked');
        btn.setAttribute('aria-disabled', 'true');
      }
    });

    const shapeHidden = document.getElementById('shapeFilter');
    if (shapeHidden) shapeHidden.value = valid.join(',');

    const detailEl = document.getElementById('ringBuilderBannerDetail');
    if (detailEl) {
      const labels = valid.map(s => s.charAt(0).toUpperCase() + s.slice(1));
      const shapeText = labels.length <= 3 ? labels.join(', ') : `${labels.length} shapes`;
      detailEl.textContent = `Showing ${shapeText} stones matched to your setting.`;
    }

    return true;
  },

  getCachedData() {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      if (!cached) return null;
      const { data, timestamp, page } = JSON.parse(cached);
      const now = Date.now();
      if (now - timestamp < this.cacheExpiry) return { data, page };
      return null;
    } catch (e) { return null; }
  },

  setCachedData(data, page) {
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify({ data, page, timestamp: Date.now() }));
    } catch (e) { /* quota or disabled */ }
  },

  async fetchDiamonds(page = 1) {
    try {
      let result;
      if (this.useWorker && this.workerUrl) result = await this.fetchFromWorker(page);
      else result = await this.fetchFromDirectAPI(page);
      if (!result || !result.data) return [];
      this.totalPages = result.total_page || 1;
      this.currentPage = page;
      this.lastCacheStatus = result._cacheStatus || 'DIRECT';
      let diamonds = result.data.filter(d => d.Availability === 'G');
      diamonds = this.applyFilters(diamonds);
      return diamonds;
    } catch (error) {
      return this.getFallbackData() || [];
    }
  },

  async fetchFromWorker(page = 1) {
    const url = `${this.workerUrl}?type=lab&page=${page}`;
    try {
      const response = await fetch(url);
      if (response.redirected || response.status === 302 || response.status === 301) return this.fetchFromDirectAPI(page);
      if (response.status === 403) return this.fetchFromDirectAPI(page);
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) return this.fetchFromDirectAPI(page);
      const result = await response.json();
      if (result.error) return this.fetchFromDirectAPI(page);
      if (result.data) this.setCachedData(result.data, page);
      return result;
    } catch (error) {
      return this.fetchFromDirectAPI(page);
    }
  },

  async fetchFromDirectAPI(page = 1) {
    const cached = this.getCachedData();
    if (cached && cached.page === page) {
      this.totalPages = 1;
      this.currentPage = page;
      return { data: cached.data, _cacheStatus: 'LOCAL_CACHE' };
    }
    if (!this.apiKey) return null;
    const url = `${this.baseUrl}?type=lab&page=${page}&key=${this.apiKey}`;
    try {
      const response = await fetch(url);
      const result = await response.json();
      if (result.message && result.message.includes('limit reached')) {
        const fb = this.getFallbackData();
        return fb ? { data: fb, _cacheStatus: 'RATE_LIMITED' } : null;
      }
      if (!result.data || !Array.isArray(result.data)) return null;
      this.setCachedData(result.data, page);
      result._cacheStatus = 'FRESH';
      return result;
    } catch (error) {
      const fb = this.getFallbackData();
      return fb ? { data: fb, _cacheStatus: 'ERROR_FALLBACK' } : null;
    }
  },

  getFallbackData() {
    try {
      const expiredCache = localStorage.getItem(this.cacheKey);
      if (expiredCache) return JSON.parse(expiredCache).data;
    } catch (e) { /* no cache */ }
    return null;
  },

  applyFilters(diamonds) {
    return diamonds.filter(diamond => {
      if (this.filters.shapes.length > 0) {
        const shape = diamond.Shape?.toUpperCase();
        if (!this.filters.shapes.some(s => shape?.includes(s.toUpperCase()))) return false;
      }
      const carat = parseFloat(diamond.Weight) || 0;
      if (carat < this.filters.minCarat || carat > this.filters.maxCarat) return false;
      if (this.filters.colors.length > 0 && diamond.Color) {
        if (!this.filters.colors.includes(diamond.Color)) return false;
      }
      if (this.filters.clarities.length > 0 && diamond.Clarity) {
        if (!this.filters.clarities.includes(diamond.Clarity)) return false;
      }
      const price = this.calculatePrice(diamond);
      if (price < this.filters.minPrice || price > this.filters.maxPrice) return false;
      return true;
    });
  },

  calculatePrice(diamond) {
    const buyPrice = parseFloat(diamond.Buy_Price) || 0;
    const carat = parseFloat(diamond.Weight) || 1;
    return Math.round(buyPrice * carat * this.markup);
  },

  formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(price);
  },

  createDiamondCard(diamond) {
    const price = this.calculatePrice(diamond);
    const shape = diamond.Shape || 'Unknown';
    const carat = parseFloat(diamond.Weight).toFixed(2);
    const color = diamond.Color || '-';
    const clarity = diamond.Clarity || '-';
    const cut = diamond.Cut_Grade || diamond.Polish || '-';
    const lab = diamond.Lab || 'IGI';
    const imageUrl = diamond.ImageLink || '';
    const videoUrl = diamond.VideoLink || '';
    const certUrl = diamond.CertificateLink || '';
    const isRingBuilderMode = this.isInRingBuilderMode();
    const diamondDataAttr = JSON.stringify({
      Stock_No: diamond.Stock_No, Shape: shape, Weight: diamond.Weight,
      Color: color, Clarity: clarity, Cut_Grade: cut, Buy_Price: diamond.Buy_Price,
      ImageLink: imageUrl, VideoLink: videoUrl, CertificateLink: certUrl
    }).replace(/"/g, '&quot;');

    return `
      <div class="diamond-card" data-stock="${diamond.Stock_No}">
        <div class="diamond-card__image">
          ${imageUrl
            ? `<img src="${imageUrl}" alt="${carat}ct ${shape} ${color} ${clarity}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'diamond-card__placeholder\\'><svg width=\\'60\\' height=\\'60\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\'><path d=\\'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5\\'/></svg></div>'">`
            : `<div class="diamond-card__placeholder"><svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>`
          }
          ${videoUrl ? `<span class="diamond-card__video-badge">360°</span>` : ''}
        </div>
        <div class="diamond-card__content">
          <h3 class="diamond-card__title">${carat}ct ${shape}</h3>
          <div class="diamond-card__specs">
            <span class="spec">${color}</span>
            <span class="spec">${clarity}</span>
            <span class="spec">${cut}</span>
            <span class="spec">${lab}</span>
          </div>
          <div class="diamond-card__price">${this.formatPrice(price)}</div>
          <div class="diamond-card__actions">
            ${isRingBuilderMode ? `
              <button class="btn btn--gold btn--sm select-for-ring-btn" data-diamond="${diamondDataAttr}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v4m0 14v4m11-11h-4M5 12H1"/>
                </svg>
                Select this stone
              </button>
            ` : ''}
            <button class="btn btn--primary btn--sm view-diamond-btn"
                    data-stock="${diamond.Stock_No}" data-video="${videoUrl}"
                    data-cert="${certUrl}" data-image="${imageUrl}">
              View details
            </button>
          </div>
        </div>
      </div>
    `;
  },

  renderDiamonds(diamonds, containerId = 'diamondResults') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (diamonds.length === 0) {
      container.innerHTML = `
        <div class="no-results">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.3-4.3"/>
          </svg>
          <h3>No stones match these criteria</h3>
          <p>Adjust your filters to see more of the selection.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="results-header">
        <span class="results-count">${diamonds.length} stones in the selection</span>
        <div class="results-sort">
          <select id="sortDiamonds">
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="carat-asc">Carat: low to high</option>
            <option value="carat-desc">Carat: high to low</option>
          </select>
        </div>
      </div>
      <div class="diamond-grid">
        ${diamonds.map(d => { this.diamondsData.set(d.Stock_No, d); return this.createDiamondCard(d); }).join('')}
      </div>
      ${this.totalPages > 1 ? this.createPagination() : ''}
    `;

    this.attachCardListeners();
  },

  createPagination() {
    return `
      <div class="pagination">
        <button class="pagination__btn" onclick="DiamondAPI.loadPage(${this.currentPage - 1})" ${this.currentPage <= 1 ? 'disabled' : ''}>
          ← Previous
        </button>
        <span class="pagination__info">Page ${this.currentPage} of ${this.totalPages}</span>
        <button class="pagination__btn" onclick="DiamondAPI.loadPage(${this.currentPage + 1})" ${this.currentPage >= this.totalPages ? 'disabled' : ''}>
          Next →
        </button>
      </div>
    `;
  },

  async loadPage(page) {
    if (page < 1 || page > this.totalPages) return;
    this.showLoading();
    const diamonds = await this.fetchDiamonds(page);
    this.renderDiamonds(diamonds);
  },

  showLoading() {
    const container = document.getElementById('diamondResults');
    if (container) {
      container.innerHTML = `
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>Bringing the selection forward…</p>
        </div>
      `;
    }
  },

  attachCardListeners() {
    document.querySelectorAll('.view-diamond-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const stock = e.target.dataset.stock;
        const video = e.target.dataset.video;
        const cert = e.target.dataset.cert;
        const image = e.target.dataset.image;
        this.showDiamondModal(stock, video, cert, image);
      });
    });

    document.querySelectorAll('.select-for-ring-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        const diamondData = JSON.parse(e.currentTarget.dataset.diamond);
        this.selectDiamondForRing(diamondData);
        window.location.href = '/pages/ring-builder';
      });
    });

    const sortSelect = document.getElementById('sortDiamonds');
    if (sortSelect) sortSelect.addEventListener('change', (e) => this.sortDiamonds(e.target.value));
  },

  showDiamondModal(stockNo, videoUrl, certUrl, imageUrl) {
    const diamond = this.diamondsData.get(stockNo);
    if (!diamond) return;

    const price = this.calculatePrice(diamond);
    const carat = parseFloat(diamond.Weight) || 0;
    const pricePerCarat = carat > 0 ? Math.round(price / carat) : 0;

    const shape = diamond.Shape || 'Unknown';
    const color = diamond.Color || '-';
    const clarity = diamond.Clarity || '-';
    const cut = diamond.Cut_Grade || '-';
    const polish = diamond.Polish || '-';
    const symmetry = diamond.Symmetry || '-';
    const fluorescence = diamond.Fluor || diamond.Fluorescence || 'None';
    const tablePercent = diamond.Table_Per || diamond.TablePer || '-';
    const depthPercent = diamond.Depth_Per || diamond.DepthPer || '-';
    const length = diamond.Length || '-';
    const width = diamond.Width || '-';
    const height = diamond.Height || '-';
    const lab = diamond.Lab || 'IGI';
    const certNumber = diamond.Certificate_No || diamond.CertificateNo || stockNo;

    const measurements = (length !== '-' && width !== '-' && height !== '-')
      ? `${length} × ${width} × ${height} mm` : 'Not available';

    const description = this.generateDiamondDescription(diamond);

    const modal = document.createElement('div');
    modal.className = 'diamond-modal';
    modal.innerHTML = `
      <div class="diamond-modal__overlay" onclick="this.parentElement.remove()"></div>
      <div class="diamond-modal__content">
        <button class="diamond-modal__close" onclick="this.closest('.diamond-modal').remove()" aria-label="Close">×</button>

        <div class="diamond-modal__media">
          <div class="diamond-modal__media-tabs">
            ${videoUrl ? '<button class="media-tab active" data-type="video">360° video</button>' : ''}
            ${imageUrl ? `<button class="media-tab ${!videoUrl ? 'active' : ''}" data-type="image">Image</button>` : ''}
            ${certUrl ? '<button class="media-tab" data-type="cert">Certificate</button>' : ''}
          </div>
          <div class="diamond-modal__media-viewer">
            ${videoUrl ? `<video class="media-content active" data-type="video" src="${videoUrl}" autoplay loop muted playsinline></video>` : ''}
            ${imageUrl ? `<img class="media-content ${!videoUrl ? 'active' : ''}" data-type="image" src="${imageUrl}" alt="${carat.toFixed(2)}ct ${shape} diamond">` : ''}
            ${certUrl ? `<iframe class="media-content" data-type="cert" src="${certUrl}" title="Certificate"></iframe>` : ''}
            ${!videoUrl && !imageUrl ? `<div class="diamond-modal__placeholder"><svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M6 3h12l4 6-10 13L2 9z"></path><path d="M12 22V9"></path><path d="m2 9 10 4 10-4"></path><path d="m6 3 6 6 6-6"></path></svg></div>` : ''}
          </div>
        </div>

        <div class="diamond-modal__info">
          <div class="diamond-modal__header">
            <h2 class="diamond-modal__title">${carat.toFixed(2)}ct ${shape} diamond</h2>
            <span class="diamond-modal__stock">Stone #${stockNo}</span>
          </div>

          <div class="diamond-modal__price-section">
            <span class="diamond-modal__price">${this.formatPrice(price)}</span>
            <span class="diamond-modal__price-per-carat">${this.formatPrice(pricePerCarat)}/ct</span>
          </div>

          <div class="diamond-modal__4cs">
            <div class="four-c"><span class="four-c__value">${carat.toFixed(2)}</span><span class="four-c__label">Carat</span></div>
            <div class="four-c"><span class="four-c__value">${color}</span><span class="four-c__label">Color</span></div>
            <div class="four-c"><span class="four-c__value">${clarity}</span><span class="four-c__label">Clarity</span></div>
            <div class="four-c"><span class="four-c__value">${cut}</span><span class="four-c__label">Cut</span></div>
          </div>

          <p class="diamond-modal__description">${description}</p>

          <div class="diamond-modal__specs">
            <h3 class="specs-title">Specifications</h3>
            <div class="specs-grid">
              <div class="spec-item"><span class="spec-label">Shape</span><span class="spec-value">${shape}</span></div>
              <div class="spec-item"><span class="spec-label">Carat</span><span class="spec-value">${carat.toFixed(2)} ct</span></div>
              <div class="spec-item"><span class="spec-label">Color</span><span class="spec-value">${color}</span></div>
              <div class="spec-item"><span class="spec-label">Clarity</span><span class="spec-value">${clarity}</span></div>
              <div class="spec-item"><span class="spec-label">Cut</span><span class="spec-value">${cut}</span></div>
              <div class="spec-item"><span class="spec-label">Polish</span><span class="spec-value">${polish}</span></div>
              <div class="spec-item"><span class="spec-label">Symmetry</span><span class="spec-value">${symmetry}</span></div>
              <div class="spec-item"><span class="spec-label">Fluorescence</span><span class="spec-value">${fluorescence}</span></div>
              <div class="spec-item"><span class="spec-label">Table</span><span class="spec-value">${tablePercent}${tablePercent !== '-' ? '%' : ''}</span></div>
              <div class="spec-item"><span class="spec-label">Depth</span><span class="spec-value">${depthPercent}${depthPercent !== '-' ? '%' : ''}</span></div>
              <div class="spec-item spec-item--full"><span class="spec-label">Measurements</span><span class="spec-value">${measurements}</span></div>
              <div class="spec-item spec-item--full"><span class="spec-label">Certificate</span><span class="spec-value">${lab} #${certNumber}</span></div>
            </div>
          </div>

          <div class="diamond-modal__actions">
            <button class="btn btn--primary btn--lg add-to-cart-btn" data-stock="${stockNo}">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path>
                <path d="M3 6h18"></path>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
              Add to cart
            </button>
            ${certUrl ? `<a href="${certUrl}" target="_blank" rel="noopener" class="btn btn--secondary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              View certificate
            </a>` : ''}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.attachModalTabListeners(modal);
  },

  generateDiamondDescription(diamond) {
    const carat = parseFloat(diamond.Weight) || 0;
    const shape = diamond.Shape || 'diamond';
    const color = diamond.Color || '';
    const clarity = diamond.Clarity || '';
    const cut = diamond.Cut_Grade || '';

    let colorDesc = '';
    if (['D', 'E', 'F'].includes(color)) colorDesc = 'colorless';
    else if (['G', 'H', 'I'].includes(color)) colorDesc = 'near-colorless';
    else colorDesc = 'with subtle warmth';

    let clarityDesc = '';
    if (['FL', 'IF'].includes(clarity)) clarityDesc = 'flawless';
    else if (['VVS1', 'VVS2'].includes(clarity)) clarityDesc = 'with exceptional clarity';
    else if (['VS1', 'VS2'].includes(clarity)) clarityDesc = 'with excellent clarity';
    else clarityDesc = 'with good clarity';

    let cutDesc = '';
    if (cut === 'EX' || cut === 'Excellent' || cut === 'Ideal') cutDesc = 'Cut for maximum brilliance,';
    else if (cut === 'VG' || cut === 'Very Good') cutDesc = 'Cut for exceptional fire,';
    else cutDesc = 'Considered in cut,';

    return `${cutDesc} this ${carat.toFixed(2)} carat ${shape.toLowerCase()} lab-grown stone is ${colorDesc} and ${clarityDesc}. Independently graded by IGI or GIA and selected for the Laura Milman atelier.`;
  },

  attachModalTabListeners(modal) {
    const tabs = modal.querySelectorAll('.media-tab');
    const contents = modal.querySelectorAll('.media-content');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const type = tab.dataset.type;
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        contents.forEach(c => {
          c.classList.remove('active');
          if (c.dataset.type === type) c.classList.add('active');
        });
      });
    });
  },

  init() {
    const filterForm = document.getElementById('diamondFilterForm');
    if (filterForm) {
      filterForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        this.collectFilters();
        this.showLoading();
        const diamonds = await this.fetchDiamonds(1);
        this.renderDiamonds(diamonds);
      });
    }

    const onShapeToggle = function (e) {
      e.preventDefault();
      e.stopPropagation();
      const allow = DiamondAPI._ringBuilderShapeAllowlist;
      if (allow?.length === 1 && this.dataset.shape === allow[0] && this.classList.contains('active')) return;
      this.classList.toggle('active');
      DiamondAPI.updateShapeFilters();
      if (allow?.length && DiamondAPI.filters.shapes.length === 0) {
        allow.forEach(shapeId => {
          document.querySelector(`.shape-btn[data-shape="${shapeId}"]`)?.classList.add('active');
        });
        DiamondAPI.updateShapeFilters();
      }
    };

    document.querySelectorAll('.shape-btn').forEach(btn => {
      btn.addEventListener('click', onShapeToggle);
    });

    const urlLockedShapes = this.applyRingBuilderUrlShapeLocks();
    if (this.isInRingBuilderMode() && urlLockedShapes && document.getElementById('diamondResults')) {
      this.collectFilters();
      this.showLoading();
      this.fetchDiamonds(1).then(diamonds => this.renderDiamonds(diamonds));
    }
  },

  collectFilters() {
    this.updateShapeFilters();
    if (this._ringBuilderShapeAllowlist?.length && this.filters.shapes.length === 0) {
      this._ringBuilderShapeAllowlist.forEach(shapeId => {
        document.querySelector(`.shape-btn[data-shape="${shapeId}"]`)?.classList.add('active');
      });
      this.updateShapeFilters();
    }
    const minCarat = document.getElementById('minCarat');
    const maxCarat = document.getElementById('maxCarat');
    if (minCarat) this.filters.minCarat = parseFloat(minCarat.value) || 0.5;
    if (maxCarat) this.filters.maxCarat = parseFloat(maxCarat.value) || 30;
    const minPrice = document.getElementById('minPrice');
    const maxPrice = document.getElementById('maxPrice');
    if (minPrice) this.filters.minPrice = parseInt(minPrice.value.replace(/[^0-9]/g, '')) || 0;
    if (maxPrice) this.filters.maxPrice = parseInt(maxPrice.value.replace(/[^0-9]/g, '')) || 100000;
  },

  updateShapeFilters() {
    this.filters.shapes = Array.from(document.querySelectorAll('.shape-btn.active')).map(btn => btn.dataset.shape);
    if (this._ringBuilderShapeAllowlist?.length) {
      this.filters.shapes = this.filters.shapes.filter(s => this._ringBuilderShapeAllowlist.includes(s));
    }
  },

  sortDiamonds(sortBy) { /* placeholder — sort handled server-side via re-fetch */ },

  ringBuilderKey: 'laura_milman_ring_builder_diamond',

  selectDiamondForRing(diamond) {
    const shapeSlug = (diamond.Shape || 'round').toString().trim().toLowerCase();
    const diamondData = {
      id: diamond.Stock_No, shape: shapeSlug, carat: diamond.Weight,
      color: diamond.Color, clarity: diamond.Clarity, cut: diamond.Cut_Grade,
      price: this.calculatePrice(diamond),
      image: diamond.ImageLink, video: diamond.VideoLink, certificate: diamond.CertificateLink
    };
    try {
      localStorage.setItem(this.ringBuilderKey, JSON.stringify(diamondData));
      window.dispatchEvent(new CustomEvent('diamondSelectedForRing', { detail: diamondData }));
      return diamondData;
    } catch (e) { return null; }
  },

  getSelectedDiamondForRing() {
    try {
      const saved = localStorage.getItem(this.ringBuilderKey);
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  },

  clearSelectedDiamondForRing() {
    localStorage.removeItem(this.ringBuilderKey);
  }
};

document.addEventListener('DOMContentLoaded', () => { DiamondAPI.init(); });
