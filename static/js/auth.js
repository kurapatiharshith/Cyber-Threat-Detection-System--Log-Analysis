document.addEventListener('DOMContentLoaded', function() {
    console.log('Auth.js loaded');
    
    // Initialize theme from localStorage
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Check if we're on the login page
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        // Clear all authentication data on login page load
        localStorage.removeItem('userSession');
        sessionStorage.removeItem('userSession');
        
        // Clear cookies that might be related to authentication
        document.cookie.split(';').forEach(function(cookie) {
            const eqPos = cookie.indexOf('=');
            const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
            document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
        });
        
        // Add this meta tag to prevent caching
        const meta = document.createElement('meta');
        meta.httpEquiv = 'Cache-Control';
        meta.content = 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0';
        document.head.appendChild(meta);
        
        // Add no-cache pragma
        const noCacheMeta = document.createElement('meta');
        noCacheMeta.httpEquiv = 'Pragma';
        noCacheMeta.content = 'no-cache';
        document.head.appendChild(noCacheMeta);
        
        // Add expires meta
        const expiresMeta = document.createElement('meta');
        expiresMeta.httpEquiv = 'Expires';
        expiresMeta.content = '0';
        document.head.appendChild(expiresMeta);
        
        // Remember-me functionality
        const rememberMeCheckbox = document.getElementById('rememberMe');
        if (rememberMeCheckbox) {
            loginForm.addEventListener('submit', function() {
                if (rememberMeCheckbox.checked) {
                    localStorage.setItem('rememberMe', 'true');
                } else {
                    localStorage.removeItem('rememberMe');
                }
            });
        }
        
        // REMOVE THIS CODE - it's causing a reload loop
        // if (document.referrer && document.referrer.includes(window.location.origin)) {
        //     window.location.reload(true);
        // }
    }
    
    // Check if we're on a page with logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            // Clean up local storage
            localStorage.removeItem('userSession');
            sessionStorage.removeItem('userSession');
            localStorage.removeItem('rememberMe');
            
            // Let the normal logout process occur
            // (don't add cache-busting parameters here)
        });
    }
    
    // Add global AJAX error handler to detect auth redirects
    if (typeof $ !== 'undefined') {
        $(document).ajaxError(function(event, jqXHR, ajaxSettings, thrownError) {
            // If we get redirected to login page (HTML response) when expecting JSON
            if (jqXHR.responseText && jqXHR.responseText.includes('<!DOCTYPE html>') && 
                ajaxSettings.dataType === 'json') {
                console.log('Session expired or not authenticated. Redirecting to login page.');
                window.location.href = '/login?expired=true';
            }
        });
    }
});

// Keep this empty function as a placeholder
function checkSession() {
    return;
}
