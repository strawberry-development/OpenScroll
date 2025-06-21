document.addEventListener('DOMContentLoaded', (event) => {
    const openScroll = new OpenScroll();
    
    // Start parallax animation
    const smoothscroller = openScroll.start('SmoothScroller');
    
    // Check what's running
    console.log('Running openAnimations:', openScroll.getAllInstances());
});