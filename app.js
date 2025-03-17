/**
 * Main initialization script
 * Brings together all modules in a streamlined approach
 */
document.addEventListener('DOMContentLoaded', function() {
    // Small delay to ensure DOM is ready
    setTimeout(function() {
        // 1. Initialize the metrics tracker first
        const metricsTracker = new PerformanceMetricsTracker();
        window.metricsTracker = metricsTracker; // Store global reference for debugging
        metricsTracker.init();
        
        // 2. Initialize the image loader
        const imageLoader = new ImageLoader(metricsTracker);
        window.imageLoader = imageLoader; // Store global reference for debugging
        
        // 3. Initialize display manager that connects both modules
        const displayManager = new DisplayManager(metricsTracker, imageLoader);
        window.displayManager = displayManager; // Store global reference for debugging
        
        // 4. Set up test button functionality
        const runTestButton = document.getElementById('run-test');
        if (runTestButton) {
            runTestButton.addEventListener('click', () => {
                // Store current settings in session storage to preserve them
                const imageSize = document.getElementById('image-size').value || 'medium';
                const imageType = document.getElementById('image-type').value || 'standard';
                
                sessionStorage.setItem('savedImageSize', imageSize);
                sessionStorage.setItem('savedImageType', imageType);
                
                // Force a complete page reload, bypassing the cache
                window.location.reload(true);
            });
        }
        
        // 5. Restore settings from previous session if available
        const savedSize = sessionStorage.getItem('savedImageSize');
        const savedType = sessionStorage.getItem('savedImageType');
        
        if (savedSize && document.getElementById('image-size')) {
            document.getElementById('image-size').value = savedSize;
        }
        
        if (savedType && document.getElementById('image-type')) {
            document.getElementById('image-type').value = savedType;
        }
        
        // Clear saved settings now that we've used them
        sessionStorage.removeItem('savedImageSize');
        sessionStorage.removeItem('savedImageType');
        
        // 6. Start initial image loading
        imageLoader.loadImages();
        
    }, 100);
});