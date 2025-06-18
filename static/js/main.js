/**
 * Log Analyzer - Main JavaScript
 * Common functionality used across the application
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('Log Analyzer application loaded');
    
    // Check for flash messages and set timeout to fade them out
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            alert.style.opacity = '0';
            setTimeout(() => {
                alert.style.display = 'none';
            }, 500);
        }, 5000);
    });

    // Initialize theme
    initTheme();
    
    // Setup theme toggle
    setupThemeToggle();
    
    // Load uploaded logs in sidebar
    loadUploadedLogs();
    
    // Set up log search in sidebar
    setupLogSearch();
    
    // Set up global search
    setupGlobalSearch();
    
    // Setup sidebar toggle
    setupSidebarToggle();

    // Add responsive handler for sidebar
    handleResponsiveSidebar();

    // Ensure content area resizes properly when window is resized
    window.addEventListener('resize', function() {
        handleResponsiveSidebar();
    });

    // Global AJAX setup to handle authentication errors
    if (typeof $ !== 'undefined') {
        $.ajaxSetup({
            error: function(xhr, status, error) {
                // If response is HTML when expecting JSON, likely a login page redirect
                if (xhr.responseText && xhr.responseText.includes('<!DOCTYPE html>')) {
                    console.log('Authentication required. Please log in.');
                    window.location.href = '/login';
                    return;
                }
                console.error("AJAX Error:", status, error);
            }
        });
        
        // Safe loading of logs or any other data that requires authentication
        window.loadLogs = function() {
            if (!document.getElementById('logsContainer')) {
                return; // Not on a page with logs
            }
            
            $.ajax({
                url: '/list_log_files',
                method: 'GET',
                dataType: 'json',
                success: function(data) {
                    // Handle log data
                    console.log('Logs loaded successfully');
                },
                error: function(xhr, status, error) {
                    console.log('Error loading logs:', error);
                    // Error handler in $.ajaxSetup will handle authentication redirects
                }
            });
        };
        
        // Only try to load logs if we're not on the login page
        if (!window.location.pathname.includes('/login')) {
            setTimeout(function() {
                try {
                    window.loadLogs();
                } catch (e) {
                    console.error('Error in loadLogs:', e);
                }
            }, 500);
        }
    }
    
    // Update any references to log-icon.png to use the SVG version
    document.querySelectorAll('img[src*="log-icon.png"]').forEach(function(img) {
        img.src = img.src.replace('log-icon.png', 'log-icon.svg');
    });

    // Initialize the search modal functionality
    setupSearchModal();
});

/**
 * Initialize theme based on saved preference or system default
 */
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    
    // Apply theme (light or dark)
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);
    } else {
        // Check for system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            document.documentElement.setAttribute('data-theme', 'light');
            updateThemeIcon('light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            updateThemeIcon('dark');
        }
    }
    
    // Apply custom theme variants if available
    const currentTheme = document.documentElement.getAttribute('data-theme');
    
    if (currentTheme === 'light') {
        const lightTheme = localStorage.getItem('lightTheme');
        if (lightTheme) {
            document.documentElement.setAttribute('data-custom-theme', lightTheme);
        }
        
        const lightAccentColor = localStorage.getItem('lightAccentColor');
        if (lightTheme === 'custom' && lightAccentColor) {
            document.documentElement.style.setProperty('--custom-accent-light', lightAccentColor);
            document.documentElement.style.setProperty(
                '--custom-accent-hover-light', 
                adjustColorBrightness(lightAccentColor, -10)
            );
            document.documentElement.setAttribute('data-custom-accent-light', 'true');
        }
    } else {
        const darkTheme = localStorage.getItem('darkTheme');
        if (darkTheme) {
            document.documentElement.setAttribute('data-custom-theme', darkTheme);
        }
        
        const darkAccentColor = localStorage.getItem('darkAccentColor');
        if (darkTheme === 'custom' && darkAccentColor) {
            document.documentElement.style.setProperty('--custom-accent-dark', darkAccentColor);
            document.documentElement.style.setProperty(
                '--custom-accent-hover-dark', 
                adjustColorBrightness(darkAccentColor, -10)
            );
            document.documentElement.setAttribute('data-custom-accent-dark', 'true');
        }
    }
}

/**
 * Adjust color brightness
 */
