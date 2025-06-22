/*
 * OpenScroll Distribution Build
 * Generated on: -06-2025 17:10
 * Build script: build_dist.bat
 *
 * This file combines all source and plugin files into a single distribution.
 */

 
// === Source: openscroll.core.js === 
/**
 * OpenScroll is the main class that is used to launch other animations; it isn’t meant to be very complex at all.
 */

class OpenScroll {
    constructor() {
        // Use to track the different instance
        this.instances = new Map();
    }

    /**
     * Starts an animation class
     * @param {Function|string} AnimationClass - Either a class constructor or class name string
     * @param {Object} options - Options to pass to the animation constructor
     * @returns {Object} - The instantiated animation object
     */
    start(AnimationClass, options = {}) {
        try {
            let AnimationConstructor;

            // Resolve class from string if necessary
            if (typeof AnimationClass === 'string') {
                AnimationConstructor = window[AnimationClass];
                if (typeof AnimationConstructor !== 'function') {
                    throw new Error(`Class ${AnimationClass} not found in global scope`);
                }
            } else if (typeof AnimationClass === 'function') {
                AnimationConstructor = AnimationClass;
            } else {
                throw new Error('AnimationClass must be a string or constructor function');
            }

            // Create instance with merged options
            const instance = new AnimationConstructor(options);

            // Store the instance for later reference
            const className = AnimationConstructor.name || 'UnknownAnimation';
            this.instances.set(className, instance);

            return instance;
        } catch (error) {
            console.error('Failed to start animation:', error);
            throw error;
        }
    }

    /**
     * Get a previously instantiated animation by class name
     * @param {string} className - Name of the animation class
     * @returns {Object|null} - The animation instance or null if not found
     */
    getInstance(className) {
        return this.instances.get(className) || null;
    }

    /**
     * Stop and remove an animation instance
     * @param {string} className - Name of the animation class to stop
     * @returns {boolean} - True if successfully stopped, false if not found
     */
    stop(className) {
        const instance = this.instances.get(className);
        if (instance) {
            if (typeof instance.stop === 'function') {
                instance.stop();
            }
            if (typeof instance.destroy === 'function') {
                instance.destroy();
            }
            this.instances.delete(className);
            return true;
        }
        return false;
    }

    /**
     * Stop all running animations
     */
    stopAll() {
        for (const [className, instance] of this.instances) {
            if (typeof instance.stop === 'function') {
                instance.stop();
            }
            if (typeof instance.destroy === 'function') {
                instance.destroy();
            }
        }
        this.instances.clear();
    }

    /**
     * Get all active animation instances
     * @returns {Map} - Map of all active instances
     */
    getAllInstances() {
        return new Map(this.instances);
    }

    /**
     * Check if an animation is currently running
     * @param {string} className - Name of the animation class
     * @returns {boolean} - True if running, false otherwise
     */
    isRunning(className) {
        return this.instances.has(className);
    }
}
 
 
// === Source: openscroll.parallax.js === 
/**
 * Parallax effect
 * V1.0.0
 */
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
 
// === Source: openscroll.smoothscroller.js === 
/**
 * Smooth Scroll
 * V1.0.0
 */
