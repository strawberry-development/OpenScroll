# SmoothScroller

↯ SmoothScroller is an alternative to libraries like GSAP ScrollSmoother, providing similar functionality without the subscription costs.

## Basic Usage

1. Include the script in your HTML:
```html
<script src="path/to/smooth-scroller.min.js"></script>
```

2. Create a container element for your scrollable content:
```html
<div id="scrollSmooth">
  <!-- Your content here -->
</div>
```

3. Initialize SmoothScroller:
```javascript
document.addEventListener('DOMContentLoaded', () => {
  const scroller = new SmoothScroller({
    element: '#scrollSmooth',
    smoothness: 0.95
  });
});
```

## Configuration Options

SmoothScroller accepts the following configuration options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `element` | String\|HTMLElement | '#scrollSmooth' | Element to apply smooth scrolling to |
| `smoothness` | Number | 0.95 | Scrolling smoothness (0.8-0.95 recommended) |
| `minMovement` | Number | 0.5 | Minimum movement threshold in pixels |
| `maxDeltaTime` | Number | 2 | Maximum delta time for stability |
| `debug` | Boolean | false | Enable console logging |
| `scrollToDuration` | Number | 1000 | Default duration for scrollTo in ms |
| `scrollToEasing` | String | 'easeInOutCubic' | Default easing function |
| `autoScrollOffset` | Number | 0 | Offset for scrollTo |
| `useNativeForTouch` | Boolean | true | Use native scrolling on touch devices |
| `respectReducedMotion` | Boolean | true | Respect user's reduced motion preference |
| `onInit` | Function | null | Callback after initialization |
| `onDestroy` | Function | null | Callback after destruction |
| `onScrollStart` | Function | null | Callback when scrolling starts |
| `onScrollEnd` | Function | null | Callback when scrolling ends |

## API Reference

### Methods

#### `scrollTo(target, options)`
Scrolls to a specified target.
- `target`: Number (position in pixels) or Element/selector to scroll to
- `options`: Object containing animation options
    - `duration`: Animation duration in ms
    - `easing`: Easing function name
    - `offset`: Offset from the element in pixels
    - `immediate`: Whether to cancel current animations
    - `onComplete`: Callback when animation completes
- Returns: Promise that resolves when animation completes

#### `scrollToElement(selector, options)`
Scrolls to an element using a CSS selector.
- `selector`: String CSS selector
- `options`: Same as scrollTo options
- Returns: Promise that resolves when animation completes

#### `start()`
Starts the smooth scrolling effect.

#### `stop()`
Stops the smooth scrolling effect.

#### `toggle(force)`
Toggles the smooth scrolling effect.
- `force`: Optional boolean to force enable/disable
- Returns: Current state (true = enabled)

#### `setSmoothness(value)`
Sets the smoothness value.
- `value`: Number between 0.5 and 0.99

#### `setScrollToDuration(value)`
Sets the default scroll animation duration.
- `value`: Number in milliseconds

#### `setScrollToEasing(easing)`
Sets the default easing function.
- `easing`: String name of easing function

#### `getScrollPosition()`
Gets the current scroll position.
- Returns: Current scroll position in pixels

#### `addEasing(name, fn)`
Adds a custom easing function.
- `name`: String name for the easing function
- `fn`: Function taking progress (0-1) and returning eased value

#### `updateConfig(options)`
Updates configuration options.
- `options`: Object with config options to update

#### `destroy()`
Cleans up event listeners and restores original DOM.

## Available Easing Functions

- `linear`
- `easeInQuad`, `easeOutQuad`, `easeInOutQuad`
- `easeInCubic`, `easeOutCubic`, `easeInOutCubic`
- `easeInQuart`, `easeOutQuart`, `easeInOutQuart`
- `easeInQuint`, `easeOutQuint`, `easeInOutQuint`
- `easeOutBack` (with overshoot)
- `easeOutElastic` (with bounce)

## Advanced Example

```javascript
// Initialize with custom options
const scroller = new SmoothScroller({
  element: '#content',
  smoothness: 0.9,
  scrollToDuration: 1200,
  scrollToEasing: 'easeOutBack',
  debug: true,
  onScrollStart: () => {
    console.log('Started scrolling');
    document.body.classList.add('is-scrolling');
  },
  onScrollEnd: () => {
    console.log('Finished scrolling');
    document.body.classList.remove('is-scrolling');
  }
});

// Example: Scroll to an element when a button is clicked
document.querySelector('.scroll-to-features').addEventListener('click', () => {
  scroller.scrollToElement('#features', {
    duration: 1500,
    easing: 'easeOutElastic',
    offset: 50
  });
});

// Example: Add a custom easing function
scroller.addEasing('bouncy', t => {
  const b = 2;
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t) * Math.abs(Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3) * b));
});
```