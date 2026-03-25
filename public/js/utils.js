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
        el.className = type;
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
    return `<span class="difficulty ${difficulty.toLowerCase()}">${difficulty}</span>`;
}

// Format status badge
function getStatusBadge(status) {
    return `<span class="status ${status.toLowerCase()}">${status}</span>`;
}
