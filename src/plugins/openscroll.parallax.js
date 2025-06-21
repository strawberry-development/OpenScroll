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