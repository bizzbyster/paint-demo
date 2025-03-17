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
        
        // 4. Set up test button functionality - MODIFIED FOR DIRECT PAGE RELOAD
        const runTestButton = document.getElementById('run-test');
        if (runTestButton) {
            runTestButton.addEventListener('click', () => {
                // Get current settings
                const imageSize = document.getElementById('image-size').value || 'medium';
                const imageType = document.getElementById('image-type').value || 'standard';
                
                // Build URL with query parameters instead of using sessionStorage
                const url = new URL(window.location.href);
                url.searchParams.set('imageSize', imageSize);
                url.searchParams.set('imageType', imageType);
                
                // Force a complete page reload with the parameters
                window.location.href = url.toString();
            });
        }
        
        // 5. Check URL parameters for settings (instead of sessionStorage)
        const urlParams = new URLSearchParams(window.location.search);
        const sizeParam = urlParams.get('imageSize');
        const typeParam = urlParams.get('imageType');
        
        if (sizeParam && document.getElementById('image-size')) {
            document.getElementById('image-size').value = sizeParam;
        }
        
        if (typeParam && document.getElementById('image-type')) {
            document.getElementById('image-type').value = typeParam;
        }
        
        // 6. Start initial image loading
        imageLoader.loadImages();
        
    }, 100);
});