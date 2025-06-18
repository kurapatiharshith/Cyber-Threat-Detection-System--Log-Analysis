/**
 * Log Analyzer - Settings JavaScript
 * Functionality for the settings page
 */

document.addEventListener('DOMContentLoaded', function() {
    // Setup password toggles
    setupPasswordToggles();
    
    // Setup theme options
    setupThemeOptions();
    
    // Setup font size slider
    setupFontSizeSlider();
    
    // Setup form submissions
    setupFormSubmissions();
    
    // Load current settings
    loadCurrentSettings();
});

/**
 * Setup password toggle visibility
 */
function setupPasswordToggles() {
    document.querySelectorAll('.toggle-password').forEach(toggleBtn => {
        toggleBtn.addEventListener('click', function() {
            const targetId = this.dataset.target;
            const passwordInput = document.getElementById(targetId);
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                this.querySelector('i').className = 'fas fa-eye-slash';
            } else {
                passwordInput.type = 'password';
                this.querySelector('i').className = 'fas fa-eye';
            }
        });
    });
}

/**
 * Setup theme options radio buttons
 */
function setupThemeOptions() {
    const themeOptions = document.querySelectorAll('.theme-option');
    const themeRadios = document.querySelectorAll('input[name="theme"]');
    
    // Highlight currently active theme
    const currentTheme = localStorage.getItem('theme') || 'dark';
    document.querySelector(`#${currentTheme}Theme`).checked = true;
    
    // Add click handlers to theme options
    themeOptions.forEach(option => {
        option.addEventListener('click', function() {
            const themeValue = this.dataset.theme;
            document.querySelector(`#${themeValue}Theme`).checked = true;
        });
    });
}

/**
 * Setup font size slider
 */
function setupFontSizeSlider() {
    const fontSizeSlider = document.getElementById('fontSize');
    const fontSizeValue = document.getElementById('fontSizeValue');
    
    if (!fontSizeSlider || !fontSizeValue) return;
    
    // Update displayed value when slider changes
    fontSizeSlider.addEventListener('input', function() {
        fontSizeValue.textContent = `${this.value}px`;
    });
}

/**
 * Setup form submissions
 */
function setupFormSubmissions() {
    // User profile form
    const userSettingsForm = document.getElementById('userSettingsForm');
    if (userSettingsForm) {
        userSettingsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveUserSettings(new FormData(this));
        });
    }
    
    // API settings form
    const apiSettingsForm = document.getElementById('apiSettingsForm');
    if (apiSettingsForm) {
        apiSettingsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveApiSettings(new FormData(this));
        });
        
        // Update threshold value display
        const apiThreshold = document.getElementById('apiThreshold');
        const thresholdValue = document.getElementById('thresholdValue');
        if (apiThreshold && thresholdValue) {
            apiThreshold.addEventListener('input', function() {
                thresholdValue.textContent = `${this.value}%`;
            });
        }
    }
    
    // Notification settings form
    const notificationSettingsForm = document.getElementById('notificationSettingsForm');
    if (notificationSettingsForm) {
        notificationSettingsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveNotificationSettings(new FormData(this));
        });
    }
    
    // Appearance settings
    const saveAppearanceBtn = document.getElementById('saveAppearanceBtn');
    if (saveAppearanceBtn) {
        saveAppearanceBtn.addEventListener('click', function() {
            saveAppearanceSettings();
        });
    }
}

/**
 * Load current user settings
 */
