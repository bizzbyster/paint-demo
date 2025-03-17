/**
 * Unified Performance Metrics Tracker
 * Consolidates all metrics tracking functionality into a single, cohesive module
 */
class PerformanceMetricsTracker {
    constructor() {
        this.metrics = {
            navigationTiming: {},
            paintTiming: {},
            webVitals: {}
        };
        
        // Track custom metrics like LCS
        this.customMetrics = {
            customLCP: null,
            lcs: {
                elements: [],
                threshold: 0.8,
                lastPaintTime: 0
            }
        };
        
        this.observers = [];
        this.paintEvents = [];
        this.lcpDisconnected = false;
        this.callbacks = {};
    }
    
    /**
     * Initialize metrics collection
     */
    init() {
        // Store navigation start time
        window.navigationStartTime = this.getNavigationStartTime();
        
        // Initialize cross-browser timing system
        this.initCrossBrowserTiming();
        
        // Capture existing timing data
        this.captureNavigationTiming();
        
        // Set up observers for ongoing metrics
        this.observePaintTiming();
        this.observeLargestContentfulPaint();
        this.observeLayoutShift();
        
        // Set up Element Timing API if available
        this.setupElementTimingObserver();
        
        // Capture final metrics after page load
        window.addEventListener('load', () => {
            setTimeout(() => {
                this.captureNavigationTiming();
                this.displayMetrics();
            }, 1000);
        });
        
        // Visibility change listener for finalizing LCP
        this.setupVisibilityChangeListener();
        
        // Initialize LCS tracking
        this.initLargeContentfulSetTracking();
    }
    
    /**
     * Initialize a cross-browser compatible timing system
     * This should be added to your metrics-tracker.js
     */
    initCrossBrowserTiming() {
        // Graceful feature detection
        const hasPerformanceObserver = typeof PerformanceObserver === 'function';
        const hasElementTiming = hasPerformanceObserver && (() => {
            try {
                const test = new PerformanceObserver(() => {});
                test.observe({entryTypes: ['element']});
                test.disconnect();
                return true;
            } catch (e) {
                return false;
            }
        })();
        
        console.log(`Browser timing capabilities: PerformanceObserver: ${hasPerformanceObserver}, ElementTiming: ${hasElementTiming}`);
        
        // Create a timestamp relative to navigation
        this.getRelativeTimestamp = () => {
            return performance.now();
        };
        
        // Create a unified timing system
        this.unifiedTimingSystem = {
            // Record all timing events in one place
            events: [],
            
            // Record a timing event
            record: (type, detail, timestamp = this.getRelativeTimestamp()) => {
                const event = {
                    type,
                    detail,
                    timestamp
                };
                
                this.unifiedTimingSystem.events.push(event);
                return event;
            },
            
            // Calculate time between two event types
            calculateDelta: (startType, endType) => {
                const startEvent = this.unifiedTimingSystem.events.find(e => e.type === startType);
                const endEvent = this.unifiedTimingSystem.events.find(e => e.type === endType);
                
                if (startEvent && endEvent) {
                    return endEvent.timestamp - startEvent.timestamp;
                }
                return null;
            }
        };
        
        // Set up Safari-compatible image load to paint monitoring
        if (!hasElementTiming) {
            this.monitorImagePaint = (img, metadata = {}) => {
                // First detect load
                const onLoad = () => {
                    const loadTime = this.getRelativeTimestamp();
                    this.unifiedTimingSystem.record('image-load', {
                        element: img,
                        size: img.width * img.height,
                        src: img.src,
                        ...metadata
                    }, loadTime);
                    
                    // Then detect paint using double rAF technique
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            const paintTime = this.getRelativeTimestamp();
                            this.unifiedTimingSystem.record('image-paint', {
                                element: img,
                                size: img.width * img.height,
                                src: img.src,
                                loadTime,
                                delta: paintTime - loadTime,
                                ...metadata
                            }, paintTime);
                            
                            // Update LCP/LCS as needed
                            this.checkForLargestElement();
                        });
                    });
                    
