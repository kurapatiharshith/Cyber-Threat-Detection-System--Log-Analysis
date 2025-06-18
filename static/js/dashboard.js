/**
 * Log Analyzer - Dashboard JavaScript
 * Functionality for the dashboard page
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard script loaded');

    // Load dashboard statistics
    loadDashboardStats();
    
    // Initialize charts
    initCharts();
    
    // Load recent logs
    loadRecentLogs();
    
    // Setup upload modal functionality
    setupUploadModal();
    
    // Add event listener for refresh button
    const refreshBtn = document.getElementById('refreshDashboardBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            console.log('Refreshing dashboard data...');
            loadDashboardStats();
            loadRecentLogs();
            // Show spinner in the button while refreshing
            const icon = this.querySelector('i');
            icon.classList.remove('fa-sync-alt');
            icon.classList.add('fa-spinner', 'fa-spin');
            
            // Restore button after 1 second
            setTimeout(() => {
                icon.classList.remove('fa-spinner', 'fa-spin');
                icon.classList.add('fa-sync-alt');
            }, 1000);
        });
    }
});

/**
 * Load dashboard statistics
 */
function loadDashboardStats() {
    fetch('/dashboard_data?nocache=' + new Date().getTime())  // Add cache-busting parameter
        .then(response => response.json())
        .then(data => {
            console.log('Dashboard data:', data);
            
            // Update statistics cards
            document.getElementById('totalLogsCount').textContent = data.log_count || 0;
            
            // Improved threat count calculation with better debug logging
            let threatCount = 0;
            if (data.threat_counts) {
                console.log('Raw threat counts data:', data.threat_counts);
                // Sum all threat counts explicitly with logging
                const critical = data.threat_counts.critical || 0;
                const high = data.threat_counts.high || 0;
                const medium = data.threat_counts.medium || 0;
                const low = data.threat_counts.low || 0;
                const info = data.threat_counts.info || 0;
                
                threatCount = critical + high + medium + low + info;
                console.log(`Calculated threat count: ${threatCount} (Critical: ${critical}, High: ${high}, Medium: ${medium}, Low: ${low}, Info: ${info})`);
            } else if (data.recent_threats && Array.isArray(data.recent_threats)) {
                // Fallback to count recent threats if available
                threatCount = data.recent_threats.length;
                console.log(`Using recent_threats length as count: ${threatCount}`);
            }
            
            // Update the UI with the threat count
            document.getElementById('threatsCount').textContent = threatCount;
            document.getElementById('reportsCount').textContent = data.report_count || 0;
            
            // Update total file size if available
            const totalSize = data.total_log_size ? formatFileSize(data.total_log_size) : 'N/A';
            document.getElementById('totalSize').textContent = totalSize;
            
            // Enhanced last analysis display with better debug info
            if (data.last_analysis) {
                console.log('Raw last_analysis value:', data.last_analysis);
                try {
                    // Try direct ISO date parsing
                    const date = new Date(data.last_analysis);
                    if (!isNaN(date.getTime())) {
                        const formattedDate = date.toLocaleString();
                        console.log('Formatted date:', formattedDate);
                        document.getElementById('lastAnalysis').textContent = formattedDate;
                    } else {
                        // Try parsing timestamp as number (seconds or milliseconds)
                        const timestamp = parseFloat(data.last_analysis);
                        if (!isNaN(timestamp)) {
                            // Check if timestamp is in seconds (Unix timestamp) or milliseconds
                            const dateFromTimestamp = new Date(
                                timestamp < 10000000000 ? timestamp * 1000 : timestamp
                            );
                            console.log('Parsed from timestamp:', dateFromTimestamp.toLocaleString());
                            document.getElementById('lastAnalysis').textContent = dateFromTimestamp.toLocaleString();
                        } else {
                            console.error('Invalid date format from last_analysis:', data.last_analysis);
                            document.getElementById('lastAnalysis').textContent = String(data.last_analysis);
                        }
                    }
                } catch (e) {
                    console.error('Error parsing last analysis date:', e);
                    // Display the raw value as fallback
                    document.getElementById('lastAnalysis').textContent = String(data.last_analysis);
                }
            } else {
                document.getElementById('lastAnalysis').textContent = 'Never';
            }
            
            // Update line counts if available
            document.getElementById('totalLineCount').textContent = data.total_line_count?.toLocaleString() || 'N/A';
            
            // Update chart data
            updateChartData(data);
        })
        .catch(error => {
            console.error('Error loading dashboard data:', error);
            // Show error message on UI
            document.getElementById('totalLogsCount').textContent = '!';
            document.getElementById('threatsCount').textContent = '!';
            document.getElementById('reportsCount').textContent = '!';
            document.getElementById('lastAnalysis').textContent = 'Error';
        });
}

