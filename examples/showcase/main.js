document.addEventListener('DOMContentLoaded', (event) => {
    const openScroll = new OpenScroll();

    //  Load by string from global scope
    const smoothScroller = openScroll.start('SmoothScroller');

    // Check what's running
    console.log('Running openAnimations:', openScroll.getAllInstances());
});