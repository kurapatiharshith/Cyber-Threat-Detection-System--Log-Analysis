/**
 * Log Analyzer - Reports JavaScript
 * Functionality for the reports page
 */

document.addEventListener('DOMContentLoaded', function() {
    // Load reports list
    loadReports();
    
    // Setup report format filter
    setupFormatFilter();
    
    // Setup close report button
    setupCloseReport();
    
    // Setup threat detail modal
    setupThreatDetailModal();
    
    // Setup refresh button
    setupRefreshButton();
});

/**
 * Load reports list
 */
function loadReports() {
    const reportsTableBody = document.getElementById('reportsTableBody');
    if (!reportsTableBody) return Promise.reject('Reports table not found');
    
    // Check if page is in dark mode
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    
    // Update UI to loading state
    reportsTableBody.innerHTML = `
        <tr><td colspan="5" class="text-center">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2">Loading reports...</p>
        </td></tr>
    `;
    
    return fetch('/reports_list')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (!data.reports || data.reports.length === 0) {
                reportsTableBody.innerHTML = '<tr><td colspan="5" class="text-center">No reports available</td></tr>';
                return;
            }
            
            reportsTableBody.innerHTML = '';
            
            // Sort reports by creation date, newest first
            data.reports.sort((a, b) => new Date(b.created) - new Date(a.created));
            
            data.reports.forEach(report => {
                const tr = document.createElement('tr');
                const date = new Date(report.created);
                
                // Add text-white class for dark mode
                if (isDarkMode) {
                    tr.classList.add('text-white');
                    
                    // Add event listeners for hover in dark mode
                    tr.addEventListener('mouseover', function() {
                        this.style.color = '#ffffff';
                        Array.from(this.children).forEach(td => {
                            td.style.color = '#ffffff';
                        });
                    });
                }
                
                tr.innerHTML = `
                    <td>${report.filename}</td>
                    <td>${date.toLocaleString()}</td>
                    <td><span class="badge bg-${getBadgeColor(report.type)}">${report.type.toUpperCase()}</span></td>
                    <td>${formatFileSize(report.size)}</td>
                    <td>
                        <a href="/report_preview/${encodeURIComponent(report.filename)}" target="_blank" class="btn btn-sm btn-outline-primary">
                            <i class="fas fa-eye"></i> View
                        </a>
                        <a href="/reports/${encodeURIComponent(report.filename)}" download class="btn btn-sm btn-outline-secondary">
                            <i class="fas fa-download"></i>
                        </a>
                    </td>
                `;
                
                tr.dataset.type = report.type;
                reportsTableBody.appendChild(tr);
            });
            
            // We don't need the click handlers for view buttons anymore since we're using direct links
            // with target="_blank" to open reports in a new tab
        })
        .catch(error => {
            console.error('Error loading reports:', error);
            reportsTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Error loading reports</td></tr>';
            return Promise.reject(error);
        });
}

/**
 * Setup format filter
 */
