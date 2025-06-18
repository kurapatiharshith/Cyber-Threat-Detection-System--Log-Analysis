/**
 * Log Analyzer - Admin JavaScript
 * Functionality for the admin panel
 */

// Global variables
let currentPage = 1;
let entriesPerPage = 25;
let currentLogFilter = 'all';

document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme based on localStorage setting
    initTheme();

    // Load users
    loadUsers();
    
    // Load activity logs
    loadActivityLogs();
    
    // Setup user management modal events
    setupUserManagement();
    
    // Setup log filtering
    setupLogFiltering();
    
    // Setup system settings
    setupSystemSettings();
});

/**
 * Initialize theme based on localStorage setting
 */
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    
    // Set the correct radio button
    if (savedTheme === 'light') {
        const themeLightBtn = document.getElementById('themeLight');
        const themeLightOption = document.getElementById('themeLightOption');
        if (themeLightBtn) themeLightBtn.checked = true;
        if (themeLightOption) themeLightOption.classList.add('selected');
    } else {
        const themeDarkBtn = document.getElementById('themeDark');
        const themeDarkOption = document.getElementById('themeDarkOption');
        if (themeDarkBtn) themeDarkBtn.checked = true;
        if (themeDarkOption) themeDarkOption.classList.add('selected');
    }
    
    // Apply the theme to the document
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Setup theme switchers
    setupThemeOptions();
}

/**
 * Setup theme option interactions
 */
function setupThemeOptions() {
    const themeLightOption = document.getElementById('themeLightOption');
    const themeDarkOption = document.getElementById('themeDarkOption');
    
    if (themeLightOption) {
        themeLightOption.addEventListener('click', function() {
            const themeLight = document.getElementById('themeLight');
            if (themeLight) themeLight.checked = true;
            themeLightOption.classList.add('selected');
            if (themeDarkOption) themeDarkOption.classList.remove('selected');
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        });
    }
    
    if (themeDarkOption) {
        themeDarkOption.addEventListener('click', function() {
            const themeDark = document.getElementById('themeDark');
            if (themeDark) themeDark.checked = true;
            themeDarkOption.classList.add('selected');
            if (themeLightOption) themeLightOption.classList.remove('selected');
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        });
    }
}

/**
 * Load users into the user management table
 */
