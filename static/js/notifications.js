/**
 * Notification System
 * Properly displays notification messages in the UI
 */

class NotificationSystem {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Create notifications container if it doesn't exist
        if (!document.querySelector('.notifications-container')) {
            this.container = document.createElement('div');
            this.container.className = 'notifications-container';
            document.body.appendChild(this.container);
        } else {
            this.container = document.querySelector('.notifications-container');
        }
    }

    show(message, type = 'info', duration = 5000) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification-toast ${type}`;
        
        // Create notification content
        notification.innerHTML = `
            <div class="notification-content p-3">
                <div class="d-flex align-items-center">
                    <i class="notification-icon me-3 ${this.getIconClass(type)}"></i>
                    <div class="notification-message">${message}</div>
                    <button type="button" class="btn-close ms-auto" aria-label="Close"></button>
                </div>
            </div>
        `;
        
        // Add to container
        this.container.appendChild(notification);
        
        // Add event listener for close button
        const closeButton = notification.querySelector('.btn-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => this.close(notification));
        }
        
        // Auto close after duration
        setTimeout(() => {
            if (notification.parentNode) {
                this.close(notification);
            }
        }, duration);
        
        return notification;
    }
    
    close(notification) {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300); // Match the CSS animation duration
    }
    
    getIconClass(type) {
        switch(type) {
            case 'success': return 'fas fa-check-circle';
            case 'error': return 'fas fa-times-circle';
            case 'warning': return 'fas fa-exclamation-triangle';
            default: return 'fas fa-info-circle';
        }
    }
    
    // Helper methods for different notification types
    success(message, duration) {
        return this.show(message, 'success', duration);
    }
    
    error(message, duration) {
        return this.show(message, 'error', duration);
    }
    
    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }
    
    info(message, duration) {
        return this.show(message, 'info', duration);
    }
}

// Create global notifications object
const notifications = new NotificationSystem();

// Example usage:
// notifications.success('Operation completed successfully');
// notifications.error('An error occurred');
// notifications.warning('Warning message');
// notifications.info('Information message');
