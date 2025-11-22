// public/dashboard.js

// === Utility Functions ===

/**
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

/**
 * Displays a temporary message (success or error) in the message area.
 * @param {string} message 
 * @param {boolean} isError 
 */
const showMessage = (message, isError = false) => {
    const messageArea = document.getElementById('message-area');
    messageArea.textContent = message;
    messageArea.className = `text-sm font-medium ${isError ? 'text-red-600' : 'text-green-600'}`;
    
    setTimeout(() => {
        messageArea.textContent = '';
    }, 4000);
};


// === Rendering Functions ===

/**
 * Creates a table row element (<tr>) for a single link object.
 */
const createLinkRow = (link) => {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50 transition duration-100';

    const shortUrl = `${window.location.origin}/${link.short_code}`;

    row.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
            <a href="/${link.short_code}" target="_blank" class="hover:underline">
                ${link.short_code}
            </a>
            <button class="copy-btn ml-2 text-gray-400 hover:text-blue-500" data-url="${shortUrl}" title="Copy Link">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5h4m-4 4h4m-4 8h4"/>
                </svg>
            </button>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            <span class="truncate-url" title="${link.target_url}">${link.target_url}</span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${link.total_clicks}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatTimestamp(link.last_clicked)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <a href="/code/${link.short_code}" class="text-indigo-600 hover:text-indigo-900 mr-4">Stats</a>
            <button data-code="${link.short_code}" class="delete-btn text-red-600 hover:text-red-900">Delete</button>
        </td>
    `;
    return row;
};

/**
 * Fetches all links and updates the dashboard table, showing empty/loading states.
 */
const fetchAndRenderLinks = async () => {
    const tableBody = document.getElementById('links-table-body');
    const loadingState = document.getElementById('loading-state');
    const emptyState = document.getElementById('empty-state');
    const tableContainer = document.getElementById('links-table-container');

    tableBody.innerHTML = ''; 
    loadingState.classList.remove('hidden'); 
    emptyState.classList.add('hidden');
    tableContainer.classList.add('hidden');

    try {
        const response = await fetch('/api/links');
        
        if (!response.ok) {
            // Check for non-200 responses (e.g., 500)
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const links = await response.json();

        // FIX: Ensure the result is an array before using forEach or checking length
        if (!Array.isArray(links)) {
            console.error('API returned non-array data:', links);
            throw new Error('API did not return a list of links.');
        }

        if (links.length === 0) {
            emptyState.classList.remove('hidden'); 
        } else {
            links.forEach(link => {
                tableBody.appendChild(createLinkRow(link));
            });
            tableContainer.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Failed to fetch links:', error);
        showMessage('Failed to load links from the server.', true);
    } finally {
        loadingState.classList.add('hidden'); 
    }
};


// === Event Handlers (Form Submission and Table Actions) ===

const handleCreateLink = async (event) => {
    event.preventDefault();
    
    const form = document.getElementById('create-link-form');
    const urlInput = document.getElementById('target-url');
    const codeInput = document.getElementById('short-code');
    const submitBtn = document.getElementById('submit-button');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Shortening...';

    const payload = {
        target_url: urlInput.value.trim(),
        ...(codeInput.value.trim() && { short_code: codeInput.value.trim() })
    };

    try {
        const response = await fetch('/api/links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (response.ok) {
            showMessage(`Link created successfully! Code: ${result.short_code}`, false);
            form.reset(); 
            fetchAndRenderLinks();
        } else if (response.status === 409) {
            showMessage(result.error || 'Custom code already in use.', true); // Handles 409 Conflict
        } else {
            showMessage(result.error || 'An error occurred during link creation.', true);
        }

    } catch (error) {
        console.error('Network error:', error);
        showMessage('A network error occurred. Check your connection.', true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Shorten Link';
    }
};

const handleTableActions = async (event) => {
    const target = event.target.closest('.delete-btn, .copy-btn');
    if (!target) return;

    if (target.classList.contains('delete-btn')) {
        const code = target.dataset.code;
        if (confirm(`Are you sure you want to delete the link with code: ${code}?`)) {
            try {
                const response = await fetch(`/api/links/${code}`, {
                    method: 'DELETE',
                });

                if (response.status === 204) {
                    showMessage(`Link '${code}' deleted successfully.`, false);
                    fetchAndRenderLinks();
                } else if (response.status === 404) {
                    showMessage(`Link '${code}' not found.`, true);
                } else {
                    const result = await response.json();
                    showMessage(result.error || 'Failed to delete link.', true);
                }
            } catch (error) {
                console.error('Network error during deletion:', error);
                showMessage('A network error occurred during deletion.', true);
            }
        }
    } else if (target.classList.contains('copy-btn')) {
        const urlToCopy = target.dataset.url;
        try {
            await navigator.clipboard.writeText(urlToCopy);
            showMessage('Link copied to clipboard!', false);
        } catch (err) {
            console.error('Could not copy text: ', err);
            showMessage('Failed to copy link. Please copy manually.', true);
        }
    }
};


// === Initialization ===
document.addEventListener('DOMContentLoaded', () => {
    fetchAndRenderLinks();
    document.getElementById('create-link-form').addEventListener('submit', handleCreateLink);
    document.getElementById('links-table-container').addEventListener('click', handleTableActions);
});