class Smoothscroller {
    /**
     * Constructor for the SmoothScroller class
     * @param {Object} options - Configuration options
     * @param {HTMLElement|string} [options.element] - Element to apply smooth scrolling to
     * @param {number} [options.smoothness=0.95] - Scrolling smoothness (0.8-0.95 recommended)
     * @param {number} [options.minMovement=0.5] - Minimum movement threshold in pixels
     * @param {number} [options.maxDeltaTime=2] - Maximum delta time for stability
     * @param {boolean} [options.debug=false] - Enable console logging
     * @param {number} [options.scrollToDuration=1000] - Default duration for scrollTo in ms
     * @param {string} [options.scrollToEasing='easeInOutCubic'] - Default easing function
     * @param {number} [options.autoScrollOffset=0] - Offset for scrollTo
     * @param {boolean} [options.useNativeForTouch=true] - Use native scrolling on touch devices
     * @param {boolean} [options.respectReducedMotion=true] - Respect user's reduced motion preference
     */
    constructor(options = {}) {
        // DOM elements
        this.scrollElement = this._resolveElement(options.element || '#scrollSmooth');
        this.wrapperElement = null;

        // Internal state
        this.currentScroll = window.scrollY;
        this.targetScroll = window.scrollY;
        this.lastTime = performance.now();
        this.isRunning = false;
        this.animationFrameId = null;
        this.resizeObserver = null;
        this.isTouchDevice = this._isTouchDevice();
        this.prefersReducedMotion = this._prefersReducedMotion();

        // Animation state
        this.animations = [];
        this.isAnimating = false;
        this.currentAnimation = null;

        // Configuration with defaults
        this.config = {
            smoothness: this._clamp(options.smoothness ?? 0.94, 0.5, 0.99),
            minMovement: options.minMovement ?? 0.5,
            maxDeltaTime: options.maxDeltaTime ?? 2,
            debug: options.debug ?? false,
            scrollToDuration: options.scrollToDuration ?? 1000,
            scrollToEasing: options.scrollToEasing ?? 'easeInOutCubic',
            autoScrollOffset: options.autoScrollOffset ?? 0,
            useNativeForTouch: options.useNativeForTouch ?? true,
            respectReducedMotion: options.respectReducedMotion ?? true
        };

        // Easing functions collection
        this.easings = {
            linear: t => t,
            easeInQuad: t => t * t,
            easeOutQuad: t => t * (2 - t),
            easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
            easeInCubic: t => t * t * t,
            easeOutCubic: t => (--t) * t * t + 1,
            easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
            easeInQuart: t => t * t * t * t,
            easeOutQuart: t => 1 - (--t) * t * t * t,
            easeInOutQuart: t => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
            easeInQuint: t => t * t * t * t * t,
            easeOutQuint: t => 1 + (--t) * t * t * t * t,
            easeInOutQuint: t => t <.5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t,
            // Add some spring physics options
            easeOutBack: t => {
                const c1 = 1.70158;
                const c3 = c1 + 1;
                return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
            },
            easeOutElastic: t => {
                const c4 = (2 * Math.PI) / 3;
                return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
            }
        };

        // Bind methods to this instance
        this._bindMethods();

        // Initialize if we should use smooth scrolling
        if (this._shouldUseSmooth()) {
            this.init();
        } else {
            this._setupFallback();
            this._log('Using native scrolling due to device or user preference');
        }
    }

    /**
     * Bind all methods that need "this" context
     * @private
     */
    _bindMethods() {
        this.updateScroll = this.updateScroll.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        this.handleScroll = this.handleScroll.bind(this);
        this.animate = this.animate.bind(this);
    }

    /**
     * Determine if we should use smooth scrolling based on device and preferences
     * @private
     * @returns {boolean} Whether smooth scrolling should be used
     */
    _shouldUseSmooth() {
        // Skip smooth scroll if reduced motion is preferred and we respect that setting
        if (this.prefersReducedMotion && this.config.respectReducedMotion) {
            return false;
        }

        // Skip smooth scroll on touch devices if configured that way
        if (this.isTouchDevice && this.config.useNativeForTouch) {
            return false;
        }

        return true;
    }

    /**
     * Check if the device is a touch device
     * @private
     * @returns {boolean} Whether this is a touch device
     */
    _isTouchDevice() {
        return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    }

    /**
     * Check if the user prefers reduced motion
     * @private
     * @returns {boolean} Whether reduced motion is preferred
     */
    _prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    /**
     * Utility to clamp a value between min and max
     * @private
     * @param {number} value - The value to clamp
     * @param {number} min - Minimum allowed value
     * @param {number} max - Maximum allowed value
     * @returns {number} The clamped value
     */
    _clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    /**
     * Set up a fallback for devices that should use native scrolling
     * @private
     */
    _setupFallback() {
        // Keep the scrollElement as is, just make sure it's not fixed
        if (this.scrollElement) {
            this.scrollElement.style.position = '';
            this.scrollElement.style.top = '';
            this.scrollElement.style.left = '';
            this.scrollElement.style.width = '';
            this.scrollElement.style.transform = '';
        }

        // We still support the scrollTo API but use native scrolling
        // Other methods will be no-ops
    }

