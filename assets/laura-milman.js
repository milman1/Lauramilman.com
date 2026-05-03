/**
 * Laura Milman — Main JavaScript
 * Handles filter interactions, animations, and UI functionality.
 * Functional logic copied from PD theme; brand strings rewritten.
 */

document.addEventListener('DOMContentLoaded', function () {
    // =============================================
    // HEADER SCROLL EFFECT
    // =============================================
    const header = document.getElementById('header');

    var scrollTicking = false;
    function handleScroll() {
        if (!header) return;
        if (window.scrollY > 50) {
            header.classList.add('header--scrolled');
        } else {
            header.classList.remove('header--scrolled');
        }
    }

    window.addEventListener('scroll', function() {
        if (!scrollTicking) {
            window.requestAnimationFrame(function() {
                handleScroll();
                scrollTicking = false;
            });
            scrollTicking = true;
        }
    }, { passive: true });
    handleScroll();

    // =============================================
    // NATURAL / LAB-GROWN TOGGLE
    // =============================================
    const toggleNatural = document.getElementById('toggleNatural');
    const toggleLabGrown = document.getElementById('toggleLabGrown');

    if (toggleNatural && toggleLabGrown) {
        toggleNatural.addEventListener('click', function () {
            toggleNatural.classList.add('active');
            toggleLabGrown.classList.remove('active');
        });

        toggleLabGrown.addEventListener('click', function () {
            toggleLabGrown.classList.add('active');
            toggleNatural.classList.remove('active');
        });
    }

    // =============================================
    // STEP SLIDER INTERACTIONS
    // =============================================
    function initStepSlider(sliderId) {
        const slider = document.getElementById(sliderId);
        if (!slider) return;

        const steps = slider.querySelectorAll('.step-slider__step');
        const labels = slider.parentElement.querySelectorAll('.step-slider__label');
        const progress = slider.querySelector('.step-slider__progress');

        let minIndex = 0;
        let maxIndex = steps.length - 1;

        steps.forEach((step, index) => {
            if (step.classList.contains('active') || step.classList.contains('in-range')) {
                if (index < minIndex || !steps[minIndex].classList.contains('active')) {
                    minIndex = index;
                }
                maxIndex = index;
            }
        });

        steps.forEach((step, index) => {
            step.addEventListener('click', function () {
                if (index < minIndex) {
                    minIndex = index;
                } else if (index > maxIndex) {
                    maxIndex = index;
                } else if (index === minIndex && minIndex < maxIndex) {
                    minIndex = index + 1;
                } else if (index === maxIndex && maxIndex > minIndex) {
                    maxIndex = index - 1;
                } else {
                    minIndex = index;
                    maxIndex = index;
                }
                updateStepSliderUI(steps, labels, progress, minIndex, maxIndex);
            });
        });

        labels.forEach((label, index) => {
            label.addEventListener('click', function () {
                if (index < minIndex) {
                    minIndex = index;
                } else if (index > maxIndex) {
                    maxIndex = index;
                } else if (index === minIndex && minIndex < maxIndex) {
                    minIndex = index + 1;
                } else if (index === maxIndex && maxIndex > minIndex) {
                    maxIndex = index - 1;
                } else {
                    minIndex = index;
                    maxIndex = index;
                }
                updateStepSliderUI(steps, labels, progress, minIndex, maxIndex);
            });
        });
    }

    function updateStepSliderUI(steps, labels, progress, minIndex, maxIndex) {
        steps.forEach((step, index) => {
            step.classList.remove('active', 'in-range');
            if (index >= minIndex && index <= maxIndex) {
                if (index === minIndex || index === maxIndex) {
                    step.classList.add('active');
                } else {
                    step.classList.add('in-range');
                }
            }
        });

        labels.forEach((label, index) => {
            label.classList.remove('active');
            if (index >= minIndex && index <= maxIndex) {
                label.classList.add('active');
            }
        });

        const totalSteps = steps.length - 1;
        const leftPercent = (minIndex / totalSteps) * 100;
        const widthPercent = ((maxIndex - minIndex) / totalSteps) * 100;
        if (progress) {
            progress.style.left = leftPercent + '%';
            progress.style.width = widthPercent + '%';
        }
    }

    initStepSlider('claritySlider');
    initStepSlider('colorSlider');
    initStepSlider('cutSlider');

    // =============================================
    // RANGE SLIDER INTERACTIONS
    // =============================================
    function initRangeSlider(options) {
        const {
            sliderId,
            minInputId,
            maxInputId,
            minThumbId,
            maxThumbId,
            minValue,
            maxValue,
            prefix = '',
            suffix = ''
        } = options;

        const slider = document.getElementById(sliderId);
        if (!slider) return;

        const minInput = document.getElementById(minInputId);
        const maxInput = document.getElementById(maxInputId);
        const minThumb = document.getElementById(minThumbId);
        const maxThumb = document.getElementById(maxThumbId);
        const track = slider.querySelector('.range-slider__track');

        if (!minInput || !maxInput || !minThumb || !maxThumb) return;

        let currentMin = minValue;
        let currentMax = maxValue;
        let isDragging = null;

        function updateUI() {
            const range = maxValue - minValue;
            const minPercent = ((currentMin - minValue) / range) * 100;
            const maxPercent = ((currentMax - minValue) / range) * 100;

            minThumb.style.left = minPercent + '%';
            maxThumb.style.left = maxPercent + '%';
            track.style.left = minPercent + '%';
            track.style.width = (maxPercent - minPercent) + '%';

            if (prefix === '$') {
                minInput.value = '$' + currentMin.toLocaleString();
                maxInput.value = '$' + currentMax.toLocaleString();
            } else {
                minInput.value = currentMin.toFixed(2);
                maxInput.value = currentMax.toFixed(2);
            }
        }

        function handleDrag(e, thumb) {
            const rect = slider.getBoundingClientRect();
            const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
            const value = minValue + (percent / 100) * (maxValue - minValue);

            if (thumb === 'min') {
                currentMin = Math.min(value, currentMax - 1);
                currentMin = Math.max(minValue, currentMin);
            } else {
                currentMax = Math.max(value, currentMin + 1);
                currentMax = Math.min(maxValue, currentMax);
            }
            updateUI();
        }

        minThumb.addEventListener('mousedown', function (e) { isDragging = 'min'; e.preventDefault(); });
        maxThumb.addEventListener('mousedown', function (e) { isDragging = 'max'; e.preventDefault(); });
        document.addEventListener('mousemove', function (e) { if (isDragging) handleDrag(e, isDragging); });
        document.addEventListener('mouseup', function () { isDragging = null; });

        minThumb.addEventListener('touchstart', function (e) { isDragging = 'min'; e.preventDefault(); }, { passive: false });
        maxThumb.addEventListener('touchstart', function (e) { isDragging = 'max'; e.preventDefault(); }, { passive: false });
        document.addEventListener('touchmove', function (e) {
            if (isDragging && e.touches[0]) {
                e.preventDefault();
                handleDrag(e.touches[0], isDragging);
            }
        }, { passive: false });
        document.addEventListener('touchend', function () { isDragging = null; });

        minInput.addEventListener('change', function () {
            let value = parseFloat(this.value.replace(/[^0-9.]/g, ''));
            if (!isNaN(value)) {
                currentMin = Math.max(minValue, Math.min(value, currentMax - 1));
                updateUI();
            }
        });

        maxInput.addEventListener('change', function () {
            let value = parseFloat(this.value.replace(/[^0-9.]/g, ''));
            if (!isNaN(value)) {
                currentMax = Math.min(maxValue, Math.max(value, currentMin + 1));
                updateUI();
            }
        });

        updateUI();
    }

    initRangeSlider({
        sliderId: 'priceSlider',
        minInputId: 'minPrice',
        maxInputId: 'maxPrice',
        minThumbId: 'priceThumbMin',
        maxThumbId: 'priceThumbMax',
        minValue: 200,
        maxValue: 50000,
        prefix: '$'
    });

    initRangeSlider({
        sliderId: 'caratSlider',
        minInputId: 'minCarat',
        maxInputId: 'maxCarat',
        minThumbId: 'caratThumbMin',
        maxThumbId: 'caratThumbMax',
        minValue: 0.5,
        maxValue: 30,
        prefix: ''
    });

    // =============================================
    // SIDEBAR FILTER COLLAPSE
    // =============================================
    document.querySelectorAll('.sidebar-filter__title').forEach(title => {
        title.addEventListener('click', function () {
            const filter = this.parentElement;
            filter.classList.toggle('collapsed');
            const content = filter.querySelector('.sidebar-filter__content');
            if (content) {
                content.style.display = filter.classList.contains('collapsed') ? 'none' : 'flex';
            }
        });
    });

    // =============================================
    // SMOOTH SCROLL FOR ANCHOR LINKS
    // =============================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // =============================================
    // INTERSECTION OBSERVER FOR ANIMATIONS
    // =============================================
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-fade-in');
                observer.unobserve(entry.target);
            }
        });
    }, { root: null, rootMargin: '0px', threshold: 0.1 });

    document.querySelectorAll('.product-card, .category-card, .why-card').forEach(el => {
        observer.observe(el);
    });

    // =============================================
    // PRODUCT CARD KEYBOARD ACCESSIBILITY
    // =============================================
    document.querySelectorAll('.product-card').forEach(card => {
        const actions = card.querySelector('.product-card__actions');
        if (actions) {
            const buttons = actions.querySelectorAll('button');
            buttons.forEach(button => {
                button.addEventListener('focus', () => {
                    actions.style.opacity = '1';
                    actions.style.transform = 'translateX(-50%) translateY(0)';
                });
                button.addEventListener('blur', () => {
                    actions.style.opacity = '';
                    actions.style.transform = '';
                });
            });
        }
    });

    // =============================================
    // PRODUCT CARD VIDEO HOVER (desktop only)
    // =============================================
    var isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

    if (!isTouch) {
        document.querySelectorAll('.product-card--has-video').forEach(function(card) {
            var video = card.querySelector('.product-card__video');
            if (!video) return;

            var videoLoaded = false;
            var dataSrc = video.getAttribute('data-src');
            if (!dataSrc) return;

            card.addEventListener('mouseenter', function() {
                if (!videoLoaded) {
                    var source = document.createElement('source');
                    source.src = dataSrc;
                    source.type = 'video/mp4';
                    video.appendChild(source);
                    video.load();
                    videoLoaded = true;
                }
                var playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise.catch(function() { /* autoplay blocked */ });
                }
            });

            card.addEventListener('mouseleave', function() {
                video.pause();
                video.currentTime = 0;
            });
        });
    }
});
