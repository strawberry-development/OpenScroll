/*
 * OpenScroll Distribution Build
 * Generated on: -06-2025 17:13
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
            maxTransform: 500, // Maximum transform distance to prevent infinite scrolling
            containTransforms: true, // Keep transforms within reasonable bounds
            ...options
        };

        this.elements = [];
        this.isRunning = false;
        this.rafId = null;
        this.lastScrollY = 0;
        this.lastScrollX = 0;
        this.currentScrollY = 0;
        this.currentScrollX = 0;
        this.frameCount = 0;
        this.observer = null;
        this.visibleElements = new Set();
        this.isScrolling = false;
        this.scrollTimeout = null;

        this.init();
    }

    init() {
        this.setupElements();
        this.bindEvents();
        this.setupIntersectionObserver();
        this.start();
    }

    setupElements() {
        const nodeList = document.querySelectorAll(this.options.selector);
        this.elements = Array.from(nodeList).map(el => {
            const speed = parseFloat(el.dataset.parallaxSpeed) || this.options.speed;
            const direction = el.dataset.parallaxDirection || this.options.direction;
            const offset = parseFloat(el.dataset.parallaxOffset) || this.options.offset;

            // Ensure elements are properly positioned for transforms
            this.prepareElement(el);

            const item = {
                element: el,
                speed: Math.max(-2, Math.min(2, speed)), // Clamp speed to reasonable range
                direction,
                offset,
                initialTransform: this.getInitialTransform(el),
                rect: null,
                isVisible: false,
                lastUpdate: 0,
                container: this.getContainer(el),
                lastTransform: { x: 0, y: 0 }
            };

            return item;
        });

        this.updateElementRects();

        if (this.options.debug) {
            console.log(`Parallax initialized with ${this.elements.length} elements`);
        }
    }

    prepareElement(element) {
        const computedStyle = window.getComputedStyle(element);

        // Ensure element won't affect document flow with transforms
        if (computedStyle.position === 'static') {
            element.style.position = 'relative';
        }

        // Prevent transforms from affecting layout
        if (!element.style.willChange) {
            element.style.willChange = 'transform';
        }

        // Ensure element has a stacking context
        if (computedStyle.zIndex === 'auto') {
            element.style.zIndex = '0';
        }
    }

    getContainer(element) {
        let parent = element.parentElement;
        while (parent && parent !== document.body) {
            const style = window.getComputedStyle(parent);
            if (style.overflow !== 'visible' || style.position === 'relative' || style.position === 'absolute') {
                return parent;
            }
            parent = parent.parentElement;
        }
        return document.body;
    }

    getInitialTransform(element) {
        const transform = window.getComputedStyle(element).transform;
        if (transform === 'none') return { x: 0, y: 0, z: 0 };

        const matrix = transform.match(/matrix.*\((.+)\)/);
        if (matrix) {
            const values = matrix[1].split(', ');
            return {
                x: parseFloat(values[4]) || 0,
                y: parseFloat(values[5]) || 0,
                z: 0
            };
        }
        return { x: 0, y: 0, z: 0 };
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
                const element = entry.target;
                if (entry.isIntersecting) {
                    this.visibleElements.add(element);
                } else {
                    this.visibleElements.delete(element);
                }
            });
        }, observerOptions);

        this.elements.forEach(item => {
            this.observer.observe(item.element);
        });

        if (this.options.debug) {
            console.log('Intersection Observer setup complete');
        }
    }

    bindEvents() {
        this.handleScroll = this.throttle(this.handleScroll.bind(this), 16); // ~60fps
        this.handleResize = this.debounce(this.handleResize.bind(this), 250);
        this.handleLoad = this.handleLoad.bind(this);

        window.addEventListener('scroll', this.handleScroll, { passive: true });
        window.addEventListener('resize', this.handleResize, { passive: true });
        window.addEventListener('load', this.handleLoad, { passive: true });

        // Reduced mutation observer scope to prevent performance issues
        if (window.MutationObserver) {
            this.mutationObserver = new MutationObserver(this.debounce(() => {
                this.updateElementRects();
            }, 500));

            this.mutationObserver.observe(document.body, {
                childList: true,
                subtree: false, // Only direct children
                attributes: false // Don't watch attributes
            });
        }
    }

    handleScroll() {
        this.currentScrollY = window.pageYOffset;
        this.currentScrollX = window.pageXOffset;

        // Prevent scroll feedback loops
        this.isScrolling = true;
        clearTimeout(this.scrollTimeout);
        this.scrollTimeout = setTimeout(() => {
            this.isScrolling = false;
        }, 100);
    }

    handleResize() {
        this.updateElementRects();
    }

    handleLoad() {
        setTimeout(() => this.updateElementRects(), 100);
    }

    updateElementRects() {
        this.elements.forEach(item => {
            // Get rect without current transform to avoid cumulative errors
            const currentTransform = item.element.style.transform;
            item.element.style.transform = 'none';
            item.rect = item.element.getBoundingClientRect();
            item.element.style.transform = currentTransform;
            item.lastUpdate = Date.now();
        });

        if (this.options.debug) {
            console.log('Element rects updated');
        }
    }

    isElementVisible(item) {
        if (this.observer) {
            return this.visibleElements.has(item.element);
        }

        const rect = item.rect || item.element.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const threshold = this.options.threshold;

        return (
            rect.bottom >= -threshold &&
            rect.top <= windowHeight + threshold
        );
    }

    calculateTransform(item) {
        const { speed, direction, offset, initialTransform } = item;

        // Use actual scroll values instead of smoothed to prevent feedback loops
        const scrollY = this.currentScrollY;
        const scrollX = this.currentScrollX;

        // Calculate base transform
        const scrollDiffY = scrollY * speed;
        const scrollDiffX = scrollX * speed;

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
        }

        // Constrain transforms to prevent infinite scrolling
        if (this.options.containTransforms) {
            const maxTransform = this.options.maxTransform;
            transformX = Math.max(-maxTransform, Math.min(maxTransform, transformX));
            transformY = Math.max(-maxTransform, Math.min(maxTransform, transformY));
        }

        return { x: transformX, y: transformY };
    }

    animate() {
        if (!this.isRunning) return;

        this.frameCount++;

        // Update rects less frequently and only when not scrolling
        if (!this.observer && !this.isScrolling && this.frameCount % this.options.updateFrequency === 0) {
            this.updateElementRects();
        }

        this.elements.forEach(item => {
            const isVisible = this.isElementVisible(item);

            if (isVisible) {
                const transform = this.calculateTransform(item);

                // Only update if transform actually changed significantly
                const deltaX = Math.abs(transform.x - item.lastTransform.x);
                const deltaY = Math.abs(transform.y - item.lastTransform.y);

                if (deltaX > 0.1 || deltaY > 0.1) {
                    const transformString = `translate3d(${transform.x.toFixed(2)}px, ${transform.y.toFixed(2)}px, 0px)`;
                    item.element.style.transform = transformString;
                    item.lastTransform = transform;
                }
            }
        });

        this.rafId = requestAnimationFrame(() => this.animate());
    }

    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        // Initialize scroll values
        this.currentScrollY = window.pageYOffset;
        this.currentScrollX = window.pageXOffset;
        this.lastScrollY = this.currentScrollY;
        this.lastScrollX = this.currentScrollX;

        this.animate();

        if (this.options.debug) {
            console.log('Parallax animation started');
        }
    }

    stop() {
        this.isRunning = false;

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

        // Clear timeouts
        clearTimeout(this.scrollTimeout);
        clearTimeout(this.debounceTimer);

        // Remove event listeners
        window.removeEventListener('scroll', this.handleScroll);
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('load', this.handleLoad);

        // Disconnect observers
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }

        // Reset all element styles
        this.elements.forEach(item => {
            const { initialTransform } = item;
            item.element.style.transform =
                `translate3d(${initialTransform.x}px, ${initialTransform.y}px, ${initialTransform.z}px)`;
            item.element.style.willChange = 'auto';
            item.element.style.position = '';
            item.element.style.zIndex = '';
        });

        this.elements = [];
        this.visibleElements.clear();

        if (this.options.debug) {
            console.log('Parallax destroyed');
        }
    }

    // Utility methods
    debounce(func, wait) {
        return (...args) => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => func.apply(this, args), wait);
        };
    }

    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    addElement(element, options = {}) {
        const speed = Math.max(-2, Math.min(2, options.speed || this.options.speed));
        const direction = options.direction || this.options.direction;
        const offset = options.offset || this.options.offset;

        this.prepareElement(element);

        const item = {
            element,
            speed,
            direction,
            offset,
            initialTransform: this.getInitialTransform(element),
            rect: element.getBoundingClientRect(),
            isVisible: false,
            lastUpdate: Date.now(),
            container: this.getContainer(element),
            lastTransform: { x: 0, y: 0 }
        };

        this.elements.push(item);

        if (this.observer) {
            this.observer.observe(element);
        }

        if (this.options.debug) {
            console.log('Element added to parallax');
        }

        return item;
    }

    removeElement(element) {
        const index = this.elements.findIndex(item => item.element === element);
        if (index > -1) {
            if (this.observer) {
                this.observer.unobserve(element);
            }

            this.visibleElements.delete(element);

            const item = this.elements[index];
            const { initialTransform } = item;
            element.style.transform =
                `translate3d(${initialTransform.x}px, ${initialTransform.y}px, ${initialTransform.z}px)`;
            element.style.willChange = 'auto';
            element.style.position = '';
            element.style.zIndex = '';

            this.elements.splice(index, 1);

            if (this.options.debug) {
                console.log('Element removed from parallax');
            }

            return true;
        }
        return false;
    }

    updateOptions(newOptions) {
        const oldUseIntersectionObserver = this.options.useIntersectionObserver;
        this.options = { ...this.options, ...newOptions };

        if (oldUseIntersectionObserver !== this.options.useIntersectionObserver) {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
                this.visibleElements.clear();
            }
            this.setupIntersectionObserver();
        }

        this.setupElements();

        if (this.options.debug) {
            console.log('Parallax options updated');
        }
    }

    getPerformanceStats() {
        return {
            elementsCount: this.elements.length,
            visibleElementsCount: this.visibleElements.size,
            frameCount: this.frameCount,
            isRunning: this.isRunning,
            useIntersectionObserver: !!this.observer,
            isScrolling: this.isScrolling
        };
    }
}

// Auto-initialize with safer defaults
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('[data-parallax]')) {
        window.parallaxInstance = new Parallax({
            containTransforms: true,
            maxTransform: 300,
            smoothing: 0.05 // Reduced smoothing to prevent feedback loops
        });
    }
});

window.Parallax = Parallax; 
 
// === Source: openscroll.smoothscroller.js === 
class OpenscrollSmoothscroller {
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

window.SmoothScroller = OpenscrollSmoothscroller; 