    /**
     * Resolve an element from string selector or direct reference
     * @private
     * @param {HTMLElement|string} element - Element or selector
     * @returns {HTMLElement} The resolved element
     */
    _resolveElement(element) {
        if (typeof element === 'string') {
            return document.querySelector(element);
        }
        return element;
    }

    /**
     * Debug logging utility
     * @private
     * @param {string} message - Message to log
     * @param {*} [data] - Optional data to log
     */
    _log(message, data) {
        if (this.config.debug) {
            if (data !== undefined) {
                console.log(`SmoothScroller: ${message}`, data);
            } else {
                console.log(`SmoothScroller: ${message}`);
            }
        }
    }

    /**
     * Sets up the DOM structure for smooth scrolling
     * @returns {number} The content height
     */
    setupScrollStructure() {
        if (!this.scrollElement) {
            this._log('No scroll element found - abort setup');
            return 0;
        }

        // Calculate total height of content
        const contentHeight = this.scrollElement.scrollHeight;

        // Create a wrapper for the fixed element if needed
        if (!document.getElementById('smooth-scroll-wrapper')) {
            this.wrapperElement = document.createElement('div');
            this.wrapperElement.id = 'smooth-scroll-wrapper';
            this.wrapperElement.style.cssText = `
                height: ${contentHeight}px;
                position: relative;
                width: 100%;
                pointer-events: none;
            `;

            // Move the scroll element to the wrapper
            this.scrollElement.parentNode.insertBefore(this.wrapperElement, this.scrollElement);
            this.wrapperElement.appendChild(this.scrollElement);
        } else {
            // Just update height if wrapper exists
            this.wrapperElement = document.getElementById('smooth-scroll-wrapper');
            this.wrapperElement.style.height = contentHeight + 'px';
        }

        // Fix the scroll element position
        this.scrollElement.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            z-index: 1;
            pointer-events: auto;
            will-change: transform;
        `;

        // Add an aria attribute for accessibility
        this.scrollElement.setAttribute('aria-live', 'polite');

        // Keep body scrollable
        document.body.style.overflow = 'auto';
        document.body.style.margin = '0';
        document.body.style.padding = '0';

        this._log(`Content height set to ${contentHeight}px`);

        return contentHeight;
    }

    /**
     * Handle scroll events
     * @private
     */
    handleScroll() {
        if (!this.isAnimating) {
            this.targetScroll = window.scrollY;
        }
    }

    /**
     * Main animation function for smooth scrolling
     */
    updateScroll() {
        if (!this.isRunning) return;

        const currentTime = performance.now();
        const deltaTime = Math.min((currentTime - this.lastTime) / 16.67, this.config.maxDeltaTime);
        this.lastTime = currentTime;

        // If we're currently running a custom animation, let it control the scroll
        if (this.isAnimating && this.currentAnimation) {
            this.animate();
        } else {
            // Normal smooth scrolling behavior
            const distance = this.targetScroll - this.currentScroll;
            const absDistance = Math.abs(distance);

            // Only update if we need to move
            if (absDistance < this.config.minMovement) {
                this.currentScroll = this.targetScroll;
            } else {
                // Calculate smooth movement
                this.currentScroll += distance * (1 - this.config.smoothness) * deltaTime;
            }
        }

        // Apply the transform with hardware acceleration
        this.scrollElement.style.transform = `translate3d(0, -${this.currentScroll}px, 0)`;

        // Continue animation
        this.animationFrameId = requestAnimationFrame(this.updateScroll);
    }

    /**
     * Process the current animation frame
     */
    animate() {
        const animation = this.currentAnimation;
        if (!animation) return;

        const now = performance.now();
        const elapsed = now - animation.startTime;
        const progress = Math.min(elapsed / animation.duration, 1);

        // Apply easing
        const easingFunction = this.easings[animation.easing] || this.easings.easeInOutCubic;
        const easedProgress = easingFunction(progress);

        // Calculate new scroll position
        this.currentScroll = animation.startPosition + (animation.targetPosition - animation.startPosition) * easedProgress;

        // Update browser's scroll position to match
        if (progress < 1) {
            window.scrollTo(0, this.currentScroll);
        } else {
            // Animation complete
            window.scrollTo(0, animation.targetPosition);
            this.currentScroll = animation.targetPosition;
            this.targetScroll = animation.targetPosition;
            this.isAnimating = false;
            this.currentAnimation = null;

            // Call onComplete callback if provided
            if (typeof animation.onComplete === 'function') {
                animation.onComplete();
            }

            // Process next animation in queue if any
            if (this.animations.length > 0) {
                const nextAnimation = this.animations.shift();
                this.startAnimation(nextAnimation);
            }

            this._log("Animation complete");
        }
    }

    /**
     * Start a specific animation
     * @param {Object} animation - The animation object to start
     */
    startAnimation(animation) {
        this.currentAnimation = animation;
        this.currentAnimation.startTime = performance.now();
        this.currentAnimation.startPosition = window.scrollY;
        this.isAnimating = true;

        this._log(`Starting animation to ${animation.targetPosition}px with ${animation.easing} easing`);
    }

    /**
     * Scroll to a specific position or element with animation
     * @param {(number|HTMLElement|string)} target - Target position in pixels or element to scroll to
     * @param {Object} options - Animation options
     * @param {number} [options.duration] - Duration of scroll animation in ms
     * @param {string} [options.easing] - Easing function name
     * @param {number} [options.offset] - Offset from the element in pixels
     * @param {boolean} [options.immediate=false] - Whether to cancel current openAnimations
     * @param {Function} [options.onComplete] - Callback when animation completes
     * @returns {Promise} A promise that resolves when the animation completes
     */
    scrollTo(target, options = {}) {
        // If we're in fallback mode, use native scrolling
        if (!this._shouldUseSmooth()) {
            return this._nativeScrollTo(target, options);
        }

        return new Promise((resolve) => {
            let targetPosition;

            // Determine the target position based on what was passed
            if (typeof target === 'number') {
                targetPosition = target;
            } else if (target instanceof HTMLElement) {
                const rect = target.getBoundingClientRect();
                targetPosition = window.scrollY + rect.top - (options.offset ?? this.config.autoScrollOffset);
            } else if (typeof target === 'string') {
                const element = document.querySelector(target);
                if (element) {
                    const rect = element.getBoundingClientRect();
                    targetPosition = window.scrollY + rect.top - (options.offset ?? this.config.autoScrollOffset);
                } else {
                    this._log(`Element not found: ${target}`);
                    resolve(false);
                    return;
                }
            } else {
                this._log('Invalid target for scrollTo', target);
                resolve(false);
                return;
            }

            // Create animation object
            const animation = {
                targetPosition,
                startPosition: window.scrollY,
                startTime: null, // Will be set when animation starts
                duration: options.duration ?? this.config.scrollToDuration,
                easing: options.easing ?? this.config.scrollToEasing,
                onComplete: () => {
                    if (typeof options.onComplete === 'function') {
                        options.onComplete();
                    }
                    resolve(true);
                }
            };

            // Add to queue or start immediately
            if (this.isAnimating) {
                if (options.immediate) {
                    // Clear current openAnimations and start this one immediately
                    this.animations = [];
                    this.isAnimating = false;
                    this.currentAnimation = null;
                    this.startAnimation(animation);
                } else {
                    // Queue the animation
                    this.animations.push(animation);
                }
            } else {
                // Start immediately if no current animation
                this.startAnimation(animation);
            }
        });
    }

    /**
     * Fallback for native scrolling when smooth is disabled
     * @private
     * @param {(number|HTMLElement|string)} target - Target to scroll to
     * @param {Object} options - Scroll options
     * @returns {Promise} A promise that resolves when scrolling is complete
     */
    _nativeScrollTo(target, options = {}) {
        return new Promise((resolve) => {
            let targetPosition;

            // Determine the target position
            if (typeof target === 'number') {
                targetPosition = target;
            } else if (target instanceof HTMLElement) {
                targetPosition = target.getBoundingClientRect().top + window.scrollY - (options.offset ?? this.config.autoScrollOffset);
            } else if (typeof target === 'string') {
                const element = document.querySelector(target);
                if (element) {
                    targetPosition = element.getBoundingClientRect().top + window.scrollY - (options.offset ?? this.config.autoScrollOffset);
                } else {
                    this._log(`Element not found: ${target}`);
                    resolve(false);
                    return;
                }
            } else {
                this._log('Invalid target for scrollTo', target);
                resolve(false);
                return;
            }

            // Use native smooth scrolling if available and not reduced motion
            const behavior = (!this.prefersReducedMotion && this.config.respectReducedMotion) ? 'smooth' : 'auto';

            window.scrollTo({
                top: targetPosition,
                behavior
            });

            // Since we can't reliably detect when native scroll completes, we use a timeout
            setTimeout(() => {
                if (typeof options.onComplete === 'function') {
                    options.onComplete();
                }
                resolve(true);
            }, behavior === 'smooth' ? 500 : 100);
        });
    }

    /**
     * Handle window resize events
     */
    handleResize() {
        this.setupScrollStructure();
    }

    /**
     * Handle visibility change events
     */
    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            // Resume animation and reset timing
            this.start();
        } else {
            // Pause animation when tab not visible
            this.stop();
        }
    }

    /**
     * Start the smooth scrolling effect
     */
    start() {
        if (this.isRunning || !this._shouldUseSmooth()) return;

        this.isRunning = true;
        this.lastTime = performance.now();
        this.currentScroll = window.scrollY;
        this.targetScroll = window.scrollY;

        if (this.animationFrameId === null) {
            this.animationFrameId = requestAnimationFrame(this.updateScroll);
        }

        this._log("Smooth scrolling started");
    }

    /**
     * Stop the smooth scrolling effect
     */
    stop() {
        this.isRunning = false;

        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        this._log("Smooth scrolling stopped");
    }

    /**
     * Update configuration options
     * @param {Object} options - New configuration options
     */
    updateConfig(options = {}) {
        Object.assign(this.config, options);

        // Check if we need to switch between smooth and native
        const shouldUseSmooth = this._shouldUseSmooth();

        if (shouldUseSmooth && !this.isRunning) {
            this.init();
        } else if (!shouldUseSmooth && this.isRunning) {
            this.destroy();
            this._setupFallback();
        }

        this._log("Configuration updated", this.config);
    }

    /**
     * Add a new easing function
     * @param {string} name - Name of the easing function
     * @param {Function} fn - Easing function taking progress (0-1) and returning eased value
     */
    addEasing(name, fn) {
        if (typeof fn !== 'function') {
            this._log(`Invalid easing function for ${name}`);
            return;
        }

        this.easings[name] = fn;
        this._log(`Added easing function: ${name}`);
    }

    /**
     * Clean up event listeners and animation
     */
    destroy() {
        // Stop animation
        this.stop();

        // Remove event listeners
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('scroll', this.handleScroll);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);

        // Remove ResizeObserver if supported
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        // Restore original DOM if possible
        if (this.wrapperElement && this.scrollElement) {
            this.wrapperElement.parentNode.insertBefore(this.scrollElement, this.wrapperElement);
            this.wrapperElement.parentNode.removeChild(this.wrapperElement);
        }

        // Reset element styles
        if (this.scrollElement) {
            this.scrollElement.style.position = '';
            this.scrollElement.style.top = '';
            this.scrollElement.style.left = '';
            this.scrollElement.style.width = '';
            this.scrollElement.style.zIndex = '';
            this.scrollElement.style.transform = '';
            this.scrollElement.style.willChange = '';
            this.scrollElement.removeAttribute('aria-live');
        }

        this._log("Smooth scrolling destroyed and cleaned up");
    }

    /**
     * Initialize the smooth scroller
     */
    init() {
        if (!this.scrollElement) {
            this._log("No scroll element found. Initialization aborted.");
            return;
        }

        // Set up DOM structure
        this.setupScrollStructure();

        // Add event listeners
        window.addEventListener('resize', this.handleResize, { passive: true });
        window.addEventListener('scroll', this.handleScroll, { passive: true });
        document.addEventListener('visibilitychange', this.handleVisibilityChange);

        // Use ResizeObserver if supported for more efficient resize handling
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(this.handleResize);
            this.resizeObserver.observe(this.scrollElement);
        }

        // Start scrolling
        this.start();

        this._log("Smooth scroll initialized with these settings:", this.config);
    }
}

window.SmoothScroller = Smoothscroller; 
 
// === Source: Plugins.js === 
 
