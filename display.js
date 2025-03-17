/**
 * Display script to handle UI updates from ImageLoader
 * This separates the display logic from the core image loading functionality
 * Includes LCS (Large Contentful Set) metric display
 */
window.DisplayManager = class DisplayManager {
    constructor(imageLoader) {
        this.imageLoader = imageLoader;
        this.resultsContainer = document.getElementById('results');
        this.deviceInfoEl = document.getElementById('device-info');
        this.viewportDimEl = document.getElementById('viewport-dimensions');
        this.elementPosEl = document.getElementById('element-positions');
        this.intersectionEventsEl = document.getElementById('intersection-events');
        
        // LCS tracking
        this.lcsData = {
            elements: [],
            threshold: 0.8, // Elements within 80% of largest are included
            lastPaintTime: 0
        };
        
        // Store last results for potential redisplay
        this._lastResults = null;
        
        // Set up event listeners for imageLoader
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Device info update
        this.updateDeviceInfo();
        
        // Listen for viewport updates
        this.imageLoader.events.on('viewportUpdate', (debugInfo) => {
            this.updateViewportDebugPanel(debugInfo);
        });
        
        // Listen for intersection updates
        this.imageLoader.events.on('intersectionUpdate', (data) => {
            this.updateIntersectionDebugPanel(data);
        });
        
        // Listen for results ready
        this.imageLoader.events.on('resultsReady', (results) => {
            this.displayResults(results);
        });
        
        // Set up refresh debug button
        const refreshDebugButton = document.getElementById('refresh-debug');
        if (refreshDebugButton) {
            refreshDebugButton.addEventListener('click', () => {
                document.querySelectorAll('.product-image').forEach(img => {
                    this.imageLoader.checkInitialViewportStatus(img);
                });
                this.updateDeviceInfo();
            });
        }
        
        // Listen for LCS updates
        window.addEventListener('lcs-update', (event) => {
            if (event.detail) {
                this.lcsData = event.detail;
                if (this._lastResults) {
                    this.displayResults(this._lastResults);
                }
            }
        });
    }
    
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
            
        this.deviceInfoEl.textContent = 
            `User Agent: ${userAgent.substring(0, 50)}...\n` +
            `Device Type: ${deviceType}\n` +
            `Browser: ${browser}\n` +
            `Safari Detected: ${isSafari}\n` +
            `Pixel Ratio: ${window.devicePixelRatio || 1}\n` +
            `Performance API Support: ${!!window.performance}\n` +
            `Performance Observer Support: ${!!window.PerformanceObserver}\n` +
            `LCP Support: ${this.imageLoader.checkLCPSupport() ? 'Yes' : 'No'}\n`;
            
        // Update viewport dimensions
        if (this.viewportDimEl) {
            this.viewportDimEl.textContent = 
                `Window Inner: ${window.innerWidth}×${window.innerHeight}\n` +
                `Client Area: ${document.documentElement.clientWidth}×${document.documentElement.clientHeight}\n` +
                `Scroll Position: ${window.scrollX}, ${window.scrollY}\n` +
                `Document Size: ${document.documentElement.scrollWidth}×${document.documentElement.scrollHeight}`;
        }
    }
    
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
            `In Viewport: ${debugInfo.isInViewport} (${debugInfo.visiblePercent}% visible)\n` +
            `Calculation: top<vh=${debugInfo.calculation.topTest}, bottom>0=${debugInfo.calculation.bottomTest}, ` +
            `left<vw=${debugInfo.calculation.leftTest}, right>0=${debugInfo.calculation.rightTest}`
        );
        
        this.elementPosEl.textContent = entries.join('\n\n');
    }
    
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
     * Display results in HTML
     */
    displayResults(results) {
        if (!this.resultsContainer) return;
        
        // Store results for potential redisplay
        this._lastResults = results;
        
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
        
        // Add LCS table if data available
        if (this.lcsData.elements.length > 0) {
            resultsHTML += this.generateLCSTableHTML();
        }
        
        // Update the results element
        this.resultsContainer.innerHTML = resultsHTML;
    }
    
    /**
     * Generate HTML for the Large Contentful Set (LCS) table
     */
    generateLCSTableHTML() {
        // Sort elements by size (largest first)
        const sortedElements = [...this.lcsData.elements].sort((a, b) => b.area - a.area);
        
        // Get largest element size for percentage calculation
        const largestSize = sortedElements.length > 0 ? sortedElements[0].area : 0;
        
        // Generate rows
        const rows = sortedElements.map(item => {
            const element = item.element;
            const percentage = ((item.area / largestSize) * 100).toFixed(1);
            const elementInfo = this.formatElementInfo(element);
            
            return `
                <tr>
                    <td>${elementInfo}</td>
                    <td>${item.area}</td>
                    <td>${item.paintEvent.time.toFixed(2)}</td>
                    <td>${percentage}%</td>
                </tr>
            `;
        }).join('');
        
        // Create the full table HTML
        return `
            <h3>Large Contentful Set (LCS) Analysis</h3>
            <p>This shows the set of large elements that are at least ${Math.round(this.lcsData.threshold * 100)}% of the largest element's size:</p>
            <table>
                <thead>
                    <tr>
                        <th>Element</th>
                        <th>Size (pixels)</th>
                        <th>Paint Time (ms)</th>
                        <th>% of Largest</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
            <p><strong>LCS Completion Time:</strong> ${this.lcsData.lastPaintTime.toFixed(2)}ms - when all large elements finished painting</p>
        `;
    }
    
    /**
     * Format element information for display
     */
    formatElementInfo(element) {
        let info = element.tagName;
        
        if (element.className && element.className.length > 0) {
            info += `.${element.className.replace(/\s+/g, '.')}`;
        }
        
        if (element.id) {
            info += `#${element.id}`;
        }
        
        // Add product image index if available
        if (element.dataset && element.dataset.index) {
            info += ` (Image ${parseInt(element.dataset.index) + 1})`;
        }
        
        return info;
    }
    
    /**
     * Update LCS data externally
     */
    updateLCSData(lcsData) {
        this.lcsData = lcsData;
        
        // Redisplay if we have results
        if (this._lastResults) {
            this.displayResults(this._lastResults);
        }
    }
};