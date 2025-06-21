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
