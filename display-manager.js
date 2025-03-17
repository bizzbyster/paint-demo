/**
 * Unified Display Manager
 * Handles all UI updates from both metrics tracker and image loader
 */
class DisplayManager {
    constructor(metricsTracker, imageLoader) {
        this.metricsTracker = metricsTracker;
        this.imageLoader = imageLoader;
        
        // DOM elements
        this.resultsContainer = document.getElementById('results');
        this.deviceInfoEl = document.getElementById('device-info');
        this.viewportDimEl = document.getElementById('viewport-dimensions');
        this.elementPosEl = document.getElementById('element-positions');
        this.intersectionEventsEl = document.getElementById('intersection-events');
        
        // Last results for redisplay
        this.lastMetrics = null;
        this.lastImageResults = null;
        
        // Set up event listeners
        this.setupEventListeners();
    }
    
    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Update device info initially
        this.updateDeviceInfo();
        
        // Register for metrics tracker events
        if (this.metricsTracker) {
            this.metricsTracker.on('metricsUpdate', (data) => {
                this.lastMetrics = data;
                this.renderEnhancedMetricsDisplay(document.getElementById('page-metrics-content'), data);
            });
            
            this.metricsTracker.on('lcsUpdate', (data) => {
                // Re-render any current metrics with updated LCS data
                if (this.lastMetrics) {
                    this.lastMetrics.lcs = data;
                    this.renderEnhancedMetricsDisplay(document.getElementById('page-metrics-content'), this.lastMetrics);
                }
            });
        }
        
        // Register for image loader events
        if (this.imageLoader) {
            this.imageLoader.on('viewportUpdate', (debugInfo) => {
                this.updateViewportDebugPanel(debugInfo);
            });
            
            this.imageLoader.on('intersectionUpdate', (data) => {
                this.updateIntersectionDebugPanel(data);
            });
            
            this.imageLoader.on('resultsReady', (results) => {
                this.lastImageResults = results;
                this.displayImageResults(results);
            });
        }
        
