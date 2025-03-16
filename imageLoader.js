/**
 * Get the navigation start time from Performance API
 * This will serve as the reference point for all our measurements
 */
function getNavigationStartTime() {
    if (performance.timeOrigin) {
        // Modern browsers
        return performance.timeOrigin;
    } else if (performance.timing && performance.timing.navigationStart) {
        // Older browsers
        return performance.timing.navigationStart;
    }
    // Fallback to current time minus a small offset
    return Date.now() - 100;
}

/**
 * Get current time relative to navigation start
 * This aligns our measurements with browser metrics like LCP
 */
function getRelativeTime() {
    return performance.now() + window.navigationStartTime;
}

// Store navigation start time when the script loads
window.navigationStartTime = getNavigationStartTime();

/**
 * Image Loader Module with navigation-aligned timing
 */
window.ImageLoader = class ImageLoader {
    constructor() {
        // DOM references
        this.productContainer = document.getElementById('product-container');
        this.results = document.getElementById('results');
        this.imageSize = document.getElementById('image-size');
        this.imageType = document.getElementById('image-type');
        
        // Timings storage
        this.timingData = {
            startTime: 0,
            navigationStartTime: window.navigationStartTime,
            imageLoadTimes: [],
            elementTimings: [],
            paintDeltas: [],
            viewportDeltas: []
        };
        
        // IntersectionObserver for viewport detection
        this.viewportObserver = null;
    }
    
    /**
     * Generate a cache-busting URL for images
     */
    getCacheBustingUrl(baseUrl) {
        // Add timestamp and a random number to make each request unique
        const cacheBuster = `cache=${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        
        // Add cache buster as a query parameter
        if (baseUrl.includes('?')) {
            return `${baseUrl}&${cacheBuster}`;
        } else {
            return `${baseUrl}?${cacheBuster}`;
        }
    }
    
    /**
     * Initialize the IntersectionObserver for viewport detection
     */
    initViewportObserver() {
        // Clean up previous observer if exists
        if (this.viewportObserver) {
            this.viewportObserver.disconnect();
        }
        
        this.viewportObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const img = entry.target;
                const index = parseInt(img.dataset.index);
                const viewportTime = getRelativeTime() - this.timingData.startTime;
                const statusBadge = img.parentNode.querySelector('.status-badge');
                
                // Update status badge
                if (statusBadge) {
                    statusBadge.textContent = entry.isIntersecting ? "In Viewport" : "Out of Viewport";
                    statusBadge.classList.toggle('in-viewport', entry.isIntersecting);
                    statusBadge.classList.toggle('out-viewport', !entry.isIntersecting);
                }
                
                // Record viewport entry time
                if (entry.isIntersecting) {
                    // First time entering viewport
                    if (!this.timingData.viewportDeltas.some(item => item.imageIndex === index)) {
                        this.timingData.viewportDeltas.push({
                            imageIndex: index,
                            viewportTime: viewportTime,
                            intersectionRatio: entry.intersectionRatio
                        });
                    }
                }
            });
        }, {
            threshold: CONFIG.observer.threshold,
            rootMargin: CONFIG.observer.rootMargin
        });
    }
    
    /**
     * Check if an element is initially in the viewport
     */
    checkInitialViewportStatus(element) {
        // Get the element's bounding rectangle
        const rect = element.getBoundingClientRect();
        
        // Check if the element is in the viewport
        const isInViewport = (
            rect.top < window.innerHeight &&
            rect.bottom > 0 &&
            rect.left < window.innerWidth &&
            rect.right > 0
        );
        
        // Find the status badge
        const statusBadge = element.parentNode.querySelector('.status-badge');
        
        // Update the status badge
        if (statusBadge) {
            statusBadge.textContent = isInViewport ? "In Viewport" : "Out of Viewport";
            statusBadge.classList.toggle('in-viewport', isInViewport);
            statusBadge.classList.toggle('out-viewport', !isInViewport);
        }
        
        // Record viewport entry if in viewport
        if (isInViewport) {
            const index = parseInt(element.dataset.index);
            const viewportTime = getRelativeTime() - this.timingData.startTime;
            
            // Only add if not already recorded
            if (!this.timingData.viewportDeltas.some(item => item.imageIndex === index)) {
                this.timingData.viewportDeltas.push({
                    imageIndex: index,
                    viewportTime: viewportTime,
                    intersectionRatio: 1.0 // Estimated ratio since we don't have actual IntersectionObserverEntry
                });
            }
        }
    }
    
    /**
     * Create HTML for a product item
     */
    createProductHTML(product, index, size, loadType) {
        const randomSeed = Math.floor(Math.random() * 1000); // Random seed for unique images
        const productDiv = document.createElement('div');
        productDiv.className = 'product-item';
        
        // Create base URLs with cache busting
        const baseUrl = `https://picsum.photos/seed/product${randomSeed}/${size}`;
        const uniqueUrl = this.getCacheBustingUrl(baseUrl);
        
        if (loadType === 'standard') {
            // Standard approach with cache busting
            productDiv.innerHTML = `
                <img 
                    src="${uniqueUrl}" 
                    alt="${product.title}" 
                    class="product-image" 
                    data-index="${index}" 
                    elementtiming="product-image-${index + 1}"
                >
                <div class="status-badge out-viewport">Out of Viewport</div>
                <div class="product-info">
                    <h2>${product.title}</h2>
                    <p>${product.description}</p>
                    <div class="price">${product.price}</div>
                </div>
            `;
        } else {
            // Low quality first approach with cache busting
            const smallSize = CONFIG.lqipSize;
            const smallBaseUrl = `https://picsum.photos/seed/product${randomSeed}/${smallSize}`;
            const uniqueSmallUrl = this.getCacheBustingUrl(smallBaseUrl);
            
            productDiv.innerHTML = `
                <img 
                    src="${uniqueSmallUrl}" 
                    alt="${product.title}" 
                    class="product-image" 
                    data-index="${index}" 
                    data-highres="${uniqueUrl}"
                    style="filter: blur(5px); transition: filter 0.5s ease;"
                    elementtiming="product-image-${index + 1}"
                >
                <div class="status-badge out-viewport">Out of Viewport</div>
                <div class="product-info">
                    <h2>${product.title}</h2>
                    <p>${product.description}</p>
                    <div class="price">${product.price}</div>
                </div>
            `;
        }
        
        return productDiv;
    }
    
    /**
     * Set up load event listeners for standard images
     */
    setupStandardLoadListeners() {
        document.querySelectorAll('.product-image').forEach(img => {
            // Check if the image is initially in viewport before observing
            this.checkInitialViewportStatus(img);
            
            // Start observing for viewport changes
            this.viewportObserver.observe(img);
            
            // Use an arrow function to preserve 'this' context
            img.addEventListener('load', () => {
                const loadTime = getRelativeTime() - this.timingData.startTime;
                const index = parseInt(img.dataset.index);
                
                this.timingData.imageLoadTimes.push({
                    index: index,
                    time: loadTime
                });
                
                // Monitor paint time using requestAnimationFrame
                this.monitorPaintTime(img, index, loadTime);
                
                // Check if all images are loaded
                if (this.timingData.imageLoadTimes.length === CONFIG.products.length) {
                    setTimeout(() => this.displayResults(), 1000);
                }
            });
            
            img.addEventListener('error', () => {
                console.error(`Error loading image ${img.dataset.index}`);
            });
        });
    }
    
    /**
     * Set up two-phase loading for LQIP approach
     */
    setupLQIPLoadListeners() {
        const that = this; // Store reference to 'this' for use in callbacks
        
        document.querySelectorAll('.product-image').forEach(img => {
            // Check if the image is initially in viewport before observing
            this.checkInitialViewportStatus(img);
            
            // Start observing for viewport changes
            that.viewportObserver.observe(img);
            
            const onLowResLoad = function() {
                const loadTime = getRelativeTime() - that.timingData.startTime;
                const index = parseInt(img.dataset.index);
                
                // Track low-res load
                that.timingData.imageLoadTimes.push({
                    index: index,
                    time: loadTime,
                    type: 'low-res'
                });
                
                // Track low-res paint time
                requestAnimationFrame(() => {
                    const lowResPaintTime = getRelativeTime() - that.timingData.startTime;
                    that.timingData.paintDeltas.push({
                        imageIndex: index,
                        loadTime: loadTime,
                        paintTime: lowResPaintTime,
                        delta: lowResPaintTime - loadTime,
                        method: 'requestAnimationFrame',
                        type: 'low-res'
                    });
                });
                
                // Remove listener to avoid triggering again for high-res
                img.removeEventListener('load', onLowResLoad);
                
                // Now load high-res version
                setTimeout(() => {
                    const highResImage = new Image();
                    
                    highResImage.onload = () => {
                        const highResLoadTime = getRelativeTime() - that.timingData.startTime;
                        
                        // Update the image
                        img.src = highResImage.src;
                        img.style.filter = 'blur(0)';
                        
                        // Track high-res load
                        that.timingData.imageLoadTimes.push({
                            index: index,
                            time: highResLoadTime,
                            type: 'high-res'
                        });
                        
                        // Track high-res paint time
                        that.monitorPaintTime(img, index, highResLoadTime, 'high-res');
                        
                        // Check if all high-res images are loaded
                        const highResLoads = that.timingData.imageLoadTimes.filter(item => item.type === 'high-res');
                        if (highResLoads.length === CONFIG.products.length) {
                            setTimeout(() => that.displayResults(), 1000);
                        }
                    };
                    
                    highResImage.src = img.dataset.highres;
                }, 500); // Small delay before loading high-res
            };
            
            img.addEventListener('load', onLowResLoad);
            
            img.addEventListener('error', () => {
                console.error(`Error loading image ${img.dataset.index}`);
            });
        });
    }
    
    /**
     * Monitor image paint time using requestAnimationFrame
     */
    monitorPaintTime(img, index, loadTime, type = 'standard') {
        // Store original dimensions (likely 0x0 until image loads and paints)
        const originalWidth = img.offsetWidth;
        const originalHeight = img.offsetHeight;
        let paintDetected = false;
        
        const checkPaint = () => {
            // If dimensions changed, the image has likely been painted
            if (!paintDetected && (img.offsetWidth !== originalWidth || img.offsetHeight !== originalHeight || img.naturalWidth > 0)) {
                const paintTime = getRelativeTime() - this.timingData.startTime;
                paintDetected = true;
                
                // Sanity check - ignore extremely delayed paint times (likely errors)
                // A threshold of 10 seconds should be more than enough for most cases
                if (paintTime - loadTime > 10000) {
                    console.warn(`Unusually high paint delta detected (${(paintTime - loadTime).toFixed(2)}ms) for image ${index}, ignoring.`);
                    return;
                }
                
                // Store paint time if not already recorded via Element Timing API
                const existingDelta = this.timingData.paintDeltas.find(
                    item => item.imageIndex === index && item.type === type
                );
                
                if (!existingDelta) {
                    this.timingData.paintDeltas.push({
                        imageIndex: index,
                        loadTime: loadTime,
                        paintTime: paintTime,
                        delta: paintTime - loadTime,
                        method: 'requestAnimationFrame',
                        type: type
                    });
                }
                
                return;
            }
            
            // Keep checking until paint is detected or timeout
            if (!paintDetected && getRelativeTime() - this.timingData.startTime < 10000) {
                requestAnimationFrame(checkPaint);
            }
        };
        
        // Start monitoring after a small delay (to allow initial render)
        setTimeout(() => {
            requestAnimationFrame(checkPaint);
        }, 50);
    }
    
    /**
     * Set up Performance Observer for element timing
     */
    setupPerformanceObservers() {
        if ('PerformanceObserver' in window) {
            try {
                // Observe element timing for images
                const elementObserver = new PerformanceObserver((entryList) => {
                    for (const entry of entryList.getEntries()) {
                        console.log(`Element timing: ${entry.identifier} at ${entry.startTime}ms (relative to navigation start)`);
                        
                        // Store element timing data
                        this.timingData.elementTimings.push({
                            identifier: entry.identifier,
                            time: entry.startTime,
                            renderTime: entry.renderTime || entry.startTime
                        });
                        
                        // Match with load time to calculate delta
                        if (entry.identifier && entry.identifier.startsWith('product-image-')) {
                            const imageIndex = parseInt(entry.identifier.split('-').pop()) - 1;
                            
                            // Find the matching load time entry based on image type
                            let loadEntry;
                            if (this.imageType.value === 'standard') {
                                loadEntry = this.timingData.imageLoadTimes.find(item => item.index === imageIndex);
                            } else {
                                // For LQIP, use the high-res timing
                                loadEntry = this.timingData.imageLoadTimes.find(
                                    item => item.index === imageIndex && item.type === 'high-res'
                                );
                            }
                            
                            if (loadEntry) {
                                const paintTime = entry.renderTime || entry.startTime;
                                const loadTime = loadEntry.time;
                                const delta = paintTime - loadTime;
                                
                                // Sanity check - ignore extremely delayed paint times (likely errors)
                                if (delta > 10000) {
                                    console.warn(`Unusually high element timing delta detected (${delta.toFixed(2)}ms) for image ${imageIndex}, ignoring.`);
                                    return;
                                }
                                
                                // Check if we already have this entry to avoid duplicates
                                const existingEntry = this.timingData.paintDeltas.find(
                                    item => item.imageIndex === imageIndex && 
                                          item.method === 'ElementTiming API' && 
                                          item.type === (loadEntry.type || 'standard')
                                );
                                
                                if (!existingEntry) {
                                    this.timingData.paintDeltas.push({
                                        imageIndex: imageIndex,
                                        loadTime: loadTime,
                                        paintTime: paintTime,
                                        delta: delta,
                                        method: 'ElementTiming API',
                                        type: loadEntry.type || 'standard'
                                    });
                                }
                            }
                        }
                    }
                });
                
                elementObserver.observe({ entryTypes: ['element'] });
            } catch (e) {
                console.warn('Performance observer not fully supported', e);
            }
        }
    }
    
    /**
     * Try to clear performance entries if browser supports it
     */
    clearPerformanceEntries() {
        // Check if the browser supports clearing performance entries
        if (performance && typeof performance.clearResourceTimings === 'function') {
            console.log('Clearing performance resource timings');
            performance.clearResourceTimings();
        }
        
        if (performance && typeof performance.clearMarks === 'function') {
            console.log('Clearing performance marks');
            performance.clearMarks();
        }
        
        if (performance && typeof performance.clearMeasures === 'function') {
            console.log('Clearing performance measures');
            performance.clearMeasures();
        }
        
        // Try to disconnect any existing observers
        if (window.PerformanceObserver) {
            try {
                // Access any globals from our metrics tracker
                if (window.pageMetricsTracker && window.pageMetricsTracker.observers) {
                    window.pageMetricsTracker.disconnect();
                }
            } catch (e) {
                console.warn('Error disconnecting observers:', e);
            }
        }
    }
    
    /**
     * Load images with the selected options - improved with deep DOM cleaning
     */
    loadImages() {
        // Store current settings
        const currentSize = this.imageSize.value;
        const currentType = this.imageType.value;
        
        // Clear previous content
        this.productContainer.innerHTML = '';
        
        // Clear all images from the page - find any that might be in the DOM
        document.querySelectorAll('img').forEach(img => {
            if (img.parentNode) {
                // Remove image from DOM to trigger complete unload
                img.parentNode.removeChild(img);
            }
        });
        
        // Request browser to clean up resources for better resetting
        if (window.requestIdleCallback) {
            window.requestIdleCallback(() => {
                if (window.gc) window.gc(); // Request garbage collection if available
                
                // Try to clear performance entries
                this.clearPerformanceEntries();
                
                // Continue with loading after cleanup
                this.continueLoading(currentSize, currentType);
            });
        } else {
            // Fallback if requestIdleCallback not available
            setTimeout(() => {
                this.clearPerformanceEntries();
                this.continueLoading(currentSize, currentType);
            }, 50);
        }
    }
    
    /**
     * Continue loading after cleanup
     */
    continueLoading(size, type) {
        // Reset metrics tracker if available
        if (window.pageMetricsTracker && typeof window.pageMetricsTracker.reset === 'function') {
            window.pageMetricsTracker.reset();
        }
        
        // Reset timing data with navigation-aligned start time
        this.timingData = {
            startTime: getRelativeTime(),
            navigationStartTime: window.navigationStartTime,
            imageLoadTimes: [],
            elementTimings: [],
            paintDeltas: [],
            viewportDeltas: []
        };
        
        // Show loading message
        this.results.innerHTML = '<h2>Timing Results</h2><p>Loading images...</p>';
        
        // Get selected size and type
        const sizeValue = CONFIG.imageSizes[size];
        const loadType = type;
        
        // Initialize viewport observer
        this.initViewportObserver();
        
        // Create and append product items
        CONFIG.products.forEach((product, index) => {
            const productDiv = this.createProductHTML(product, index, sizeValue, loadType);
            this.productContainer.appendChild(productDiv);
        });
        
        // Set up appropriate load listeners based on type
        if (loadType === 'standard') {
            this.setupStandardLoadListeners();
        } else {
            this.setupLQIPLoadListeners();
        }
        
        // Set up performance observers
        this.setupPerformanceObservers();
    }
    
    /**
     * Display the timing results in the UI
     */
    displayResults() {
        // Create results HTML
        let resultsHTML = `
            <h2>Timing Results</h2>
            <p>Image size: <strong>${this.imageSize.value}</strong></p>
            <p>Loading type: <strong>${this.imageType.value}</strong></p>
            <p>Navigation start reference: <strong>${new Date(this.timingData.navigationStartTime).toISOString()}</strong></p>
        `;
        
        // Add load times table
        resultsHTML += `
            <h3>Image Load Times (relative to navigation start)</h3>
            <table>
                <thead>
                    <tr>
                        <th>Image</th>
                        <th>Load Time (ms)</th>
                        ${this.imageType.value === 'lowquality' ? '<th>Phase</th>' : ''}
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Sort by index and add rows
        const sortedLoadTimes = [...this.timingData.imageLoadTimes].sort((a, b) => {
            if (this.imageType.value === 'lowquality') {
                if (a.index !== b.index) return a.index - b.index;
                return a.type === 'low-res' ? -1 : 1;
            }
            return a.index - b.index;
        });
        
        sortedLoadTimes.forEach(item => {
            resultsHTML += `
                <tr>
                    <td>Product Image ${item.index + 1}</td>
                    <td>${item.time.toFixed(2)}</td>
                    ${this.imageType.value === 'lowquality' ? `<td>${item.type}</td>` : ''}
                </tr>
            `;
        });
        
        resultsHTML += `
                </tbody>
            </table>
        `;
        
        // Filter out any anomalous paint delta entries (more than 10 seconds difference)
        this.timingData.paintDeltas = this.timingData.paintDeltas.filter(item => {
            return item.delta < 10000; // Filter out entries with more than 10 seconds delta
        });
        
        // Remove duplicates by keeping only the first occurrence for each image index and type
        const uniquePaintDeltas = [];
        const seenKeys = new Set();
        
        this.timingData.paintDeltas.forEach(item => {
            const key = `${item.imageIndex}-${item.type}`;
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                uniquePaintDeltas.push(item);
            }
        });
        
        this.timingData.paintDeltas = uniquePaintDeltas;
        
        // Add paint times table
        if (this.timingData.paintDeltas.length > 0) {
            resultsHTML += `
                <h3>Image Paint Times (When visible on screen)</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Image</th>
                            <th>Resolution</th>
                            <th>Paint Time (ms)</th>
                            <th>Detection Method</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            // Sort by image index, then by type (low-res first)
            this.timingData.paintDeltas
                .sort((a, b) => {
                    if (a.imageIndex !== b.imageIndex) return a.imageIndex - b.imageIndex;
                    return (a.type === 'low-res' ? -1 : 1);
                })
                .forEach(item => {
                    resultsHTML += `
                        <tr>
                            <td>Product Image ${item.imageIndex + 1}</td>
                            <td>${item.type || 'standard'}</td>
                            <td>${item.paintTime.toFixed(2)}</td>
                            <td>${item.method || 'API'}</td>
                        </tr>
                    `;
                });
            
            resultsHTML += `
                    </tbody>
                </table>
            `;
        }
        
        // Add viewport entry times table
        if (this.timingData.viewportDeltas.length > 0) {
            resultsHTML += `
                <h3>Viewport Entry Times (When image enters viewport)</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Image</th>
                            <th>Viewport Entry Time (ms)</th>
                            <th>Intersection Ratio</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            // Sort by image index
            this.timingData.viewportDeltas
                .sort((a, b) => a.imageIndex - b.imageIndex)
                .forEach(item => {
                    resultsHTML += `
                        <tr>
                            <td>Product Image ${item.imageIndex + 1}</td>
                            <td>${item.viewportTime.toFixed(2)}</td>
                            <td>${(item.intersectionRatio * 100).toFixed(1)}%</td>
                        </tr>
                    `;
                });
            
            resultsHTML += `
                    </tbody>
                </table>
            `;
        }
        
        // Add load vs paint comparison if available
        if (this.timingData.paintDeltas.length > 0) {
            resultsHTML += `
                <h3>Load vs. Paint Comparison</h3>
                <p>This shows the difference between when an image finishes loading (JavaScript load event) and when it's actually painted to the screen:</p>
                <table>
                    <thead>
                        <tr>
                            <th>Image</th>
                            <th>Resolution</th>
                            <th>Load Time (ms)</th>
                            <th>Paint Time (ms)</th>
                            <th>Delta (ms)</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            // Sort paint deltas by image index, then by type (low-res first)
            this.timingData.paintDeltas
                .sort((a, b) => {
                    if (a.imageIndex !== b.imageIndex) return a.imageIndex - b.imageIndex;
                    return (a.type === 'low-res' ? -1 : 1);
                })
                .forEach(delta => {
                    let notes = "";
                    if (delta.method === 'estimated') {
                        notes = "Estimated paint time (API not available)";
                    } else if (delta.delta <= 0) {
                        notes = "Paint reported before load (browser optimization or cached image)";
                    } else if (delta.delta < 10) {
                        notes = "Paint happened almost immediately after load";
                    } else if (delta.delta > 50) {
                        notes = "Significant delay between load and paint";
                    }
                    
                    // Add visual improvement for LQIP
                    if (delta.type === 'low-res') {
                        const highResItem = this.timingData.imageLoadTimes.find(
                            item => item.index === delta.imageIndex && item.type === 'high-res'
                        );
                        
                        if (highResItem) {
                            const timeAdvantage = highResItem.time - delta.paintTime;
                            if (timeAdvantage > 0) {
                                notes += ` User sees content ${timeAdvantage.toFixed(0)}ms earlier with LQIP.`;
                            }
                        }
                    }
                    
                    // Find viewport entry for this image
                    const viewportEntry = this.timingData.viewportDeltas.find(
                        item => item.imageIndex === delta.imageIndex
                    );
                    
                    if (viewportEntry) {
                        const loadToViewport = viewportEntry.viewportTime - delta.loadTime;
                        if (loadToViewport > 0) {
                            notes += ` Entered viewport ${loadToViewport.toFixed(0)}ms after load.`;
                        } else {
                            notes += ` Was already in viewport when loaded.`;
                        }
                    }
                    
                    resultsHTML += `
                        <tr>
                            <td>Product Image ${delta.imageIndex + 1}</td>
                            <td>${delta.type || 'standard'}</td>
                            <td>${delta.loadTime.toFixed(2)}</td>
                            <td>${delta.paintTime.toFixed(2)}</td>
                            <td><strong>${delta.delta.toFixed(2)}</strong></td>
                            <td>${notes}</td>
                        </tr>
                    `;
                });
            
            resultsHTML += `
                    </tbody>
                </table>
            `;
        }
        
        // Update the results element
        this.results.innerHTML = resultsHTML;
    }
};