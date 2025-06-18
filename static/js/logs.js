/**
 * Log Analyzer - Logs JavaScript
 * Functionality for the logs page
 */

// Global variables
let currentLog = null;
let searchMatches = [];
let currentMatchIndex = -1;

document.addEventListener('DOMContentLoaded', function() {
    // Load available logs
    loadAvailableLogs();
    
    // Setup search functionality
    setupLogSearch();
    
    // Setup in-file search functionality
    setupContentSearch();
    
    // Setup upload modal functionality
    setupUploadModal();
    
    // Setup analysis modal functionality
    setupAnalysisModal();
    
    // Check URL parameters to load specific log
    checkUrlParams();
});

/**
 * Load available logs
 */
function loadAvailableLogs() {
    const logsList = document.getElementById('logsList');
    
    fetch('/list_log_files')
        .then(response => response.json())
        .then(data => {
            if (data.count === 0) {
                logsList.innerHTML = '<li class="text-center text-muted">No logs available</li>';
                return;
            }
            
            logsList.innerHTML = '';
            data.log_files.forEach(file => {
                const li = document.createElement('li');
                li.textContent = file.filename;
                li.dataset.filename = file.filename;
                li.dataset.path = file.path;
                li.dataset.size = file.size;
                li.dataset.created = file.created;
                
                li.addEventListener('click', function() {
                    // Remove active class from all logs
                    document.querySelectorAll('#logsList li').forEach(item => {
                        item.classList.remove('active');
                    });
                    
                    // Add active class to clicked log
                    this.classList.add('active');
                    
                    // Load log content
                    loadLogContent(this.dataset.filename);
                    
                    // Update URL to reflect selected log
                    const url = new URL(window.location);
                    url.searchParams.set('file', this.dataset.filename);
                    history.pushState({}, '', url);
                });
                
                logsList.appendChild(li);
            });
        })
        .catch(error => {
            console.error('Error loading logs:', error);
            logsList.innerHTML = '<li class="text-center text-muted">Error loading logs</li>';
        });
}

/**
 * Setup log search functionality
 */
