/**
 * K-Pop Voting Results Viewer
 * High-performance data table visualization
 */

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
    dataPath: './results.json',
    animationDelay: 50,
    scrollOffset: 100
};

// ============================================================================
// Icons (Heroicons SVG)
// ============================================================================

const ICONS = {
    group: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>`,
    idol: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>`,
    album: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg>`,
    track: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg>`,
    category: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>`,
    chart: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>`,
    streams: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>`,
    expand: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>`,
    collapse: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>`,
    copy: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>`,
    link: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>`
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse URL parameters
 */
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        id: params.get('id'),
        hash: window.location.hash.slice(1)
    };
}

/**
 * Parse vote strings like "Hearts2Hearts (45)", "Neuroprophet (#1)" into structured data
 * Handles both count format (45) and position format (#1)
 * Also handles multiple positions as single badge: "Tigran (#1, #1, #1, #2, #3)"
 */
function parseVoteString(str) {
    if (!str) return [];
    
    const results = [];
    
    // Match name with parentheses containing one or more values
    // e.g., "Name (#1)" or "Name (#1, #1, #2)" or "Name (45)"
    const regex = /([^,]+?)\s*\(([^)]+)\)(?:,|$)/g;
    let match;
    
    while ((match = regex.exec(str)) !== null) {
        const name = match[1].trim();
        const valuesStr = match[2].trim();
        
        // Validate that the content looks like positions or counts (all items are #?\d+)
        const values = valuesStr.split(',').map(v => v.trim()).filter(Boolean);
        const allValid = values.every(v => /^#?\d+$/.test(v));
        
        if (allValid && values.length > 0) {
            // Keep as single badge with all positions/values shown together
            // Calculate numeric value from first position for sorting
            const firstValue = values[0];
            results.push({
                name: name,
                value: valuesStr, // Keep full string like "#1, #1, #1, #2, #3"
                numericValue: parseInt(firstValue.replace('#', ''), 10)
            });
        }
    }
    
    // Sort by numeric value descending (for counts) or ascending (for positions with #)
    const hasPositions = results.some(r => r.value.startsWith('#'));
    if (hasPositions) {
        return results.sort((a, b) => a.numericValue - b.numericValue);
    }
    return results.sort((a, b) => b.numericValue - a.numericValue);
}

/**
 * Parse track contribution strings like "TRACK NAME [views: 123 | popularity: 45]"
 */
function parseTrackContributions(str) {
    if (!str) return [];
    
    const regex = /([^\[,]+)\s*\[views:\s*([\d,]+)\s*\|\s*popularity:\s*(\d+)\]/g;
    const results = [];
    let match;
    
    while ((match = regex.exec(str)) !== null) {
        results.push({
            name: match[1].trim(),
            views: match[2],
            popularity: parseInt(match[3], 10)
        });
    }
    
    return results;
}

/**
 * Format large numbers
 */
function formatNumber(num) {
    if (typeof num === 'string') {
        num = parseInt(num.replace(/,/g, ''), 10);
    }
    
    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(1) + 'B';
    }
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Smooth scroll to element
 */
function scrollToElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        setTimeout(() => {
            const y = element.getBoundingClientRect().top + window.pageYOffset - CONFIG.scrollOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
            
            // Highlight effect
            element.classList.add('ring-2', 'ring-accent-violet', 'ring-offset-2', 'ring-offset-void');
            setTimeout(() => {
                element.classList.remove('ring-2', 'ring-accent-violet', 'ring-offset-2', 'ring-offset-void');
            }, 2000);
        }, 100);
    }
}

// ============================================================================
// Render Functions
// ============================================================================

/**
 * Render vote badges with counts or positions
 */
function renderVoteBadges(voteString, badgeClass = 'badge-default') {
    const votes = parseVoteString(voteString);
    if (votes.length === 0) return '<span class="text-gray-500 text-sm">—</span>';
    
    return votes.map(vote => `
        <span class="vote-badge ${badgeClass}">
            <span>${escapeHtml(vote.name)}</span>
            <span class="vote-count">${vote.value}</span>
        </span>
    `).join('');
}

/**
 * Render track contributions with Spotify data
 */
function renderTrackContributions(trackString) {
    const tracks = parseTrackContributions(trackString);
    if (tracks.length === 0) return '<span class="text-gray-500 text-sm">—</span>';
    
    return `
        <div class="space-y-1.5">
            ${tracks.map(track => `
                <div class="flex items-center justify-between gap-3 py-1.5 px-2 rounded-lg hover:bg-surface-hover/50 transition-colors group">
                    <span class="text-sm text-gray-300 truncate flex-1">${escapeHtml(track.name)}</span>
                    <div class="flex items-center gap-3 flex-shrink-0">
                        <span class="track-streams" title="Streams on Spotify">
                            <span class="font-mono text-xs text-accent-cyan">${formatNumber(track.views)}</span>
                            <span class="font-mono text-xs text-gray-300">streams, </span>
                        </span>
                        <span class="track-popularity" title="Spotify Popularity Score">
                            <span class="font-mono text-xs text-gray-300">${track.popularity}</span>
                            <div class="inline-block w-6 h-1.5 bg-surface-light rounded-full overflow-hidden align-middle ml-1">
                                <div class="h-full rounded-full ${getPopularityColor(track.popularity)}" style="width: ${track.popularity}%"></div>
                            </div>
                            <span class="font-mono text-xs text-gray-300">spotify_score</span>
                        </span>
                    </div>
                </div>
            `).join('')}    
        </div>
    `;
}

/**
 * Get color class based on popularity
 */
function getPopularityColor(popularity) {
    if (popularity >= 80) return 'bg-green-400';
    if (popularity >= 60) return 'bg-accent-cyan';
    if (popularity >= 40) return 'bg-accent-violet';
    return 'bg-accent-pink';
}

/**
 * Parse "TRACK (Company Name)" format items
 */
function parseTrackCompanyString(str) {
    if (!str) return [];
    
    // Split by comma, but handle commas inside parentheses
    const results = [];
    let current = '';
    let parenDepth = 0;
    
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char === '(') parenDepth++;
        if (char === ')') parenDepth--;
        
        if (char === ',' && parenDepth === 0) {
            if (current.trim()) results.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    if (current.trim()) results.push(current.trim());
    
    // Parse each item
    return results.map(item => {
        const match = item.match(/^(.+?)\s*\(([^)]+)\)$/);
        if (match) {
            return { name: match[1].trim(), company: match[2].trim() };
        }
        return { name: item, company: null };
    });
}

/**
 * Render track with company badges
 */
function renderTrackCompanyBadges(str) {
    const items = parseTrackCompanyString(str);
    if (items.length === 0) return '<span class="text-gray-500">—</span>';
    
    return `<div class="space-y-1">
        ${items.map(item => `
            <div class="flex items-center gap-2 py-0.5">
                <span class="text-gray-300 text-sm">${escapeHtml(item.name)}</span>
                ${item.company ? `<span class="text-xs px-1.5 py-0.5 bg-surface-light rounded text-gray-500">${escapeHtml(item.company)}</span>` : ''}
            </div>
        `).join('')}
    </div>`;
}

/**
 * Parse MBTI format: "INFP (2) [Ningning, Shuhua]\nENTP (1) [Asa]"
 */
function parseMbtiString(str) {
    if (!str) return [];
    
    // Split by newlines (handle both \n and actual newlines)
    const lines = str.split(/\\n|\n/).filter(line => line.trim());
    
    return lines.map(line => {
        // Match: TYPE (count) [names]
        const match = line.match(/^([A-Z]{4})\s*\((\d+)\)\s*\[([^\]]+)\]/);
        if (match) {
            return {
                type: match[1],
                count: parseInt(match[2], 10),
                names: match[3].split(',').map(n => n.trim())
            };
        }
        return null;
    }).filter(Boolean);
}

/**
 * Render MBTI badges - inline when collapsed, with newlines when expanded
 */
function renderMbtiBadges(str) {
    const items = parseMbtiString(str);
    if (items.length === 0) return `<span class="text-gray-300">${escapeHtml(str)}</span>`;
    
    return `<div class="mbti-list flex flex-wrap gap-1.5">
        ${items.map(item => `
            <span class="vote-badge badge-default">
                <span>${item.type}</span>
                <span class="vote-count">${item.count}</span>
                <span class="mbti-names">${item.names.join(', ')}</span>
            </span>
        `).join('')}
    </div>`;
}

/**
 * Parse album with voters format: "NMIXX: Blue Valentine (8) [@ianist109, ...] | NMIXX: Fe3o4 (4) [...]"
 */
function parseAlbumVotersString(str) {
    if (!str) return [];
    
    // Split by |
    const items = str.split('|').map(s => s.trim()).filter(Boolean);
    
    return items.map(item => {
        // Match: Name (count) [voters]
        const match = item.match(/^(.+?)\s*\((\d+)\)\s*\[([^\]]+)\]$/);
        if (match) {
            return {
                name: match[1].trim(),
                count: parseInt(match[2], 10),
                voters: match[3].split(',').map(n => n.trim())
            };
        }
        return null;
    }).filter(Boolean);
}

/**
 * Render album with voters badges
 */
function renderAlbumVotersBadges(str) {
    const items = parseAlbumVotersString(str);
    if (items.length === 0) return `<span class="text-gray-300">${escapeHtml(str)}</span>`;
    
    return `<div class="mbti-list flex flex-wrap gap-1.5">
        ${items.map(item => `
            <span class="vote-badge badge-default">
                <span>${escapeHtml(item.name)}</span>
                <span class="vote-count">${item.count}</span>
                <span class="mbti-names">${item.voters.join(', ')}</span>
            </span>
        `).join('')}
    </div>`;
}

/**
 * Render simple comma-separated list as badges
 */
function renderSimpleListBadges(items) {
    return `<div class="flex flex-wrap gap-1.5">
        ${items.map(item => `
            <span class="simple-badge">${escapeHtml(item)}</span>
        `).join('')}
    </div>`;
}

/**
 * Detect field type and render appropriately
 * @param {string} key - Column key
 * @param {any} value - Cell value
 * @param {string} columnType - Detected column type: 'votes', 'list', or 'auto'
 * @param {boolean} isFirstColumn - Whether this is the first column (no badges)
 */
function renderFieldValue(key, value, columnType = 'auto', isFirstColumn = false) {
    // Handle null/undefined
    if (value == null) {
        return '<span class="text-gray-500">—</span>';
    }
    
    // First column: always render as plain text (no badges)
    if (isFirstColumn && typeof value === 'string') {
        return `<span class="text-gray-100">${escapeHtml(value)}</span>`;
    }
    
    // Date columns: render with smaller, muted text
    if ((key === 'Дата релиза' || key === 'Дата дебюта') && typeof value === 'string') {
        return `<span class="text-xs text-gray-400 font-mono">${escapeHtml(value)}</span>`;
    }
    
    // Handle string values that look like vote lists
    if (typeof value === 'string') {
        // MBTI format: "INFP (2) [Ningning, Shuhua]\nENTP (1) [Asa]"
        if (/^[A-Z]{4}\s*\(\d+\)\s*\[/.test(value)) {
            return renderMbtiBadges(value);
        }
        
        // Album with voters format: "Album Name (8) [@user1, user2] | Album2 (4) [user3]"
        // Or single: "Album Name (2) [@user1, user2]"
        // Pattern: has (number) followed by [brackets]
        if (/\(\d+\)\s*\[[^\]]+\]/.test(value)) {
            return renderAlbumVotersBadges(value);
        }
        
        // Vote patterns: "Name (45)" or "Name (#1)" or "Name (#1, #1, #2)" - must have numbers/positions
        // Match parentheses containing only numbers/positions (with optional # and commas)
        // Exclude strings with [brackets] as they have different structure (e.g., album lists with voters)
        if (/\((#?\d+(?:\s*,\s*#?\d+)*)\)/.test(value) && !value.includes('[')) {
            return `<div class="flex flex-wrap gap-1.5">${renderVoteBadges(value, 'badge-default')}</div>`;
        }
        
        // If this column was detected as 'votes' type, render single names as badges too
        if (columnType === 'votes' && value.trim() && !value.includes('(') && !value.includes('[')) {
            // Single name in a votes column - render as simple badge
            return `<div class="flex flex-wrap gap-1.5"><span class="simple-badge">${escapeHtml(value.trim())}</span></div>`;
        }
        
        // Track contributions with Spotify data
        if (/\[views:.*popularity:/.test(value)) {
            return renderTrackContributions(value);
        }
        
        // Formatted number with comma separators: "75,659,865"
        // Must be only digits and commas (with optional whitespace)
        if (/^\s*[\d,]+\s*$/.test(value)) {
            const numValue = parseInt(value.replace(/,/g, ''), 10);
            if (!isNaN(numValue)) {
                if (numValue > 10000) {
                    return `<span class="font-mono text-accent-cyan">${formatNumber(numValue)}</span>`;
                }
                return `<span class="font-mono text-white font-medium">${numValue.toLocaleString()}</span>`;
            }
        }
        
        // Track with company: "TRACK NAME (Company Name), TRACK2 (Company2)"
        // Must have MOST items ending with (Something) pattern - not just a few with parentheses in names
        if (/\([^)]+\)/.test(value) && value.includes(',') && !/\(#?\d+\)/.test(value)) {
            const parsed = parseTrackCompanyString(value);
            // Only use track+company format if most items (>50%) have a company
            const itemsWithCompany = parsed.filter(p => p.company !== null).length;
            if (parsed.length > 0 && itemsWithCompany / parsed.length > 0.5) {
                return renderTrackCompanyBadges(value);
            }
        }
        
        // Simple comma-separated list (2+ items)
        // e.g., "ifeye, IVE, Illit" or "Wendy, Yeji" or "TRACK1, TRACK2 ('10S VER.)"
        if (value.includes(',') && !value.includes('[')) {
            const items = value.split(',').map(s => s.trim()).filter(Boolean);
            if (items.length >= 2) {
                return renderSimpleListBadges(items);
            }
        }
        
        // If this column was detected as 'list' type, render single items as badges too
        if (columnType === 'list' && value.trim() && !value.includes('[')) {
            return `<div class="flex flex-wrap gap-1.5"><span class="simple-badge">${escapeHtml(value.trim())}</span></div>`;
        }
        
        // Regular string
        return `<span class="text-gray-300">${escapeHtml(value)}</span>`;
    }
    
    // Handle numbers
    if (typeof value === 'number') {
        // Check if it's a large number (likely streams/views)
        if (value > 10000) {
            return `<span class="font-mono text-accent-cyan">${formatNumber(value)}</span>`;
        }
        // Check if column is detected as 'score' type or if value is a decimal
        if (columnType === 'score' || !Number.isInteger(value)) {
            return `<span class="font-mono text-accent-gold">${value.toFixed(1)}</span>`;
        }
        return `<span class="font-mono text-white font-medium">${value}</span>`;
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
        return `<span class="text-gray-400">${value.join(', ')}</span>`;
    }
    
    return `<span class="text-gray-500">${String(value)}</span>`;
}

/**
 * Get column name - just return the raw key from JSON
 */
function getColumnName(key) {
    return key;
}

/**
 * Render a data table
 */
function renderDataTable(dataset, index) {
    const data = dataset.data;
    if (!data || data.length === 0) {
        return '<p class="text-gray-500 text-center py-8">Нет данных для отображения</p>';
    }
    
    // Get all unique keys from data
    const keys = [...new Set(data.flatMap(item => Object.keys(item)))];
    
    return `
        <div id="${dataset.id}" class="bg-surface rounded-xl sm:rounded-2xl border border-border overflow-hidden animate-in" style="animation-delay: ${index * CONFIG.animationDelay}ms">
            <!-- Dataset Header -->
            <div class="p-3 sm:p-4 border-b border-border/50 bg-gradient-to-r from-surface-light/50 to-transparent">
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 min-w-0 flex-1">
                        <h3 class="font-display font-semibold text-sm sm:text-base text-white truncate">${escapeHtml(dataset.name)}</h3>
                        <button 
                            onclick="copyAnchorLink('${dataset.id}')" 
                            class="p-1 rounded hover:bg-surface-hover text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
                            title="Копировать ссылку"
                        >
                            ${ICONS.link}
                        </button>
                    </div>
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-light rounded text-xs text-gray-400 flex-shrink-0">
                        <span class="font-mono">Кол-во результатов: ${data.length}</span>
                    </span>
                </div>
                ${dataset.description ? `<p class="text-xs sm:text-sm text-gray-400 mt-1">${dataset.description}</p>` : ''}
            </div>
            
            <!-- Data Table -->
            ${renderTableView(data, keys)}
        </div>
    `;
}

/**
 * Generate unique ID for expandable cells
 */
let expandableCounter = 0;
function generateExpandableId() {
    return `expandable-${++expandableCounter}`;
}

/**
 * Detect column types by analyzing all values in the column
 * Returns a map of column key -> detected type
 */
function detectColumnTypes(data, keys) {
    const columnTypes = {};
    
    for (const key of keys) {
        const allValues = data.map(item => item[key]);
        
        // Collect string values for this column
        const stringValues = allValues.filter(v => typeof v === 'string');
        
        // Collect number values for this column
        const numberValues = allValues.filter(v => typeof v === 'number');
        
        // Check if ANY value in this column looks like a vote/badge list
        const hasVotePattern = stringValues.some(v => /\((#?\d+(?:\s*,\s*#?\d+)*)\)/.test(v));
        
        // Check if ANY value looks like a simple comma-separated list
        // But NOT formatted numbers like "75,659,865"
        const hasSimpleList = stringValues.some(v => 
            v.includes(',') && !v.includes('[') && !/^\s*[\d,]+\s*$/.test(v)
        );
        
        // Check if ANY number in this column is a decimal (score column)
        const hasDecimalNumbers = numberValues.some(v => !Number.isInteger(v));
        
        if (hasVotePattern) {
            columnTypes[key] = 'votes';
        } else if (hasSimpleList) {
            columnTypes[key] = 'list';
        } else if (hasDecimalNumbers && numberValues.length > 0) {
            columnTypes[key] = 'score';
        } else {
            columnTypes[key] = 'auto';
        }
    }
    
    return columnTypes;
}

/**
 * Render simple table view with horizontal scroll
 */
function renderTableView(data, keys) {
    // Pre-detect column types
    const columnTypes = detectColumnTypes(data, keys);
    
    return `
        <div class="table-scroll">
            <table class="data-table">
                <thead>
                    <tr>
                        ${keys.map((key, colIdx) => `
                            <th class="table-header ${colIdx === 0 ? 'sticky-col' : ''}">${escapeHtml(key)}</th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${data.map((item, rowIdx) => `
                        <tr>
                            ${keys.map((key, colIdx) => {
                                const value = item[key];
                                const colType = columnTypes[key];
                                const isFirstColumn = colIdx === 0;
                                const cellContent = renderFieldValue(key, value, colType, isFirstColumn);
                                const isLargeContent = !isFirstColumn && isLargeCell(value);
                                const expandId = isLargeContent ? generateExpandableId() : null;
                                
                                return `
                                    <td class="table-cell ${isFirstColumn ? 'cell-primary sticky-col' : ''}">
                                        ${isLargeContent ? renderExpandableCell(cellContent, expandId) : cellContent}
                                    </td>
                                `;
                            }).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Check if a cell value should be expandable
 */
function isLargeCell(value) {
    if (typeof value !== 'string') return false;
    
    // Check if it's a vote list with position/count patterns like (45) or (#1) or (#1, #1, #2)
    const voteMatches = (value.match(/\((#?\d+(?:\s*,\s*#?\d+)*)\)/g) || []).length;
    
    // Check for track patterns with Spotify data
    const trackMatches = (value.match(/\[views:/g) || []).length;
    
    // Check for track+company format (count commas outside parentheses)
    const hasCompanyFormat = /\([^)]+\)/.test(value) && !/\(#?\d+\)/.test(value);
    const companyItemCount = hasCompanyFormat ? parseTrackCompanyString(value).length : 0;
    
    // Check for simple comma-separated lists (no brackets)
    // But NOT formatted numbers like "75,659,865"
    const isFormattedNumber = /^\s*[\d,]+\s*$/.test(value);
    const isSimpleList = value.includes(',') && !value.includes('[') && !isFormattedNumber;
    const simpleListCount = isSimpleList ? value.split(',').filter(s => s.trim()).length : 0;
    
    return voteMatches > 3 || trackMatches > 3 || companyItemCount > 3 || simpleListCount > 3;
}

/**
 * Render expandable cell wrapper
 */
function renderExpandableCell(content, expandId) {
    return `
        <div class="expandable-cell" id="${expandId}">
            <div class="expandable-content collapsed">
                ${content}
            </div>
            <button 
                onclick="toggleExpand('${expandId}')" 
                class="expand-btn mt-2 flex items-center gap-1 text-xs text-accent-violet hover:text-accent-cyan transition-colors"
            >
                <span class="expand-text">Показать всё</span>
                ${ICONS.expand}
            </button>
        </div>
    `;
}


// Store all data globally for sidebar
let allPagesData = [];

/**
 * Main render function with sidebar navigation
 */
function renderPage(pageData, allData) {
    const container = document.getElementById('content-container');
    const datasets = pageData.datasets || [];
    
    // Store for sidebar
    allPagesData = allData;
    
    // Update page metadata
    document.getElementById('page-title').textContent = pageData.name || 'Результаты';
    document.getElementById('page-subtitle').textContent = '';
    document.title = `${pageData.name || 'Результаты'} — Голосование`;
    
    // Hide header nav (we use sidebar instead)
    document.getElementById('dataset-nav').classList.add('hidden');
    
    // Create layout with sidebar
    container.innerHTML = `
        <div class="page-layout">
            <!-- Mobile Menu Button -->
            <button class="mobile-menu-toggle" onclick="toggleSidebar()" aria-label="Открыть меню">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
                <span>Навигация</span>
            </button>
            
            <!-- Sidebar Overlay (mobile) -->
            <div class="sidebar-overlay" onclick="closeSidebar()"></div>
            
            <!-- Sidebar Navigation -->
            <aside class="page-sidebar" id="page-sidebar">
                <div class="sidebar-header-mobile">
                    <span class="sidebar-header-title">Навигация</span>
                    <button class="sidebar-close" onclick="closeSidebar()" aria-label="Закрыть">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <nav class="sidebar-nav">
                    ${renderHierarchicalNav(allData, pageData.id, datasets)}
                </nav>
            </aside>
            
            <!-- Main Content -->
            <div class="page-main">
                <div class="datasets-list">
                    ${datasets.map((dataset, idx) => renderDataTable(dataset, idx)).join('')}
                </div>
            </div>
        </div>
    `;
    
    // Show content
    document.getElementById('loading-state').classList.add('hidden');
    container.classList.remove('hidden');
    
    // Check expandable cells and hide buttons if content doesn't overflow
    requestAnimationFrame(() => {
        checkExpandableCells();
    });
    
    // Handle hash scroll after render (let browser handle it natively)
    if (window.location.hash) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
            const el = document.querySelector(window.location.hash);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    }
}

/**
 * Check all expandable cells and show/hide expand button based on actual overflow
 */
function checkExpandableCells() {
    document.querySelectorAll('.expandable-cell').forEach(cell => {
        const content = cell.querySelector('.expandable-content');
        const btn = cell.querySelector('.expand-btn');
        
        if (!content || !btn) return;
        
        // Skip if already expanded by user
        if (content.classList.contains('expanded')) return;
        
        // Temporarily add collapsed class to measure overflow
        const wasCollapsed = content.classList.contains('collapsed');
        if (!wasCollapsed) {
            content.classList.add('collapsed');
        }
        
        // Check if content actually overflows when collapsed
        // scrollHeight is the full height, clientHeight is the visible height
        const isOverflowing = content.scrollHeight > content.clientHeight + 5; // 5px tolerance
        
        if (isOverflowing) {
            // Content overflows, show the button and keep collapsed
            btn.style.display = '';
            content.classList.add('collapsed');
        } else {
            // Content fits, hide the button and remove collapsed state
            btn.style.display = 'none';
            content.classList.remove('collapsed');
        }
    });
}

/**
 * Render hierarchical navigation with all pages and their datasets
 */
function renderHierarchicalNav(allData, currentPageId, currentDatasets) {
    return `
        <ul class="nav-tree">
            ${allData.map(page => {
                const isCurrentPage = page.id === currentPageId;
                const hasDatasets = page.datasets && page.datasets.length > 0;
                
                return `
                    <li class="nav-group ${isCurrentPage ? 'expanded active' : ''}" data-page-id="${page.id}">
                        <button type="button" 
                                class="nav-group-toggle"
                                onclick="toggleNavGroup(this, '${page.id}')">
                            <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                            </svg>
                            <span class="nav-group-text">${escapeHtml(page.name)}</span>
                            ${hasDatasets ? `
                                <svg class="nav-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                                </svg>
                            ` : ''}
                        </button>
                        ${hasDatasets ? `
                            <ul class="nav-children">
                                ${(isCurrentPage ? currentDatasets : page.datasets).map(ds => `
                                    <li class="nav-child">
                                        <a href="?id=${page.id}#${ds.id}" 
                                           class="nav-link"
                                           onclick="event.preventDefault(); navigateTo('${page.id}', '${ds.id}')">
                                            <span class="nav-text">${escapeHtml(ds.name)}</span>
                                        </a>
                                    </li>
                                `).join('')}
                            </ul>
                        ` : ''}
                    </li>
                `;
            }).join('')}
        </ul>
    `;
}

/**
 * Toggle navigation group expand/collapse (never navigates, just toggles)
 */
function toggleNavGroup(button, pageId) {
    const group = button.closest('.nav-group');
    group.classList.toggle('expanded');
}

/**
 * Toggle sidebar visibility (mobile)
 */
function toggleSidebar() {
    document.body.classList.toggle('sidebar-open');
}

/**
 * Close sidebar (mobile)
 */
function closeSidebar() {
    document.body.classList.remove('sidebar-open');
}


/**
 * Render index page (list all available datasets)
 */
function renderIndexPage(allData) {
    const container = document.getElementById('content-container');
    
    // Store for potential use
    allPagesData = allData;
    
    document.getElementById('page-title').textContent = 'Все результаты';
    document.getElementById('page-subtitle').textContent = '';
    document.title = 'Результаты голосования';
    
    container.innerHTML = `
        <div class="page-layout">
            <!-- Mobile Menu Button -->
            <button class="mobile-menu-toggle" onclick="toggleSidebar()" aria-label="Открыть меню">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
                <span>Навигация</span>
            </button>
            
            <!-- Sidebar Overlay (mobile) -->
            <div class="sidebar-overlay" onclick="closeSidebar()"></div>
            
            <!-- Sidebar Navigation -->
            <aside class="page-sidebar" id="page-sidebar">
                <div class="sidebar-header-mobile">
                    <span class="sidebar-header-title">Навигация</span>
                    <button class="sidebar-close" onclick="closeSidebar()" aria-label="Закрыть">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <nav class="sidebar-nav">
                    ${renderIndexNav(allData)}
                </nav>
            </aside>
            
            <!-- Main Content -->
            <div class="page-main">
                <div class="index-header">
                    <a href="https://wrapped.ifmeovv.com" class="back-button-gradient inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white text-sm mb-4 transition-all hover:scale-105 hover:shadow-lg hover:shadow-accent-pink/25">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                        </svg>
                        Вернуться назад
                    </a>
                    <h2 class="font-display text-xl sm:text-2xl font-semibold text-white mb-2">Выберите раздел</h2>
                    <p class="text-gray-400 text-sm">Доступно ${allData.length} разделов с результатами голосования</p>
                </div>
                <div class="index-grid">
                    ${allData.map((item, idx) => `
                        <a href="?id=${item.id}" 
                           class="index-card animate-in"
                           style="animation-delay: ${idx * CONFIG.animationDelay}ms"
                           onclick="event.preventDefault(); navigateTo('${item.id}')">
                            <div class="index-card-icon">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                                </svg>
                            </div>
                            <div class="index-card-content">
                                <h3 class="index-card-title">${escapeHtml(item.name)}</h3>
                                <p class="index-card-count">${(item.datasets || []).length} таблиц</p>
                            </div>
                            <svg class="index-card-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                            </svg>
                        </a>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('loading-state').classList.add('hidden');
    container.classList.remove('hidden');
}

/**
 * Render navigation for index page
 */
function renderIndexNav(allData) {
    return `
        <ul class="nav-tree">
            ${allData.map(page => {
                const hasDatasets = page.datasets && page.datasets.length > 0;
                return `
                    <li class="nav-group" data-page-id="${page.id}">
                        <button type="button" 
                                class="nav-group-toggle"
                                onclick="toggleNavGroup(this, '${page.id}')">
                            <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                            </svg>
                            <span class="nav-group-text">${escapeHtml(page.name)}</span>
                            ${hasDatasets ? `
                                <svg class="nav-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                                </svg>
                            ` : ''}
                        </button>
                        ${hasDatasets ? `
                            <ul class="nav-children">
                                ${page.datasets.map(ds => `
                                    <li class="nav-child">
                                        <a href="?id=${page.id}#${ds.id}" 
                                           class="nav-link"
                                           onclick="event.preventDefault(); navigateTo('${page.id}', '${ds.id}')">
                                            <span class="nav-text">${escapeHtml(ds.name)}</span>
                                        </a>
                                    </li>
                                `).join('')}
                            </ul>
                        ` : ''}
                    </li>
                `;
            }).join('')}
        </ul>
    `;
}

/**
 * Show error state
 */
function showError(message) {
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('error-state').classList.remove('hidden');
    document.getElementById('error-message').textContent = message;
}

// ============================================================================
// Event Handlers & Utilities
// ============================================================================

/**
 * Copy anchor link to clipboard
 */
function copyAnchorLink(id) {
    const url = new URL(window.location.href);
    url.hash = id;
    
    navigator.clipboard.writeText(url.toString()).then(() => {
        // Show brief toast notification
        showToast('Ссылка скопирована!');
    }).catch(() => {
        // Fallback
        prompt('Скопируйте ссылку:', url.toString());
    });
}

/**
 * Toggle expandable cell
 */
function toggleExpand(id) {
    const cell = document.getElementById(id);
    if (!cell) return;
    
    const content = cell.querySelector('.expandable-content');
    const btn = cell.querySelector('.expand-btn');
    const text = btn.querySelector('.expand-text');
    const icon = btn.querySelector('svg');
    
    const isCollapsed = content.classList.contains('collapsed');
    
    if (isCollapsed) {
        content.classList.remove('collapsed');
        content.classList.add('expanded');
        text.textContent = 'Свернуть';
        icon.style.transform = 'rotate(180deg)';
    } else {
        content.classList.remove('expanded');
        content.classList.add('collapsed');
        text.textContent = 'Показать всё';
        icon.style.transform = 'rotate(0deg)';
    }
}

/**
 * Show toast notification
 */
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-accent-violet text-white text-sm rounded-lg shadow-lg z-50 animate-in';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

/**
 * Setup scroll fade indicators
 */
function setupScrollFade() {
    document.querySelectorAll('.scroll-fade').forEach(container => {
        const checkScroll = () => {
            const scrollable = container.querySelector('table') || container.firstElementChild;
            if (scrollable && scrollable.scrollWidth > container.clientWidth) {
                container.classList.add('show-fade');
            } else {
                container.classList.remove('show-fade');
            }
        };
        
        checkScroll();
        window.addEventListener('resize', checkScroll);
    });
}

/**
 * Mobile menu toggle
 */
function setupMobileMenu() {
    const btn = document.getElementById('mobile-menu-btn');
    const nav = document.getElementById('mobile-nav');
    
    btn?.addEventListener('click', () => {
        nav.classList.toggle('hidden');
    });
}

/**
 * Update footer timestamp
 */
function updateTimestamp() {
    const el = document.getElementById('generated-time');
    if (el) {
        const now = new Date();
        el.textContent = `Обновлено: ${now.toLocaleDateString('ru-RU')} ${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    }
}

// ============================================================================
// Initialization
// ============================================================================

async function init() {
    setupMobileMenu();
    updateTimestamp();
    setupFooterEasterEgg();
    
    // Recheck expandable cells on resize (debounced)
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(checkExpandableCells, 200);
    });
    
    const { id } = getUrlParams();
    
    try {
        const response = await fetch(CONFIG.dataPath);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const allData = await response.json();
        
        if (!id) {
            // Show index page
            renderIndexPage(allData);
            return;
        }
        
        // Find requested dataset
        const pageData = allData.find(item => item.id === id);
        
        if (!pageData) {
            showError(`Набор данных "${id}" не найден.`);
            return;
        }
        
        renderPage(pageData, allData);
        
    } catch (error) {
        console.error('Failed to load data:', error);
        showError('Не удалось загрузить данные. Проверьте подключение к серверу.');
    }
}

/**
 * Navigate to a page without reload (SPA-style)
 */
function navigateTo(pageId, hash) {
    if (!allPagesData.length) return;
    
    // Close sidebar on mobile
    closeSidebar();
    
    // Check if we're already on this page (just scroll)
    const currentId = getUrlParams().id;
    if (currentId === pageId && hash) {
        const el = document.getElementById(hash);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // Update URL hash without re-rendering
        history.pushState({ pageId, hash }, '', `?id=${pageId}#${hash}`);
        return;
    }
    
    // Build new URL
    const url = new URL(window.location.href);
    url.search = pageId ? `?id=${pageId}` : '';
    url.hash = hash || '';
    
    // Update browser history
    history.pushState({ pageId, hash }, '', url.toString());
    
    // Fade out, render, fade in
    const container = document.getElementById('content-container');
    container.style.opacity = '0';
    container.style.transition = 'opacity 0.15s ease';
    
    setTimeout(() => {
        // Render the new page
        if (!pageId) {
            renderIndexPage(allPagesData);
        } else {
            const pageData = allPagesData.find(p => p.id === pageId);
            if (pageData) {
                renderPage(pageData, allPagesData);
            }
        }
        
        // Fade in
        requestAnimationFrame(() => {
            container.style.opacity = '1';
            
            // Scroll to hash after render
            if (hash) {
                setTimeout(() => {
                    const el = document.getElementById(hash);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 50);
            } else {
                window.scrollTo({ top: 0 });
            }
        });
    }, 150);
}

/**
 * Handle browser back/forward navigation
 */
window.addEventListener('popstate', (event) => {
    const { id } = getUrlParams();
    const hash = window.location.hash.slice(1);
    const container = document.getElementById('content-container');
    
    // Fade out
    container.style.opacity = '0';
    
    setTimeout(() => {
        if (!id) {
            renderIndexPage(allPagesData);
        } else {
            const pageData = allPagesData.find(p => p.id === id);
            if (pageData) {
                renderPage(pageData, allPagesData);
            }
        }
        
        // Fade in
        requestAnimationFrame(() => {
            container.style.opacity = '1';
            if (hash) {
                setTimeout(() => {
                    const el = document.getElementById(hash);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 50);
            }
        });
    }, 150);
});

// Make functions available globally
window.copyAnchorLink = copyAnchorLink;
window.toggleExpand = toggleExpand;
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.toggleNavGroup = toggleNavGroup;
window.navigateTo = navigateTo;

/**
 * Setup footer easter egg
 */
function setupFooterEasterEgg() {
    const pawBtn = document.getElementById('paw-btn');
    const msg = document.getElementById('narin-message');
    
    if (pawBtn && msg) {
        pawBtn.addEventListener('click', () => {
            pawBtn.classList.add('hidden');
            msg.classList.remove('hidden');
        });
        
        msg.addEventListener('click', () => {
            msg.classList.add('hidden');
            pawBtn.classList.remove('hidden');
        });
        
        msg.style.cursor = 'pointer';
    }
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
