

/*
 * Formats a timestamp into a readable string or returns N/A if null.
 * @param {string | null} timestamp 
 * @returns {string}
 */
const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Intl.DateTimeFormat('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
    }).format(new Date(timestamp));
};

/*
 * Renders the fetched link data onto the stats page and handles visibility of states.
 * @param {Object} data 
 */
const renderStats = (data) => {
    document.getElementById('stat-short-code').textContent = data.short_code;
    document.getElementById('stat-target-url').textContent = data.target_url;
    document.getElementById('stat-total-clicks').textContent = data.total_clicks;
    document.getElementById('stat-created-at').textContent = formatTimestamp(data.created_at);
    document.getElementById('stat-last-clicked').textContent = formatTimestamp(data.last_clicked);

    document.getElementById('stats-container').classList.remove('hidden');
};

/*
 * Fetches the statistics for a given short code using the backend API.
 * @param {string} code 
 */
const fetchStats = async (code) => {
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    
    // Show loading state, hide other states
    loadingState.classList.remove('hidden');
    errorState.classList.add('hidden');
    document.getElementById('stats-container').classList.add('hidden');

    try {
        // GET /api/links/:code
        const response = await fetch(`/api/links/${code}`);
        const data = await response.json();

        if (response.ok) {
            renderStats(data);
        } else if (response.status === 404) {
            errorMessage.textContent = `Error: Link /${code} not found.`;
            errorState.classList.remove('hidden');
        } else {
            errorMessage.textContent = `Error: ${data.error || 'Server error occurred.'}`;
            errorState.classList.remove('hidden');
        }

    } catch (error) {
        errorMessage.textContent = 'A network error occurred while fetching stats.';
        errorState.classList.remove('hidden');
        console.error('Fetch Stats Error:', error);
    } finally {
        loadingState.classList.add('hidden');
    }
};

/*
 * Initialization: Extracts the code from the URL and starts the fetch.
 */
document.addEventListener('DOMContentLoaded', () => {
    // URL format is /code/:code, so we extract the code from the path
    const pathSegments = window.location.pathname.split('/');
    // pathSegments will look like: ["", "code", "YOUR_CODE"]
    const shortCode = pathSegments[2];

    if (shortCode) {
        fetchStats(shortCode);
    } else {
        document.getElementById('error-message').textContent = 'Error: No short code provided in the URL.';
        document.getElementById('error-state').classList.remove('hidden');
    }
});