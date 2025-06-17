# OpenScroll
OpenScroll is a free alternative to premium animation libraries like GSAP.

##  Quick Start

##  Feature

### SmoothScroller
Allow to have a smooth scrolling effect.

## Basic Usage

```html
<!DOCTYPE html>
<html>
<head>
    <script src="path/to/openscroll.core.js"></script>
    <!--Imported needed animataion -->
    <script src="path/to/plugins/SmoothScroller.js"></script>
</head>
<body>
<div id="scrollSmooth">
    <!-- Your content here -->
</div>

<script>
    document.addEventListener('DOMContentLoaded', () => {
        const openScroll = new OpenScroll();

        // Start smooth scrolling
        openScroll.start(OpenscrollSmoothscroller, {
            element: '#scrollSmooth',
            smoothness: 0.95,
            speed: 1.2
        });
    });
</script>
</body>
</html>
```

## License

MIT License - see the [LICENSE](LICENSE) file for details.