function adjustColorBrightness(hex, percent) {
    // Convert hex to RGB
    let r = parseInt(hex.substring(1, 3), 16);
    let g = parseInt(hex.substring(3, 5), 16);
    let b = parseInt(hex.substring(5, 7), 16);
    
    // Adjust brightness
    r = Math.max(0, Math.min(255, r + percent));
    g = Math.max(0, Math.min(255, g + percent));
    b = Math.max(0, Math.min(255, b + percent));
    
    // Convert back to hex
    return '#' + 
        ((1 << 24) + (r << 16) + (g << 8) + b)
        .toString(16)
        .slice(1);
}

/**
 * Set up theme toggle button
 */
function setupThemeToggle() {
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', function() {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            
            updateThemeIcon(newTheme);
        });
    }
}

/**
 * Update theme toggle icon based on current theme
 */
function updateThemeIcon(theme) {
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        const icon = themeToggleBtn.querySelector('i');
        if (theme === 'dark') {
            icon.className = 'fas fa-sun';
        } else {
            icon.className = 'fas fa-moon';
        }
    }
}

/**
 * Load list of uploaded log files in sidebar
 */
function loadUploadedLogs() {
    const uploadedLogsList = document.getElementById('uploadedLogsList');
    if (!uploadedLogsList) return;
    
    // Use try/catch to handle potential fetch errors
    try {
        fetch('/list_log_files')
            .then(response => {
                // Check if response is ok before attempting to parse JSON
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.count === 0) {
                    uploadedLogsList.innerHTML = '<li class="log-list-empty">No logs uploaded yet</li>';
                    return;
                }
                
                uploadedLogsList.innerHTML = '';
                data.log_files.forEach(file => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <div title="${file.filename}">
                            <i class="fas fa-file-alt"></i>
                            <span class="log-name">${truncateFilename(file.filename, 18)}</span>
                        </div>
                        <span class="log-size">${formatFileSize(file.size)}</span>
                    `;
                    li.dataset.filename = file.filename;
                    li.dataset.path = file.path;
                    
                    li.addEventListener('click', function() {
                        window.location.href = `/logs?file=${encodeURIComponent(file.filename)}`;
                    });
                    
                    uploadedLogsList.appendChild(li);
                });
            })
            .catch(error => {
                console.error('Error loading logs:', error);
                uploadedLogsList.innerHTML = '<li class="log-list-empty">Error loading logs</li>';
            });
    } catch (e) {
        console.error('Exception in loadUploadedLogs:', e);
        uploadedLogsList.innerHTML = '<li class="log-list-empty">Error loading logs</li>';
    }
}

/**
 * Set up log search in sidebar
 */
function setupLogSearch() {
    const logSearchInput = document.getElementById('logSearchSidebar');
    if (!logSearchInput) return;
    
    logSearchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const logItems = document.querySelectorAll('#uploadedLogsList li:not(.log-list-empty)');
        
        logItems.forEach(item => {
            const logName = item.querySelector('.log-name').textContent.toLowerCase();
            if (logName.includes(searchTerm)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    });
}

/**
 * Set up global search functionality
 */
function setupGlobalSearch() {
    const globalSearchInput = document.getElementById('globalSearch');
    const globalSearchBtn = document.getElementById('globalSearchBtn');
    
    if (!globalSearchInput || !globalSearchBtn) return;
    
    // Function to handle search submission
    const handleSearch = () => {
        const searchTerm = globalSearchInput.value.trim();
        if (searchTerm) {
            // Ensure searchTerm is properly encoded
            const encodedSearchTerm = encodeURIComponent(searchTerm);
            // Navigate to the search page with the query parameter
            window.location.href = `/search?query=${encodedSearchTerm}`;
        }
    };
    
    // Handle search button click
    globalSearchBtn.addEventListener('click', function(e) {
        handleSearch();
    });
    
    // Handle enter key in the input
    globalSearchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleSearch();
            e.preventDefault();
        }
    });
}

/**
 * Setup the search modal functionality
 */
function setupSearchModal() {
    // Get elements
    const sidebarSearchBtn = document.getElementById('sidebarSearchBtn');
    const searchModal = document.getElementById('searchModal');
    const searchModalClose = document.getElementById('searchModalClose');
    const modalSearchButton = document.getElementById('modalSearchButton');
    const modalSearchQuery = document.getElementById('modalSearchQuery');
    
    if (!sidebarSearchBtn || !searchModal) return;
    
    // Open modal when sidebar search button is clicked
    sidebarSearchBtn.addEventListener('click', function(e) {
        e.preventDefault();
        searchModal.classList.add('show');
        
        // Focus on the search input after a short delay
        setTimeout(() => {
            if (modalSearchQuery) modalSearchQuery.focus();
        }, 100);
    });
    
    // Close modal when close button is clicked
    if (searchModalClose) {
        searchModalClose.addEventListener('click', function() {
            searchModal.classList.remove('show');
        });
    }
    
    // Close modal when clicking outside the content
    searchModal.addEventListener('click', function(e) {
        if (e.target === searchModal || e.target.classList.contains('search-modal-backdrop')) {
            searchModal.classList.remove('show');
        }
    });
    
    // Handle search button click in the modal
    if (modalSearchButton && modalSearchQuery) {
        const handleModalSearch = () => {
            const searchTerm = modalSearchQuery.value.trim();
            const severity = document.getElementById('modalSeverityFilter')?.value || '';
            
            if (searchTerm) {
                // Log the search activity
                logActivity('search', {
                    query: searchTerm,
                    severity: severity || 'all',
                    source: 'search_modal'
                });
                
                // Navigate to search page with the query
                window.location.href = `/search?query=${encodeURIComponent(searchTerm)}${
                    severity ? `&severity=${encodeURIComponent(severity)}` : ''
                }`;
            }
        };
        
        // Add click handler
        modalSearchButton.addEventListener('click', handleModalSearch);
        
        // Add enter key handler
        modalSearchQuery.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleModalSearch();
                e.preventDefault();
            }
        });
    }
    
    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && searchModal.classList.contains('show')) {
            searchModal.classList.remove('show');
        }
    });
}

/**
 * Setup sidebar toggle functionality
 */
function setupSidebarToggle() {
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    const sidebar = document.querySelector('.sidebar');
    
    if (sidebarToggleBtn && sidebar) {
        sidebarToggleBtn.addEventListener('click', function() {
            toggleSidebar();
        });
        
        // Make sure sidebar is collapsed by default unless explicitly expanded by user
        const sidebarCollapsed = localStorage.getItem('sidebarCollapsed');
        if (sidebarCollapsed === 'false') {
            // Only expand if user previously expanded
            toggleSidebar();
        } else {
            // Otherwise ensure collapsed state is saved
            localStorage.setItem('sidebarCollapsed', 'true');
        }
    }
}

/**
 * Toggle sidebar open/closed state
 */
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    const body = document.body;
    
    if (sidebar && sidebarToggleBtn) {
        sidebar.classList.toggle('collapsed');
        body.classList.toggle('sidebar-collapsed');
        
        // Update button icon
        if (sidebar.classList.contains('collapsed')) {
            sidebarToggleBtn.innerHTML = '<i class="fas fa-angle-right"></i>';
            localStorage.setItem('sidebarCollapsed', 'true');
        } else {
            sidebarToggleBtn.innerHTML = '<i class="fas fa-angle-left"></i>';
            localStorage.setItem('sidebarCollapsed', 'false');
        }
    }
}

/**
 * Handle sidebar in responsive mode
 */
function handleResponsiveSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const body = document.body;
    
    if (window.innerWidth < 768) {
        // On mobile, always collapse sidebar and add responsive class
        sidebar.classList.add('collapsed', 'mobile-view');
        body.classList.add('sidebar-collapsed');
        localStorage.setItem('sidebarCollapsed', 'true');
    } else {
        // On desktop, remove mobile-specific classes
        sidebar.classList.remove('mobile-view');
    }
}

/**
 * Helper function to truncate filename if it's too long
 */
function truncateFilename(filename, maxLength) {
    if (filename.length <= maxLength) return filename;
    
    const ext = filename.split('.').pop();
    const name = filename.substring(0, filename.length - ext.length - 1);
    
    if (maxLength < 10) return filename.substring(0, maxLength) + '...';
    
    const truncatedName = name.substring(0, maxLength - 5 - ext.length) + '...';
    return truncatedName + '.' + ext;
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
 * Log activity to be stored in activity logs
 */
function logActivity(activityType, details = {}) {
    fetch('/log_activity', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            activity_type: activityType,
            details: details
        })
    }).catch(error => console.error('Error logging activity:', error));
}
