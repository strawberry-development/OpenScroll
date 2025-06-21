document.addEventListener('DOMContentLoaded', (event) => {
    const openScroll = new OpenScroll();
    
    // Start parallax animation
    const parallax = openScroll.start('Parallax');
    
    // Check what's running
    console.log('Running openAnimations:', openScroll.getAllInstances());
});