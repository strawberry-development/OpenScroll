// Replace the mock implementation with the actual SmoothScroller implementation
document.addEventListener('DOMContentLoaded', (event) => {
    // Initialize syntax highlighting
    document.querySelectorAll('pre code').forEach((el) => {
        hljs.highlightElement(el);
    });

    // SmoothScroller implementation
    class SmoothScroller {
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
                smoothness: this._clamp(options.smoothness ?? 0.95, 0.5, 0.99),
                minMovement: options.minMovement ?? 0.5,
                maxDeltaTime: options.maxDeltaTime ?? 2,
                debug: options.debug ?? false,
                scrollToDuration: options.scrollToDuration ?? 1000,
                scrollToEasing: options.scrollToEasing ?? 'easeInOutCubic',
                autoScrollOffset: options.autoScrollOffset ?? 0,
                useNativeForTouch: options.useNativeForTouch ?? true,
                respectReducedMotion: options.respectReducedMotion ?? true,
                onInit: options.onInit || function() {},
                onDestroy: options.onDestroy || function() {},
                onScrollStart: options.onScrollStart || function() {},
                onScrollEnd: options.onScrollEnd || function() {}
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
                this.config.onInit();
            } else {
                this._setupFallback();
                this._log('Using native scrolling due to device or user preference');
            }
        }

        _bindMethods() {
            this.updateScroll = this.updateScroll.bind(this);
            this.handleResize = this.handleResize.bind(this);
            this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
            this.handleScroll = this.handleScroll.bind(this);
            this.animate = this.animate.bind(this);
        }

        _shouldUseSmooth() {
            if (this.prefersReducedMotion && this.config.respectReducedMotion) {
                return false;
            }

            if (this.isTouchDevice && this.config.useNativeForTouch) {
                return false;
            }

            return true;
        }

        _isTouchDevice() {
            return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        }

        _prefersReducedMotion() {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        }

        _clamp(value, min, max) {
            return Math.min(Math.max(value, min), max);
        }

        _setupFallback() {
            if (this.scrollElement) {
                this.scrollElement.style.position = '';
                this.scrollElement.style.top = '';
                this.scrollElement.style.left = '';
                this.scrollElement.style.width = '';
                this.scrollElement.style.transform = '';
            }
        }

        _resolveElement(element) {
            if (typeof element === 'string') {
                return document.querySelector(element);
            }
            return element;
        }

        _log(message, data) {
            if (this.config.debug) {
                if (data !== undefined) {
                    console.log(`SmoothScroller: ${message}`, data);
                } else {
                    console.log(`SmoothScroller: ${message}`);
                }
            }
        }

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

        handleScroll() {
            if (!this.isAnimating) {
                this.targetScroll = window.scrollY;
                if (this.config.onScrollStart && !this.isRunning) {
                    this.config.onScrollStart();
                }
            }
        }

        updateScroll() {
            if (!this.isRunning) return;

            const currentTime = performance.now();
            const deltaTime = Math.min((currentTime - this.lastTime) / 16.67, this.config.maxDeltaTime);
            this.lastTime = currentTime;

            let wasMoving = Math.abs(this.targetScroll - this.currentScroll) >= this.config.minMovement;

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

                    // If we were moving and now stopped, trigger onScrollEnd
                    if (wasMoving && this.config.onScrollEnd) {
                        this.config.onScrollEnd();
                    }
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
                } else if (this.config.onScrollEnd) {
                    this.config.onScrollEnd();
                }

                this._log("Animation complete");
            }
        }

        startAnimation(animation) {
            this.currentAnimation = animation;
            this.currentAnimation.startTime = performance.now();
            this.currentAnimation.startPosition = window.scrollY;
            this.isAnimating = true;

            if (this.config.onScrollStart) {
                this.config.onScrollStart();
            }

            this._log(`Starting animation to ${animation.targetPosition}px with ${animation.easing} easing`);
        }

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
                        // Clear current animations and start this one immediately
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

        scrollToElement(selector, options = {}) {
            const element = document.querySelector(selector);
            if (!element) {
                this._log(`Element not found: ${selector}`);
                return Promise.reject(new Error(`Element ${selector} not found`));
            }
            return this.scrollTo(element, options);
        }

        handleResize() {
            this.setupScrollStructure();
        }

        handleVisibilityChange() {
            if (document.visibilityState === 'visible') {
                // Resume animation and reset timing
                this.start();
            } else {
                // Pause animation when tab not visible
                this.stop();
            }
        }

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

        stop() {
            this.isRunning = false;

            if (this.animationFrameId !== null) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }

            this._log("Smooth scrolling stopped");
        }

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

        setSmoothness(value) {
            this.config.smoothness = this._clamp(parseFloat(value), 0.5, 0.99);
            this._log(`Smoothness set to ${this.config.smoothness}`);
        }

        setScrollToDuration(value) {
            this.config.scrollToDuration = parseInt(value);
            this._log(`Scroll duration set to ${this.config.scrollToDuration}ms`);
        }

        setScrollToEasing(easing) {
            if (this.easings[easing] || typeof easing === 'function') {
                this.config.scrollToEasing = easing;
                this._log(`Scroll easing set to ${easing}`);
            } else {
                this._log(`Invalid easing function: ${easing}`);
            }
        }

        getScrollPosition() {
            return this.currentScroll;
        }

        toggle(force) {
            if (force !== undefined) {
                this.enabled = force;
            } else {
                this.enabled = !this.enabled;
            }

            if (this.enabled) {
                this.start();
            } else {
                this.stop();
            }

            this._log(`Smooth scrolling ${this.enabled ? 'enabled' : 'disabled'}`);
            return this.enabled;
        }

        addEasing(name, fn) {
            if (typeof fn !== 'function') {
                this._log(`Invalid easing function for ${name}`);
                return;
            }

            this.easings[name] = fn;
            this._log(`Added easing function: ${name}`);
        }

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

            if (this.config.onDestroy) {
                this.config.onDestroy();
            }
        }

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

    // Initialize SmoothScroller with default options
    const scroller = new SmoothScroller({
        element: '#scrollSmooth',
        smoothness: 0.95,
        minMovement: 0.5,
        maxDeltaTime: 2,
        debug: true, // Enable debug to see console logs
        scrollToDuration: 1000,
        scrollToEasing: 'easeInOutCubic',
        autoScrollOffset: 0,
        useNativeForTouch: true,
        respectReducedMotion: true,
        onInit: () => console.log('SmoothScroller initialized!'),
        onScrollStart: () => console.log('Scroll started'),
        onScrollEnd: () => console.log('Scroll ended')
    });

    // Demo button functionality
    document.getElementById('demoButton').addEventListener('click', () => {
        scroller.scrollToElement('#features', {
            duration: 1200,
            easing: 'easeOutBack'
        });
    });

    // GitHub button (placeholder)
    document.getElementById('githubButton').addEventListener('click', () => {
        window.open('https://github.com/strawberry-development/SmoothScroller', '_blank');
    });

    // Easing demo buttons
    document.querySelectorAll('.easing-demo').forEach(button => {
        button.addEventListener('click', () => {
            const easing = button.dataset.easing;
            scroller.scrollToElement('#demo', {
                duration: 1000,
                easing: easing
            });
        });
    });

    // Smoothness control
    const smoothnessInput = document.getElementById('smoothness');
    const smoothnessValue = document.getElementById('smoothnessValue');
    smoothnessInput.addEventListener('input', () => {
        const value = smoothnessInput.value;
        smoothnessValue.textContent = value;
        scroller.setSmoothness(parseFloat(value));
    });

    // Duration control
    const durationInput = document.getElementById('duration');
    const durationValue = document.getElementById('durationValue');
    durationInput.addEventListener('input', () => {
        const value = durationInput.value;
        durationValue.textContent = value;
        scroller.setScrollToDuration(parseInt(value));
    });

    // Reset button
    document.getElementById('resetButton').addEventListener('click', () => {
        smoothnessInput.value = 0.95;
        smoothnessValue.textContent = '0.95';
        scroller.setSmoothness(0.95);

        durationInput.value = 1000;
        durationValue.textContent = '1000';
        scroller.setScrollToDuration(1000);

        scroller.setScrollToEasing('easeInOutCubic');
    });

    // Scroll to top button
    document.querySelector('.scroll-to-top').addEventListener('click', () => {
        scroller.scrollTo(0, {
            duration: 800,
            easing: 'easeOutQuint'
        });
    });

    // Toggle scroller button
    document.querySelector('.toggle-scroller').addEventListener('click', function() {
        const isEnabled = scroller.toggle();
        this.setAttribute('aria-pressed', !isEnabled);
    });
});