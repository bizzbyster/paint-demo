/**
 * Consolidated Image Loader Module
 * Combines image loading and viewport tracking functionality
 */
class ImageLoader {
    constructor(metricsTracker) {
        // Store reference to metrics tracker
        this.metricsTracker = metricsTracker;
        
        // DOM references
        this.productContainer = document.getElementById('product-container');
        this.results = document.getElementById('results');
        this.imageSize = document.getElementById('image-size');
        this.imageType = document.getElementById('image-type');
        
        // Timings storage
        this.timingData = {
            startTime: 0,
            imageLoadTimes: [],
            paintDeltas: [],
            viewportDeltas: []
        };
        
        // Viewport tracking
        this.viewportObserver = null;
        this.intersectionLog = [];
        
        // Event system
        this.callbacks = {};
    }
    
    /**
     * Register event listeners
     */
    on(event, callback) {
        if (!this.callbacks[event]) this.callbacks[event] = [];
        this.callbacks[event].push(callback);
    }
    
    /**
     * Emit events to listeners
     */
    emit(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => callback(data));
        }
    }
    
    /**
     * Generate a cache-busting URL for images
     */
    getCacheBustingUrl(baseUrl) {
        const cacheBuster = `cache=${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        return baseUrl.includes('?') ? `${baseUrl}&${cacheBuster}` : `${baseUrl}?${cacheBuster}`;
    }
    
    /**
     * Initialize the IntersectionObserver for viewport detection
     */
    initViewportObserver() {
        // Clean up previous observer if exists
        if (this.viewportObserver) {
            this.viewportObserver.disconnect();
        }
        
        this.intersectionLog = [];
        
        this.viewportObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const img = entry.target;
                const index = parseInt(img.dataset.index);
                const viewportTime = performance.now() - this.timingData.startTime;
                const statusBadge = img.parentNode.querySelector('.status-badge');
                
                // Calculate visible percentage
                let visiblePercent = Math.round(entry.intersectionRatio * 100);
                
                // Log the intersection event
                const entryDebugInfo = {
                    timeMs: viewportTime.toFixed(2),
                    imageIndex: index,
                    isIntersecting: entry.isIntersecting,
                    intersectionRatio: entry.intersectionRatio,
                    visiblePercent: visiblePercent,
                    boundingClientRect: {
                        top: Math.round(entry.boundingClientRect.top),
                        bottom: Math.round(entry.boundingClientRect.bottom),
                        width: Math.round(entry.boundingClientRect.width),
                        height: Math.round(entry.boundingClientRect.height)
                    }
                };
                
                // Log with consistent time format
                console.log(`Image ${index}: ${entry.isIntersecting ? 'Entered' : 'Left'} viewport at ${viewportTime.toFixed(2)}ms, Visible: ${visiblePercent}%`);
                
                // Add to log and emit event for UI updates
                this.intersectionLog.unshift(entryDebugInfo);
                if (this.intersectionLog.length > 20) this.intersectionLog.pop();
                
                this.emit('intersectionUpdate', {
                    logs: this.intersectionLog.slice(0, 3),
                    currentEntry: entryDebugInfo
                });
                
                // Update status badge
                if (statusBadge) {
                    statusBadge.className = 'status-badge';
                    
                    if (entry.isIntersecting) {
                        statusBadge.textContent = `In Viewport (${visiblePercent}%)`;
                        statusBadge.classList.add('in-viewport');
                    } else {
                        statusBadge.textContent = "Out of Viewport";
                        statusBadge.classList.add('out-viewport');
                    }
                }
                
                // Record viewport entry time (first time only)
                if (entry.isIntersecting && !this.timingData.viewportDeltas.some(item => item.imageIndex === index)) {
                    this.timingData.viewportDeltas.push({
                        imageIndex: index,
                        viewportTime: viewportTime,
                        intersectionRatio: entry.intersectionRatio
                    });
                }
            });
        }, {
            threshold: [0, 0.1, 0.5, 0.9],
            rootMargin: "0px"
        });
    }
    
    /**
     * Check if an element is in the viewport and update status
     */
    checkViewportStatus(element) {
        const rect = element.getBoundingClientRect();
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        
        // Check viewport intersection
        const isInViewport = (
            rect.top < viewportHeight &&
            rect.bottom > 0 &&
            rect.left < viewportWidth &&
            rect.right > 0
        );
        
        // Calculate visible percentage
        let visiblePercent = 0;
        if (isInViewport) {
            const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
            const visibleWidth = Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0);
            visiblePercent = Math.round((visibleHeight * visibleWidth) / (rect.width * rect.height) * 100);
        }
        
        // Capture the time since start
        const viewportTime = performance.now() - this.timingData.startTime;
        
        // Update status badge
        const statusBadge = element.parentNode.querySelector('.status-badge');
        if (statusBadge) {
            statusBadge.className = 'status-badge';
            
            if (isInViewport) {
                statusBadge.textContent = `In Viewport (${visiblePercent}%)`;
                statusBadge.classList.add('in-viewport');
            } else {
                statusBadge.textContent = "Out of Viewport";
                statusBadge.classList.add('out-viewport');
            }
        }
        
        // Create debug info
        const debugInfo = {
            timeMs: viewportTime.toFixed(2),
            index: element.dataset.index,
            isInViewport: isInViewport,
            visiblePercent: visiblePercent,
            elementPosition: {
                top: Math.round(rect.top),
                bottom: Math.round(rect.bottom),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
            },
            viewport: {
                width: viewportWidth,
                height: viewportHeight
            }
        };
        
        // Log with consistent time format
        console.log(`Check - Image ${element.dataset.index}: ${isInViewport ? 'In' : 'Out of'} viewport at ${viewportTime.toFixed(2)}ms, Visible: ${visiblePercent}%`);
        
        // Emit debug info for UI updates
        this.emit('viewportUpdate', debugInfo);
        
        // Record viewport entry if in viewport
        if (isInViewport) {
            const index = parseInt(element.dataset.index);
            
            if (!this.timingData.viewportDeltas.some(item => item.imageIndex === index)) {
                this.timingData.viewportDeltas.push({
                    imageIndex: index,
                    viewportTime: viewportTime,
                    intersectionRatio: visiblePercent / 100
                });
            }
        }
        
        return isInViewport;
    }
    
    /**
     * Set up window resize listener
     */
    setupWindowResizeListener() {
        window.removeEventListener('resize', this._resizeHandler);
        
        this._resizeHandler = this.debounce(() => {
            document.querySelectorAll('.product-image').forEach(img => {
                this.checkViewportStatus(img);
            });
        }, 100);
        
        window.addEventListener('resize', this._resizeHandler);
    }
    
    /**
     * Utility function to debounce rapid calls
     */
    debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }
    
    /**
     * Create HTML for a product item
     */
    createProductHTML(product, index, size, loadType) {
        const randomSeed = Math.floor(Math.random() * 1000);
        const productDiv = document.createElement('div');
        productDiv.className = 'product-item';
        
        const baseUrl = `https://picsum.photos/seed/product${randomSeed}/${size}`;
        const uniqueUrl = this.getCacheBustingUrl(baseUrl);
        
        if (loadType === 'standard') {
            productDiv.innerHTML = `
                <img 
                    src="${uniqueUrl}" 
                    alt="${product.title}" 
                    class="product-image" 
                    data-index="${index}" 
                    elementtiming="product-image-${index + 1}"
                >
                <div class="status-badge">Checking Viewport...</div>
                <div class="product-info">
                    <h2>${product.title}</h2>
                    <p>${product.description}</p>
                    <div class="price">${product.price}</div>
                </div>
            `;
        } else {
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
                <div class="status-badge">Checking Viewport...</div>
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
     * Set up standard image load listeners
     */
    setupStandardLoadListeners() {
        document.querySelectorAll('.product-image').forEach(img => {
            this.checkViewportStatus(img);
            this.viewportObserver.observe(img);
            
            img.addEventListener('load', () => {
                const loadTime = performance.now() - this.timingData.startTime;
                const index = parseInt(img.dataset.index);
                
                this.timingData.imageLoadTimes.push({
                    index: index,
                    time: loadTime
                });
                
                this.monitorPaintTime(img, index, loadTime);
                
                // Also notify metrics tracker about image loads
                if (this.metricsTracker) {
                    this.metricsTracker.trackElementPaint(img, {
                        source: 'image-load-event',
                        loadTime: loadTime
                    });
                }
                
                if (this.timingData.imageLoadTimes.length === CONFIG.products.length) {
                    setTimeout(() => this.finalizeResults(), 1000);
                }
            });
            
            img.addEventListener('error', () => {
                console.error(`Error loading image ${img.dataset.index}`);
            });
        });
    }
    
    /**
     * Set up LQIP (Low Quality Image Placeholder) load listeners
     */
    setupLQIPLoadListeners() {
        const that = this;
        
        document.querySelectorAll('.product-image').forEach(img => {
            this.checkViewportStatus(img);
            that.viewportObserver.observe(img);
            
            const onLowResLoad = function() {
                const loadTime = performance.now() - that.timingData.startTime;
                const index = parseInt(img.dataset.index);
                
                that.timingData.imageLoadTimes.push({
                    index: index,
                    time: loadTime,
                    type: 'low-res'
                });
                
                requestAnimationFrame(() => {
                    const lowResPaintTime = performance.now() - that.timingData.startTime;
                    that.timingData.paintDeltas.push({
                        imageIndex: index,
                        loadTime: loadTime,
                        paintTime: lowResPaintTime,
                        delta: lowResPaintTime - loadTime,
                        method: 'requestAnimationFrame',
                        type: 'low-res'
                    });
                    
                    // Notify metrics tracker
                    if (that.metricsTracker) {
                        that.metricsTracker.recordPaintEvent({
                            element: img,
                            time: performance.now(),
                            type: 'lqip-low-res',
                            metadata: {
                                loadTime: loadTime,
                                paintTime: lowResPaintTime
                            }
                        });
                    }
                });
                
                img.removeEventListener('load', onLowResLoad);
                
                setTimeout(() => {
                    const highResImage = new Image();
                    
                    highResImage.onload = () => {
                        const highResLoadTime = performance.now() - that.timingData.startTime;
                        
                        img.src = highResImage.src;
                        img.style.filter = 'blur(0)';
                        
                        that.timingData.imageLoadTimes.push({
                            index: index,
                            time: highResLoadTime,
                            type: 'high-res'
                        });
                        
                        that.monitorPaintTime(img, index, highResLoadTime, 'high-res');
                        
                        // Notify metrics tracker
                        if (that.metricsTracker) {
                            that.metricsTracker.trackElementPaint(img, {
                                source: 'lqip-high-res-load',
                                loadTime: highResLoadTime
                            });
                        }
                        
                        const highResLoads = that.timingData.imageLoadTimes.filter(item => item.type === 'high-res');
                        if (highResLoads.length === CONFIG.products.length) {
                            setTimeout(() => that.finalizeResults(), 1000);
                        }
                    };
                    
                    highResImage.src = img.dataset.highres;
                }, 500);
            };
            
            img.addEventListener('load', onLowResLoad);
            
            img.addEventListener('error', () => {
                console.error(`Error loading image ${img.dataset.index}`);
            });
        });
    }
    
    /**
     * Monitor image paint time
     */
    monitorPaintTime(img, index, loadTime, type = 'standard') {
        const originalWidth = img.offsetWidth;
        const originalHeight = img.offsetHeight;
        let paintDetected = false;
        
        const checkPaint = () => {
            if (!paintDetected && (img.offsetWidth !== originalWidth || img.offsetHeight !== originalHeight || img.naturalWidth > 0)) {
                const paintTime = performance.now() - this.timingData.startTime;
                paintDetected = true;
                
                if (paintTime - loadTime > 10000) {
                    console.warn(`Unusually high paint delta detected (${(paintTime - loadTime).toFixed(2)}ms) for image ${index}, ignoring.`);
                    return;
                }
                
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
            
            if (!paintDetected && performance.now() - this.timingData.startTime < 10000) {
                requestAnimationFrame(checkPaint);
            }
        };
        
        setTimeout(() => {
            requestAnimationFrame(checkPaint);
        }, 50);
    }
    
    /**
     * Set up Performance Observer for element timing
     */
    setupElementTimingObserver() {
        if ('PerformanceObserver' in window) {
            try {
                const elementObserver = new PerformanceObserver((entryList) => {
                    for (const entry of entryList.getEntries()) {
                        if (entry.identifier && entry.identifier.startsWith('product-image-')) {
                            const imageIndex = parseInt(entry.identifier.split('-').pop()) - 1;
                            
                            let loadEntry;
                            if (this.imageType.value === 'standard') {
                                loadEntry = this.timingData.imageLoadTimes.find(item => item.index === imageIndex);
                            } else {
                                loadEntry = this.timingData.imageLoadTimes.find(
                                    item => item.index === imageIndex && item.type === 'high-res'
                                );
                            }
                            
                            if (loadEntry) {
                                const paintTime = entry.renderTime || entry.startTime;
                                const loadTime = loadEntry.time;
                                const delta = paintTime - loadTime;
                                
                                if (delta > 10000) {
                                    console.warn(`Unusually high element timing delta detected (${delta.toFixed(2)}ms) for image ${imageIndex}, ignoring.`);
                                    return;
                                }
                                
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
     * Load images with the selected options
     */
    loadImages() {
        const currentSize = this.imageSize.value;
        const currentType = this.imageType.value;
        
        this.productContainer.innerHTML = '';
        
        document.querySelectorAll('img').forEach(img => {
            if (img.parentNode) {
                img.parentNode.removeChild(img);
            }
        });
        
        // Reset metrics if available
        if (this.metricsTracker && typeof this.metricsTracker.reset === 'function') {
            this.metricsTracker.reset();
        }
        
        if (window.requestIdleCallback) {
            window.requestIdleCallback(() => {
                this.continueLoading(currentSize, currentType);
            });
        } else {
            setTimeout(() => {
                this.continueLoading(currentSize, currentType);
            }, 50);
        }
    }
    
    /**
     * Continue loading after cleanup
     */
    continueLoading(size, type) {
        this.timingData = {
            startTime: performance.now(),
            imageLoadTimes: [],
            paintDeltas: [],
            viewportDeltas: []
        };
        
        this.results.innerHTML = '<h2>Timing Results</h2><p>Loading images...</p>';
        
        const sizeValue = CONFIG.imageSizes[size];
        const loadType = type;
        
        this.initViewportObserver();
        this.setupWindowResizeListener();
        this.setupElementTimingObserver();
        
        CONFIG.products.forEach((product, index) => {
            const productDiv = this.createProductHTML(product, index, sizeValue, loadType);
            this.productContainer.appendChild(productDiv);
        });
        
        if (loadType === 'standard') {
            this.setupStandardLoadListeners();
        } else {
            this.setupLQIPLoadListeners();
        }
        
        setTimeout(() => {
            document.querySelectorAll('.product-image').forEach(img => {
                this.checkViewportStatus(img);
            });
        }, 200);
    }
    
    /**
     * Finalize results and emit event for UI update
     */
    finalizeResults() {
        // Filter out anomalous entries
        this.timingData.paintDeltas = this.timingData.paintDeltas.filter(item => item.delta < 10000);
        
        // Remove duplicates
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
        
        // Emit results event for UI to handle
        this.emit('resultsReady', {
            imageSize: this.imageSize.value,
            imageType: this.imageType.value,
            navigationStartTime: window.navigationStartTime,
            loadTimes: this.timingData.imageLoadTimes,
            paintDeltas: this.timingData.paintDeltas,
            viewportDeltas: this.timingData.viewportDeltas
        });
    }
}