/**
 * Initialize dashboard charts
 */
function initCharts() {
    // Source IPs chart
    const sourceIpsCtx = document.getElementById('sourceIpsChart');
    if (sourceIpsCtx) {
        window.sourceIpsChart = new Chart(sourceIpsCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Number of Logs',
                    data: [],
                    backgroundColor: 'rgba(13, 110, 253, 0.7)',
                    borderColor: 'rgba(13, 110, 253, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary')
                        },
                        grid: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
                        }
                    },
                    x: {
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary')
                        },
                        grid: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary')
                        }
                    }
                }
            }
        });
    }
    
    // Destination IPs chart
    const destIpsCtx = document.getElementById('destIpsChart');
    if (destIpsCtx) {
        window.destIpsChart = new Chart(destIpsCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Traffic Volume',
                    data: [],
                    backgroundColor: 'rgba(25, 135, 84, 0.7)',
                    borderColor: 'rgba(25, 135, 84, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary')
                        },
                        grid: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
                        }
                    },
                    x: {
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary')
                        },
                        grid: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary')
                        }
                    }
                }
            }
        });
    }
    
    // Protocols chart
    const protocolsCtx = document.getElementById('protocolsChart');
    if (protocolsCtx) {
        window.protocolsChart = new Chart(protocolsCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        'rgba(13, 110, 253, 0.7)',
                        'rgba(25, 135, 84, 0.7)',
                        'rgba(220, 53, 69, 0.7)',
                        'rgba(255, 193, 7, 0.7)',
                        'rgba(13, 202, 240, 0.7)'
                    ],
                    borderColor: [
                        'rgba(13, 110, 253, 1)',
                        'rgba(25, 135, 84, 1)',
                        'rgba(220, 53, 69, 1)',
                        'rgba(255, 193, 7, 1)',
                        'rgba(13, 202, 240, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary')
                        }
                    }
                }
            }
        });
    }
    
    // Severity chart
    const severityCtx = document.getElementById('severityChart');
    if (severityCtx) {
        window.severityChart = new Chart(severityCtx.getContext('2d'), {
            type: 'pie',
            data: {
                labels: ['Critical', 'High', 'Medium', 'Low', 'Info'],
                datasets: [{
                    data: [0, 0, 0, 0, 0],
                    backgroundColor: [
                        'rgba(220, 53, 69, 0.7)',
                        'rgba(253, 126, 20, 0.7)',
                        'rgba(255, 193, 7, 0.7)',
                        'rgba(25, 135, 84, 0.7)',
                        'rgba(13, 202, 240, 0.7)'
                    ],
                    borderColor: [
                        'rgba(220, 53, 69, 1)',
                        'rgba(253, 126, 20, 1)',
                        'rgba(255, 193, 7, 1)',
                        'rgba(25, 135, 84, 1)',
                        'rgba(13, 202, 240, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary')
                        }
                    }
                }
            }
        });
    }
}

/**
 * Update chart data
 */
function updateChartData(data) {
    // Update Source IPs chart
    if (window.sourceIpsChart && data.source_ips && data.source_ips.length > 0) {
        window.sourceIpsChart.data.labels = data.source_ips.map(item => item.ip);
        window.sourceIpsChart.data.datasets[0].data = data.source_ips.map(item => item.count);
        window.sourceIpsChart.update();
    }
    
    // Update Destination IPs chart
    if (window.destIpsChart && data.dest_ips && data.dest_ips.length > 0) {
        window.destIpsChart.data.labels = data.dest_ips.map(item => item.ip);
        window.destIpsChart.data.datasets[0].data = data.dest_ips.map(item => 
            item.volume || item.count); // Some APIs return volume, some return count
        window.destIpsChart.update();
    }
    
    // Update Protocols chart
    if (window.protocolsChart && data.protocols && data.protocols.length > 0) {
        window.protocolsChart.data.labels = data.protocols.map(item => item.protocol);
        window.protocolsChart.data.datasets[0].data = data.protocols.map(item => item.count);
        window.protocolsChart.update();
    }
    
    // Update Severity chart
    if (window.severityChart && data.threat_counts) {
        const severityData = [
            data.threat_counts.critical || 0,
            data.threat_counts.high || 0,
            data.threat_counts.medium || 0,
            data.threat_counts.low || 0,
            data.threat_counts.info || 0
        ];
        window.severityChart.data.datasets[0].data = severityData;
        window.severityChart.update();
    }
}