        // Set up refresh debug button
        const refreshDebugButton = document.getElementById('refresh-debug');
        if (refreshDebugButton) {
            refreshDebugButton.addEventListener('click', () => {
                this.updateDeviceInfo();
                if (this.imageLoader) {
                    document.querySelectorAll('.product-image').forEach(img => {
                        this.imageLoader.checkViewportStatus(img);
                    });
                }
            });
        }
    }
    
    /**
     * Update device information display
     */
    updateDeviceInfo() {
        if (!this.deviceInfoEl) return;
        
        const userAgent = navigator.userAgent;
        const deviceType = /Mobile|Android|iPhone|iPad|iPod/.test(userAgent) ? 'Mobile' : 'Desktop';
        const browser = 
            /Edge/.test(userAgent) ? 'Edge' :
            /Firefox/.test(userAgent) ? 'Firefox' :
            /Chrome/.test(userAgent) ? 'Chrome' :
            /Safari/.test(userAgent) ? 'Safari' :
            'Unknown';
            
        // Check for Safari specifically
        const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
        
        // Check for LCP support
        const hasLCPSupport = (() => {
            if (!window.PerformanceObserver) return false;
            
            try {
                const testObserver = new PerformanceObserver(() => {});
                testObserver.observe({ type: 'largest-contentful-paint', buffered: true });
                testObserver.disconnect();
                return true;
            } catch (e) {
                return false;
            }
        })();
            
        this.deviceInfoEl.textContent = 
            `User Agent: ${userAgent.substring(0, 50)}...\n` +
            `Device Type: ${deviceType}\n` +
            `Browser: ${browser}\n` +
            `Safari Detected: ${isSafari}\n` +
            `Pixel Ratio: ${window.devicePixelRatio || 1}\n` +
            `Performance API Support: ${!!window.performance}\n` +
            `Performance Observer Support: ${!!window.PerformanceObserver}\n` +
            `LCP Support: ${hasLCPSupport ? 'Yes' : 'No'}\n`;
            
        // Update viewport dimensions
        if (this.viewportDimEl) {
            this.viewportDimEl.textContent = 
                `Window Inner: ${window.innerWidth}×${window.innerHeight}\n` +
                `Client Area: ${document.documentElement.clientWidth}×${document.documentElement.clientHeight}\n` +
                `Scroll Position: ${window.scrollX}, ${window.scrollY}\n` +
                `Document Size: ${document.documentElement.scrollWidth}×${document.documentElement.scrollHeight}`;
        }
    }
    
    /**
     * Update viewport debug panel
     */
    updateViewportDebugPanel(debugInfo) {
        if (!this.elementPosEl || !debugInfo) return;
        
        let currentText = this.elementPosEl.textContent;
        if (currentText === 'No elements tracked yet') {
            currentText = '';
        }
        
        // Keep only the last 3 entries
        const entries = currentText.split('\n\n').filter(entry => entry.trim() !== '');
        if (entries.length >= 3) {
            entries.shift(); // Remove oldest entry
        }
        
        // Add new entry with navigation-relative timing
        entries.push(
            `Image ${debugInfo.index} at ${debugInfo.timeMs}ms:\n` +
            `Position: top=${debugInfo.elementPosition.top}, bottom=${debugInfo.elementPosition.bottom}, ` +
            `left=${debugInfo.elementPosition.left || 0}, right=${debugInfo.elementPosition.right || 0}\n` +
            `Size: ${debugInfo.elementPosition.width}×${debugInfo.elementPosition.height}\n` +
            `In Viewport: ${debugInfo.isInViewport} (${debugInfo.visiblePercent}% visible)`
        );
        
        this.elementPosEl.textContent = entries.join('\n\n');
    }
    
    /**
     * Update intersection observer events debug panel
     */
    updateIntersectionDebugPanel(data) {
        if (!this.intersectionEventsEl) return;
        
        // Show the last 3 events with navigation-relative timestamps
        const recentEvents = data.logs;
        this.intersectionEventsEl.textContent = recentEvents.map(event => 
            `[${event.timeMs}ms] Image ${event.imageIndex}: ` +
            `${event.isIntersecting ? 'Entered' : 'Left'} viewport, ` +
            `Visible: ${event.visiblePercent}%`
        ).join('\n');
    }
    
    /**
     * Render enhanced metrics display
     */
    renderEnhancedMetricsDisplay(container, data) {
        if (!container) return;
        
        const { navTiming, webVitals, customLCP, lcs } = data;
        
        let html = '<table><thead><tr><th>Metric</th><th>Value</th><th>Notes</th></tr></thead><tbody>';
        
        // Add navigation start reference
        const navStartTime = navTiming.navigationStart;
        if (navStartTime) {
            html += `
                <tr>
                    <td><strong>Navigation Start Reference</strong></td>
                    <td>${new Date(navStartTime).toISOString()}</td>
                    <td>All times are relative to this point</td>
                </tr>
            `;
        }
        
        // --- FIRST SECTION: LCP METRICS COMPARISON ---
        if (webVitals.lcp || customLCP) {
            html += `
                <tr class="section-header">
                    <td colspan="3"><strong>LCP Measurements Comparison</strong></td>
                </tr>
            `;
            
            // Add native LCP (if available)
            if (webVitals.lcp) {
                const nativeLCP = webVitals.lcp;
                const lcpElement = `${nativeLCP.element}${nativeLCP.elementClass ? ', Class: ' + nativeLCP.elementClass : ''}${nativeLCP.elementId ? ', ID: ' + nativeLCP.elementId : ''}`;
                
                html += `
                    <tr>
                        <td><strong>Native LCP (Browser API)</strong></td>
                        <td class="metric-${nativeLCP.rating}">${nativeLCP.value.toFixed(2)} ms</td>
                        <td>
                            Element: ${lcpElement}<br>
                            Size: ${nativeLCP.size} pixels<br>
                            ${nativeLCP.url ? 'URL: ' + nativeLCP.url + '<br>' : ''}
                            ${nativeLCP.loadTime ? 'Load Time: ' + nativeLCP.loadTime.toFixed(2) + ' ms<br>' : ''}
                            ${nativeLCP.renderTime ? 'Render Time: ' + nativeLCP.renderTime.toFixed(2) + ' ms' : ''}
                            ${nativeLCP.method ? '<br>Detection method: ' + nativeLCP.method : ''}
                        </td>
                    </tr>
                `;
            }
            
            // Add custom LCP (if available)
            if (customLCP) {
                const lcpElement = `${customLCP.element}${customLCP.elementClass ? ', Class: ' + customLCP.elementClass : ''}${customLCP.elementId ? ', ID: ' + customLCP.elementId : ''}`;
                
                html += `
                    <tr>
                        <td><strong>Custom LCP Implementation</strong></td>
                        <td>${customLCP.value.toFixed(2)} ms</td>
                        <td>
                            Element: ${lcpElement}<br>
                            Size: ${customLCP.size} pixels<br>
                            ${customLCP.url ? 'URL: ' + customLCP.url + '<br>' : ''}
                            Method: ${customLCP.method}
                        </td>
                    </tr>
                `;
            }
            
            // If we have both, add comparison analysis
            if (webVitals.lcp && customLCP) {
                const difference = Math.abs(webVitals.lcp.value - customLCP.value);
                const differencePercent = ((difference / webVitals.lcp.value) * 100).toFixed(1);
                const isLargeDiscrepancy = difference > 500;
                const elementsDiffer = webVitals.lcp.element !== customLCP.element || 
                                       webVitals.lcp.elementClass !== customLCP.elementClass;
                
                let analysisHtml = `Difference: <strong>${difference.toFixed(2)} ms</strong> (${differencePercent}%)<br>`;
                
                // Add potential reasons for discrepancy
                if (isLargeDiscrepancy || elementsDiffer) {
                    analysisHtml += '<strong>Potential reasons for discrepancy:</strong><br>';
                    
                    if (elementsDiffer) {
                        analysisHtml += '- Different elements identified as LCP<br>';
                    }
                    
                    if (isLargeDiscrepancy) {
                        analysisHtml += '- Chrome\'s LCP detection includes additional paint events<br>';
                        analysisHtml += '- Browser may be using different timing approach<br>';
                        analysisHtml += '- Native LCP includes text rendering and image processing time<br>';
                    }
                }
                
                html += `
                    <tr>
                        <td><strong>LCP Discrepancy Analysis</strong></td>
                        <td>${difference.toFixed(2)} ms</td>
                        <td>${analysisHtml}</td>
                    </tr>
                `;
            }
        }
        
        // --- SECOND SECTION: LCS METRICS ---
        if (lcs && lcs.elements && lcs.elements.length > 0) {
            const elementSummary = lcs.elements.map(item => {
                const element = item.element;
                const elementInfo = this.formatElementInfo(element);
                return `${elementInfo} (${item.area} px, ${item.paintEvent.time.toFixed(0)}ms)`;
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
        
        // --- THIRD SECTION: OTHER WEB VITALS ---
        html += `
            <tr class="section-header">
                <td colspan="3"><strong>Other Web Vitals</strong></td>
            </tr>
        `;
        
        // FCP (if available)
        if (webVitals.fcp) {
            html += `
                <tr>
                    <td><strong>First Contentful Paint (FCP)</strong></td>
                    <td class="metric-${webVitals.fcp.rating}">${webVitals.fcp.value.toFixed(2)} ms</td>
                    <td>${this.getFCPDescription(webVitals.fcp.rating)}</td>
                </tr>
            `;
        }
        
        // CLS (if available)
        if (webVitals.cls) {
            html += `
                <tr>
                    <td><strong>Cumulative Layout Shift (CLS)</strong></td>
                    <td>${webVitals.cls.value.toFixed(4)}</td>
                    <td>Number of shifts: ${webVitals.cls.entries.length}</td>
                </tr>
            `;
        }
        
        // --- FOURTH SECTION: NAVIGATION TIMING ---
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
    getFCPDescription(rating) {
        switch(rating) {
            case 'good': return 'Good: Content appears quickly';
            case 'average': return 'Needs improvement: User might notice a delay';
            case 'poor': return 'Poor: User likely notices a significant delay';
            default: return '';
        }
    }
    
    /**
     * Format element information for display
     */
    formatElementInfo(element) {
        let info = element.tagName;
        
        if (element.id) {
            info += `#${element.id}`;
        }
        
        if (element.className) {
            const classStr = typeof element.className === 'string' 
                ? element.className 
                : (element.classList ? [...element.classList].join(' ') : '');
                
            if (classStr.trim()) {
                info += `.${classStr.split(' ').join('.')}`;
            }
        }
        
        // Add product image index if available
        if (element.dataset && element.dataset.index) {
            info += ` (Image ${parseInt(element.dataset.index) + 1})`;
        }
        
        return info;
    }
    
    /**
     * Display image loading results in HTML
     */
    displayImageResults(results) {
        if (!this.resultsContainer) return;
        
        // Create results HTML
        let resultsHTML = `
            <h2>Timing Results</h2>
            <p>Image size: <strong>${results.imageSize}</strong></p>
            <p>Loading type: <strong>${results.imageType}</strong></p>
            <p>Navigation start reference: <strong>${new Date(results.navigationStartTime).toISOString()}</strong></p>
        `;
        
        // Add load times table
        resultsHTML += `
            <h3>Image Load Times (relative to navigation start)</h3>
            <table>
                <thead>
                    <tr>
                        <th>Image</th>
                        <th>Load Time (ms)</th>
                        ${results.imageType === 'lowquality' ? '<th>Phase</th>' : ''}
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Sort by index and add rows
        const sortedLoadTimes = [...results.loadTimes].sort((a, b) => {
            if (results.imageType === 'lowquality') {
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
                    ${results.imageType === 'lowquality' ? `<td>${item.type}</td>` : ''}
                </tr>
            `;
        });
        
        resultsHTML += `
                </tbody>
            </table>
        `;
        
        // Add paint times table WITH viewport percentage
        if (results.paintDeltas.length > 0) {
            resultsHTML += `
                <h3>Image Paint Times (When visible on screen)</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Image</th>
                            <th>Resolution</th>
                            <th>Paint Time (ms)</th>
                            <th>Viewport Visibility %</th>
                            <th>Detection Method</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            // Sort by image index, then by type (low-res first)
            results.paintDeltas
                .sort((a, b) => {
                    if (a.imageIndex !== b.imageIndex) return a.imageIndex - b.imageIndex;
                    return (a.type === 'low-res' ? -1 : 1);
                })
                .forEach(item => {
                    // Find viewport entry for this image to get visibility percentage
                    const viewportEntry = results.viewportDeltas.find(
                        entry => entry.imageIndex === item.imageIndex
                    );
                    
                    const visibilityPercent = viewportEntry 
                        ? Math.round(viewportEntry.intersectionRatio * 100) 
                        : 0;
                    
                    resultsHTML += `
                        <tr>
                            <td>Product Image ${item.imageIndex + 1}</td>
                            <td>${item.type || 'standard'}</td>
                            <td>${item.paintTime.toFixed(2)}</td>
                            <td>${visibilityPercent}%</td>
                            <td>${item.method || 'API'}</td>
                        </tr>
                    `;
                });
            
            resultsHTML += `
                    </tbody>
                </table>
            `;
        }
        
        // Add load vs paint comparison if available
        if (results.paintDeltas.length > 0) {
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
            results.paintDeltas
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
                        const highResItem = results.loadTimes.find(
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
                    const viewportEntry = results.viewportDeltas.find(
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
        this.resultsContainer.innerHTML = resultsHTML;
    }
}