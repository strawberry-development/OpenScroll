class Parallax {
    constructor(options = {}) {
        this.options = {
            selector: '[data-parallax]',
            speed: 0.5,
            direction: 'vertical', // 'vertical', 'horizontal', or 'both'
            offset: 0,
            threshold: 0,
            smoothing: 0.1,
            debug: false,
            updateFrequency: 10,
            useIntersectionObserver: true,
            rootMargin: '50px',
            maxTransform: 500,
            containTransforms: true,
            enableRAF: true, // Allow disabling RAF for testing
            enableGPUAcceleration: true,
            ...options
        };

        // State management
        this.state = {
            isRunning: false,
            isScrolling: false,
            frameCount: 0,
            lastScrollY: 0,
            lastScrollX: 0,
            currentScrollY: 0,
            currentScrollX: 0
        };

        // Collections and references
        this.elements = new Map(); // Use Map for better performance
        this.visibleElements = new Set();
        this.rafId = null;
        this.observer = null;
        this.mutationObserver = null;
        this.resizeObserver = null;

        // Timers
        this.scrollTimeout = null;
        this.debounceTimers = new Map();

        // Bind methods once
        this.boundMethods = {
            handleScroll: this.throttle(this.handleScroll.bind(this), 16),
            handleResize: this.debounce(this.handleResize.bind(this), 250),
            handleLoad: this.handleLoad.bind(this),
            animate: this.animate.bind(this)
        };

        this.init();
    }

    init() {
        try {
            this.setupElements();
            this.bindEvents();
            this.setupObservers();
            this.start();
        } catch (error) {
            this.handleError('Initialization failed', error);
        }
    }

    setupElements() {
        const nodeList = document.querySelectorAll(this.options.selector);

        if (nodeList.length === 0) {
            if (this.options.debug) {
                console.warn(`No elements found with selector: ${this.options.selector}`);
            }
            return;
        }

        // Clear existing elements
        this.elements.clear();

        Array.from(nodeList).forEach((el, index) => {
            try {
                const item = this.createParallaxItem(el, index);
                this.elements.set(el, item);
            } catch (error) {
                this.handleError(`Failed to setup element ${index}`, error);
            }
        });

        this.updateElementRects();

        if (this.options.debug) {
            console.log(`Parallax initialized with ${this.elements.size} elements`);
        }
    }

    createParallaxItem(element, index) {
        const speed = this.parseFloat(element.dataset.parallaxSpeed, this.options.speed);
        const direction = element.dataset.parallaxDirection || this.options.direction;
        const offset = this.parseFloat(element.dataset.parallaxOffset, this.options.offset);

        // Validate and clamp speed
        const clampedSpeed = Math.max(-2, Math.min(2, speed));

        if (speed !== clampedSpeed && this.options.debug) {
            console.warn(`Element ${index}: Speed clamped from ${speed} to ${clampedSpeed}`);
        }

        this.prepareElement(element);

        return {
            element,
            speed: clampedSpeed,
            direction,
            offset,
            initialTransform: this.getInitialTransform(element),
            rect: null,
            isVisible: false,
            lastUpdate: 0,
            container: this.getContainer(element),
            lastTransform: { x: 0, y: 0 },
            id: `parallax-${index}-${Date.now()}`
        };
    }

    parseFloat(value, fallback) {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? fallback : parsed;
    }

    prepareElement(element) {
        const computedStyle = window.getComputedStyle(element);
        const styles = {};

        // Only set styles if they need to be changed
        if (computedStyle.position === 'static') {
            styles.position = 'relative';
        }

        if (!element.style.willChange && this.options.enableGPUAcceleration) {
            styles.willChange = 'transform';
        }

        if (computedStyle.zIndex === 'auto') {
            styles.zIndex = '0';
        }

        // Apply styles in batch to minimize reflows
        Object.assign(element.style, styles);
    }

    getContainer(element) {
        let parent = element.parentElement;

        while (parent && parent !== document.body) {
            const style = window.getComputedStyle(parent);
            if (style.overflow !== 'visible' ||
                ['relative', 'absolute', 'fixed'].includes(style.position)) {
                return parent;
            }
            parent = parent.parentElement;
        }

        return document.body;
    }

    getInitialTransform(element) {
        const transform = window.getComputedStyle(element).transform;

        if (transform === 'none') {
            return { x: 0, y: 0, z: 0 };
        }

        // Handle both matrix and matrix3d
        const matrixMatch = transform.match(/matrix(?:3d)?\(([^)]+)\)/);

        if (matrixMatch) {
            const values = matrixMatch[1].split(',').map(v => parseFloat(v.trim()));

            if (values.length === 6) { // 2D matrix
                return { x: values[4] || 0, y: values[5] || 0, z: 0 };
            } else if (values.length === 16) { // 3D matrix
                return { x: values[12] || 0, y: values[13] || 0, z: values[14] || 0 };
            }
        }

        return { x: 0, y: 0, z: 0 };
    }

    setupObservers() {
        this.setupIntersectionObserver();
        this.setupResizeObserver();
        this.setupMutationObserver();
    }

    setupIntersectionObserver() {
        if (!this.options.useIntersectionObserver || !window.IntersectionObserver) {
            if (this.options.debug) {
                console.log('Intersection Observer not available or disabled');
            }
            return;
        }

        const observerOptions = {
            root: null,
            rootMargin: this.options.rootMargin,
            threshold: 0
        };

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.visibleElements.add(entry.target);
                } else {
                    this.visibleElements.delete(entry.target);
                }
            });
        }, observerOptions);

        this.elements.forEach((item) => {
            this.observer.observe(item.element);
        });

        if (this.options.debug) {
            console.log('Intersection Observer setup complete');
        }
    }

    setupResizeObserver() {
        if (!window.ResizeObserver) return;

        this.resizeObserver = new ResizeObserver(
            this.debounce(() => {
                this.updateElementRects();
            }, 150)
        );

        this.elements.forEach((item) => {
            this.resizeObserver.observe(item.element);
        });
    }

    setupMutationObserver() {
        if (!window.MutationObserver) return;

        this.mutationObserver = new MutationObserver(
            this.debounce(() => {
                this.updateElementRects();
            }, 500)
        );

        this.mutationObserver.observe(document.body, {
            childList: true,
            subtree: false,
            attributes: false
        });
    }

    bindEvents() {
        const options = { passive: true };

        window.addEventListener('scroll', this.boundMethods.handleScroll, options);
        window.addEventListener('resize', this.boundMethods.handleResize, options);
        window.addEventListener('load', this.boundMethods.handleLoad, options);
    }

    handleScroll() {
        this.state.currentScrollY = window.pageYOffset;
        this.state.currentScrollX = window.pageXOffset;

        this.state.isScrolling = true;
        clearTimeout(this.scrollTimeout);
        this.scrollTimeout = setTimeout(() => {
            this.state.isScrolling = false;
        }, 100);
    }

    handleResize() {
        this.updateElementRects();
    }

    handleLoad() {
        // Use shorter timeout and ensure elements exist
        setTimeout(() => {
            if (this.elements.size > 0) {
                this.updateElementRects();
            }
        }, 50);
    }

    updateElementRects() {
        const now = Date.now();

        this.elements.forEach((item) => {
            try {
                // Temporarily remove transform to get accurate measurements
                const currentTransform = item.element.style.transform;
                item.element.style.transform = 'none';

                item.rect = item.element.getBoundingClientRect();
                item.lastUpdate = now;

                // Restore transform
                item.element.style.transform = currentTransform;
            } catch (error) {
                this.handleError(`Failed to update rect for element ${item.id}`, error);
            }
        });

        if (this.options.debug) {
            console.log('Element rects updated');
        }
    }

    isElementVisible(item) {
        if (this.observer) {
            return this.visibleElements.has(item.element);
        }

        if (!item.rect) {
            item.rect = item.element.getBoundingClientRect();
        }

        const windowHeight = window.innerHeight;
        const threshold = this.options.threshold;

        return (
            item.rect.bottom >= -threshold &&
            item.rect.top <= windowHeight + threshold
        );
    }

    calculateTransform(item) {
        const { speed, direction, offset, initialTransform } = item;
        const { currentScrollY, currentScrollX } = this.state;

        const scrollDiffY = currentScrollY * speed;
        const scrollDiffX = currentScrollX * speed;

        let transformX = initialTransform.x;
        let transformY = initialTransform.y;

        switch (direction) {
            case 'vertical':
                transformY = initialTransform.y + scrollDiffY + offset;
                break;
            case 'horizontal':
                transformX = initialTransform.x + scrollDiffX + offset;
                break;
            case 'both':
                transformY = initialTransform.y + scrollDiffY + offset;
                transformX = initialTransform.x + scrollDiffX + offset;
                break;
            default:
                if (this.options.debug) {
                    console.warn(`Unknown direction: ${direction} for element ${item.id}`);
                }
                break;
        }

        // Constrain transforms
        if (this.options.containTransforms) {
            const max = this.options.maxTransform;
            transformX = Math.max(-max, Math.min(max, transformX));
            transformY = Math.max(-max, Math.min(max, transformY));
        }

        return { x: transformX, y: transformY };
    }

    animate() {
        if (!this.state.isRunning) return;

        this.state.frameCount++;

        // Update rects periodically when not scrolling
        if (!this.observer &&
            !this.state.isScrolling &&
            this.state.frameCount % this.options.updateFrequency === 0) {
            this.updateElementRects();
        }

        // Batch DOM updates
        const updates = [];

        this.elements.forEach((item) => {
            if (!this.isElementVisible(item)) return;

            const transform = this.calculateTransform(item);
            const deltaX = Math.abs(transform.x - item.lastTransform.x);
            const deltaY = Math.abs(transform.y - item.lastTransform.y);

            // Only update if change is significant
            if (deltaX > 0.1 || deltaY > 0.1) {
                updates.push({
                    element: item.element,
                    transform,
                    item
                });
            }
        });

        // Apply all updates in batch
        updates.forEach(({ element, transform, item }) => {
            const transformString = this.options.enableGPUAcceleration
                ? `translate3d(${transform.x.toFixed(2)}px, ${transform.y.toFixed(2)}px, 0px)`
                : `translate(${transform.x.toFixed(2)}px, ${transform.y.toFixed(2)}px)`;

            element.style.transform = transformString;
            item.lastTransform = transform;
        });

        if (this.options.enableRAF) {
            this.rafId = requestAnimationFrame(this.boundMethods.animate);
        }
    }

    start() {
        if (this.state.isRunning) return;

        this.state.isRunning = true;
        this.state.currentScrollY = window.pageYOffset;
        this.state.currentScrollX = window.pageXOffset;
        this.state.lastScrollY = this.state.currentScrollY;
        this.state.lastScrollX = this.state.currentScrollX;

        if (this.options.enableRAF) {
            this.animate();
        }

        if (this.options.debug) {
            console.log('Parallax animation started');
        }
    }

    stop() {
        this.state.isRunning = false;

        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        if (this.options.debug) {
            console.log('Parallax animation stopped');
        }
    }

    destroy() {
        this.stop();

        // Clear all timers
        clearTimeout(this.scrollTimeout);
        this.debounceTimers.forEach((timer) => clearTimeout(timer));
        this.debounceTimers.clear();

        // Remove event listeners
        window.removeEventListener('scroll', this.boundMethods.handleScroll);
        window.removeEventListener('resize', this.boundMethods.handleResize);
        window.removeEventListener('load', this.boundMethods.handleLoad);

        // Disconnect all observers
        [this.observer, this.mutationObserver, this.resizeObserver]
            .forEach(observer => {
                if (observer) {
                    observer.disconnect();
                }
            });

        // Reset element styles
        this.elements.forEach((item) => {
            this.resetElementStyles(item);
        });

        // Clear collections
        this.elements.clear();
        this.visibleElements.clear();

        if (this.options.debug) {
            console.log('Parallax destroyed');
        }
    }

    resetElementStyles(item) {
        const { element, initialTransform } = item;
        const transformString = this.options.enableGPUAcceleration
            ? `translate3d(${initialTransform.x}px, ${initialTransform.y}px, ${initialTransform.z}px)`
            : `translate(${initialTransform.x}px, ${initialTransform.y}px)`;

        element.style.transform = transformString;
        element.style.willChange = 'auto';
        element.style.position = '';
        element.style.zIndex = '';
    }

    // Utility methods with improved implementations
    debounce(func, wait, key = 'default') {
        return (...args) => {
            const existingTimer = this.debounceTimers.get(key);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }

            const timer = setTimeout(() => {
                func.apply(this, args);
                this.debounceTimers.delete(key);
            }, wait);

            this.debounceTimers.set(key, timer);
        };
    }

    throttle(func, limit) {
        let inThrottle;
        return (...args) => {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Public API methods
    addElement(element, options = {}) {
        if (this.elements.has(element)) {
            if (this.options.debug) {
                console.warn('Element already exists in parallax');
            }
            return this.elements.get(element);
        }

        try {
            const item = this.createParallaxItem(element, this.elements.size);
            this.elements.set(element, item);

            if (this.observer) {
                this.observer.observe(element);
            }

            if (this.resizeObserver) {
                this.resizeObserver.observe(element);
            }

            if (this.options.debug) {
                console.log(`Element added to parallax: ${item.id}`);
            }

            return item;
        } catch (error) {
            this.handleError('Failed to add element', error);
            return null;
        }
    }

    removeElement(element) {
        const item = this.elements.get(element);
        if (!item) return false;

        try {
            // Disconnect observers
            if (this.observer) {
                this.observer.unobserve(element);
            }
            if (this.resizeObserver) {
                this.resizeObserver.unobserve(element);
            }

            this.visibleElements.delete(element);
            this.resetElementStyles(item);
            this.elements.delete(element);

            if (this.options.debug) {
                console.log(`Element removed from parallax: ${item.id}`);
            }

            return true;
        } catch (error) {
            this.handleError('Failed to remove element', error);
            return false;
        }
    }

    updateOptions(newOptions) {
        const oldOptions = { ...this.options };
        this.options = { ...this.options, ...newOptions };

        // Handle observer changes
        if (oldOptions.useIntersectionObserver !== this.options.useIntersectionObserver) {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
                this.visibleElements.clear();
            }
            this.setupIntersectionObserver();
        }

        // Re-setup elements if significant options changed
        const significantOptions = ['selector', 'speed', 'direction', 'offset'];
        const hasSignificantChanges = significantOptions.some(
            key => oldOptions[key] !== this.options[key]
        );

        if (hasSignificantChanges) {
            this.setupElements();
        }

        if (this.options.debug) {
            console.log('Parallax options updated', { oldOptions, newOptions });
        }
    }

    // Performance and debugging
    getPerformanceStats() {
        return {
            elementsCount: this.elements.size,
            visibleElementsCount: this.visibleElements.size,
            frameCount: this.state.frameCount,
            isRunning: this.state.isRunning,
            isScrolling: this.state.isScrolling,
            useIntersectionObserver: !!this.observer,
            memoryUsage: this.getMemoryUsage()
        };
    }

    getMemoryUsage() {
        if (performance.memory) {
            return {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }

    handleError(message, error) {
        if (this.options.debug) {
            console.error(`Parallax Error: ${message}`, error);
        }

        // Emit custom event for error handling
        window.dispatchEvent(new CustomEvent('parallax:error', {
            detail: { message, error }
        }));
    }

    // Static factory method
    static create(options = {}) {
        return new Parallax(options);
    }
}

// Auto-initialization with improved error handling
document.addEventListener('DOMContentLoaded', () => {
    try {
        if (document.querySelector('[data-parallax]')) {
            window.parallaxInstance = Parallax.create({
                containTransforms: true,
                maxTransform: 300,
                smoothing: 0.05,
                debug: false // Set to true for debugging
            });
        }
    } catch (error) {
        console.error('Failed to initialize parallax:', error);
    }
});

window.Parallax = Parallax;