/**
 * Load recent logs
 */
function loadRecentLogs() {
    const recentLogsTable = document.getElementById('recentLogsTable');
    if (!recentLogsTable) return;
    
    fetch('/list_log_files?limit=5')
        .then(response => response.json())
        .then(data => {
            if (data.count === 0) {
                recentLogsTable.innerHTML = '<tr><td colspan="4" class="text-center">No logs uploaded yet</td></tr>';
                return;
            }
            
            recentLogsTable.innerHTML = '';
            data.log_files.forEach(file => {
                const tr = document.createElement('tr');
                const date = new Date(file.created);
                
                tr.innerHTML = `
                    <td>${file.filename}</td>
                    <td>${formatFileSize(file.size)}</td>
                    <td>${date.toLocaleString()}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary view-log-btn" data-filename="${file.filename}" title="View">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-success analyze-log-btn" data-filename="${file.filename}" title="Analyze">
                            <i class="fas fa-search"></i>
                        </button>
                    </td>
                `;
                
                recentLogsTable.appendChild(tr);
            });
            
            // Add event listeners to view and analyze buttons
            document.querySelectorAll('.view-log-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const filename = this.getAttribute('data-filename');
                    window.location.href = `/logs?file=${encodeURIComponent(filename)}`;
                });
            });
            
            document.querySelectorAll('.analyze-log-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const filename = this.getAttribute('data-filename');
                    window.location.href = `/logs?file=${encodeURIComponent(filename)}&analyze=true`;
                });
            });
        })
        .catch(error => {
            console.error('Error loading recent logs:', error);
            recentLogsTable.innerHTML = '<tr><td colspan="4" class="text-center">Error loading logs</td></tr>';
        });
}

/**
 * Set up upload modal functionality
 */
function setupUploadModal() {
    const uploadLogBtn = document.getElementById('uploadLogBtn');
    const uploadLogModal = document.getElementById('uploadLogModal');
    const uploadForm = document.getElementById('uploadLogForm');
    const submitUploadBtn = document.getElementById('submitUploadBtn');
    
    if (!uploadLogBtn || !uploadForm || !submitUploadBtn) return;
    
    uploadLogBtn.addEventListener('click', function() {
        const modal = new bootstrap.Modal(document.getElementById('uploadLogModal'));
        modal.show();
    });
    
    submitUploadBtn.addEventListener('click', function() {
        const formData = new FormData(uploadForm);
        const uploadStatus = document.getElementById('uploadStatus');
        
        // Validate files
        const logFiles = document.getElementById('logFiles').files;
        if (logFiles.length === 0) {
            uploadStatus.innerHTML = '<div class="alert alert-danger">Please select at least one log file</div>';
            return;
        }
        
        // Submit form
        submitUploadBtn.disabled = true;
        uploadStatus.innerHTML = '<div class="alert alert-info">Uploading files...</div>';
        
        fetch('/upload_logs', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                uploadStatus.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
                submitUploadBtn.disabled = false;
            } else {
                uploadStatus.innerHTML = `
                    <div class="alert alert-success">
                        ${logFiles.length} file(s) uploaded successfully!
                    </div>
                `;
                
                // Force a complete refresh of the dashboard data
                setTimeout(() => {
                    loadDashboardStats();
                    loadRecentLogs();
                }, 500);
                
                // Also update the sidebar log list 
                if (typeof loadUploadedLogs === 'function') {
                    loadUploadedLogs();
                }
                
                // Reset form and close modal after delay
                setTimeout(() => {
                    uploadForm.reset();
                    bootstrap.Modal.getInstance(document.getElementById('uploadLogModal')).hide();
                    submitUploadBtn.disabled = false;
                }, 1500);
            }
        })
        .catch(error => {
            console.error('Error uploading logs:', error);
            uploadStatus.innerHTML = '<div class="alert alert-danger">Error uploading files. Please try again.</div>';
            submitUploadBtn.disabled = false;
        });
    });
}

/**
 * Format file size in KB, MB etc.
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
}