function loadCurrentSettings() {
    // Load user settings
    fetch('/settings')
        .then(response => response.json())
        .then(data => {
            // Apply API settings
            if (data.api_settings) {
                const apiKey = document.getElementById('apiKey');
                const apiThreshold = document.getElementById('apiThreshold');
                const thresholdValue = document.getElementById('thresholdValue');
                
                if (apiKey && data.api_settings.api_key) {
                    apiKey.value = data.api_settings.api_key;
                }
                
                if (apiThreshold && thresholdValue && data.api_settings.threshold) {
                    apiThreshold.value = data.api_settings.threshold;
                    thresholdValue.textContent = `${data.api_settings.threshold}%`;
                }
            }
            
            // Apply notification settings
            if (data.notification_settings) {
                const discordWebhook = document.getElementById('discordWebhook');
                
                if (discordWebhook && data.notification_settings.discord_webhook) {
                    discordWebhook.value = data.notification_settings.discord_webhook;
                }
                
                // Set checkboxes
                if (data.notification_settings.notify_on_upload !== undefined) {
                    document.getElementById('notifyOnUpload').checked = data.notification_settings.notify_on_upload;
                }
                
                if (data.notification_settings.notify_on_analysis !== undefined) {
                    document.getElementById('notifyOnAnalysis').checked = data.notification_settings.notify_on_analysis;
                }
                
                if (data.notification_settings.notify_on_critical !== undefined) {
                    document.getElementById('notifyOnCritical').checked = data.notification_settings.notify_on_critical;
                }
            }
            
            // Apply appearance settings
            if (data.appearance_settings) {
                // Font size
                const fontSize = document.getElementById('fontSize');
                const fontSizeValue = document.getElementById('fontSizeValue');
                
                if (fontSize && fontSizeValue && data.appearance_settings.font_size) {
                    fontSize.value = data.appearance_settings.font_size;
                    fontSizeValue.textContent = `${data.appearance_settings.font_size}px`;
                }
            }
        })
        .catch(error => {
            console.error('Error loading settings:', error);
            showToast('error', 'Failed to load settings');
        });
}

/**
 * Save user profile settings
 */
function saveUserSettings(formData) {
    // Validate passwords match if changing password
    const newPassword = formData.get('new_password');
    const confirmPassword = formData.get('confirm_password');
    
    if (newPassword && newPassword !== confirmPassword) {
        showToast('error', 'New passwords do not match');
        return;
    }
    
    fetch('/settings/user', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast('success', 'User settings updated successfully');
            
            // Clear password fields
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
            
            // Log activity
            logActivity('settings_change', { type: 'user_profile' });
        } else {
            showToast('error', data.message || 'Failed to update user settings');
        }
    })
    .catch(error => {
        console.error('Error saving user settings:', error);
        showToast('error', 'An error occurred while saving settings');
    });
}

/**
 * Save API settings
 */
function saveApiSettings(formData) {
    fetch('/settings/api', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast('success', 'API settings updated successfully');
            
            // Log activity
            logActivity('settings_change', { type: 'api_settings' });
        } else {
            showToast('error', data.message || 'Failed to update API settings');
        }
    })
    .catch(error => {
        console.error('Error saving API settings:', error);
        showToast('error', 'An error occurred while saving settings');
    });
}

/**
 * Save notification settings
 */
function saveNotificationSettings(formData) {
    fetch('/settings/notifications', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast('success', 'Notification settings updated successfully');
            
            // Log activity
            logActivity('settings_change', { type: 'notification_settings' });
        } else {
            showToast('error', data.message || 'Failed to update notification settings');
        }
    })
    .catch(error => {
        console.error('Error saving notification settings:', error);
        showToast('error', 'An error occurred while saving settings');
    });
}

/**
 * Save appearance settings
 */
function saveAppearanceSettings() {
    // Get selected theme
    const selectedTheme = document.querySelector('input[name="theme"]:checked').value;
    
    // Get font size
    const fontSize = document.getElementById('fontSize').value;
    
    // Apply theme immediately
    if (selectedTheme === 'auto') {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
        localStorage.removeItem('theme'); // Remove saved preference to use auto
    } else {
        document.documentElement.setAttribute('data-theme', selectedTheme);
        localStorage.setItem('theme', selectedTheme);
    }
    
    // Update icon on theme toggle button
    updateThemeIcon(document.documentElement.getAttribute('data-theme'));
    
    // Apply font size
    document.documentElement.style.setProperty('--font-size-base', `${fontSize}px`);
    
    // Save to server
    fetch('/settings/appearance', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            theme: selectedTheme,
            font_size: fontSize
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast('success', 'Appearance settings updated successfully');
            
            // Log activity
            logActivity('settings_change', { type: 'appearance_settings' });
        } else {
            showToast('error', data.message || 'Failed to update appearance settings');
        }
    })
    .catch(error => {
        console.error('Error saving appearance settings:', error);
        showToast('error', 'An error occurred while saving settings');
    });
}

/**
 * Show a toast message
 */
function showToast(type, message) {
    // Create toast container if it doesn't exist
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
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
    
    // Show the toast
    const bsToast = new bootstrap.Toast(toast, {
        autohide: true,
        delay: 3000
    });
    
    bsToast.show();
}
