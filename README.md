# OpenScroll
OpenScroll is a free alternative to premium animation libraries like GSAP.

##  Note

This project is currently in development.

## Example
Find example [here](https://github.com/strawberry-development/OpenScroll/tree/main/examples)

## Basic Usage

```html
<!DOCTYPE html>
<html>
<head>
    <script src="path/to/openscroll.js"></script>
</head>
<body>
<script>
    // Example usage
    const openScroll = new OpenScroll();

    // Start parallax animation
    const smoothscroller = openScroll.start('Parallax');

    // Check what's running
    console.log('Running openAnimations:', openScroll.getAllInstances());
</script>
</body>
</html>
```

## License

MIT License - see the [LICENSE](LICENSE) file for details.