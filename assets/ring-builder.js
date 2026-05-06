/**
 * Laura Milman — Ring Builder Module
 * Interactive ring customization with diamond pairing
 */

const RingBuilder = {
  // State management
  state: {
    currentStep: 'entry', // 'entry', 'pick-shape', 'diamond', 'setting', 'customize', 'complete'
    entryPath: null, // 'diamond-first' or 'setting-first'
    selectedDiamond: null,
    selectedSetting: null,
    selectedMetal: '14k-white-gold',
    selectedBand: 'plain',
    selectedShape: 'round',
    selectedRingSize: '7',
    selectedProngStyle: '4-prong', // NEW: Prong style selection
    sideStoneShape: null,
    sideStoneCarat: null,
    engravingEnabled: false,
    engravingText: '',
    isSharedDesign: false
  },

  // Prong style options (NEW)
  prongStyles: [
    { id: '4-prong', name: '4 Prong', description: 'Classic and secure', priceModifier: 0 },
    { id: '6-prong', name: '6 Prong', description: 'Maximum security', priceModifier: 50 },
    { id: 'bezel', name: 'Bezel', description: 'Modern protection', priceModifier: 100 },
    { id: 'claw', name: 'Claw', description: 'Vintage elegance', priceModifier: 75 }
  ],

  // Settings data (populated from JSON)
  settingsData: null,

  // Storage key
  storageKey: 'laura_milman_ring_builder',

  /**
   * Initialize the ring builder
   */
  init() {
    console.log('Ring Builder initialized');

    // Load settings data
    this.loadSettingsData();

    // Check for shared design in URL first (before restoring local state)
    if (!this.loadFromSharedUrl()) {
      // Restore saved state only if no shared URL
      this.restoreState();
    }

    // Check if returning from diamond selection
    this.checkForSelectedDiamond();

    // Setup event listeners
    this.setupEventListeners();

    // Render initial view
    this.render();
  },

  /**
   * Check if a diamond was selected from the diamond page
   */
  checkForSelectedDiamond() {
    // Check if DiamondAPI has a selected diamond for ring builder
    if (typeof DiamondAPI !== 'undefined') {
      const selectedDiamond = DiamondAPI.getSelectedDiamondForRing();
      if (selectedDiamond) {
        // Diamond was selected from the diamond page - always update
        const impShape = (selectedDiamond.shape || 'round').toString().trim().toLowerCase();
        this.state.selectedDiamond = {
          id: selectedDiamond.id,
          shape: impShape,
          carat: selectedDiamond.carat,
          color: selectedDiamond.color,
          clarity: selectedDiamond.clarity,
          price: selectedDiamond.price,
          image: selectedDiamond.image
        };
        this.state.selectedShape = impShape;

        // Clear the selected diamond from DiamondAPI storage first
        DiamondAPI.clearSelectedDiamondForRing();

        // Determine next step based on entry path
        if (this.state.entryPath === 'diamond-first') {
          this.state.currentStep = 'setting';
        } else if (this.state.entryPath === 'setting-first') {
          // If we have a setting selected, go to customize
          // Otherwise stay on setting step (shouldn't happen in normal flow)
          if (this.state.selectedSetting) {
            this.state.currentStep = 'customize';
          }
        }

        this.saveState();

        console.log('Diamond imported from selection:', this.state.selectedDiamond);
        console.log('Current step set to:', this.state.currentStep);
      }
    }
  },

  /**
   * Load ring settings data from embedded JSON
   */
  loadSettingsData() {
    const dataElement = document.getElementById('ring-settings-data');
    if (dataElement) {
      try {
        this.settingsData = JSON.parse(dataElement.textContent);
        console.log('Ring settings loaded:', this.settingsData);
      } catch (e) {
        console.error('Failed to parse ring settings:', e);
      }
    }
  },

  /**
   * Save state to localStorage
   */
  saveState() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch (e) {
      console.error('Failed to save ring builder state:', e);
    }
  },

  /**
   * Restore state from localStorage
   */
  restoreState() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.state = { ...this.state, ...parsed };
        console.log('Ring builder state restored:', this.state);
      }
    } catch (e) {
      console.error('Failed to restore ring builder state:', e);
    }
  },

  /**
   * Clear saved state
   */
  clearState() {
    localStorage.removeItem(this.storageKey);
    // Clear URL hash if present
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    this.state = {
      currentStep: 'entry',
      entryPath: null,
      selectedDiamond: null,
      selectedSetting: null,
      selectedMetal: '14k-white-gold',
      selectedBand: 'plain',
      selectedShape: 'round',
      selectedRingSize: '7',
      selectedProngStyle: '4-prong',
      sideStoneShape: null,
      sideStoneCarat: null,
      isSharedDesign: false
    };
    this.render();
  },

  /**
   * Setup all event listeners
   */
  setupEventListeners() {
    // Entry path selection
    document.addEventListener('click', (e) => {
      // Entry path buttons
      if (e.target.closest('.entry-path-card')) {
        const card = e.target.closest('.entry-path-card');
        const path = card.dataset.path;
        this.selectEntryPath(path);
      }

      if (e.target.closest('.rb-entry-shape-btn')) {
        const btn = e.target.closest('.rb-entry-shape-btn');
        const shapeId = btn.dataset.shapeId;
        if (shapeId) this.confirmDiamondFirstShape(shapeId);
      }

      // Setting selection
      if (e.target.closest('.setting-card')) {
        const card = e.target.closest('.setting-card');
        const settingId = card.dataset.settingId;
        this.selectSetting(settingId);
      }

      // Metal selection
      if (e.target.closest('.metal-option') || e.target.closest('.metal-option-improved')) {
        const option = e.target.closest('.metal-option') || e.target.closest('.metal-option-improved');
        this.selectMetal(option.dataset.metalId);
      }

      // Band selection
      if (e.target.closest('.band-option') || e.target.closest('.band-option-improved')) {
        const option = e.target.closest('.band-option') || e.target.closest('.band-option-improved');
        this.selectBand(option.dataset.bandId);
      }

      // Shape selection
      if (e.target.closest('.shape-option')) {
        const option = e.target.closest('.shape-option');
        this.selectShape(option.dataset.shapeId);
      }

      // Side stone shape selection
      if (e.target.closest('.side-stone-option')) {
        const option = e.target.closest('.side-stone-option');
        this.selectSideStoneShape(option.dataset.shapeId);
      }

      // Side stone carat selection
      if (e.target.closest('.side-carat-option')) {
        const option = e.target.closest('.side-carat-option');
        this.selectSideStoneCarat(option.dataset.carat);
      }

      // Ring size selection
      if (e.target.closest('.ring-size-option')) {
        const option = e.target.closest('.ring-size-option');
        this.selectRingSize(option.dataset.size);
      }

      // Prong style selection
      if (e.target.closest('.prong-option')) {
        const option = e.target.closest('.prong-option');
        this.selectProngStyle(option.dataset.prongId);
      }

      // Share button
      if (e.target.closest('.rb-btn-share')) {
        this.showShareModal();
      }

      // Size guide link
      if (e.target.closest('.rb-size-guide-link')) {
        e.preventDefault();
        this.showSizeGuide();
      }

      // Navigation buttons
      if (e.target.closest('.rb-btn-select-diamond')) {
        this.goToStep('diamond');
      }

      if (e.target.closest('.rb-btn-select-setting')) {
        this.goToStep('setting');
      }

      if (e.target.closest('.rb-btn-customize')) {
        this.goToStep('customize');
      }

      if (e.target.closest('.rb-btn-back')) {
        this.goBack();
      }

      if (e.target.closest('.rb-btn-start-over')) {
        this.clearState();
      }

      if (e.target.closest('.rb-btn-add-to-cart')) {
        this.addToCart();
      }

      // Diamond builder filter buttons
      if (e.target.closest('.rb-filter-shape-btn')) {
        const btn = e.target.closest('.rb-filter-shape-btn');
        this.toggleBuilderShapeFilter(btn.dataset.shape);
      }

      if (e.target.closest('.rb-filter-sort-btn')) {
        const btn = e.target.closest('.rb-filter-sort-btn');
        this.setBuilderSort(btn.dataset.sort);
      }

      if (e.target.closest('.rb-load-more-btn')) {
        this.loadMoreBuilderDiamonds();
      }

      // Diamond selection from grid
      if (e.target.closest('.diamond-select-btn')) {
        const btn = e.target.closest('.diamond-select-btn');
        const diamondData = JSON.parse(btn.dataset.diamond);
        this.selectDiamond(diamondData);
      }

      // Complete step buttons
      if (e.target.closest('.rb-btn-view-cart')) {
        window.location.href = '/cart';
      }

      if (e.target.closest('.rb-btn-continue-shopping')) {
        this.clearState();
        window.location.href = '/collections';
      }

      // Engraving toggle
      if (e.target.closest('.rb-engraving-toggle')) {
        this.toggleEngraving();
      }
    });

    // Engraving text input
    document.addEventListener('input', (e) => {
      if (e.target.closest('.rb-engraving-input')) {
        this.state.engravingText = e.target.value.substring(0, 20);
        this.saveState();
        const counter = document.querySelector('.rb-engraving-counter');
        if (counter) counter.textContent = `${this.state.engravingText.length}/20`;
      }
    });
  },

  /**
   * Select entry path
   */
  selectEntryPath(path) {
    this.state.entryPath = path;
    this.saveState();

    if (path === 'diamond-first') {
      // In standalone preview mode (file:// or no Shopify), render diamonds inline
      // In Shopify, choose shape first then redirect with ?shape= for collection URL lock
      const isStandalone = window.location.protocol === 'file:' || !window.Shopify;
      if (isStandalone) {
        this.state.currentStep = 'diamond';
        this.render();
      } else {
        this.state.currentStep = 'pick-shape';
        this.render();
      }
    } else {
      this.state.currentStep = 'setting';
      this.render();
    }
  },

  /**
   * Select a diamond
   */
  selectDiamond(diamondData) {
    const shapeRaw = diamondData.shape ?? 'round';
    const shapeSlug = typeof shapeRaw === 'string'
      ? shapeRaw.trim().toLowerCase()
      : String(shapeRaw).trim().toLowerCase();
    this.state.selectedDiamond = { ...diamondData, shape: shapeSlug };
    this.state.selectedShape = shapeSlug;

    if (this.state.entryPath === 'diamond-first') {
      this.state.currentStep = 'setting';
    } else {
      this.state.currentStep = 'customize';
    }

    this.saveState();
    this.render();
  },

  /**
   * Select a setting
   */
  selectSetting(settingId) {
    const setting = this.settingsData?.settings.find(s => s.id === settingId);
    if (setting) {
      this.state.selectedSetting = setting;
      this.saveState();

      if (this.state.entryPath === 'setting-first') {
        // Redirect to diamond collection page with ring builder mode
        // Pass compatible shapes as filter
        const shapesParam = setting.compatibleShapes.join(',');
        window.location.href = `/collections/lab-diamonds?ring_builder=true&shapes=${shapesParam}`;
      } else {
        this.state.currentStep = 'customize';
        this.render();
      }
    }
  },

  /**
   * Select metal type
   */
  selectMetal(metalId) {
    this.state.selectedMetal = metalId;
    this.saveState();
    this.updatePreview();
    this.updatePrice();

    // Update active state for both old and improved metal options
    document.querySelectorAll('.metal-option, .metal-option-improved').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.metalId === metalId);
    });

    // NEW: Update ring preview with metal color filter
    this.updateMetalPreview();
  },

  /**
   * Select band style
   */
  selectBand(bandId) {
    this.state.selectedBand = bandId;
    this.saveState();
    this.updatePreview();
    this.updatePrice();

    document.querySelectorAll('.band-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.bandId === bandId);
    });
  },

  /**
   * Select shape
   */
  selectShape(shapeId) {
    this.state.selectedShape = shapeId;
    this.saveState();
    this.updatePreview();

    document.querySelectorAll('.shape-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.shapeId === shapeId);
    });
  },

  /**
   * Select side stone shape
   */
  selectSideStoneShape(shapeId) {
    this.state.sideStoneShape = shapeId;
    this.saveState();
    this.updatePreview();

    document.querySelectorAll('.side-stone-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.shapeId === shapeId);
    });
  },

  /**
   * Select side stone carat
   */
  selectSideStoneCarat(carat) {
    this.state.sideStoneCarat = carat;
    this.saveState();
    this.updatePrice();

    document.querySelectorAll('.side-carat-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.carat === carat);
    });
  },

  /**
   * Select ring size
   */
  selectRingSize(size) {
    this.state.selectedRingSize = size;
    this.saveState();

    document.querySelectorAll('.ring-size-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.size === size);
    });
  },

  /**
   * Navigate to a step
   */
  goToStep(step) {
    this.state.currentStep = step;
    this.saveState();
    this.render();
  },

  /**
   * Go back to previous step
   */
  goBack() {
    if (this.state.currentStep === 'pick-shape') {
      this.state.currentStep = 'entry';
      this.saveState();
      this.render();
      return;
    }

    const stepOrder = ['entry', 'diamond', 'setting', 'customize', 'complete'];
    const currentIndex = stepOrder.indexOf(this.state.currentStep);

    if (currentIndex > 0) {
      // Determine the correct previous step based on entry path
      if (this.state.currentStep === 'customize') {
        if (this.state.entryPath === 'diamond-first') {
          this.state.currentStep = 'setting';
        } else {
          this.state.currentStep = 'diamond';
        }
      } else if (this.state.currentStep === 'setting' && this.state.entryPath === 'diamond-first') {
        const isStandalone = window.location.protocol === 'file:' || !window.Shopify;
        this.state.currentStep = isStandalone ? 'diamond' : 'pick-shape';
      } else if (this.state.currentStep === 'diamond' && this.state.entryPath === 'setting-first') {
        this.state.currentStep = 'setting';
      } else {
        this.state.currentStep = 'entry';
      }
    }

    this.saveState();
    this.render();
  },

  /**
   * Diamond-first (Shopify): after shape choice, redirect to lab diamonds with URL lock
   */
  confirmDiamondFirstShape(shapeId) {
    const slug = (shapeId || 'round').toString().trim().toLowerCase();
    this.state.selectedShape = slug;
    this.saveState();
    window.location.href = `/collections/lab-diamonds?ring_builder=true&shape=${encodeURIComponent(slug)}`;
  },

  /**
   * Calculate total price
   */
  calculatePrice() {
    let total = 0;

    // Diamond price
    if (this.state.selectedDiamond?.price) {
      total += this.state.selectedDiamond.price;
    }

    // Setting base price
    if (this.state.selectedSetting?.basePrice) {
      total += this.state.selectedSetting.basePrice;
    }

    // Metal modifier
    const metal = this.settingsData?.metals.find(m => m.id === this.state.selectedMetal);
    if (metal?.priceModifier) {
      total += metal.priceModifier;
    }

    // Band modifier
    const band = this.settingsData?.bands.find(b => b.id === this.state.selectedBand);
    if (band?.priceModifier) {
      total += band.priceModifier;
    }

    // NEW: Prong style modifier
    const prong = this.prongStyles.find(p => p.id === this.state.selectedProngStyle);
    if (prong?.priceModifier) {
      total += prong.priceModifier;
    }

    return total;
  },

  /**
   * Format price for display
   */
  formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  },

  /**
   * Update price display
   */
  updatePrice() {
    const total = this.calculatePrice();

    const priceEl = document.querySelector('.rb-total-price');
    if (priceEl) {
      priceEl.textContent = this.formatPrice(total);
    }

    // Also update Add to Cart button price
    const cartBtn = document.querySelector('.rb-btn-add-to-cart');
    if (cartBtn && this.state.selectedDiamond) {
      cartBtn.textContent = `Add to Cart - ${this.formatPrice(total)}`;
    }
  },

  /**
   * Update ring preview
   */
  updatePreview() {
    // This would update the ring preview image based on selections
    // In a real implementation, this would swap images or use a 3D renderer
    const previewEl = document.querySelector('.rb-preview-image');
    if (previewEl) {
      // Add a subtle animation
      previewEl.style.opacity = '0.7';
      setTimeout(() => {
        previewEl.style.opacity = '1';
      }, 150);
    }
  },

  /**
   * Add completed ring to cart using Shopify Cart API
   * Requires a "Custom Engagement Ring" product in Shopify with variant ID
   */
  async addToCart() {
    // Validate we have both diamond and setting
    if (!this.state.selectedDiamond || !this.state.selectedSetting) {
      this.showNotification('Please select both a diamond and setting', 'error');
      return;
    }

    const metal = this.settingsData?.metals.find(m => m.id === this.state.selectedMetal);
    const band = this.settingsData?.bands.find(b => b.id === this.state.selectedBand);
    const prong = this.prongStyles.find(p => p.id === this.state.selectedProngStyle);
    const setting = this.state.selectedSetting;
    const previewUrl = setting?.metalImages?.[this.state.selectedMetal] || setting?.image || '';
    const diamondImg = this.state.selectedDiamond.image || '';
    const certUrl = this.state.selectedDiamond.certificate || '';

    // Build line item properties for the custom ring
    const properties = {
      '_ring_builder': 'true',
      'Diamond': `${this.state.selectedDiamond.carat}ct ${this.state.selectedDiamond.shape} - ${this.state.selectedDiamond.color}/${this.state.selectedDiamond.clarity}`,
      'Diamond ID': this.state.selectedDiamond.id || 'N/A',
      'Diamond Price': this.formatPrice(this.state.selectedDiamond.price),
      'Setting': this.state.selectedSetting.name,
      'Setting Price': this.formatPrice(this.state.selectedSetting.basePrice),
      'Metal': metal?.name || this.state.selectedMetal,
      'Band Style': band?.name || this.state.selectedBand,
      'Ring Size': String(this.state.selectedRingSize || ''),
      'Prong style': prong?.name || this.state.selectedProngStyle,
      'Total Price': this.formatPrice(this.calculatePrice())
    };

    if (previewUrl) properties['Ring preview'] = previewUrl;
    if (diamondImg) properties['Diamond image'] = diamondImg;
    if (certUrl) properties['Certificate URL'] = certUrl;

    if (this.state.engravingEnabled && (this.state.engravingText || '').trim()) {
      properties['Engraving'] = this.state.engravingText.trim();
    }

    // Add side stone info if applicable
    if (this.state.sideStoneShape) {
      properties['Side Stones'] = `${this.state.sideStoneShape} - ${this.state.sideStoneCarat || 'Standard'}`;
    }

    // Get the Custom Ring product variant ID from the page or settings
    // This should be set in the ring-builder section schema
    const variantId = this.getCustomRingVariantId();

    if (!variantId) {
      // Fallback: Show inquiry form or contact message
      this.showInquiryModal(properties);
      return;
    }

    try {
      // Add to Shopify cart via AJAX API
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: variantId,
          quantity: 1,
          properties: properties
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Ring added to cart:', data);

        // Update cart count in header
        this.updateCartCount();

        // Navigate to complete step
        this.state.currentStep = 'complete';
        this.saveState();
        this.render();

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const error = await response.json();
        console.error('Cart error:', error);
        this.showNotification('Unable to add to cart. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Add to cart failed:', error);
      this.showNotification('Something went wrong. Please try again.', 'error');
    }
  },

  /**
   * Get the variant ID for the custom ring product
   * This can be set via data attribute or fetched from section settings
   */
  getCustomRingVariantId() {
    // Check for variant ID in the container's data attribute
    const container = document.getElementById('ringBuilderContainer');
    if (container?.dataset.variantId) {
      return parseInt(container.dataset.variantId);
    }

    // Check for global setting
    if (window.LAURA_MILMAN?.customRingVariantId) {
      return window.LAURA_MILMAN.customRingVariantId;
    }

    return null;
  },

  /**
   * Show inquiry modal when no variant ID is configured
   */
  showInquiryModal(properties) {
    const modal = document.createElement('div');
    modal.className = 'rb-inquiry-modal';
    modal.innerHTML = `
      <div class="rb-inquiry-modal__overlay"></div>
      <div class="rb-inquiry-modal__content">
        <button class="rb-inquiry-modal__close">&times;</button>
        <h2>Complete Your Order</h2>
        <p>Your custom ring is ready! Please contact us to complete your order.</p>
        
        <div class="rb-inquiry-modal__summary">
          <h4>Your Selection:</h4>
          <ul>
            <li><strong>Diamond:</strong> ${properties['Diamond']}</li>
            <li><strong>Setting:</strong> ${properties['Setting']}</li>
            <li><strong>Metal:</strong> ${properties['Metal']}</li>
            <li><strong>Band:</strong> ${properties['Band Style']}</li>
            <li><strong>Total:</strong> ${properties['Total Price']}</li>
          </ul>
        </div>
        
        <div class="rb-inquiry-modal__actions">
          <a href="mailto:hello@lauramilman.com?subject=Custom Ring Inquiry&body=${encodeURIComponent(this.formatEmailBody(properties))}" 
             class="btn btn--primary btn--lg">
            Email Us
          </a>
          <a href="/pages/contact" class="btn btn--outline">
            Contact Page
          </a>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    modal.querySelector('.rb-inquiry-modal__close').onclick = () => modal.remove();
    modal.querySelector('.rb-inquiry-modal__overlay').onclick = () => modal.remove();
  },

  /**
   * Format email body for inquiry
   */
  formatEmailBody(properties) {
    let body = 'I would like to order a custom engagement ring with the following specifications:\n\n';
    for (const [key, value] of Object.entries(properties)) {
      if (!key.startsWith('_')) {
        body += `${key}: ${value}\n`;
      }
    }
    body += '\nPlease contact me to complete this order.\n';
    return body;
  },

  /**
   * Update cart count in header
   */
  async updateCartCount() {
    try {
      const response = await fetch('/cart.js');
      const cart = await response.json();
      const countElement = document.querySelector('.cart-count');
      if (countElement) {
        countElement.textContent = cart.item_count;
        countElement.style.display = cart.item_count > 0 ? 'flex' : 'none';
      }
    } catch (e) {
      console.error('Failed to update cart count:', e);
    }
  },

  /**
   * Show notification
   */
  showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'rb-notification';
    notification.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      <span>${message}</span>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  },

  /**
   * Main render function
   */
  render() {
    const container = document.getElementById('ringBuilderContainer');
    if (!container) return;

    switch (this.state.currentStep) {
      case 'entry':
        this.renderEntryStep(container);
        break;
      case 'pick-shape':
        this.renderPickShapeStep(container);
        break;
      case 'diamond':
        this.renderDiamondStep(container);
        break;
      case 'setting':
        this.renderSettingStep(container);
        break;
      case 'customize':
        this.renderCustomizeStep(container);
        break;
      case 'complete':
        this.renderCompleteStep(container);
        break;
    }
  },

  /**
   * Render entry step - choose path
   */
  /**
   * Diamond-first: choose center stone shape before browsing diamonds (Shopify)
   */
  renderPickShapeStep(container) {
    const shapes = this.settingsData?.shapes || [];
    container.innerHTML = `
      <div class="rb-pick-shape rb-step">
        <div class="rb-step__header rb-pick-shape__header">
          <button type="button" class="rb-btn-back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            Back
          </button>
        </div>
        <div class="rb-pick-shape__inner">
          <h1 class="rb-pick-shape__title">Choose your diamond shape</h1>
          <p class="rb-pick-shape__subtitle">We will show diamonds in this shape first. You can refine further on the next page.</p>
          <div class="rb-pick-shape__grid">
            ${shapes.map(s => `
              <button type="button" class="rb-entry-shape-btn" data-shape-id="${s.id}" title="${s.name}">
                <span class="rb-entry-shape-btn__icon">${this.getShapeIcon(s.id)}</span>
                <span class="rb-entry-shape-btn__label">${s.name}</span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  },

  renderEntryStep(container) {
    container.innerHTML = `
      <div class="rb-entry">
        <div class="rb-entry__header">
          <h1 class="rb-entry__title">Build Your Dream Ring</h1>
          <p class="rb-entry__subtitle">Create a one-of-a-kind engagement ring that tells your unique love story</p>
        </div>
        
        <div class="rb-entry__paths">
          <div class="entry-path-card" data-path="diamond-first">
            <div class="entry-path-card__icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <h3 class="entry-path-card__title">Start with a Diamond</h3>
            <p class="entry-path-card__description">Choose your perfect lab-grown diamond first, then select a setting to complement it</p>
            <span class="entry-path-card__cta">
              Browse Diamonds
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </span>
          </div>
          
          <div class="entry-path-card" data-path="setting-first">
            <div class="entry-path-card__icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v4m0 14v4m11-11h-4M5 12H1m17.66-6.66l-2.83 2.83M9.17 14.83l-2.83 2.83m0-11.32l2.83 2.83m5.66 5.66l2.83 2.83"/>
              </svg>
            </div>
            <h3 class="entry-path-card__title">Start with a Setting</h3>
            <p class="entry-path-card__description">Explore our beautiful ring settings first, then find the ideal diamond to complete your ring</p>
            <span class="entry-path-card__cta">
              Browse Settings
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </span>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Render diamond selection step
   */
  // Builder diamond filter state
  builderFilters: {
    shapes: [],
    sort: 'price-asc',
    displayCount: 20
  },
  builderDiamondsCache: [],

  renderDiamondStep(container) {
    const hasSelectedSetting = this.state.selectedSetting !== null;
    const compatibleShapes = hasSelectedSetting ? this.state.selectedSetting.compatibleShapes : null;
    const allShapes = this.settingsData?.shapes || [];
    const filterShapes = compatibleShapes
      ? allShapes.filter(s => compatibleShapes.includes(s.id))
      : allShapes;

    container.innerHTML = `
      <div class="rb-step rb-step--diamond">
        <div class="rb-step__header">
          ${this.renderProgressBar()}
          <button class="rb-btn-back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            Back
          </button>
        </div>
        
        <div class="rb-step__content">
          <div class="rb-step__main">
            <h2 class="rb-step__title">Select Your Diamond</h2>
            <p class="rb-step__subtitle">Choose the perfect lab-grown diamond for your ring</p>
            
            <!-- Diamond Filter Bar -->
            <div class="rb-filter-bar">
              <div class="rb-filter-group">
                <span class="rb-filter-label">Shape</span>
                <div class="rb-filter-shapes">
                  ${filterShapes.map(s => `
                    <button class="rb-filter-shape-btn ${this.builderFilters.shapes.includes(s.id) ? 'active' : ''}" 
                            data-shape="${s.id}" title="${s.name}">
                      ${this.getShapeIcon(s.id)}
                    </button>
                  `).join('')}
                </div>
              </div>
              <div class="rb-filter-group">
                <span class="rb-filter-label">Sort by</span>
                <div class="rb-filter-sort">
                  <button class="rb-filter-sort-btn ${this.builderFilters.sort === 'price-asc' ? 'active' : ''}" data-sort="price-asc">Price ↑</button>
                  <button class="rb-filter-sort-btn ${this.builderFilters.sort === 'price-desc' ? 'active' : ''}" data-sort="price-desc">Price ↓</button>
                  <button class="rb-filter-sort-btn ${this.builderFilters.sort === 'carat-desc' ? 'active' : ''}" data-sort="carat-desc">Carat ↓</button>
                </div>
              </div>
            </div>
            
            <div id="diamondBuilderResults" class="rb-diamond-grid">
              <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Loading diamonds...</p>
              </div>
            </div>
          </div>
          
          ${hasSelectedSetting ? `
            <div class="rb-step__sidebar">
              <div class="rb-selection-summary">
                <h4>Your Setting</h4>
                <div class="rb-selection-card">
                  <div class="rb-selection-card__icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M12 1v4m0 14v4m11-11h-4M5 12H1"/>
                    </svg>
                  </div>
                  <div class="rb-selection-card__info">
                    <span class="rb-selection-card__name">${this.state.selectedSetting.name}</span>
                    <span class="rb-selection-card__price">${this.formatPrice(this.state.selectedSetting.basePrice)}</span>
                  </div>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
        ${this.renderConfigSummaryBar()}
      </div>
    `;

    // Load diamonds
    this.loadDiamondsForBuilder();
  },

  /**
   * Load diamonds for builder
   */
  async loadDiamondsForBuilder() {
    if (typeof DiamondAPI !== 'undefined') {
      // Use shape filter if we have a setting with compatible shapes
      if (this.state.selectedSetting?.compatibleShapes) {
        DiamondAPI.filters.shapes = this.state.selectedSetting.compatibleShapes;
      }

      const compat = this.state.selectedSetting?.compatibleShapes;
      const dShape = this.state.selectedDiamond?.shape;
      if (compat?.length && dShape && compat.includes(dShape)) {
        this.builderFilters.shapes = [dShape];
      } else if (!dShape) {
        this.builderFilters.shapes = [];
      }

      const diamonds = await DiamondAPI.fetchDiamonds(1);
      this.builderDiamondsCache = diamonds;
      this.renderDiamondGrid(diamonds);
    } else {
      // Fallback sample diamonds
      this.builderDiamondsCache = this.getSampleDiamonds();
      this.renderDiamondGrid(this.builderDiamondsCache);
    }
  },

  /**
   * Toggle shape filter in builder
   */
  toggleBuilderShapeFilter(shape) {
    const idx = this.builderFilters.shapes.indexOf(shape);
    if (idx >= 0) {
      this.builderFilters.shapes.splice(idx, 1);
    } else {
      this.builderFilters.shapes.push(shape);
    }
    // Update button states
    document.querySelectorAll('.rb-filter-shape-btn').forEach(btn => {
      btn.classList.toggle('active', this.builderFilters.shapes.includes(btn.dataset.shape));
    });
    this.renderDiamondGrid(this.builderDiamondsCache);
  },

  /**
   * Set sort mode in builder
   */
  setBuilderSort(sort) {
    this.builderFilters.sort = sort;
    document.querySelectorAll('.rb-filter-sort-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sort === sort);
    });
    this.renderDiamondGrid(this.builderDiamondsCache);
  },

  /**
   * Load more diamonds in builder
   */
  loadMoreBuilderDiamonds() {
    this.builderFilters.displayCount += 12;
    this.renderDiamondGrid(this.builderDiamondsCache);
  },

  /**
   * Filter and sort builder diamonds
   */
  filterAndSortDiamonds(diamonds) {
    let filtered = [...diamonds];

    // Apply shape filter
    if (this.builderFilters.shapes.length > 0) {
      filtered = filtered.filter(d => {
        const shape = (d.Shape || d.shape || 'round').toLowerCase();
        return this.builderFilters.shapes.includes(shape);
      });
    }

    // Apply sort
    filtered.sort((a, b) => {
      const priceA = typeof DiamondAPI !== 'undefined' ? DiamondAPI.calculatePrice(a) : (a.price || 0);
      const priceB = typeof DiamondAPI !== 'undefined' ? DiamondAPI.calculatePrice(b) : (b.price || 0);
      const caratA = parseFloat(a.Weight || a.carat || 0);
      const caratB = parseFloat(b.Weight || b.carat || 0);

      switch (this.builderFilters.sort) {
        case 'price-asc': return priceA - priceB;
        case 'price-desc': return priceB - priceA;
        case 'carat-desc': return caratB - caratA;
        default: return 0;
      }
    });

    return filtered;
  },
};

window.RingBuilder = RingBuilder;