                    img.removeEventListener('load', onLoad);
                };
                
                if (img.complete) {
                    onLoad();
                } else {
                    img.addEventListener('load', onLoad);
                }
            };
            
            // Apply to all product images
            document.querySelectorAll('.product-image').forEach(img => {
                this.monitorImagePaint(img, {source: 'safari-compatible-monitor'});
            });
        }
        
        return this.unifiedTimingSystem;
    }
    
    /**
     * Get navigation start time
     */
    getNavigationStartTime() {
        if (performance.timeOrigin) {
            return performance.timeOrigin;
        } else if (performance.timing && performance.timing.navigationStart) {
            return performance.timing.navigationStart;
        }
        return Date.now() - 100;
    }
    
    /**
     * Get current time relative to navigation start
     */
    getRelativeTime() {
        return performance.now();
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
     * Set up listener for visibility change to properly finalize LCP
     */
    setupVisibilityChangeListener() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden' && !this.lcpDisconnected) {
                console.log('Page hidden, finalizing LCP measurement');
                this.lcpDisconnected = true;
                
                // Give a small delay to finalize LCP before displaying
                setTimeout(() => this.displayMetrics(), 100);
            }
        });
    }
    
    /**
     * Reset all observers and metrics for a fresh start
     */
    reset() {
        // Disconnect all observers
        this.disconnect();
        
        // Clear metrics object
        this.metrics = {
            navigationTiming: {},
            paintTiming: {},
            webVitals: {}
        };
        
        // Reset custom metrics
        this.customMetrics = {
            customLCP: null,
            lcs: {
                elements: [],
                threshold: 0.8,
                lastPaintTime: 0
            }
        };
        
        // Reset LCP disconnected flag
        this.lcpDisconnected = false;
        
        // Try to clear performance entries
        this.clearPerformanceEntries();
        
        // Reinitialize observers
        this.init();
        
        console.log('Performance metrics reset and observers reinitialized');
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
    }
    
    /**
     * Capture metrics from Navigation Timing API
     */
    captureNavigationTiming() {
        if (window.performance && window.performance.getEntriesByType) {
            // Modern Navigation Timing API
            const navEntry = performance.getEntriesByType('navigation')[0];
            if (navEntry) {
                this.metrics.navigationTiming = {
                    // Store actual epoch timestamps for each event
                    navigationStart: window.navigationStartTime,
                    // Event timings relative to navigation start
                    domInteractive: navEntry.domInteractive,
                    domContentLoaded: navEntry.domContentLoadedEventEnd,
                    domComplete: navEntry.domComplete,
                    loadEvent: navEntry.loadEventEnd
                };
            }
        } else if (window.performance && window.performance.timing) {
            // Legacy Navigation Timing API
            const timing = window.performance.timing;
            const navigationStart = timing.navigationStart;
            
            this.metrics.navigationTiming = {
                navigationStart: navigationStart,
                domInteractive: timing.domInteractive - navigationStart,
                domContentLoaded: timing.domContentLoadedEventEnd - navigationStart,
                domComplete: timing.domComplete - navigationStart,
                loadEvent: timing.loadEventEnd - navigationStart
            };
        }
    }
    
    /**
     * Observe paint timing events (FP, FCP)
     */
    observePaintTiming() {
        if ('PerformanceObserver' in window) {
            try {
                const paintObserver = new PerformanceObserver((entryList) => {
                    for (const entry of entryList.getEntries()) {
                        console.log(`Paint event: ${entry.name} at ${entry.startTime}ms (relative to navigation start)`);
                        
                        // Store paint timing data - already relative to navigation start
                        this.metrics.paintTiming[entry.name] = entry.startTime;
                        
                        // If this is FCP, check performance level
                        if (entry.name === 'first-contentful-paint') {
                            this.metrics.webVitals.fcp = {
                                value: entry.startTime,
                                rating: this.getRating(entry.startTime, CONFIG.performance.fcp)
                            };
                        }
                        
                        this.displayMetrics();
                    }
                });
                
                paintObserver.observe({ entryTypes: ['paint'] });
                this.observers.push(paintObserver);
            } catch (e) {
                console.warn('Paint timing observer not supported', e);
            }
        }
    }
    
    /**
     * Observe Element Timing API
     */
    setupElementTimingObserver() {
        if ('PerformanceObserver' in window) {
            try {
                const elementObserver = new PerformanceObserver((entryList) => {
                    for (const entry of entryList.getEntries()) {
                        // Process element timing entries
                        if (entry.identifier && entry.identifier.startsWith('product-image-')) {
                            this.recordPaintEvent({
                                element: entry.element,
                                time: entry.renderTime || entry.startTime,
                                type: 'element-timing-api',
                                identifier: entry.identifier
                            });
                        }
                    }
                });
                
                elementObserver.observe({ entryTypes: ['element'] });
                this.observers.push(elementObserver);
            } catch (e) {
                console.warn('Element timing observer not supported', e);
            }
        }
    }
    
    /**
     * Observe Largest Contentful Paint (LCP)
     */
    observeLargestContentfulPaint() {
        if ('PerformanceObserver' in window) {
            try {
                // Try the standard approach for Chrome/Firefox
                const lcpObserver = new PerformanceObserver((entryList) => {
                    const entries = entryList.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    
                    if (!lastEntry) return;
                    
                    // Skip entries with unusually large times (likely errors)
                    if (lastEntry.startTime > 30000) {
                        console.warn(`Unusually high LCP time detected (${lastEntry.startTime.toFixed(2)}ms), ignoring.`);
                        return;
                    }
                    
                    console.log(`LCP event at ${lastEntry.startTime}ms (relative to navigation start) for element ${lastEntry.element?.tagName}`);
                    
                    // LCP times are already relative to navigation start
                    this.metrics.webVitals.lcp = {
                        value: lastEntry.startTime,
                        element: lastEntry.element ? lastEntry.element.tagName : 'unknown',
                        elementId: lastEntry.element ? lastEntry.element.id : null,
                        elementClass: lastEntry.element ? lastEntry.element.className : null,
                        size: lastEntry.size,
                        url: lastEntry.url,
                        loadTime: lastEntry.loadTime,
                        renderTime: lastEntry.renderTime,
                        rating: this.getRating(lastEntry.startTime, CONFIG.performance.lcp)
                    };
                    
                    // If the element is available, record it for LCS tracking
                    if (lastEntry.element) {
                        this.recordPaintEvent({
                            element: lastEntry.element,
                            time: lastEntry.startTime,
                            type: 'native-lcp',
                            size: lastEntry.size
                        });
                    }
                    
                    this.displayMetrics();
                });
                
                // Use the recommended buffered flag for more reliable detection
                try {
                    lcpObserver.observe({ 
                        type: 'largest-contentful-paint', 
                        buffered: true 
                    });
                    this.observers.push(lcpObserver);
                } catch (err) {
                    // Fallback to older syntax for Safari
                    console.log('Using fallback LCP observer approach');
                    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
                    this.observers.push(lcpObserver);
                }
                
                // For Safari, add a fallback approach
                const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
                if (isSafari) {
                    console.log('Safari detected, adding fallback LCP detection mechanism');
                    this.initLCPFallback();
                }
            } catch (e) {
                console.warn('LCP observer not supported, using fallback', e);
                // Add fallback for Safari or other browsers without LCP support
                this.initLCPFallback();
            }
        } else {
            console.warn('PerformanceObserver not supported, using fallback');
            this.initLCPFallback();
        }
    }
    
    /**
     * Initialize fallback mechanisms for LCP in Safari or other browsers
     * that don't support the standard API
     */
    initLCPFallback() {
        console.log('Initializing LCP fallback detection');
        
        // Check for largest element once DOM is interactive
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(() => this.checkForLargestElement(), 500);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => this.checkForLargestElement(), 500);
            });
        }
        
        // Check again after images have loaded
        window.addEventListener('load', () => {
            setTimeout(() => this.checkForLargestElement(), 1000);
        });
        
        // Listen for image loads to update LCP
        document.addEventListener('load', (event) => {
            if (event.target.tagName === 'IMG') {
                setTimeout(() => this.checkForLargestElement(), 100);
            }
        }, true);
        
        // Set up a periodic check to catch late-loading content
        let checkCount = 0;
        const maxChecks = 5;
        const checkInterval = setInterval(() => {
            this.checkForLargestElement();
            checkCount++;
            
            if (checkCount >= maxChecks) {
                clearInterval(checkInterval);
            }
        }, 1000);
    }
    
    /**
     * Check for the largest element - used for LCP fallback
     */
    checkForLargestElement() {
        // Check large visible elements - common LCP candidates
        const candidates = [
            ...Array.from(document.querySelectorAll('img')),
            ...Array.from(document.querySelectorAll('.product-image')),
            ...Array.from(document.querySelectorAll('h1')),
            ...Array.from(document.querySelectorAll('video')),
            ...Array.from(document.querySelectorAll('.product-item')),
        ];
        
        let largestElement = null;
        let largestSize = 0;
        
        candidates.forEach(el => {
            if (!el.isConnected) return;
            
            // Get element dimensions
            const rect = el.getBoundingClientRect();
            let area = rect.width * rect.height;
            let effectiveElement = el;
            
            // Check if the element contains an image and use it instead
            const largestImage = this.findLargestImageWithin(el);
            if (largestImage) {
                effectiveElement = largestImage;
                const imageRect = largestImage.getBoundingClientRect();
                area = imageRect.width * imageRect.height;
            }
            
            // Check if it's in viewport
            const isInViewport = this.isElementInViewport(rect);
            
            // For images, only consider if they're loaded
            if (effectiveElement.tagName === 'IMG' && (!effectiveElement.complete || !effectiveElement.naturalWidth)) {
                return;
            }
            
            // Only track elements that are in viewport and visible
            if (isInViewport && area > largestSize) {
                largestSize = area;
                largestElement = effectiveElement;
                
                // Record as potential LCP if not already set
                if (!this.metrics.webVitals.lcp || this.metrics.webVitals.lcp.element === 'unknown') {
                    const now = performance.now();
                    this.metrics.webVitals.lcp = {
                        value: now,
                        element: effectiveElement.tagName,
                        elementId: effectiveElement.id,
                        elementClass: effectiveElement.className,
                        size: area,
                        renderTime: now,
                        rating: this.getRating(now, CONFIG.performance.lcp),
                        method: 'fallback'
                    };
                    
                    // Also record for LCS tracking
                    this.recordPaintEvent({
                        element: effectiveElement,
                        time: now,
                        type: 'lcp-fallback',
                        size: area
                    });
                    
                    console.log('Fallback LCP detected:', this.metrics.webVitals.lcp);
                    this.displayMetrics();
                }
            }
        });
    }
    
    /**
     * Check if element is in viewport
     */
    isElementInViewport(rect) {
        return (
            rect.top < window.innerHeight &&
            rect.bottom > 0 &&
            rect.left < window.innerWidth &&
            rect.right > 0
        );
    }
    
    /**
     * Find the largest image within an element
     */
    findLargestImageWithin(element) {
        if (element.tagName === 'IMG') {
            return element;
        }
        
        const images = element.querySelectorAll('img');
        let largestImage = null;
        let largestArea = 0;
        
        images.forEach(img => {
            const area = img.offsetWidth * img.offsetHeight;
            if (area > largestArea) {
                largestArea = area;
                largestImage = img;
            }
        });
        
        return largestImage;
    }
    
    /**
     * Observe Cumulative Layout Shift (CLS)
     */
    observeLayoutShift() {
        if ('PerformanceObserver' in window) {
            try {
                let clsValue = 0;
                let clsEntries = [];
                
                const clsObserver = new PerformanceObserver((entryList) => {
                    for (const entry of entryList.getEntries()) {
                        // Only count layout shifts without recent user input
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value;
                            clsEntries.push(entry);
                        }
                    }
                    
                    this.metrics.webVitals.cls = {
                        value: clsValue,
                        entries: clsEntries
                    };
                    
                    this.displayMetrics();
                });
                
                clsObserver.observe({ entryTypes: ['layout-shift'] });
                this.observers.push(clsObserver);
            } catch (e) {
                console.warn('CLS observer not supported', e);
            }
        }
    }
    
    /**
     * Initialize Large Contentful Set (LCS) tracking
     */
    initLargeContentfulSetTracking() {
        // Set up tracking for product images specifically
        document.addEventListener('DOMContentLoaded', () => {
            this.monitorProductImages();
            this.scanForLargeElements();
        });
        
        // Check again after window load
        window.addEventListener('load', () => {
            setTimeout(() => {
                this.monitorProductImages();
                this.scanForLargeElements();
                
                // Final check for large elements
                setTimeout(() => {
                    this.scanForLargeElements();
                    this.filterLargeElements();
                    this.displayMetrics();
                }, 1000);
            }, 200);
        });
    }
    
    /**
     * Monitor all product images specifically
     */
    monitorProductImages() {
        const productImages = document.querySelectorAll('.product-image');
        
        productImages.forEach(img => {
            // Skip if already monitored
            if (img.dataset.monitored) return;
            img.dataset.monitored = 'true';
            
            // Function to check image rendering
            const checkImageRender = () => {
                if (img.complete && img.naturalWidth > 0) {
                    this.recordPaintEvent({
                        element: img,
                        time: performance.now(),
                        type: 'product-image-monitor',
                        metadata: {
                            naturalSize: `${img.naturalWidth}x${img.naturalHeight}`,
                            displaySize: `${img.width}x${img.height}`
                        }
                    });
                } else {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(checkImageRender);
                    });
                }
            };
            
            // Start monitoring
            if (img.complete) {
                checkImageRender();
            } else {
                img.addEventListener('load', () => {
                    // Record load event
                    this.recordPaintEvent({
                        element: img,
                        time: performance.now(),
                        type: 'image-load',
                        event: 'load'
                    });
                    
                    // Start monitoring rendering
                    checkImageRender();
                });
            }
        });
    }
    
    /**
     * Scan for large elements in the page
     */
    scanForLargeElements() {
        // Check for images first (most likely to be LCP)
        const images = document.querySelectorAll('img');
        images.forEach(img => this.trackElementPaint(img, { source: 'image-scan' }));
        
        // Then check headings and other potential large elements
        const headings = document.querySelectorAll('h1, h2');
        headings.forEach(heading => this.trackElementPaint(heading, { source: 'heading-scan' }));
        
        // Check product containers
        const containers = document.querySelectorAll('.product-item');
        containers.forEach(container => this.trackElementPaint(container, { source: 'container-scan' }));
    }
    
    /**
     * Track element paint
     */
    trackElementPaint(element, metadata = {}) {
        if (!element || !element.isConnected) return;
        
        // Don't process if element is not visible
        if (!this.isElementInViewport(element.getBoundingClientRect())) return;
        
        // Record the paint event
        this.recordPaintEvent({
            element: element,
            time: performance.now(),
            type: 'paint-tracking',
            metadata: metadata
        });
    }
    
    /**
     * Record a paint event and update metrics
     */
    recordPaintEvent(eventData) {
        const { element, time, type, metadata = {} } = eventData;
        
        // Get element measurements
        const rect = element.getBoundingClientRect();
        const area = rect.width * rect.height;
        
        // Create paint event object
        const paintEvent = {
            time,
            type,
            element: element.tagName,
            elementClass: element.className,
            elementId: element.id || null,
            area,
            index: element.dataset?.index,
            isProductImage: element.classList?.contains('product-image'),
            ...metadata
        };
        
        // Store the paint event
        this.paintEvents.push(paintEvent);
        
        // Log the event
        console.log(`[${time.toFixed(2)}ms] ${type} - ${element.tagName}${element.className ? '.' + element.className.replace(/\s+/g, '.') : ''} (${area} pixels)`);
        
        // Update custom LCP tracking
        this.updateCustomLCP(element, paintEvent);
        
        // Update Large Contentful Set
        this.updateLCS(element, paintEvent);
        
        // Emit event for UI updates
        this.emit('paintEvent', paintEvent);
    }
    
    /**
     * Update custom LCP metric
     */
    updateCustomLCP(element, paintEvent) {
        const area = paintEvent.area;
        
        // Check if this is larger than current largest
        if (!this.customMetrics.customLCP || area > this.customMetrics.customLCP.size) {
            // Create new custom LCP metric
            this.customMetrics.customLCP = {
                value: paintEvent.time,
                element: element.tagName,
                elementId: element.id || null,
                elementClass: element.className || null,
                size: area,
                url: element.tagName === 'IMG' ? element.src : null,
                renderTime: paintEvent.time,
                method: 'custom-implementation',
                paintEvent: paintEvent
            };
            
            console.log(`New Custom LCP: ${element.tagName} (${area} pixels) at ${paintEvent.time.toFixed(2)}ms`);
        }
    }
    
    /**
     * Update Large Contentful Set (LCS)
     */
    updateLCS(element, paintEvent) {
        let area = paintEvent.area;
        let effectiveElement = element;
        
        // Check if the element contains an image and use it instead
        const largestImage = this.findLargestImageWithin(element);
        if (largestImage) {
            effectiveElement = largestImage;
            area = largestImage.offsetWidth * largestImage.offsetHeight;
        }
        
        // If no elements or empty set, initialize with this element
        if (this.customMetrics.lcs.elements.length === 0) {
            this.customMetrics.lcs.elements.push({
                element: effectiveElement,
                paintEvent: paintEvent,
                area: area
            });
            this.customMetrics.lcs.lastPaintTime = paintEvent.time;
            return;
        }
        
        // Get current largest element area
        const largestArea = Math.max(...this.customMetrics.lcs.elements.map(item => item.area));
        
        // Calculate threshold area based on largest element
        const thresholdArea = largestArea * this.customMetrics.lcs.threshold;
        
        // Check if this element is large enough to be included in the set
        if (area >= thresholdArea) {
            // Check if this element is already in the set
            const existingIndex = this.customMetrics.lcs.elements.findIndex(item => 
                item.element === effectiveElement
            );
            
            if (existingIndex >= 0) {
                // Update existing element data
                this.customMetrics.lcs.elements[existingIndex] = {
                    element: effectiveElement,
                    paintEvent: paintEvent,
                    area: area
                };
            } else {
                // Add new element to set
                this.customMetrics.lcs.elements.push({
                    element: effectiveElement,
                    paintEvent: paintEvent,
                    area: area
                });
            }
            
            // Update the last paint time if this is later
            if (paintEvent.time > this.customMetrics.lcs.lastPaintTime) {
                this.customMetrics.lcs.lastPaintTime = paintEvent.time;
            }
            
            console.log(`Updated LCS: Now ${this.customMetrics.lcs.elements.length} elements, last paint at ${this.customMetrics.lcs.lastPaintTime.toFixed(2)}ms`);
        }
        
        // If this is a larger element, we need to recalculate the set
        if (area > largestArea) {
            // Recalculate threshold based on new largest
            const newThreshold = area * this.customMetrics.lcs.threshold;
            
            // Filter out elements that no longer meet the threshold
            this.customMetrics.lcs.elements = this.customMetrics.lcs.elements.filter(item => 
                item.area >= newThreshold
            );
            
            // Recalculate last paint time
            if (this.customMetrics.lcs.elements.length > 0) {
                this.customMetrics.lcs.lastPaintTime = Math.max(
                    ...this.customMetrics.lcs.elements.map(item => item.paintEvent.time)
                );
            }
        }
        
        // Emit event for UI updates
        this.emit('lcsUpdate', this.customMetrics.lcs);
    }
    
    /**
     * Filter large elements to prioritize content over containers
     */
    filterLargeElements() {
        // If we have an LCS with DIVs, check if we should filter them
        if (this.customMetrics.lcs.elements.length > 0) {
            // Check if the largest element is a DIV and there are also images
            const hasDivs = this.customMetrics.lcs.elements.some(item => item.element.tagName === 'DIV');
            const hasImages = this.customMetrics.lcs.elements.some(item => item.element.tagName === 'IMG');
            
            // If we have both, and DIVs are dominating, try to filter them out
            if (hasDivs && hasImages) {
                // Find all images elements
                const imageElements = this.customMetrics.lcs.elements.filter(item => 
                    item.element.tagName === 'IMG'
                );
                
                // If we have image elements, consider using only those
                if (imageElements.length > 0) {
                    // Calculate the largest image size
                    const largestImageArea = Math.max(...imageElements.map(item => item.area));
                    
                    // Only keep DIVs that are significantly larger than images
                    this.customMetrics.lcs.elements = this.customMetrics.lcs.elements.filter(item => 
                        item.element.tagName === 'IMG' || 
                        item.area > largestImageArea * 1.5
                    );
                    
                    // Recalculate last paint time if needed
                    if (this.customMetrics.lcs.elements.length > 0) {
                        this.customMetrics.lcs.lastPaintTime = Math.max(
                            ...this.customMetrics.lcs.elements.map(item => item.paintEvent.time)
                        );
                    }
                    
                    console.log('Filtered LCS to prioritize images over container DIVs');
                }
            }
        }
        
        // Emit updated LCS data
        this.emit('lcsUpdate', this.customMetrics.lcs);
    }
    
    /**
     * Get performance rating based on threshold values
     */
    getRating(value, thresholds) {
        if (value <= thresholds.good) return 'good';
        if (value <= thresholds.poor) return 'average';
        return 'poor';
    }
    
    /**
     * Generate element information for display
     */
    formatElementInfo(element) {
        let info = element.tagName;
        
        if (element.id) {
            info += `#${element.id}`;
        }
        
        if (element.className) {
            info += `.${element.className.split(' ').join('.')}`;
        }
        
        if (element.src) {
            info += ` (src: ${element.src.split('/').pop()})`;
        }
        
        return info;
    }
    
    /**
     * Display metrics in the UI with navigation-aligned timing
     */
    displayMetrics() {
        const metricsContainer = document.getElementById('page-metrics-content');
        if (!metricsContainer) return;
        
        // Get enhanced data
        const enhancedData = {
            navTiming: this.metrics.navigationTiming || {},
            paintTiming: this.metrics.paintTiming || {},
            webVitals: this.metrics.webVitals || {},
            
            // Custom metrics
            customLCP: this.customMetrics.customLCP,
            lcs: this.customMetrics.lcs
        };
        
        // Emit event for UI to handle rendering
        this.emit('metricsUpdate', enhancedData);
        
        // Default rendering if no listeners
        if (!this.callbacks['metricsUpdate'] || this.callbacks['metricsUpdate'].length === 0) {
            this._renderDefaultMetricsDisplay(metricsContainer, enhancedData);
        }
    }
    
    /**
     * Default rendering implementation for metrics display
     */
    _renderDefaultMetricsDisplay(container, data) {
        const { navTiming, webVitals, customLCP, lcs } = data;
        
        let html = '<table><thead><tr><th>Metric</th><th>Value</th><th>Notes</th></tr></thead><tbody>';
        
        // Navigation Start Reference
        if (navTiming.navigationStart) {
            html += `
                <tr>
                    <td><strong>Navigation Start Reference</strong></td>
                    <td>${new Date(navTiming.navigationStart).toISOString()}</td>
                    <td>All times are relative to this point</td>
                </tr>
            `;
        }
        
        // LCP Section
        if (webVitals.lcp || customLCP) {
            html += `
                <tr class="section-header">
                    <td colspan="3"><strong>LCP Measurements</strong></td>
                </tr>
            `;
            
            // Native LCP
            if (webVitals.lcp) {
                const nativeLCP = webVitals.lcp;
                html += `
                    <tr>
                        <td><strong>Native LCP (Browser API)</strong></td>
                        <td class="metric-${nativeLCP.rating}">${nativeLCP.value.toFixed(2)} ms</td>
                        <td>
                            Element: ${nativeLCP.element}${nativeLCP.elementClass ? ', Class: ' + nativeLCP.elementClass : ''}${nativeLCP.elementId ? ', ID: ' + nativeLCP.elementId : ''}<br>
                            Size: ${nativeLCP.size} pixels<br>
                            ${nativeLCP.url ? 'URL: ' + nativeLCP.url + '<br>' : ''}
                            ${nativeLCP.method ? 'Method: ' + nativeLCP.method : ''}
                        </td>
                    </tr>
                `;
            }
            
            // Custom LCP
            if (customLCP) {
                html += `
                    <tr>
                        <td><strong>Custom LCP Implementation</strong></td>
                        <td>${customLCP.value.toFixed(2)} ms</td>
                        <td>
                            Element: ${customLCP.element}${customLCP.elementClass ? ', Class: ' + customLCP.elementClass : ''}${customLCP.elementId ? ', ID: ' + customLCP.elementId : ''}<br>
                            Size: ${customLCP.size} pixels<br>
                            Method: ${customLCP.method}
                        </td>
                    </tr>
                `;
            }
        }
        
        // Large Contentful Set
        if (lcs && lcs.elements && lcs.elements.length > 0) {
            const elementSummary = lcs.elements.map(item => {
                return `${this.formatElementInfo(item.element)} (${item.area} px, ${item.paintEvent.time.toFixed(0)}ms)`;
            }).join(', ');
            
            html += `
                <tr class="section-header">
                    <td colspan="3"><strong>Large Contentful Set (LCS) Metrics</strong></td>
                </tr>
                <tr>
                    <td><strong>LCS Completion Time</strong></td>
                    <td>${lcs.lastPaintTime.toFixed(2)} ms</td>
                    <td>
                        Set of ${lcs.elements.length} large elements<br>
                        Threshold: ${Math.round(lcs.threshold * 100)}% of largest<br>
                        Elements: ${elementSummary}
                    </td>
                </tr>
            `;
        }
        
        // Other Web Vitals
        html += `
            <tr class="section-header">
                <td colspan="3"><strong>Other Web Vitals</strong></td>
            </tr>
        `;
        
        // FCP
        if (webVitals.fcp) {
            html += `
                <tr>
                    <td><strong>First Contentful Paint (FCP)</strong></td>
                    <td class="metric-${webVitals.fcp.rating}">${webVitals.fcp.value.toFixed(2)} ms</td>
                    <td>${this._getFCPDescription(webVitals.fcp.rating)}</td>
                </tr>
            `;
        }
        
        // CLS
        if (webVitals.cls) {
            html += `
                <tr>
                    <td><strong>Cumulative Layout Shift (CLS)</strong></td>
                    <td>${webVitals.cls.value.toFixed(4)}</td>
                    <td>Number of shifts: ${webVitals.cls.entries.length}</td>
                </tr>
            `;
        }
        
        // Navigation Timing
        html += `
            <tr class="section-header">
                <td colspan="3"><strong>Navigation Timing</strong></td>
            </tr>
        `;
        
        if (Object.keys(navTiming).length > 0) {
            html += `
                <tr>
                    <td><strong>DOM Interactive</strong></td>
                    <td>${navTiming.domInteractive?.toFixed(2) || 'N/A'} ms</td>
                    <td>DOM is ready for user interaction</td>
                </tr>
                <tr>
                    <td><strong>DOM Content Loaded</strong></td>
                    <td>${navTiming.domContentLoaded?.toFixed(2) || 'N/A'} ms</td>
                    <td>Initial HTML document loaded and parsed</td>
                </tr>
                <tr>
                    <td><strong>DOM Complete</strong></td>
                    <td>${navTiming.domComplete?.toFixed(2) || 'N/A'} ms</td>
                    <td>Page and all assets fully loaded</td>
                </tr>
            `;
        }
        
        html += '</tbody></table>';
        
        // Update the container
        container.innerHTML = html;
    }
    
    /**
     * Get description for FCP rating
     */
    _getFCPDescription(rating) {
        switch(rating) {
            case 'good': return 'Good: Content appears quickly';
            case 'average': return 'Needs improvement: User might notice a delay';
            case 'poor': return 'Poor: User likely notices a significant delay';
            default: return '';
        }
    }
    
    /**
     * Clean up observers
     */
    disconnect() {
        this.observers.forEach(observer => {
            if (observer && typeof observer.disconnect === 'function') {
                observer.disconnect();
            }
        });
        this.observers = [];
    }
}