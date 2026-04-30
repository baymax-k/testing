/**
 * Common utility functions for CodeEthnics frontend
 */

const API_BASE = '/api/v1';

// Auth functions
async function signOut() {
    try {
        await fetch(`${API_BASE}/auth/sign-out`, { method: 'POST' });
        window.location.href = '/test/login.html';
    } catch (err) {
        console.error('Sign out failed:', err);
    }
}

async function checkAuth() {
    try {
        const res = await fetch(`${API_BASE}/me`);
        if (res.status === 401) {
            window.location.href = '/test/login.html';
            return false;
        }
        return true;
    } catch (err) {
        window.location.href = '/test/login.html';
        return false;
    }
}

// Fetch utilities
async function fetchAPI(endpoint, options = {}) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options
        });
        
        if (res.status === 401) {
            window.location.href = '/test/login.html';
            return null;
        }
        
        const data = await res.json();
        return { status: res.status, data };
    } catch (err) {
        console.error('API fetch error:', err);
        return null;
    }
}

// DOM utilities
function showMessage(elementId, message, type = 'error') {
    const el = document.getElementById(elementId);
    if (el) {
        el.className = `alert alert-${type}`;
        el.innerHTML = message;
        el.style.display = 'block';
    }
}

function hideMessage(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
        el.style.display = 'none';
    }
}

// URL parameter helper
function getURLParam(param) {
    return new URLSearchParams(window.location.search).get(param);
}

// Format date
function formatDate(dateString) {
    return new Date(dateString).toLocaleString();
}

// Format difficulty badge
function getDifficultyBadge(difficulty) {
    const level = (difficulty || 'unknown').toLowerCase();
    return `<span class="badge difficulty-${level}">${level.toUpperCase()}</span>`;
}

// Format status badge
function getStatusBadge(status) {
    const key = (status || '').toLowerCase().replace(/_/g, '-');
    const labels = {
        'accepted': 'Accepted',
        'wrong-answer': 'Wrong Answer',
        'time-limit-exceeded': 'Time Limit',
        'memory-limit-exceeded': 'Memory Limit',
        'runtime-error': 'Runtime Error',
        'compilation-error': 'Compilation Error',
        'processing': 'Processing',
        'internal-error': 'Internal Error'
    };
    const label = labels[key] || status || 'Unknown';
    
    let badgeClass = 'badge-gray';
    if (key === 'accepted') badgeClass = 'badge-success';
    else if (key === 'processing') badgeClass = 'badge-warning';
    else if (key.includes('error') || key.includes('wrong')) badgeClass = 'badge-error';
    
    return `<span class="badge ${badgeClass}">${label}</span>`;
}

// Loading state helpers
function showLoading(elementId, message = 'Loading...') {
    const el = document.getElementById(elementId);
    if (el) {
        el.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                ${message}
            </div>
        `;
    }
}

function hideLoading(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
        const loading = el.querySelector('.loading');
        if (loading) {
            loading.remove();
        }
    }
}

// Toast notifications
function showToast(message, type = 'info', duration = 3000) {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `alert alert-${type}`;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        min-width: 300px;
        animation: slideIn 0.3s ease;
    `;
    toast.innerHTML = message;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    // Add to DOM
    document.body.appendChild(toast);
    
    // Auto remove
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, duration);
}

// Form validation helpers
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePassword(password) {
    return password && password.length >= 8;
}

// Local storage helpers
function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
        console.error('Failed to save to localStorage:', err);
    }
}

function loadFromStorage(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (err) {
        console.error('Failed to load from localStorage:', err);
        return defaultValue;
    }
}

// Theme helpers
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    saveToStorage('theme', theme);
}

function getTheme() {
    return loadFromStorage('theme', 'light');
}

// Initialize theme on load
document.addEventListener('DOMContentLoaded', () => {
    const theme = getTheme();
    setTheme(theme);
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        signOut,
        checkAuth,
        fetchAPI,
        showMessage,
        hideMessage,
        getURLParam,
        formatDate,
        getDifficultyBadge,
        getStatusBadge,
        showLoading,
        hideLoading,
        showToast,
        validateEmail,
        validatePassword,
        saveToStorage,
        loadFromStorage,
        setTheme,
        getTheme
    };
}