function setupLogSearch() {
    const logSearchInput = document.getElementById('logSearch');
    
    logSearchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const logItems = document.querySelectorAll('#logsList li');
        
        logItems.forEach(item => {
            if (item.textContent.toLowerCase().includes(searchTerm)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    });
}

/**
 * Setup in-file search functionality (similar to Ctrl+F)
 */
function setupContentSearch() {
    const searchInput = document.getElementById('logContentSearch');
    const prevMatchBtn = document.getElementById('prevMatchBtn');
    const nextMatchBtn = document.getElementById('nextMatchBtn');
    const logContent = document.getElementById('logContent');
    const searchStats = document.getElementById('searchStats');
    
    // Search as user types
    searchInput.addEventListener('input', function() {
        if (!currentLog) return;
        
        const searchTerm = this.value;
        if (!searchTerm) {
            // Clear highlights if search term is empty
            logContent.innerHTML = escapeHtml(currentLog);
            searchMatches = [];
            currentMatchIndex = -1;
            searchStats.textContent = '';
            return;
        }
        
        // Perform search
        const text = currentLog;
        searchMatches = [...text.matchAll(new RegExp(escapeRegExp(searchTerm), 'gi'))];
        currentMatchIndex = searchMatches.length > 0 ? 0 : -1;
        
        // Update search stats
        updateSearchStats();
        
        // Highlight matches
        highlightMatches();
        
        // Scroll to first match
        if (searchMatches.length > 0) {
            scrollToMatch(0);
        }
    });
    
    // Navigate to previous match
    prevMatchBtn.addEventListener('click', function() {
        if (searchMatches.length === 0) return;
        
        currentMatchIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
        updateSearchStats();
        scrollToMatch(currentMatchIndex);
    });
    
    // Navigate to next match
    nextMatchBtn.addEventListener('click', function() {
        if (searchMatches.length === 0) return;
        
        currentMatchIndex = (currentMatchIndex + 1) % searchMatches.length;
        updateSearchStats();
        scrollToMatch(currentMatchIndex);
    });
}

/**
 * Load log content
 */
function loadLogContent(filename) {
    const logContent = document.getElementById('logContent');
    const logPlaceholder = document.getElementById('logPlaceholder');
    const currentLogName = document.getElementById('currentLogName');
    const logStats = document.getElementById('logStats');
    const analyzeLogBtn = document.getElementById('analyzeLogBtn');
    
    // Show loading state
    logContent.textContent = 'Loading log content...';
    logContent.style.display = 'block';
    logPlaceholder.style.display = 'none';
    currentLogName.textContent = filename;
    
    // Get log file size
    const logItem = document.querySelector(`#logsList li[data-filename="${filename}"]`);
    const fileSize = logItem ? formatFileSize(logItem.dataset.size) : '';
    const created = logItem ? new Date(logItem.dataset.created).toLocaleString() : '';
    logStats.textContent = `${fileSize} • ${created}`;
    
    // Show analyze button
    analyzeLogBtn.style.display = 'inline-block';
    analyzeLogBtn.dataset.filename = filename;
    
    // Load log content
    fetch(`/preview_log/${encodeURIComponent(filename)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            return response.text();
        })
        .then(content => {
            currentLog = content;
            logContent.innerHTML = escapeHtml(content);
            
            // Clear search
            document.getElementById('logContentSearch').value = '';
            searchMatches = [];
            currentMatchIndex = -1;
            document.getElementById('searchStats').textContent = '';
            
            // Log the activity
            logActivity('view_log', { filename });
        })
        .catch(error => {
            console.error('Error loading log content:', error);
            logContent.textContent = `Error loading log content: ${error.message}`;
        });
}

/**
 * Update search stats display
 */
function updateSearchStats() {
    const searchStats = document.getElementById('searchStats');
    if (searchMatches.length === 0) {
        searchStats.textContent = 'No matches found';
    } else {
        searchStats.textContent = `${currentMatchIndex + 1} of ${searchMatches.length} matches`;
    }
}

/**
 * Highlight all matches in the log content
 */
function highlightMatches() {
    if (searchMatches.length === 0 || !currentLog) return;
    
    const logContent = document.getElementById('logContent');
    const searchTerm = document.getElementById('logContentSearch').value;
    const text = currentLog;
    
    // Create HTML with highlighted matches
    let html = escapeHtml(text);
    let offset = 0;
    
    // Sort matches by index to process from start to end
    const sortedMatches = [...searchMatches].sort((a, b) => a.index - b.index);
    
    for (let i = 0; i < sortedMatches.length; i++) {
        const match = sortedMatches[i];
        const matchText = escapeHtml(match[0]);
        
        // Create highlighted HTML
        const highlightClass = i === currentMatchIndex ? 'text-highlighted current-match' : 'text-highlighted';
        const highlightedMatch = `<span class="${highlightClass}" id="match-${i}">${matchText}</span>`;
        
        // Replace the match with highlighted version
        const adjustedIndex = match.index + offset;
        html = html.substring(0, adjustedIndex) + highlightedMatch + html.substring(adjustedIndex + matchText.length);
        
        // Adjust offset for the added HTML
        offset += highlightedMatch.length - matchText.length;
    }
    
    logContent.innerHTML = html;
}

/**
 * Scroll to a specific match
 */
function scrollToMatch(index) {
    const matchEl = document.getElementById(`match-${index}`);
    if (matchEl) {
        // Highlight current match
        document.querySelectorAll('.current-match').forEach(el => {
            el.classList.remove('current-match');
        });
        matchEl.classList.add('current-match');
        
        // Scroll to match
        matchEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

/**
 * Set up upload modal functionality
 */
function setupUploadModal() {
    const uploadBtn = document.getElementById('uploadLogBtn');
    const uploadModal = new bootstrap.Modal(document.getElementById('uploadLogModal'));
    const submitUploadBtn = document.getElementById('submitUploadBtn');
    const uploadForm = document.getElementById('uploadLogForm');
    const uploadStatus = document.getElementById('uploadStatus');
    
    uploadBtn.addEventListener('click', function() {
        uploadModal.show();
    });
    
    submitUploadBtn.addEventListener('click', function() {
        const formData = new FormData(uploadForm);
        const logFiles = document.getElementById('logFiles').files;
        
        if (logFiles.length === 0) {
            uploadStatus.innerHTML = '<div class="alert alert-danger">Please select at least one log file</div>';
            return;
        }
        
        uploadStatus.innerHTML = '<div class="alert alert-info">Uploading files, please wait...</div>';
        submitUploadBtn.disabled = true;
        
        fetch('/analyze', {
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
                
                // Log the activity
                logActivity('upload', { files: Array.from(logFiles).map(f => f.name) });
                
                // Reload logs in sidebar and logs list after short delay
                setTimeout(() => {
                    loadUploadedLogs();
                    loadAvailableLogs();
                    
                    // Reset form and close modal
                    uploadForm.reset();
                    uploadModal.hide();
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
 * Setup analysis modal functionality
 */
function setupAnalysisModal() {
    const analyzeLogBtn = document.getElementById('analyzeLogBtn');
    const analysisModal = new bootstrap.Modal(document.getElementById('analysisModal'));
    const startAnalysisBtn = document.getElementById('startAnalysisBtn');
    const analysisForm = document.getElementById('analysisForm');
    const analysisStatus = document.getElementById('analysisStatus');
    
    if (!analyzeLogBtn) return;
    
    analyzeLogBtn.addEventListener('click', function() {
        analysisModal.show();
    });
    
    startAnalysisBtn.addEventListener('click', function() {
        const filename = analyzeLogBtn.dataset.filename;
        if (!filename) {
            analysisStatus.innerHTML = '<div class="alert alert-danger">No log file selected</div>';
            return;
        }
        
        const formData = new FormData(analysisForm);
        
        // Create a File object from the filename to properly send it as a file
        fetch(`/preview_log/${encodeURIComponent(filename)}`)
            .then(response => response.text())
            .then(content => {
                // Instead of trying to create a File object, use the filename
                // directly as a parameter in the request
                formData.append('log_files', filename);
                
                analysisStatus.innerHTML = '<div class="alert alert-info">Analyzing log, please wait... This may take a moment.</div>';
                startAnalysisBtn.disabled = true;
                
                fetch('/analyze', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.error) {
                        analysisStatus.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
                    } else {
                        analysisStatus.innerHTML = `
                            <div class="alert alert-success">
                                Analysis complete! Found ${data.total_threats} potential threats.
                                <a href="/reports" class="alert-link">View in Reports tab</a>
                            </div>
                        `;
                        
                        // Log activity
                        logActivity('analyze', { 
                            filename: filename,
                            format: formData.get('format'),
                            threat_count: data.total_threats 
                        });
                        
                        // Close modal after delay
                        setTimeout(() => {
                            analysisForm.reset();
                            analysisModal.hide();
                            startAnalysisBtn.disabled = false;
                        }, 2500);
                    }
                })
                .catch(error => {
                    console.error('Error analyzing log:', error);
                    analysisStatus.innerHTML = '<div class="alert alert-danger">Error analyzing log. Please try again.</div>';
                    startAnalysisBtn.disabled = false;
                });
            })
            .catch(error => {
                console.error('Error loading log content:', error);
                analysisStatus.innerHTML = '<div class="alert alert-danger">Error loading log file. Please try again.</div>';
                startAnalysisBtn.disabled = false;
            });
    });
}

/**
 * Check URL parameters to load specific log
 */
function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const filename = urlParams.get('file');
    const analyze = urlParams.get('analyze');
    
    if (filename) {
        // Select the log in the list
        const logItem = document.querySelector(`#logsList li[data-filename="${filename}"]`);
        if (logItem) {
            logItem.classList.add('active');
            loadLogContent(filename);
            
            // If analyze parameter is present, open analysis modal
            if (analyze === 'true') {
                setTimeout(() => {
                    document.getElementById('analyzeLogBtn').click();
                }, 500);
            }
        }
    }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Escape regular expression special characters
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
