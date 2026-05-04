/**
 * Laura Milman — Ring Builder Module (part 2)
 */

Object.assign(window.RingBuilder, {

  /**
   * Render diamond grid for builder
   */
  renderDiamondGrid(diamonds) {
    const container = document.getElementById('diamondBuilderResults');
    if (!container) return;

    const filtered = this.filterAndSortDiamonds(diamonds);
    const displayCount = this.builderFilters.displayCount;
    const visible = filtered.slice(0, displayCount);
    const hasMore = filtered.length > displayCount;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="rb-no-results">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          <p>No diamonds match your filters</p>
          <button class="btn btn--outline" onclick="RingBuilder.builderFilters.shapes = []; RingBuilder.renderDiamondGrid(RingBuilder.builderDiamondsCache); document.querySelectorAll('.rb-filter-shape-btn').forEach(b => b.classList.remove('active'));">Clear Filters</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <p class="rb-diamond-count">${filtered.length} diamond${filtered.length !== 1 ? 's' : ''} found</p>
      <div class="rb-diamond-list">
        ${visible.map(d => this.createBuilderDiamondCard(d)).join('')}
      </div>
      ${hasMore ? `
        <div class="rb-load-more">
          <button class="btn btn--outline rb-load-more-btn">Load More (${filtered.length - displayCount} remaining)</button>
        </div>
      ` : ''}
    `;
  },

  /**
   * Create diamond card for builder
   */
  createBuilderDiamondCard(diamond) {
    const price = typeof DiamondAPI !== 'undefined'
      ? DiamondAPI.calculatePrice(diamond)
      : diamond.price || 2500;
    const shapeRaw = diamond.Shape || diamond.shape || 'Round';
    const shapeSlug = shapeRaw.toString().trim().toLowerCase();
    const carat = parseFloat(diamond.Weight || diamond.carat || 1).toFixed(2);
    const color = diamond.Color || diamond.color || 'G';
    const clarity = diamond.Clarity || diamond.clarity || 'VS1';
    const imageUrl = diamond.ImageLink || diamond.image || '';
    const videoUrl = diamond.VideoLink || diamond.video || ''; // NEW: Get video URL
    const certUrl = diamond.CertificateLink || diamond.certificate || '';

    const diamondData = JSON.stringify({
      id: diamond.Stock_No || diamond.id,
      shape: shapeSlug,
      carat: carat,
      color: color,
      clarity: clarity,
      price: price,
      image: imageUrl,
      certificate: certUrl
    }).replace(/"/g, '&quot;');

    return `
      <div class="rb-diamond-card" 
           ${videoUrl ? `onmouseenter="this.querySelector('video')?.play()" onmouseleave="this.querySelector('video')?.pause()"` : ''}>
        <div class="rb-diamond-card__image">
          ${imageUrl
        ? `<img src="${imageUrl}" alt="${carat}ct ${shapeRaw}" loading="lazy">`
        : `<div class="rb-diamond-card__placeholder">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>`
      }
          ${videoUrl ? `
            <video class="rb-diamond-card__video" muted loop playsinline preload="none" poster="${imageUrl}">
              <source src="${videoUrl}" type="video/mp4">
            </video>
            <span class="rb-diamond-card__video-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              360°
            </span>
          ` : ''}
        </div>
        <div class="rb-diamond-card__content">
          <h4 class="rb-diamond-card__title">${carat}ct ${shapeRaw}</h4>
          <div class="rb-diamond-card__specs">
            <span>${color}</span>
            <span>${clarity}</span>
          </div>
          <div class="rb-diamond-card__price">${this.formatPrice(price)}</div>
          <button class="btn btn--primary btn--sm diamond-select-btn" data-diamond="${diamondData}">
            Select Diamond
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Get sample diamonds for fallback
   */
  getSampleDiamonds() {
    return [
      { id: '1', shape: 'Round', carat: 1.50, color: 'E', clarity: 'VS1', price: 3200 },
      { id: '2', shape: 'Oval', carat: 1.75, color: 'F', clarity: 'VS2', price: 3800 },
      { id: '3', shape: 'Cushion', carat: 2.00, color: 'G', clarity: 'VVS2', price: 4500 },
      { id: '4', shape: 'Princess', carat: 1.25, color: 'E', clarity: 'VVS1', price: 2900 },
      { id: '5', shape: 'Radiant', carat: 1.80, color: 'F', clarity: 'VS1', price: 4100 },
      { id: '6', shape: 'Emerald', carat: 2.10, color: 'D', clarity: 'VS2', price: 5200 }
    ];
  },

  /**
   * Render setting selection step
   */
  renderSettingStep(container) {
    const hasSelectedDiamond = this.state.selectedDiamond !== null;
    const settings = this.settingsData?.settings || [];

    // Filter settings by compatible shapes if diamond is selected
    const filteredSettings = hasSelectedDiamond
      ? settings.filter(s => s.compatibleShapes.includes(this.state.selectedShape))
      : settings;

    const emptySettings = hasSelectedDiamond && filteredSettings.length === 0;
    const shapeLabel = this.capitalize(this.state.selectedShape || '');

    container.innerHTML = `
      <div class="rb-step rb-step--setting">
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
            <h2 class="rb-step__title">Choose Your Setting</h2>
            <p class="rb-step__subtitle">${hasSelectedDiamond
        ? `Showing settings that fit your <strong>${shapeLabel}</strong> diamond.`
        : 'Select a setting style for your engagement ring'}</p>
            
            ${emptySettings ? `
              <div class="rb-empty-settings">
                <p>We do not have a setting style in our builder that matches this diamond shape yet. Try a different diamond shape, or start over to browse all settings first.</p>
                <div class="rb-empty-settings__actions">
                  <button type="button" class="btn btn--primary rb-btn-select-diamond">Choose a different diamond</button>
                  <button type="button" class="btn btn--outline rb-btn-start-over">Start over</button>
                </div>
              </div>
            ` : `
            <div class="rb-settings-grid">
              ${filteredSettings.map(setting => this.createSettingCard(setting)).join('')}
            </div>
            `}
          </div>
          
          ${hasSelectedDiamond ? `
            <div class="rb-step__sidebar">
              <div class="rb-selection-summary">
                <h4>Your Diamond</h4>
                <div class="rb-selection-card">
                  <div class="rb-selection-card__icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                    </svg>
                  </div>
                  <div class="rb-selection-card__info">
                    <span class="rb-selection-card__name">${this.state.selectedDiamond.carat}ct ${this.state.selectedDiamond.shape}</span>
                    <span class="rb-selection-card__details">${this.state.selectedDiamond.color} / ${this.state.selectedDiamond.clarity}</span>
                    <span class="rb-selection-card__price">${this.formatPrice(this.state.selectedDiamond.price)}</span>
                  </div>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
        ${this.renderConfigSummaryBar()}
      </div>
    `;
  },

  /**
   * Create setting card
   */
  createSettingCard(setting) {
    const imageHtml = setting.image
      ? `<img src="${setting.image}" alt="${setting.name}" loading="lazy">`
      : `<div class="setting-card__placeholder">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0 0 2-4 8-4s8 4 8 4"/>
              <circle cx="12" cy="8" r="2" fill="currentColor" opacity="0.2"/>
            </svg>
          </div>`;

    return `
      <div class="setting-card" data-setting-id="${setting.id}">
        <div class="setting-card__image">
          ${imageHtml}
        </div>
        <div class="setting-card__content">
          <h3 class="setting-card__title">${setting.name}</h3>
          <p class="setting-card__description">${setting.description}</p>
          <div class="setting-card__price">Starting at ${this.formatPrice(setting.basePrice)}</div>
          <div class="setting-card__features">
            ${setting.hasHalo ? '<span class="setting-feature">Halo</span>' : ''}
            ${setting.hasSideStones ? '<span class="setting-feature">Side Stones</span>' : ''}
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Render customization step
   */
  renderCustomizeStep(container) {
    const setting = this.state.selectedSetting;
    const diamond = this.state.selectedDiamond;
    const metals = this.settingsData?.metals || [];
    const bands = this.settingsData?.bands || [];
    const shapes = this.settingsData?.shapes || [];
    const ringSizes = this.settingsData?.ringSizes || [];

    // Get current metal and band for price calculation
    const currentMetal = metals.find(m => m.id === this.state.selectedMetal);
    const currentBand = bands.find(b => b.id === this.state.selectedBand);

    // Calculate price components
    const diamondPrice = diamond?.price || 0;
    const settingPrice = setting?.basePrice || 0;
    const metalUpgrade = currentMetal?.priceModifier || 0;
    const bandUpgrade = currentBand?.priceModifier || 0;
    const totalPrice = this.calculatePrice();
    const previewUrl = setting?.metalImages?.[this.state.selectedMetal] || setting?.image || '';
    const dockTitle = setting?.name ? this.escapeHtml(setting.name) : 'Your ring';
    const dockSub = [
      currentMetal?.name,
      diamond ? `${diamond.carat}ct ${this.capitalize(diamond.shape || '')}` : ''
    ].filter(Boolean).join(' · ');
    const dockSubSafe = this.escapeHtml(dockSub);

    container.innerHTML = `
      ${this.renderSharedBanner()}
      <div class="rb-step rb-step--customize">
        <div class="rb-step__header">
          ${this.renderProgressBar()}
          <div class="rb-header-actions">
            <button class="rb-btn-share">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="18" cy="5" r="3"/>
                <circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              <span>Share Design</span>
            </button>
          </div>
          <button class="rb-btn-back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            Back
          </button>
        </div>
        
        <div class="rb-customize-layout">
          <!-- Preview Panel -->
          <div class="rb-preview-panel">
            <div class="rb-preview-main">
              <!-- Metal Indicator Badge -->
              <div class="rb-metal-indicator">
                <span class="rb-metal-indicator__swatch" style="background: ${currentMetal?.color || '#e8e8e8'}"></span>
                <span>${currentMetal?.name || ''}</span>
              </div>
              <div class="rb-preview-image">
                ${(() => {
        // Use metal-specific image if available, otherwise fall back to default
        const imageUrl = setting?.metalImages?.[this.state.selectedMetal] || setting?.image;
        return imageUrl
          ? `<img src="${imageUrl}" alt="${setting.name}" class="rb-preview-img">`
          : `<div class="rb-preview-placeholder">
                        <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.5">
                          <circle cx="12" cy="10" r="5"/>
                          <path d="M4 22c0 0 2-6 8-6s8 6 8 6"/>
                          <circle cx="12" cy="10" r="2.5" fill="currentColor" opacity="0.1"/>
                        </svg>
                        <span>Preview of ${setting?.name || 'your ring'}</span>
                      </div>`;
      })()}
              </div>
              ${diamond ? `
                <div class="rb-preview-badge">
                  ${diamond.carat}ct ${this.capitalize(diamond.shape)}
                </div>
              ` : ''}
            </div>
            
            <!-- Diamond Summary Card -->
            ${diamond ? `
              <div class="rb-diamond-summary">
                <h4 class="rb-summary-title">Your Diamond</h4>
                <div class="rb-summary-specs">
                  <div class="rb-spec">
                    <span class="rb-spec-label">Shape</span>
                    <span class="rb-spec-value">${this.capitalize(diamond.shape)}</span>
                  </div>
                  <div class="rb-spec">
                    <span class="rb-spec-label">Carat</span>
                    <span class="rb-spec-value">${diamond.carat}ct</span>
                  </div>
                  <div class="rb-spec">
                    <span class="rb-spec-label">Color</span>
                    <span class="rb-spec-value">${diamond.color}</span>
                  </div>
                  <div class="rb-spec">
                    <span class="rb-spec-label">Clarity</span>
                    <span class="rb-spec-value">${diamond.clarity}</span>
                  </div>
                </div>
                <div class="rb-summary-price">${this.formatPrice(diamondPrice)}</div>
              </div>
            ` : ''}
          </div>
          
          <!-- Options Panel -->
          <div class="rb-options-panel">
            <h2 class="rb-options-title">${setting?.name || 'Engagement Ring'}</h2>
            
            <!-- Price Breakdown -->
            <div class="rb-price-breakdown">
              ${diamond ? `
                <div class="rb-price-row">
                  <span>Diamond (${diamond.carat}ct ${this.capitalize(diamond.shape)})</span>
                  <span>${this.formatPrice(diamondPrice)}</span>
                </div>
              ` : ''}
              <div class="rb-price-row">
                <span>Setting (${setting?.name})</span>
                <span>${this.formatPrice(settingPrice)}</span>
              </div>
              ${metalUpgrade > 0 ? `
                <div class="rb-price-row">
                  <span>Metal Upgrade (${currentMetal?.name})</span>
                  <span>+${this.formatPrice(metalUpgrade)}</span>
                </div>
              ` : ''}
              ${bandUpgrade > 0 ? `
                <div class="rb-price-row">
                  <span>Band Style (${currentBand?.name})</span>
                  <span>+${this.formatPrice(bandUpgrade)}</span>
                </div>
              ` : ''}
              <div class="rb-price-row rb-price-total">
                <span>Total</span>
                <span class="rb-total-price">${this.formatPrice(totalPrice)}</span>
              </div>
            </div>
            
            <!-- Ring Size Selector -->
            <div class="rb-option-group">
              <label class="rb-option-label">
                Ring Size
                <span class="rb-option-value">${this.state.selectedRingSize}</span>
              </label>
              <div class="rb-ring-size-options">
                ${ringSizes.map(size => `
                  <button class="ring-size-option ${size.id === this.state.selectedRingSize ? 'active' : ''}" 
                          data-size="${size.id}">
                    ${size.name}
                  </button>
                `).join('')}
              </div>
              <a href="#" class="rb-size-guide-link">Need help finding your size?</a>
            </div>
            
            <!-- Metal Selector -->
            <div class="rb-option-group">
              <label class="rb-option-label">
                Metal
                <span class="rb-option-value">${currentMetal?.name || ''}</span>
              </label>
              <div class="rb-metal-options-improved">
                ${metals.map(metal => `
                  <button class="metal-option-improved ${metal.id === this.state.selectedMetal ? 'active' : ''}" 
                          data-metal-id="${metal.id}"
                          title="${metal.name}">
                    <span class="metal-swatch-improved" style="background: ${metal.color}"></span>
                    <span class="metal-name">${metal.name.replace('14k ', '').replace('18k ', '')}</span>
                    ${metal.priceModifier > 0 ? `<span class="metal-price">+${this.formatPrice(metal.priceModifier)}</span>` : ''}
                  </button>
                `).join('')}
              </div>
            </div>
            
            <!-- Band Selector -->
            <div class="rb-option-group">
              <label class="rb-option-label">
                Band Style
                <span class="rb-option-value">${currentBand?.name || ''}</span>
              </label>
              <div class="rb-band-options-improved">
                ${bands.map(band => `
                  <button class="band-option-improved ${band.id === this.state.selectedBand ? 'active' : ''}" 
                          data-band-id="${band.id}">
                    ${this.getBandIcon(band.id)}
                    <span class="band-name">${band.name}</span>
                    ${band.priceModifier > 0 ? `<span class="band-price">+${this.formatPrice(band.priceModifier)}</span>` : ''}
                  </button>
                `).join('')}
              </div>
            </div>
            
            ${setting?.hasSideStones ? `
              <!-- Side Stone Shape -->
              <div class="rb-option-group">
                <label class="rb-option-label">
                  Side Stone Shape
                  <span class="rb-option-value">${this.state.sideStoneShape ? this.capitalize(this.state.sideStoneShape.replace('-', ' ')) : 'Select'}</span>
                </label>
                <div class="rb-side-stone-options">
                  ${setting.sideStoneOptions?.map(opt => `
                    <button class="side-stone-option ${opt.shape === this.state.sideStoneShape ? 'active' : ''}" 
                            data-shape-id="${opt.shape}">
                      <span class="side-stone-icon">${this.getSideStoneIcon(opt.shape)}</span>
                      <span>${opt.name}</span>
                    </button>
                  `).join('') || ''}
                </div>
              </div>
            ` : ''}
            
            <!-- Prong Style Selector - Only show for settings that support prong customization -->
            ${(() => {
        // Hide prong selector for Pavé, Channel, and Bezel settings/bands (they have fixed prong styles)
        const hideProngSelector = ['pave', 'channel', 'bezel'].includes(this.state.selectedBand) ||
          ['pave', 'bezel'].includes(setting?.id);

        if (hideProngSelector) {
          return `
                  <div class="rb-option-group rb-option-group--disabled">
                    <label class="rb-option-label">
                      Prong Style
                      <span class="rb-option-value">Fixed for this design</span>
                    </label>
                    <p class="rb-option-note">This setting style has a fixed prong configuration.</p>
                  </div>
                `;
        }

        return `
                <div class="rb-option-group">
                  <label class="rb-option-label">
                    Prong Style
                    <span class="rb-option-value">${this.prongStyles.find(p => p.id === this.state.selectedProngStyle)?.name || '4 Prong'}</span>
                  </label>
                  <div class="rb-prong-options">
                    ${this.prongStyles.map(prong => `
                      <button class="prong-option ${prong.id === this.state.selectedProngStyle ? 'active' : ''}" 
                              data-prong-id="${prong.id}"
                              title="${prong.description}">
                        <div class="prong-option__icon">
                          ${this.getProngIcon(prong.id)}
                        </div>
                        <span class="prong-option__name">${prong.name}</span>
                        ${prong.priceModifier > 0 ? `<span class="prong-option__price">+${this.formatPrice(prong.priceModifier)}</span>` : ''}
                      </button>
                    `).join('')}
                  </div>
                </div>
              `;
      })()}
            
            <!-- Engraving Option -->
            <div class="rb-option-group">
              <label class="rb-option-label">
                Personalization
              </label>
              <button class="rb-engraving-toggle ${this.state.engravingEnabled ? 'active' : ''}">
                <span class="rb-engraving-toggle__label">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 20h9"/>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                  Add Custom Engraving
                </span>
                <span class="rb-engraving-toggle__switch"></span>
              </button>
              <div class="rb-engraving-input-wrap" style="${this.state.engravingEnabled ? 'display: flex' : ''}">
                <input type="text" class="rb-engraving-input" placeholder="Enter your text..." value="${this.state.engravingText || ''}" maxlength="20">
                <span class="rb-engraving-counter">${(this.state.engravingText || '').length}/20</span>
              </div>
            </div>
            
            <!-- Actions -->
            <div class="rb-actions">
              ${!diamond ? `
                <button class="btn btn--primary btn--lg rb-btn-select-diamond">
                  Select Your Lab-Grown Diamond
                </button>
              ` : `
                <button class="btn btn--primary btn--lg rb-btn-add-to-cart">
                  Add to Cart - ${this.formatPrice(totalPrice)}
                </button>
              `}
              <button class="btn btn--outline rb-btn-start-over">
                Start Over
              </button>
            </div>
          </div>
        </div>
        ${this.renderPreviewDockHtml(previewUrl, dockTitle, dockSubSafe, this.formatPrice(totalPrice))}
      </div>
    `;
  },

  /**
   * Sticky bar: diamond + setting + estimated total (diamond / setting steps)
   */
  renderConfigSummaryBar() {
    const d = this.state.selectedDiamond;
    const s = this.state.selectedSetting;
    const parts = [];
    if (d) {
      parts.push(`
        <div class="rb-config-summary__part">
          <span class="rb-config-summary__label">Diamond</span>
          <span class="rb-config-summary__value">${d.carat}ct ${this.capitalize(d.shape || '')}</span>
        </div>
      `);
    }
    if (s) {
      parts.push(`
        <div class="rb-config-summary__part">
          <span class="rb-config-summary__label">Setting</span>
          <span class="rb-config-summary__value">${s.name}</span>
        </div>
      `);
    }
    if (parts.length === 0) return '';
    const total = this.calculatePrice();
    return `
      <div class="rb-config-summary" role="region" aria-label="Ring configuration summary">
        <div class="rb-config-summary__parts">
          ${parts.join('')}
        </div>
        <div class="rb-config-summary__part">
          <span class="rb-config-summary__label">Est. total</span>
          <span class="rb-config-summary__total">${this.formatPrice(total)}</span>
        </div>
      </div>
    `;
  },

  /**
   * Mobile dock HTML for customize step (preview stays visible)
   */
  renderPreviewDockHtml(previewUrl, titleLine, subLine, totalFormatted) {
    const img = previewUrl
      ? `<img src="${previewUrl}" alt="" class="rb-preview-dock__img-el">`
      : `<div class="rb-preview-dock__placeholder"></div>`;
    return `
      <div class="rb-preview-dock" id="rbPreviewDock" aria-hidden="false">
        <div class="rb-preview-dock__thumb" id="rbPreviewDockThumb">${img}</div>
        <div class="rb-preview-dock__meta">
          <div class="rb-preview-dock__title" id="rbPreviewDockTitle">${titleLine}</div>
          <div class="rb-preview-dock__sub" id="rbPreviewDockSub">${subLine}</div>
        </div>
        <div class="rb-preview-dock__total" id="rbPreviewDockTotal">${totalFormatted}</div>
      </div>
    `;
  },

  /**
   * Render progress bar
   */
  renderProgressBar() {
    const steps = this.state.entryPath === 'diamond-first'
      ? [
        { id: 'diamond', label: 'Diamond' },
        { id: 'setting', label: 'Setting' },
        { id: 'customize', label: 'Customize' }
      ]
      : [
        { id: 'setting', label: 'Setting' },
        { id: 'diamond', label: 'Diamond' },
        { id: 'customize', label: 'Customize' }
      ];

    const getCurrentStepIndex = () => {
      return steps.findIndex(s => s.id === this.state.currentStep);
    };

    const currentIndex = getCurrentStepIndex();

    return `
      <div class="rb-progress">
        ${steps.map((step, index) => `
          <div class="rb-progress__step ${index <= currentIndex ? 'active' : ''} ${index < currentIndex ? 'complete' : ''}">
            <div class="rb-progress__number">${index + 1}</div>
            <span class="rb-progress__label">${step.label}</span>
          </div>
          ${index < steps.length - 1 ? '<div class="rb-progress__line"></div>' : ''}
        `).join('')}
      </div>
    `;
  },

  /**
   * Get shape icon SVG
   */
  getShapeIcon(shape) {
    const icons = {
      round: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>',
      princess: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16"/></svg>',
      cushion: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/></svg>',
      emerald: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/></svg>',
      oval: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="6" ry="9"/></svg>',
      radiant: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="1"/></svg>',
      asscher: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16"/><rect x="7" y="7" width="10" height="10"/></svg>',
      marquise: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="4" ry="10"/></svg>',
      heart: '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
      pear: '<svg viewBox="0 0 24 24"><path d="M12 3c-3 0-6 4-6 9s3 9 6 9 6-4 6-9-3-9-6-9z"/></svg>'
    };
    return icons[shape] || icons.round;
  },

  /**
   * Get side stone icon
   */
  getSideStoneIcon(shape) {
    const icons = {
      'tapered-baguette': '◇',
      'trillion': '△',
      'round': '○'
    };
    return icons[shape] || '◇';
  },

  /**
   * Get band icon
   */
  getBandIcon(band) {
    const icons = {
      plain: '<svg viewBox="0 0 40 20"><path d="M5 10h30" stroke="currentColor" stroke-width="3" fill="none"/></svg>',
      pave: '<svg viewBox="0 0 40 20"><path d="M5 10h30" stroke="currentColor" stroke-width="3" fill="none"/><circle cx="10" cy="10" r="2"/><circle cx="16" cy="10" r="2"/><circle cx="22" cy="10" r="2"/><circle cx="28" cy="10" r="2"/></svg>',
      channel: '<svg viewBox="0 0 40 20"><rect x="5" y="7" width="30" height="6" rx="1"/><rect x="8" y="9" width="24" height="2" fill="currentColor" opacity="0.3"/></svg>',
      cathedral: '<svg viewBox="0 0 40 20"><path d="M5 15 C10 5, 15 5, 20 5 C25 5, 30 5, 35 15" stroke="currentColor" stroke-width="2" fill="none"/></svg>'
    };
    return icons[band] || icons.plain;
  },

  /**
   * Capitalize first letter
   */
  capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  },

  escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  // =============================================
  // NEW: SHARE & SAVE DESIGN FEATURES
  // =============================================

  /**
   * Load design from shared URL hash
   * @returns {boolean} True if design was loaded from URL
   */
  loadFromSharedUrl() {
    try {
      const hash = window.location.hash;
      if (!hash || !hash.startsWith('#design=')) return false;

      const encodedState = hash.replace('#design=', '');
      const stateJson = decodeURIComponent(atob(encodedState));
      const sharedState = JSON.parse(stateJson);

      // Merge shared state with defaults
      this.state = { ...this.state, ...sharedState, isSharedDesign: true };

      console.log('Loaded shared design:', this.state);
      return true;
    } catch (e) {
      console.error('Failed to load shared design:', e);
      return false;
    }
  },

  /**
   * Generate shareable URL with current design
   */
  generateShareUrl() {
    // Only share the relevant state (not transient data)
    const shareableState = {
      currentStep: this.state.currentStep,
      entryPath: this.state.entryPath,
      selectedDiamond: this.state.selectedDiamond,
      selectedSetting: this.state.selectedSetting ? {
        id: this.state.selectedSetting.id,
        name: this.state.selectedSetting.name,
        basePrice: this.state.selectedSetting.basePrice
      } : null,
      selectedMetal: this.state.selectedMetal,
      selectedBand: this.state.selectedBand,
      selectedShape: this.state.selectedShape,
      selectedRingSize: this.state.selectedRingSize,
      selectedProngStyle: this.state.selectedProngStyle,
      sideStoneShape: this.state.sideStoneShape,
      sideStoneCarat: this.state.sideStoneCarat
    };

    const encoded = btoa(encodeURIComponent(JSON.stringify(shareableState)));
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}#design=${encoded}`;
  },

  /**
   * Show share modal
   */
  showShareModal() {
    const shareUrl = this.generateShareUrl();

    const modal = document.createElement('div');
    modal.className = 'rb-share-modal active';
    modal.innerHTML = `
      <div class="rb-share-modal__overlay"></div>
      <div class="rb-share-modal__content">
        <button class="rb-share-modal__close">&times;</button>
        <div class="rb-share-modal__header">
          <h3>Share Your Design</h3>
          <p>Copy this link to share your custom ring design with friends and family</p>
        </div>
        <div class="rb-share-modal__link-box">
          <input type="text" class="rb-share-modal__input" value="${shareUrl}" readonly>
          <button class="rb-share-modal__copy-btn">Copy Link</button>
        </div>
        <div class="rb-share-modal__social">
          <button class="rb-share-modal__social-btn" data-share="email" title="Share via Email">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </button>
          <button class="rb-share-modal__social-btn" data-share="whatsapp" title="Share on WhatsApp">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </button>
          <button class="rb-share-modal__social-btn" data-share="pinterest" title="Share on Pinterest">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    modal.querySelector('.rb-share-modal__close').onclick = () => modal.remove();
    modal.querySelector('.rb-share-modal__overlay').onclick = () => modal.remove();

    // Copy button handler
    const copyBtn = modal.querySelector('.rb-share-modal__copy-btn');
    const input = modal.querySelector('.rb-share-modal__input');

    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(shareUrl);
        copyBtn.textContent = 'Copied!';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.textContent = 'Copy Link';
          copyBtn.classList.remove('copied');
        }, 2000);
      } catch (e) {
        input.select();
        document.execCommand('copy');
      }
    };

    // Social share handlers
    modal.querySelectorAll('.rb-share-modal__social-btn').forEach(btn => {
      btn.onclick = () => {
        const platform = btn.dataset.share;
        const text = 'Check out my custom ring design from Laura Milman!';

        let shareLink;
        switch (platform) {
          case 'email':
            shareLink = `mailto:?subject=${encodeURIComponent('My Custom Ring Design')}&body=${encodeURIComponent(text + '\n\n' + shareUrl)}`;
            break;
          case 'whatsapp':
            shareLink = `https://wa.me/?text=${encodeURIComponent(text + ' ' + shareUrl)}`;
            break;
          case 'pinterest':
            shareLink = `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareUrl)}&description=${encodeURIComponent(text)}`;
            break;
        }
        if (shareLink) window.open(shareLink, '_blank');
      };
    });
  },

  // =============================================
  // NEW: PRONG STYLE SELECTION
  // =============================================

  /**
   * Select prong style
   */
  selectProngStyle(prongId) {
    this.state.selectedProngStyle = prongId;
    this.saveState();
    this.updatePrice();

    // Update active state in UI
    document.querySelectorAll('.prong-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.prongId === prongId);
    });
  },

  /**
   * Get prong icon SVG
   */
  getProngIcon(prongId) {
    const icons = {
      '4-prong': '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="24" y1="4" x2="24" y2="14" stroke="currentColor" stroke-width="2"/><line x1="24" y1="34" x2="24" y2="44" stroke="currentColor" stroke-width="2"/><line x1="4" y1="24" x2="14" y2="24" stroke="currentColor" stroke-width="2"/><line x1="34" y1="24" x2="44" y2="24" stroke="currentColor" stroke-width="2"/></svg>',
      '6-prong': '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="24" y1="4" x2="24" y2="14" stroke="currentColor" stroke-width="2"/><line x1="24" y1="34" x2="24" y2="44" stroke="currentColor" stroke-width="2"/><line x1="4" y1="24" x2="14" y2="24" stroke="currentColor" stroke-width="2"/><line x1="34" y1="24" x2="44" y2="24" stroke="currentColor" stroke-width="2"/><line x1="10" y1="10" x2="17" y2="17" stroke="currentColor" stroke-width="2"/><line x1="31" y1="31" x2="38" y2="38" stroke="currentColor" stroke-width="2"/></svg>',
      'bezel': '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="24" cy="24" r="8" fill="none" stroke="currentColor" stroke-width="1"/></svg>',
      'claw': '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M24 4 L21 14 M24 4 L27 14" stroke="currentColor" stroke-width="2"/><path d="M24 44 L21 34 M24 44 L27 34" stroke="currentColor" stroke-width="2"/><path d="M4 24 L14 21 M4 24 L14 27" stroke="currentColor" stroke-width="2"/><path d="M44 24 L34 21 M44 24 L34 27" stroke="currentColor" stroke-width="2"/></svg>'
    };
    return icons[prongId] || icons['4-prong'];
  },

  // =============================================
  // NEW: DYNAMIC METAL PREVIEW
  // =============================================

  /**
   * Update preview image with metal color filter
   */
  updateMetalPreview() {
    const previewImage = document.querySelector('.rb-preview-image');
    if (!previewImage) return;

    // Remove all metal classes
    previewImage.classList.remove(
      'metal-14k-yellow-gold', 'metal-18k-yellow-gold',
      'metal-14k-white-gold', 'metal-18k-white-gold',
      'metal-14k-rose-gold', 'metal-18k-rose-gold',
      'metal-platinum'
    );

    // Add the current metal class (fallback for settings without metalImages)
    previewImage.classList.add(`metal-${this.state.selectedMetal}`);

    // IMPROVED: Swap actual image if metalImages is available
    const setting = this.state.selectedSetting;
    const previewImg = previewImage.querySelector('.rb-preview-img');

    if (previewImg && setting?.metalImages && setting.metalImages[this.state.selectedMetal]) {
      // Use the actual metal-specific image
      previewImg.src = setting.metalImages[this.state.selectedMetal];

      // Remove filter since we have actual images
      previewImage.classList.remove(
        'metal-14k-yellow-gold', 'metal-18k-yellow-gold',
        'metal-14k-white-gold', 'metal-18k-white-gold',
        'metal-14k-rose-gold', 'metal-18k-rose-gold',
        'metal-platinum'
      );
    }

    const dockImg = document.querySelector('#rbPreviewDockThumb .rb-preview-dock__img-el');
    if (dockImg && setting?.metalImages?.[this.state.selectedMetal]) {
      dockImg.src = setting.metalImages[this.state.selectedMetal];
    } else if (dockImg && previewImg?.src) {
      dockImg.src = previewImg.src;
    }

    const dockSub = document.getElementById('rbPreviewDockSub');
    if (dockSub) {
      const m = this.settingsData?.metals.find(x => x.id === this.state.selectedMetal);
      const d = this.state.selectedDiamond;
      dockSub.textContent = [
        m?.name,
        d ? `${d.carat}ct ${this.capitalize(d.shape || '')}` : ''
      ].filter(Boolean).join(' · ');
    }

    const dockTotal = document.getElementById('rbPreviewDockTotal');
    if (dockTotal) dockTotal.textContent = this.formatPrice(this.calculatePrice());

    // Update metal indicator
    const metal = this.settingsData?.metals.find(m => m.id === this.state.selectedMetal);
    const indicator = document.querySelector('.rb-metal-indicator');
    if (indicator && metal) {
      indicator.innerHTML = `
        <span class="rb-metal-indicator__swatch" style="background: ${metal.color}"></span>
        <span>${metal.name}</span>
      `;
    }

    // Add subtle animation
    if (previewImg) {
      previewImg.style.transform = 'scale(1.02)';
      setTimeout(() => {
        previewImg.style.transform = 'scale(1)';
      }, 200);
    }
  },

  /**
   * Render shared design banner
   */
  renderSharedBanner() {
    if (!this.state.isSharedDesign) return '';
    return `
      <div class="rb-restored-banner">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
          <polyline points="16 6 12 2 8 6"/>
          <line x1="12" y1="2" x2="12" y2="15"/>
        </svg>
        <span>This is a shared design! Make it yours by customizing it below.</span>
        <button class="rb-restored-banner__dismiss" onclick="this.parentElement.remove()">Dismiss</button>
      </div>
    `;
  },

  // =============================================
  // COMPLETE STEP - Order Confirmation
  // =============================================

  /**
   * Render the complete/confirmation step
   */
  renderCompleteStep(container) {
    const diamond = this.state.selectedDiamond;
    const setting = this.state.selectedSetting;
    const metal = this.settingsData?.metals.find(m => m.id === this.state.selectedMetal);
    const band = this.settingsData?.bands.find(b => b.id === this.state.selectedBand);
    const prong = this.prongStyles.find(p => p.id === this.state.selectedProngStyle);
    const totalPrice = this.calculatePrice();

    // Get ring preview image
    const previewImage = setting?.metalImages?.[this.state.selectedMetal] || setting?.image || '';

    container.innerHTML = `
      <div class="rb-complete">
        <div class="rb-complete__success">
          <div class="rb-complete__check">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h1 class="rb-complete__title">Your Ring Has Been Added to Cart</h1>
          <p class="rb-complete__subtitle">Your custom engagement ring is ready for checkout</p>
        </div>
        
        <div class="rb-complete__summary">
          <div class="rb-complete__preview">
            ${previewImage
        ? `<img src="${previewImage}" alt="${setting?.name || 'Custom Ring'}" class="rb-complete__image">`
        : `<div class="rb-complete__placeholder">
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.5">
                    <circle cx="12" cy="10" r="5"/>
                    <path d="M4 22c0 0 2-6 8-6s8 6 8 6"/>
                  </svg>
                </div>`
      }
          </div>
          
          <div class="rb-complete__details">
            <h3 class="rb-complete__ring-name">Custom ${setting?.name || 'Engagement Ring'}</h3>
            
            <div class="rb-complete__specs">
              ${diamond ? `
                <div class="rb-complete__spec-group">
                  <h4>Diamond</h4>
                  <div class="rb-complete__spec-row">
                    <span>Shape</span><span>${this.capitalize(diamond.shape)}</span>
                  </div>
                  <div class="rb-complete__spec-row">
                    <span>Carat</span><span>${diamond.carat}ct</span>
                  </div>
                  <div class="rb-complete__spec-row">
                    <span>Color</span><span>${diamond.color}</span>
                  </div>
                  <div class="rb-complete__spec-row">
                    <span>Clarity</span><span>${diamond.clarity}</span>
                  </div>
                </div>
              ` : ''}
              
              <div class="rb-complete__spec-group">
                <h4>Setting</h4>
                <div class="rb-complete__spec-row">
                  <span>Style</span><span>${setting?.name || 'N/A'}</span>
                </div>
                <div class="rb-complete__spec-row">
                  <span>Metal</span><span>${metal?.name || 'N/A'}</span>
                </div>
                <div class="rb-complete__spec-row">
                  <span>Band</span><span>${band?.name || 'N/A'}</span>
                </div>
                <div class="rb-complete__spec-row">
                  <span>Prong</span><span>${prong?.name || 'N/A'}</span>
                </div>
                <div class="rb-complete__spec-row">
                  <span>Ring Size</span><span>${this.state.selectedRingSize}</span>
                </div>
                ${this.state.engravingText ? `
                  <div class="rb-complete__spec-row">
                    <span>Engraving</span><span>"${this.state.engravingText}"</span>
                  </div>
                ` : ''}
              </div>
            </div>
            
            <div class="rb-complete__total">
              <span>Total</span>
              <span>${this.formatPrice(totalPrice)}</span>
            </div>
          </div>
        </div>
        
        <div class="rb-complete__actions">
          <button class="btn btn--primary btn--lg rb-btn-view-cart">
            View Cart & Checkout
          </button>
          <button class="btn btn--outline rb-btn-share">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Share Your Design
          </button>
          <button class="btn btn--text rb-btn-continue-shopping">
            Continue Shopping
          </button>
        </div>
        
        <div class="rb-complete__assurance">
          <div class="rb-assurance-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="1" y="3" width="15" height="13" rx="2"/>
              <path d="M16 8h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2"/>
            </svg>
            <span>Free Insured Shipping</span>
          </div>
          <div class="rb-assurance-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span>30-Day Returns</span>
          </div>
          <div class="rb-assurance-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            <span>Certificate of Authenticity</span>
          </div>
        </div>
      </div>
    `;
  },

  // =============================================
  // RING SIZE GUIDE
  // =============================================

  /**
   * Show ring size guide modal
   */
  showSizeGuide() {
    const modal = document.createElement('div');
    modal.className = 'rb-size-guide-modal-overlay';
    modal.innerHTML = `
      <div class="rb-size-guide-modal">
        <button class="rb-size-guide-modal__close">&times;</button>
        <h2 class="rb-size-guide-modal__title">Ring Size Guide</h2>
        <p class="rb-size-guide-modal__intro">Find your perfect fit using one of these methods</p>
        
        <div class="rb-size-guide-methods">
          <div class="rb-size-guide-method">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="16"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
              Measure an Existing Ring
            </h3>
            <p>Place a ring that fits well on a ruler and measure the <strong>inside diameter</strong> in millimeters. Match it to the chart below.</p>
          </div>
          <div class="rb-size-guide-method">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                <line x1="4" y1="22" x2="4" y2="15"/>
              </svg>
              String or Paper Method
            </h3>
            <p>Wrap a thin strip of paper or string snugly around your finger. Mark where it overlaps, then measure the length in mm. Divide by 3.14 to get the diameter.</p>
          </div>
        </div>
        
        <div class="rb-size-guide-chart">
          <h3>US Ring Size Chart</h3>
          <table>
            <thead>
              <tr>
                <th>US Size</th>
                <th>Diameter (mm)</th>
                <th>Circumference (mm)</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>4</td><td>14.9</td><td>46.8</td></tr>
              <tr><td>4.5</td><td>15.3</td><td>48.0</td></tr>
              <tr><td>5</td><td>15.7</td><td>49.3</td></tr>
              <tr><td>5.5</td><td>16.1</td><td>50.6</td></tr>
              <tr><td>6</td><td>16.5</td><td>51.9</td></tr>
              <tr><td>6.5</td><td>16.9</td><td>53.1</td></tr>
              <tr class="rb-size-popular"><td>7</td><td>17.3</td><td>54.4</td></tr>
              <tr><td>7.5</td><td>17.7</td><td>55.7</td></tr>
              <tr><td>8</td><td>18.1</td><td>57.0</td></tr>
              <tr><td>8.5</td><td>18.5</td><td>58.3</td></tr>
              <tr><td>9</td><td>18.9</td><td>59.5</td></tr>
              <tr><td>9.5</td><td>19.4</td><td>60.8</td></tr>
              <tr><td>10</td><td>19.8</td><td>62.1</td></tr>
            </tbody>
          </table>
          <p class="rb-size-guide-note">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            Size 7 is the most popular women's ring size. When in doubt, size up — it's easier to resize down.
          </p>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    modal.querySelector('.rb-size-guide-modal__close').onclick = () => modal.remove();
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    // Animate in
    requestAnimationFrame(() => modal.classList.add('active'));
  },

  // =============================================
  // ENGRAVING
  // =============================================

  /**
   * Toggle engraving option
   */
  toggleEngraving() {
    this.state.engravingEnabled = !this.state.engravingEnabled;
    if (!this.state.engravingEnabled) {
      this.state.engravingText = '';
    }
    this.saveState();

    const toggle = document.querySelector('.rb-engraving-toggle');
    const input = document.querySelector('.rb-engraving-input-wrap');
    if (toggle) toggle.classList.toggle('active', this.state.engravingEnabled);
    if (input) input.style.display = this.state.engravingEnabled ? 'flex' : 'none';
  }
});

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("ringBuilderContainer")) {
    window.RingBuilder.init();
  }
});
