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