function setupFormatFilter() {
    const formatFilter = document.getElementById('reportFormatFilter');
    if (!formatFilter) return;
    
    formatFilter.addEventListener('change', function() {
        const format = this.value;
        const rows = document.querySelectorAll('#reportsTableBody tr');
        
        rows.forEach(row => {
            if (format === 'all' || row.dataset.type === format) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
}

/**
 * Setup close report button
 */
function setupCloseReport() {
    const closeReportBtn = document.getElementById('closeReportBtn');
    if (!closeReportBtn) return;
    
    closeReportBtn.addEventListener('click', function() {
        document.getElementById('reportViewerContainer').style.display = 'none';
    });
}

/**
 * Setup threat detail modal
 */
function setupThreatDetailModal() {
    // This will handle showing the threat detail modal when a threat is clicked
    $(document).on('click', '.view-details-btn', function() {
        const threatData = JSON.parse(this.getAttribute('data-threat').replace(/&#39;/g, "'"));
        const modalContent = document.querySelector('.threat-detail-content');
        
        if (modalContent) {
            let html = `<h4>${threatData.rule_name || 'Unknown Rule'}</h4>`;
            
            if (threatData.severity) {
                html += `<p><strong>Severity:</strong> <span class="badge bg-${getSeverityBadgeColor(threatData.severity)}">${threatData.severity}</span></p>`;
            }
            
            if (threatData.description) {
                html += `<div class="mb-3"><h5>Description</h5><p>${threatData.description}</p></div>`;
            }
            
            if (threatData.line) {
                html += `<div class="mb-3"><h5>Matched Line</h5><pre class="threat-line p-2">${escapeHtml(threatData.line)}</pre></div>`;
            }
            
            if (threatData.line_num) {
                html += `<p><strong>Line Number:</strong> ${threatData.line_num}</p>`;
            }
            
            if (threatData.remediation) {
                html += `<div class="mb-3"><h5>Remediation</h5><p>${threatData.remediation}</p></div>`;
            }
            
            modalContent.innerHTML = html;
        }
    });
}

/**
 * View a specific report
 */
function viewReport(reportFile, reportType) {
    const reportViewerContainer = document.getElementById('reportViewerContainer');
    const reportName = document.getElementById('currentReportName');
    const reportTimestamp = document.getElementById('reportTimestamp');
    
    // Show loading state
    reportViewerContainer.style.display = 'flex';
    reportName.textContent = reportFile;
    reportTimestamp.textContent = 'Loading...';
    
    // Update download link
    updateDownloadLinks(reportFile);
    
    // Fetch report data
    fetch(`/preview_report/${encodeURIComponent(reportFile)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
            }
            
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('application/json')) {
                return response.json().then(data => {
                    return { data: data, text: JSON.stringify(data, null, 2) };
                });
            } else {
                return response.text().then(text => {
                    try {
                        // Try to parse as JSON even if content-type isn't set correctly
                        const data = JSON.parse(text);
                        return { data: data, text: JSON.stringify(data, null, 2) };
                    } catch (e) {
                        // If not valid JSON, return as text
                        return { data: null, text: text };
                    }
                });
            }
        })
        .then(result => {
            if (reportType === 'json' && result.data) {
                processJsonReport(result.data, reportFile);
            } else if (reportType === 'html') {
                processHtmlReport(reportFile);
            } else {
                processTextReport(result.text, reportFile);
            }
            
            // Log activity
            logActivity('view_report', { filename: reportFile, type: reportType });
            
            // Scroll to report
            reportViewerContainer.scrollIntoView({ behavior: 'smooth' });
        })
        .catch(error => {
            console.error('Error loading report:', error);
            showReportError(reportFile, error);
        });
}

/**
 * Update download links for the current report
 */
function updateDownloadLinks(reportFile) {
    const downloadReportBtn = document.getElementById('downloadReportBtn');
    if (!downloadReportBtn) return;
    
    downloadReportBtn.href = `/reports/${encodeURIComponent(reportFile)}`;
    downloadReportBtn.setAttribute('download', reportFile);
}

/**
 * Process JSON report data
 */
function processJsonReport(data, reportFile) {
    // Set report name and timestamp
    document.getElementById('currentReportName').textContent = reportFile;
    const timestamp = data.timestamp ? new Date(data.timestamp).toLocaleString() : 'Unknown';
    document.getElementById('reportTimestamp').textContent = timestamp;
    
    // Update summary stats
    document.getElementById('totalThreats').textContent = data.total_threats || 0;
    
    // Update severity counts
    if (data.summary && data.summary.by_severity) {
        document.getElementById('criticalThreats').textContent = data.summary.by_severity.critical || 0;
        document.getElementById('highThreats').textContent = data.summary.by_severity.high || 0;
        document.getElementById('mediumThreats').textContent = data.summary.by_severity.medium || 0;
        document.getElementById('lowThreats').textContent = data.summary.by_severity.low || 0;
    } else {
        document.getElementById('criticalThreats').textContent = 0;
        document.getElementById('highThreats').textContent = 0;
        document.getElementById('mediumThreats').textContent = 0;
        document.getElementById('lowThreats').textContent = 0;
    }
    
    // Update threats table
    updateThreatsTable(data.threats || []);
    
    // Update protocols table
    updateProtocolsTable(data.network_stats?.protocols || []);
    
    // Update source IPs table
    updateSourceIpsTable(data.network_stats?.source_ips || []);
    
    // Update log duration
    if (data.network_stats && data.network_stats.log_duration) {
        document.getElementById('logDuration').textContent = `Log duration: ${data.network_stats.log_duration}`;
    } else {
        document.getElementById('logDuration').textContent = '';
    }
}

/**
 * Process HTML report
 */
function processHtmlReport(reportFile) {
    // Set report name
    document.getElementById('currentReportName').textContent = reportFile;
    
    // Try to get metadata for HTML report
    fetch(`/report_metadata/${encodeURIComponent(reportFile)}`)
        .then(response => response.json())
        .then(metadata => {
            // Update timestamp
            const timestamp = metadata.timestamp ? new Date(metadata.timestamp).toLocaleString() : 'Unknown';
            document.getElementById('reportTimestamp').textContent = timestamp;
            
            // Update summary stats if available
            document.getElementById('totalThreats').textContent = metadata.total_threats || 0;
            
            if (metadata.severity_counts) {
                document.getElementById('criticalThreats').textContent = metadata.severity_counts.critical || 0;
                document.getElementById('highThreats').textContent = metadata.severity_counts.high || 0;
                document.getElementById('mediumThreats').textContent = metadata.severity_counts.medium || 0;
                document.getElementById('lowThreats').textContent = metadata.severity_counts.low || 0;
            }
        })
        .catch(error => {
            console.error('Error getting HTML report metadata:', error);
            document.getElementById('reportTimestamp').textContent = 'Unknown';
        });
    
    // Show HTML report in iframe
    const threatsTable = document.getElementById('threatsTable');
    threatsTable.innerHTML = `
        <tr>
            <td colspan="4" class="p-0">
                <div class="embed-responsive">
                    <iframe src="/reports/${encodeURIComponent(reportFile)}" frameborder="0" style="width:100%; height:600px;"></iframe>
                </div>
            </td>
        </tr>
    `;
    
    // Clear other sections
    document.getElementById('protocolsTable').innerHTML = '<tr><td colspan="3" class="text-center">View HTML report for details</td></tr>';
    document.getElementById('sourceIpsTable').innerHTML = '<tr><td colspan="3" class="text-center">View HTML report for details</td></tr>';
    document.getElementById('logDuration').textContent = '';
}

/**
 * Process text report content
 */
function processTextReport(text, reportFile) {
    // Set report name
    document.getElementById('currentReportName').textContent = reportFile;
    document.getElementById('reportTimestamp').textContent = 'Plain Text Report';
    
    // Display text in pre tag
    const threatsTable = document.getElementById('threatsTable');
    threatsTable.innerHTML = `
        <tr>
            <td colspan="4">
                <pre style="max-height: 600px; overflow-y: auto; white-space: pre-wrap;">${escapeHtml(text)}</pre>
            </td>
        </tr>
    `;
    
    // Clear other sections
    document.getElementById('totalThreats').textContent = 'N/A';
    document.getElementById('criticalThreats').textContent = 'N/A';
    document.getElementById('highThreats').textContent = 'N/A';
    document.getElementById('mediumThreats').textContent = 'N/A';
    document.getElementById('lowThreats').textContent = 'N/A';
    
    document.getElementById('protocolsTable').innerHTML = '<tr><td colspan="3" class="text-center">Not available for text reports</td></tr>';
    document.getElementById('sourceIpsTable').innerHTML = '<tr><td colspan="3" class="text-center">Not available for text reports</td></tr>';
    document.getElementById('logDuration').textContent = '';
}

/**
 * Update the threats table with the provided data
 */
function updateThreatsTable(threats) {
    const threatsTable = document.getElementById('threatsTable');
    if (!threatsTable) return;
    
    if (threats.length === 0) {
        threatsTable.innerHTML = '<tr><td colspan="4" class="text-center">No threats detected</td></tr>';
        return;
    }
    
    threatsTable.innerHTML = '';
    
    threats.forEach(threat => {
        const tr = document.createElement('tr');
        
        // Determine severity badge
        const severityBadge = `<span class="badge bg-${getSeverityBadgeColor(threat.severity)}">${threat.severity}</span>`;
        
        // Create view details button if there's detailed information
        const detailsButton = threat.remediation || threat.description ? 
            `<button class="btn btn-sm btn-outline-info view-details-btn" data-bs-toggle="modal" data-bs-target="#threatDetailModal" data-threat='${JSON.stringify(threat).replace(/'/g, "&#39;")}'>
                <i class="fas fa-info-circle"></i> Details
            </button>` : 
            'None';
        
        tr.innerHTML = `
            <td>${escapeHtml(threat.rule_name || 'Unknown Rule')}</td>
            <td>${severityBadge}</td>
            <td>${threat.line_num || 'N/A'}</td>
            <td>${detailsButton}</td>
        `;
        
        threatsTable.appendChild(tr);
    });
}

/**
 * Update the protocols table with the provided data
 */
function updateProtocolsTable(protocols) {
    const protocolsTable = document.getElementById('protocolsTable');
    if (!protocolsTable) return;
    
    if (protocols.length === 0) {
        protocolsTable.innerHTML = '<tr><td colspan="3" class="text-center">No protocol data available</td></tr>';
        return;
    }
    
    protocolsTable.innerHTML = '';
    
    // Calculate total for percentages
    const total = protocols.reduce((sum, protocol) => sum + protocol.count, 0);
    
    protocols.forEach(protocol => {
        const percentage = total > 0 ? ((protocol.count / total) * 100).toFixed(1) + '%' : 'N/A';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${protocol.protocol}</td>
            <td>${protocol.count}</td>
            <td>${percentage}</td>
        `;
        
        protocolsTable.appendChild(tr);
    });
}

/**
 * Update the source IPs table with the provided data
 */
function updateSourceIpsTable(sourceIps) {
    const sourceIpsTable = document.getElementById('sourceIpsTable');
    if (!sourceIpsTable) return;
    
    if (sourceIps.length === 0) {
        sourceIpsTable.innerHTML = '<tr><td colspan="3" class="text-center">No source IP data available</td></tr>';
        return;
    }
    
    sourceIpsTable.innerHTML = '';
    
    sourceIps.forEach(ip => {
        const tr = document.createElement('tr');
        const status = ip.malicious ? 
            '<span class="badge bg-danger">Malicious</span>' : 
            '<span class="badge bg-success">Normal</span>';
            
        tr.innerHTML = `
            <td>${ip.ip}</td>
            <td>${ip.count}</td>
            <td>${status}</td>
        `;
        
        sourceIpsTable.appendChild(tr);
    });
}

/**
 * Show error when loading a report fails
 */
function showReportError(reportFile, error) {
    document.getElementById('currentReportName').textContent = reportFile;
    document.getElementById('reportTimestamp').textContent = 'Error loading report';
    
    document.getElementById('totalThreats').textContent = '!';
    document.getElementById('criticalThreats').textContent = '!';
    document.getElementById('highThreats').textContent = '!';
    document.getElementById('mediumThreats').textContent = '!';
    document.getElementById('lowThreats').textContent = '!';
    
    document.getElementById('threatsTable').innerHTML = `
        <tr>
            <td colspan="4" class="text-center text-danger">
                <i class="fas fa-exclamation-triangle"></i> Error: ${error.message || 'Failed to load report'}
            </td>
        </tr>
    `;
    
    document.getElementById('protocolsTable').innerHTML = '<tr><td colspan="3" class="text-center">No data available</td></tr>';
    document.getElementById('sourceIpsTable').innerHTML = '<tr><td colspan="3" class="text-center">No data available</td></tr>';
    document.getElementById('logDuration').textContent = '';
}

/**
 * Get badge color based on report file type
 */
function getBadgeColor(type) {
    switch (type.toLowerCase()) {
        case 'json': return 'primary';
        case 'html': return 'success';
        case 'txt': return 'secondary';
        default: return 'info';
    }
}

/**
 * Get badge color based on severity level
 */
function getSeverityBadgeColor(severity) {
    switch (severity.toLowerCase()) {
        case 'critical': return 'danger';
        case 'high': return 'warning';
        case 'medium': return 'info';
        case 'low': return 'secondary';
        case 'info': return 'primary';
        default: return 'secondary';
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Format file size in KB, MB etc.
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
}

/**
 * Setup refresh button
 */
function setupRefreshButton() {
    const refreshButton = document.getElementById('refreshReports');
    if (!refreshButton) return;
    
    refreshButton.addEventListener('click', function() {
        // Show spinner inside the button
        this.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
        this.disabled = true;
        
        // Reload reports
        loadReports().finally(() => {
            // Restore button state after loading completes
            this.innerHTML = '<i class="fas fa-sync-alt"></i>';
            this.disabled = false;
        });
    });
}