function loadUsers() {
    const userTableBody = document.getElementById('userTableBody');
    if (!userTableBody) return;
    
    fetch('/admin/users')
        .then(response => response.json())
        .then(data => {
            if (!data.users || data.users.length === 0) {
                userTableBody.innerHTML = '<tr><td colspan="7" class="text-center">No users found</td></tr>';
                return;
            }
            
            userTableBody.innerHTML = '';
            
            data.users.forEach(user => {
                const tr = document.createElement('tr');
                const lastLogin = user.last_login ? new Date(user.last_login).toLocaleString() : 'Never';
                const created = user.created ? new Date(user.created).toLocaleString() : 'Unknown';
                
                tr.innerHTML = `
                    <td>${user.username}</td>
                    <td>${user.email}</td>
                    <td>
                        <span class="badge ${user.is_admin ? 'bg-primary' : 'bg-secondary'}">
                            ${user.is_admin ? 'Admin' : 'User'}
                        </span>
                    </td>
                    <td>
                        <span class="badge ${user.status === 'active' ? 'bg-success' : 'bg-danger'}">
                            ${user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                        </span>
                    </td>
                    <td>${lastLogin}</td>
                    <td>${created}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary edit-user-btn" data-user-id="${user.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-user-btn ${user.is_admin ? 'disabled' : ''}" 
                            ${user.is_admin ? 'disabled' : ''} data-user-id="${user.id}" data-username="${user.username}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                
                userTableBody.appendChild(tr);
            });
            
            // Add event listeners to edit buttons
            document.querySelectorAll('.edit-user-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const userId = this.dataset.userId;
                    openEditUserModal(userId);
                });
            });
            
            // Add event listeners to delete buttons
            document.querySelectorAll('.delete-user-btn:not(.disabled)').forEach(btn => {
                btn.addEventListener('click', function() {
                    const userId = this.dataset.userId;
                    const username = this.dataset.username;
                    openDeleteUserModal(userId, username);
                });
            });
        })
        .catch(error => {
            console.error('Error loading users:', error);
            userTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading users</td></tr>';
        });
}

/**
 * Open edit user modal with user data
 */
function openEditUserModal(userId) {
    fetch(`/admin/users/${userId}`)
        .then(response => response.json())
        .then(data => {
            if (!data.user) {
                showToast('error', 'User not found');
                return;
            }
            
            // Populate form fields
            document.getElementById('editUserId').value = data.user.id;
            document.getElementById('editUsername').value = data.user.username;
            document.getElementById('editEmail').value = data.user.email;
            document.getElementById('userStatus').value = data.user.status;
            document.getElementById('editUserRole').value = data.user.is_admin ? 'admin' : 'user';
            
            // Reset password fields
            document.getElementById('resetPassword').checked = false;
            document.getElementById('newPasswordFields').style.display = 'none';
            document.getElementById('editNewPassword').value = '';
            document.getElementById('confirmEditPassword').value = '';
            
            // Show modal
            const editUserModal = new bootstrap.Modal(document.getElementById('editUserModal'));
            editUserModal.show();
        })
        .catch(error => {
            console.error('Error fetching user data:', error);
            showToast('error', 'Error fetching user data');
        });
}

/**
 * Open delete user confirmation modal
 */
function openDeleteUserModal(userId, username) {
    // Set user ID and username in the modal
    document.getElementById('deleteUserId').value = userId;
    document.getElementById('deleteUserName').textContent = username;
    
    // Show the modal
    const deleteModal = new bootstrap.Modal(document.getElementById('deleteUserModal'));
    deleteModal.show();
    
    // Setup confirm delete button
    const confirmDeleteBtn = document.getElementById('confirmDeleteUserBtn');
    if (confirmDeleteBtn) {
        // Remove existing event listeners
        const newConfirmBtn = confirmDeleteBtn.cloneNode(true);
        confirmDeleteBtn.parentNode.replaceChild(newConfirmBtn, confirmDeleteBtn);
        
        // Add new event listener
        newConfirmBtn.addEventListener('click', function() {
            deleteUser(userId);
            deleteModal.hide();
        });
    }
}

/**
 * Delete a user
 */
function deleteUser(userId) {
    fetch(`/admin/users/${userId}/delete`, {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast('success', 'User deleted successfully');
            loadUsers();
            
            // Log activity
            logActivity('user_management', { action: 'delete_user', user_id: userId });
        } else {
            showToast('error', data.message || 'Failed to delete user');
        }
    })
    .catch(error => {
        console.error('Error deleting user:', error);
        showToast('error', 'An error occurred while deleting user');
    });
}

/**
 * Load activity logs
 */
function loadActivityLogs() {
    const activityLogTableBody = document.getElementById('activityLogTableBody');
    if (!activityLogTableBody) return;
    
    fetch(`/admin/activity_logs?page=${currentPage}&per_page=${entriesPerPage}&filter=${currentLogFilter}`)
        .then(response => response.json())
        .then(data => {
            if (!data.logs || data.logs.length === 0) {
                activityLogTableBody.innerHTML = '<tr><td colspan="5" class="text-center">No activity logs found</td></tr>';
                updatePagination(0);
                return;
            }
            
            activityLogTableBody.innerHTML = '';
            
            data.logs.forEach(log => {
                const tr = document.createElement('tr');
                const timestamp = new Date(log.timestamp).toLocaleString();
                
                tr.innerHTML = `
                    <td>${timestamp}</td>
                    <td>${log.username}</td>
                    <td>
                        <span class="badge ${getActivityBadgeColor(log.activity_type)}">
                            ${formatActivityType(log.activity_type)}
                        </span>
                    </td>
                    <td>${log.ip_address}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-info view-details-btn" data-log-id="${log.id}">
                            <i class="fas fa-info-circle"></i> Details
                        </button>
                    </td>
                `;
                
                // Store log details for modal
                tr.dataset.details = JSON.stringify(log.details || {});
                activityLogTableBody.appendChild(tr);
            });
            
            // Add event listeners to view details buttons
            document.querySelectorAll('.view-details-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const row = this.closest('tr');
                    const details = JSON.parse(row.dataset.details);
                    showActivityDetails(details);
                });
            });
            
            // Update pagination
            updatePagination(data.total_logs || 0);
        })
        .catch(error => {
            console.error('Error loading activity logs:', error);
            activityLogTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading activity logs</td></tr>';
        });
}

/**
 * Update pagination controls
 */
function updatePagination(totalLogs) {
    const paginationElement = document.getElementById('logPagination');
    if (!paginationElement) return;
    
    const totalPages = Math.ceil(totalLogs / entriesPerPage);
    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage - 1}" aria-label="Previous">
                <span aria-hidden="true">&laquo;</span>
            </a>
        </li>
    `;
    
    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // First page if not visible
    if (startPage > 1) {
        paginationHTML += `
            <li class="page-item">
                <a class="page-link" href="#" data-page="1">1</a>
            </li>
            ${startPage > 2 ? '<li class="page-item disabled"><span class="page-link">...</span></li>' : ''}
        `;
    }
    
    // Visible page numbers
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a>
            </li>
        `;
    }
    
    // Last page if not visible
    if (endPage < totalPages) {
        paginationHTML += `
            ${endPage < totalPages - 1 ? '<li class="page-item disabled"><span class="page-link">...</span></li>' : ''}
            <li class="page-item">
                <a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a>
            </li>
        `;
    }
    
    // Next button
    paginationHTML += `
        <li class="page-item ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage + 1}" aria-label="Next">
                <span aria-hidden="true">&raquo;</span>
            </a>
        </li>
    `;
    
    paginationElement.innerHTML = paginationHTML;
    
    // Add event listeners to pagination links
    document.querySelectorAll('#logPagination .page-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const page = parseInt(this.dataset.page);
            if (page && page !== currentPage && !this.parentElement.classList.contains('disabled')) {
                currentPage = page;
                loadActivityLogs();
            }
        });
    });
}

/**
 * Show activity details in a modal
 */
function showActivityDetails(details) {
    // Format and display details
    const detailContent = document.getElementById('activityDetailsContent');
    if (detailContent) {
        detailContent.textContent = JSON.stringify(details, null, 2);
        
        // Show modal using the correct modal ID
        const activityModal = new bootstrap.Modal(document.getElementById('activityDetailsModal'));
        activityModal.show();
    } else {
        console.error('Activity details content element not found');
    }
}

/**
 * Setup log filtering controls
 */
function setupLogFiltering() {
    // Log type filter
    const logTypeFilter = document.getElementById('logTypeFilter');
    if (logTypeFilter) {
        logTypeFilter.addEventListener('change', function() {
            currentLogFilter = this.value;
            currentPage = 1; // Reset to first page
            loadActivityLogs();
        });
    }
    
    // Entries per page selector
    const logEntriesPerPage = document.getElementById('logEntriesPerPage');
    if (logEntriesPerPage) {
        logEntriesPerPage.addEventListener('change', function() {
            entriesPerPage = parseInt(this.value);
            currentPage = 1; // Reset to first page
            loadActivityLogs();
        });
    }
    
    // Refresh logs button
    const refreshLogsBtn = document.getElementById('refreshLogsBtn');
    if (refreshLogsBtn) {
        refreshLogsBtn.addEventListener('click', function() {
            loadActivityLogs();
        });
    }
    
    // Export logs button
    const exportLogsBtn = document.getElementById('exportLogsBtn');
    if (exportLogsBtn) {
        exportLogsBtn.addEventListener('click', function() {
            exportActivityLogs();
        });
    }
}

/**
 * Export activity logs
 */
function exportActivityLogs() {
    const params = new URLSearchParams({
        filter: currentLogFilter
    }).toString();
    
    fetch(`/admin/activity_logs/export?${params}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            return response.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            const date = new Date().toISOString().slice(0, 10);
            a.style.display = 'none';
            a.href = url;
            a.download = `activity-logs-${date}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            
            // Log activity
            logActivity('export', { type: 'activity_logs', filter: currentLogFilter });
        })
        .catch(error => {
            console.error('Error exporting logs:', error);
            showToast('error', 'Error exporting logs');
        });
}

/**
 * Setup system settings form
 */
function setupSystemSettings() {
    const systemSettingsForm = document.getElementById('systemSettingsForm');
    if (systemSettingsForm) {
        // Load current system settings
        fetch('/admin/system_settings')
            .then(response => response.json())
            .then(data => {
                if (data.settings) {
                    const settings = data.settings;
                    
                    // Storage settings
                    if (settings.log_retention_days) {
                        document.getElementById('logRetentionDays').value = settings.log_retention_days;
                    }
                    
                    if (settings.report_retention_days) {
                        document.getElementById('reportRetentionDays').value = settings.report_retention_days;
                    }
                    
                    if (settings.max_log_file_size) {
                        document.getElementById('maxLogFileSize').value = settings.max_log_file_size;
                    }
                    
                    // Activity logging settings
                    if (settings.log_user_login !== undefined) {
                        document.getElementById('logUserLogin').checked = settings.log_user_login;
                    }
                    
                    if (settings.log_file_upload !== undefined) {
                        document.getElementById('logFileUpload').checked = settings.log_file_upload;
                    }
                    
                    if (settings.log_analysis !== undefined) {
                        document.getElementById('logAnalysis').checked = settings.log_analysis;
                    }
                    
                    if (settings.log_settings_change !== undefined) {
                        document.getElementById('logSettingsChange').checked = settings.log_settings_change;
                    }
                    
                    // Theme settings
                    if (settings.light_theme) {
                        document.querySelector(`input[name="light_theme"][value="${settings.light_theme}"]`).checked = true;
                    }
                    
                    if (settings.dark_theme) {
                        document.querySelector(`input[name="dark_theme"][value="${settings.dark_theme}"]`).checked = true;
                    }
                    
                    if (settings.light_accent_color) {
                        document.getElementById('lightAccentColor').value = settings.light_accent_color;
                    }
                    
                    if (settings.dark_accent_color) {
                        document.getElementById('darkAccentColor').value = settings.dark_accent_color;
                    }
                    
                    // Apply theme to preview
                    updatePalettePreview();
                }
            })
            .catch(error => {
                console.error('Error loading system settings:', error);
                showToast('error', 'Failed to load system settings');
            });
        
        // Theme preview handlers
        document.querySelectorAll('input[name="light_theme"], input[name="dark_theme"]').forEach(radio => {
            radio.addEventListener('change', updatePalettePreview);
        });
        
        document.getElementById('lightAccentColor').addEventListener('input', updatePalettePreview);
        document.getElementById('darkAccentColor').addEventListener('input', updatePalettePreview);
        
        // Submit form
        systemSettingsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            
            // Add color values
            formData.append('light_accent_color', document.getElementById('lightAccentColor').value);
            formData.append('dark_accent_color', document.getElementById('darkAccentColor').value);
            
            fetch('/admin/system_settings', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showToast('success', 'System settings updated successfully');
                    
                    // Apply theme settings globally
                    applyThemeSettings();
                    
                    // Log activity
                    logActivity('settings_change', { type: 'system_settings' });
                } else {
                    showToast('error', data.message || 'Failed to update system settings');
                }
            })
            .catch(error => {
                console.error('Error updating system settings:', error);
                showToast('error', 'An error occurred while updating settings');
            });
        });
    }
}

/**
 * Update palette preview based on selected theme
 */
function updatePalettePreview() {
    // Light theme
    const lightTheme = document.querySelector('input[name="light_theme"]:checked').value;
    const lightPalette = document.querySelector('.light-palette');
    
    // Reset custom attributes
    lightPalette.querySelectorAll('.palette-item').forEach(item => {
        item.style.backgroundColor = '';
    });
    
    // Set accent color
    const lightAccentColor = document.getElementById('lightAccentColor').value;
    lightPalette.querySelector('.accent').style.backgroundColor = lightAccentColor;
    
    // Dark theme
    const darkTheme = document.querySelector('input[name="dark_theme"]:checked').value;
    const darkPalette = document.querySelector('.dark-palette');
    
    // Reset custom attributes
    darkPalette.querySelectorAll('.palette-item').forEach(item => {
        item.style.backgroundColor = '';
    });
    
    // Set accent color
    const darkAccentColor = document.getElementById('darkAccentColor').value;
    darkPalette.querySelector('.accent').style.backgroundColor = darkAccentColor;
}

/**
 * Apply theme settings to the document
 */
function applyThemeSettings() {
    // Light theme
    const lightTheme = document.querySelector('input[name="light_theme"]:checked').value;
    const lightAccentColor = document.getElementById('lightAccentColor').value;
    
    // Dark theme
    const darkTheme = document.querySelector('input[name="dark_theme"]:checked').value;
    const darkAccentColor = document.getElementById('darkAccentColor').value;
    
    // Save to localStorage for application on page load
    localStorage.setItem('lightTheme', lightTheme);
    localStorage.setItem('lightAccentColor', lightAccentColor);
    localStorage.setItem('darkTheme', darkTheme);
    localStorage.setItem('darkAccentColor', darkAccentColor);
    
    // Apply if current theme matches
    const currentTheme = document.documentElement.getAttribute('data-theme');
    
    if (currentTheme === 'light') {
        document.documentElement.setAttribute('data-custom-theme', lightTheme);
        if (lightTheme === 'custom') {
            applyCustomAccentColor(lightAccentColor, 'light');
        }
    } else {
        document.documentElement.setAttribute('data-custom-theme', darkTheme);
        if (darkTheme === 'custom') {
            applyCustomAccentColor(darkAccentColor, 'dark');
        }
    }
}

/**
 * Apply custom accent color
 */
function applyCustomAccentColor(color, mode) {
    const root = document.documentElement;
    if (mode === 'light') {
        root.style.setProperty('--custom-accent-light', color);
        // Generate a slightly darker color for hover
        root.style.setProperty('--custom-accent-hover-light', adjustColorBrightness(color, -10));
        root.setAttribute('data-custom-accent-light', 'true');
    } else {
        root.style.setProperty('--custom-accent-dark', color);
        root.style.setProperty('--custom-accent-hover-dark', adjustColorBrightness(color, -10));
        root.setAttribute('data-custom-accent-dark', 'true');
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
 * Setup user management modals and actions
 */
function setupUserManagement() {
    // Add User button
    const addUserBtn = document.getElementById('addUserBtn');
    if (addUserBtn) {
        // Remove existing event listeners to prevent duplicates
        const newAddUserBtn = addUserBtn.cloneNode(true);
        addUserBtn.parentNode.replaceChild(newAddUserBtn, addUserBtn);
        
        newAddUserBtn.addEventListener('click', function() {
            // Reset form before showing
            const form = document.getElementById('addUserForm');
            if (form) form.reset();
            
            // Show the modal using Bootstrap's API
            const addUserModal = new bootstrap.Modal(document.getElementById('addUserModal'), {
                backdrop: true,  // Allow clicking outside to close
                keyboard: true   // Allow ESC key to close
            });
            addUserModal.show();
        });
    }
    
    // Setup password validation for add user form
    const newPassword = document.getElementById('newPassword');
    const confirmNewPassword = document.getElementById('confirmNewPassword');
    
    if (newPassword && confirmNewPassword) {
        confirmNewPassword.addEventListener('input', function() {
            if (this.value !== newPassword.value) {
                this.classList.add('is-invalid');
            } else {
                this.classList.remove('is-invalid');
            }
        });
    }
    
    // Submit Add User form
    const submitAddUserBtn = document.getElementById('submitAddUserBtn');
    if (submitAddUserBtn) {
        submitAddUserBtn.addEventListener('click', function() {
            const form = document.getElementById('addUserForm');
            const formData = new FormData(form);
            
            // Validate form
            if (!validateUserForm(form)) {
                return;
            }
            
            // Send request
            fetch('/admin/users/add', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Close modal and reload users
                    bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
                    form.reset();
                    loadUsers();
                    
                    showToast('success', 'User added successfully');
                    
                    // Log activity
                    logActivity('user_management', { action: 'add_user', username: formData.get('username') });
                } else {
                    showToast('error', data.message || 'Failed to add user');
                }
            })
            .catch(error => {
                console.error('Error adding user:', error);
                showToast('error', 'An error occurred while adding user');
            });
        });
    }
    
    // Reset password checkbox toggle
    const resetPasswordCheck = document.getElementById('resetPassword');
    if (resetPasswordCheck) {
        resetPasswordCheck.addEventListener('change', function() {
            document.getElementById('newPasswordFields').style.display = this.checked ? 'block' : 'none';
        });
    }
    
    // Edit User Password Validation
    const editNewPassword = document.getElementById('editNewPassword');
    const confirmEditPassword = document.getElementById('confirmEditPassword');
    
    if (editNewPassword && confirmEditPassword) {
        confirmEditPassword.addEventListener('input', function() {
            if (this.value !== editNewPassword.value) {
                this.classList.add('is-invalid');
            } else {
                this.classList.remove('is-invalid');
            }
        });
    }
    
    // Submit Edit User form
    const submitEditUserBtn = document.getElementById('submitEditUserBtn');
    if (submitEditUserBtn) {
        submitEditUserBtn.addEventListener('click', function() {
            const form = document.getElementById('editUserForm');
            const formData = new FormData(form);
            const userId = formData.get('user_id');
            
            // Validate form if resetting password
            if (formData.get('reset_password') === 'on' && !validatePasswordReset(form)) {
                return;
            }
            
            // Send request
            fetch(`/admin/users/${userId}/edit`, {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Close modal and reload users
                    bootstrap.Modal.getInstance(document.getElementById('editUserModal')).hide();
                    form.reset();
                    document.getElementById('newPasswordFields').style.display = 'none';
                    loadUsers();
                    
                    showToast('success', 'User updated successfully');
                    
                    // Log activity
                    logActivity('user_management', { 
                        action: 'edit_user', 
                        username: document.getElementById('editUsername').value 
                    });
                } else {
                    showToast('error', data.message || 'Failed to update user');
                }
            })
            .catch(error => {
                console.error('Error updating user:', error);
                showToast('error', 'An error occurred while updating user');
            });
        });
    }
}

/**
 * Validate user form inputs
 */
function validateUserForm(form) {
    const username = form.elements.username.value;
    const email = form.elements.email.value;
    const password = form.elements.password.value;
    const confirmPassword = form.elements.confirm_password.value;
    
    if (!username || username.length < 3) {
        showToast('error', 'Username must be at least 3 characters long');
        return false;
    }
    
    if (!validateEmail(email)) {
        showToast('error', 'Please enter a valid email address');
        return false;
    }
    
    if (!password || password.length < 8) {
        showToast('error', 'Password must be at least 8 characters long');
        return false;
    }
    
    if (password !== confirmPassword) {
        showToast('error', 'Passwords do not match');
        return false;
    }
    
    return true;
}

/**
 * Validate password reset fields
 */
function validatePasswordReset(form) {
    const newPassword = form.elements.new_password.value;
    const confirmPassword = form.elements.confirm_new_password.value;
    
    if (!newPassword || newPassword.length < 8) {
        showToast('error', 'New password must be at least 8 characters long');
        return false;
    }
    
    if (newPassword !== confirmPassword) {
        showToast('error', 'Passwords do not match');
        return false;
    }
    
    return true;
}

/**
 * Validate email format
 */
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Get badge color for activity type
 */
function getActivityBadgeColor(activityType) {
    switch (activityType) {
        case 'login':
        case 'logout':
            return 'bg-info';
        case 'upload':
            return 'bg-primary';
        case 'analyze':
            return 'bg-success';
        case 'download_report':
            return 'bg-secondary';
        case 'settings_change':
            return 'bg-warning';
        case 'user_management':
            return 'bg-danger';
        default:
            return 'bg-secondary';
    }
}

/**
 * Format activity type for display
 */
function formatActivityType(activityType) {
    return activityType
        .replace('_', ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Show toast notification
 */
function showToast(type, message) {
    // Create toast container if it doesn't exist
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast
    const toastId = `toast-${Date.now()}`;
    const toast = document.createElement('div');
    toast.className = `toast align-items-center border-0 ${type === 'success' ? 'bg-success' : 'bg-danger'} text-white`;
    toast.id = toastId;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Show toast
    const bsToast = new bootstrap.Toast(toast, {
        autohide: true,
        delay: 3000
    });
    
    bsToast.show();
}

/**
 * Log activity to server
 */
function logActivity(activity_type, details = {}) {
    fetch('/log_activity', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            activity_type: activity_type,
            details: details
        })
    }).catch(error => {
        console.error('Error logging activity:', error);
    });
}
