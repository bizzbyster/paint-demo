/**
 * Page metrics tracking module with navigation-aligned timing
 */
window.PageMetricsTracker = class PageMetricsTracker {
    constructor() {
        this.metrics = {
            navigationTiming: {},
            paintTiming: {},
            webVitals: {}
        };
        
        this.observers = [];
        
        // Track whether we've already disconnected the LCP observer
        this.lcpDisconnected = false;
    }
    
    /**
     * Initialize metrics collection
     */
    init() {
        // Capture existing timing data
        this.captureNavigationTiming();
        
        // Set up observers for ongoing metrics
        this.observePaintTiming();
        this.observeLargestContentfulPaint();
        this.observeLayoutShift();
        
        // Capture final metrics after the page load completes
        window.addEventListener('load', () => {
            setTimeout(() => {
                this.captureNavigationTiming();
                this.displayMetrics();
            }, 1000);
        });
        
        // Make sure to detect page visibility changes to finalize LCP
        this.setupVisibilityChangeListener();
    }
    
    /**
     * Set up listener for visibility change to properly finalize LCP
     */
    setupVisibilityChangeListener() {
        // This needs to be outside any other method to ensure it's only attached once
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
     * Observe Largest Contentful Paint (LCP)
     */
    observeLargestContentfulPaint() {
        if ('PerformanceObserver' in window) {
            try {
                const lcpObserver = new PerformanceObserver((entryList) => {
                    const entries = entryList.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    
                    // Skip entries with unusually large times (likely errors)
                    if (lastEntry.startTime > 30000) {
                        console.warn(`Unusually high LCP time detected (${lastEntry.startTime.toFixed(2)}ms), ignoring.`);
                        return;
                    }
                    
                    console.log(`LCP event at ${lastEntry.startTime}ms (relative to navigation start) for element ${lastEntry.element?.tagName}`);
                    console.log(`LCP details:`, {
                        element: lastEntry.element ? lastEntry.element.tagName : 'unknown',
                        id: lastEntry.element ? lastEntry.element.id : null,
                        className: lastEntry.element ? lastEntry.element.className : null,
                        size: lastEntry.size,
                        url: lastEntry.url,
                        loadTime: lastEntry.loadTime,
                        startTime: lastEntry.startTime,
                        renderTime: lastEntry.renderTime
                    });
                    
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
                    
                    this.displayMetrics();
                });
                
                lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
                this.observers.push(lcpObserver);
                
                // LCP is finalized when the page's lifecycle state changes to hidden
                // Note: This is now handled in setupVisibilityChangeListener()
            } catch (e) {
                console.warn('LCP observer not supported', e);
            }
        }
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
     * Display metrics in the UI with navigation-aligned timing
     */
    displayMetrics() {
        const metricsContainer = document.getElementById('page-metrics-content');
        if (!metricsContainer) return;
        
        let html = '<table><thead><tr><th>Metric</th><th>Value</th><th>Notes</th></tr></thead><tbody>';
        
        // Add navigation start reference
        const navStartTime = this.metrics.navigationTiming.navigationStart;
        if (navStartTime) {
            html += `
                <tr>
                    <td><strong>Navigation Start Reference</strong></td>
                    <td>${new Date(navStartTime).toISOString()}</td>
                    <td>All times are relative to this point</td>
                </tr>
            `;
        }
        
        // Web Vitals
        if (this.metrics.webVitals.fcp) {
            html += `
                <tr>
                    <td><strong>First Contentful Paint (FCP)</strong></td>
                    <td class="metric-${this.metrics.webVitals.fcp.rating}">${this.metrics.webVitals.fcp.value.toFixed(2)} ms</td>
                    <td>${this.getFCPDescription(this.metrics.webVitals.fcp.rating)}</td>
                </tr>
            `;
        }
        
        if (this.metrics.webVitals.lcp) {
            const lcp = this.metrics.webVitals.lcp;
            html += `
                <tr>
                    <td><strong>Largest Contentful Paint (LCP)</strong></td>
                    <td class="metric-${lcp.rating}">${lcp.value.toFixed(2)} ms</td>
                    <td>
                        Element: ${lcp.element}${lcp.elementId ? ', ID: ' + lcp.elementId : ''}${lcp.elementClass ? ', Class: ' + lcp.elementClass : ''}<br>
                        Size: ${lcp.size} pixels<br>
                        ${lcp.url ? 'URL: ' + lcp.url + '<br>' : ''}
                        ${lcp.loadTime ? 'Load Time: ' + lcp.loadTime.toFixed(2) + ' ms<br>' : ''}
                        ${lcp.renderTime ? 'Render Time: ' + lcp.renderTime.toFixed(2) + ' ms' : ''}
                    </td>
                </tr>
            `;
        }
        
        if (this.metrics.webVitals.cls) {
            html += `
                <tr>
                    <td><strong>Cumulative Layout Shift (CLS)</strong></td>
                    <td>${this.metrics.webVitals.cls.value.toFixed(4)}</td>
                    <td>Number of shifts: ${this.metrics.webVitals.cls.entries.length}</td>
                </tr>
            `;
        }
        
        // Navigation Timing
        const navTiming = this.metrics.navigationTiming;
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
        metricsContainer.innerHTML = html;
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
     * Get description for FCP rating
     */
    getFCPDescription(rating) {
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
};