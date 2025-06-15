// Global state
        let savedSitesIndex = {};
        let websiteContentChunks = [];
        let conversationHistory = [];
        let currentLoadedSiteId = null;
        let botReady = false;
        let pendingScanDetails = null;

        // Constants
        const SAVED_SITES_KEY = 'ai_scanned_website_index';
        const APP_DATA_DIR = 'ai_scanned_websites';

        // DOM elements
        const analyzeBtn = document.getElementById('analyzeBtn');
        const websiteUrlInput = document.getElementById('websiteUrl');
        const maxPagesSelect = document.getElementById('maxPages');
        const urlTypeIndicator = document.getElementById('urlTypeIndicator');
        const urlTypeText = document.getElementById('urlTypeText');
        const savedSitesList = document.getElementById('savedSitesList');
        const chatMessages = document.getElementById('chatMessages');
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendBtn');
        const currentSiteDisplay = document.getElementById('currentSiteDisplay');
        const currentSiteTitle = document.getElementById('currentSiteTitle');
        const linkPreviewModal = document.getElementById('linkPreviewModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalDescription = document.getElementById('modalDescription');
        const githubRepoInfo = document.getElementById('githubRepoInfo');
        const repoName = document.getElementById('repoName');
        const repoDescription = document.getElementById('repoDescription');
        const repoLanguage = document.getElementById('repoLanguage');
        const repoFileCount = document.getElementById('repoFileCount');
        const websiteUrlSelection = document.getElementById('websiteUrlSelection');
        const additionalUrlSelection = document.getElementById('additionalUrlSelection');
        const githubFileSelection = document.getElementById('githubFileSelection');
        const initialUrlDisplay = document.getElementById('initialUrlDisplay');
        const additionalUrlsList = document.getElementById('additionalUrlsList');
        const githubFilesList = document.getElementById('githubFilesList');
        const selectionSummary = document.getElementById('selectionSummary');
        const cancelScanBtn = document.getElementById('cancelScanBtn');
        const confirmScanBtn = document.getElementById('confirmScanBtn');

        // Auto-resize textarea
        chatInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });

        // URL type detection
        websiteUrlInput.addEventListener('input', function() {
            const url = this.value.trim();
            if (url) {
                if (isGitHubRepo(url)) {
                    urlTypeIndicator.style.display = 'flex';
                    urlTypeIndicator.classList.add('github');
                    urlTypeText.innerHTML = '<i class="fab fa-github" style="color: #333;"></i> GitHub Repository detected';
                    analyzeBtn.querySelector('.btn-text').innerHTML = '<i class="fas fa-search" style="color: #0984e3;"></i> Analyze Repository';
                } else {
                    urlTypeIndicator.style.display = 'flex';
                    urlTypeIndicator.classList.remove('github');
                    urlTypeText.innerHTML = '<i class="fas fa-globe" style="color: #00b894;"></i> Website detected';
                    analyzeBtn.querySelector('.btn-text').innerHTML = '<i class="fas fa-search" style="color: #0984e3;"></i> Analyze & Preview';
                }
            } else {
                urlTypeIndicator.style.display = 'none';
                analyzeBtn.querySelector('.btn-text').innerHTML = '<i class="fas fa-search" style="color: #0984e3;"></i> Analyze & Preview';
            }
        });

        // Check if URL is a GitHub repository
        function isGitHubRepo(url) {
            const normalizedUrl = normalizeUrl(url);
            try {
                const urlObj = new URL(normalizedUrl);
                return urlObj.hostname === 'github.com' && urlObj.pathname.split('/').length >= 3;
            } catch {
                return false;
            }
        }

        // Parse GitHub URL to get owner and repo
        function parseGitHubUrl(url) {
            const normalizedUrl = normalizeUrl(url);
            try {
                const urlObj = new URL(normalizedUrl);
                const pathParts = urlObj.pathname.split('/').filter(part => part);
                if (pathParts.length >= 2) {
                    return {
                        owner: pathParts[0],
                        repo: pathParts[1]
                    };
                }
            } catch {
                return null;
            }
            return null;
        }

        // Normalize URL function
        function normalizeUrl(url) {
            url = url.trim();
            
            // If URL doesn't start with http:// or https://, add https://
            if (!url.match(/^https?:\/\//i)) {
                url = 'https://' + url;
            }
            
            return url;
        }

        // Initialize app
        async function initializeApp() {
    try {
        // Remove explicit signIn - Puter will handle authentication automatically when needed
        // await puter.auth.signIn();
        
        // Load saved sites - this will trigger authentication if needed
        await loadSavedSitesIndex();
        
        console.log('App initialized successfully');
    } catch (error) {
        console.error('Failed to initialize app:', error);
        addChatMessage('error', 'Failed to initialize app. Please refresh and try again.');
    }
}

        // Load saved sites index from KV store
        async function loadSavedSitesIndex() {
            try {
                /**
                 * PUTER.JS TUTORIAL: Cloud Key-Value Storage
                 * puter.kv.get() retrieves data from Puter's cloud key-value store using a unique key.
                 * - Perfect for storing app configuration and small datasets
                 * - Data persists across sessions and devices
                 * - No database setup required - just store and retrieve
                 * - Returns null if the key doesn't exist
                 */
                const indexData = await puter.kv.get(SAVED_SITES_KEY);
                if (indexData) {
                    savedSitesIndex = JSON.parse(indexData);
                }
                renderSavedSitesList();
            } catch (error) {
                console.error('Error loading saved sites:', error);
                savedSitesIndex = {};
            }
        }

        // Render saved sites list
        function renderSavedSitesList() {
            console.log('🔄 renderSavedSitesList called');
            console.log('📊 Current savedSitesIndex:', savedSitesIndex);
            
            savedSitesList.innerHTML = '';
            
            const siteIds = Object.keys(savedSitesIndex);
            console.log('🔑 Site IDs found:', siteIds);
            
            if (siteIds.length === 0) {
                savedSitesList.innerHTML = `
                    <li class="empty-state">
                        <h3>No sources saved yet</h3>
                        <p>Scan your first website or GitHub repo to get started!</p>
                    </li>
                `;
                return;
            }
            
            // Sort by scan date (newest first)
            siteIds.sort((a, b) => savedSitesIndex[b].scanned_at - savedSitesIndex[a].scanned_at);
            
            siteIds.forEach(siteId => {
                const site = savedSitesIndex[siteId];
                console.log(`🏗️ Creating list item for site: ${siteId}`, site);
                
                const li = document.createElement('li');
                li.className = `saved-site-item ${site.type === 'github' ? 'github' : ''} ${currentLoadedSiteId === siteId ? 'active' : ''}`;
                
                const typeIcon = site.type === 'github' ? '🐙' : '📄';
                const typeLabel = site.type === 'github' ? 'GitHub' : 'Website';
                const itemsLabel = site.type === 'github' ? 'files' : 'pages';
                
                li.innerHTML = `
                    <div class="site-info">
                        <h3>
                            ${site.title}
                            <span class="site-type-badge ${site.type}">${typeIcon} ${typeLabel}</span>
                        </h3>
                        <p>${site.url}</p>
                        <div class="site-meta">
                            <span>📄 ${site.num_pages_scanned} ${itemsLabel}</span>
                            <span>📝 ${site.num_chunks} chunks</span>
                            <span>📅 ${new Date(site.scanned_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div class="site-actions">
                        <button class="action-btn chat-btn" onclick="loadWebsiteDataAndChat('${siteId}', event)">
                            <span class="btn-text">💬 Chat</span>
                            <span class="spinner"></span>
                        </button>
                        <button class="action-btn delete-btn" data-site-id="${siteId}">
                            <span class="btn-text">🗑️ Delete</span>
                            <span class="spinner"></span>
                        </button>
                    </div>
                `;
                
                // Add event listener for the entire list item
                li.addEventListener('click', (e) => {
                    console.log('🖱️ List item clicked, event target:', e.target);
                    console.log('🖱️ Closest delete-btn:', e.target.closest('.delete-btn'));
                    console.log('🖱️ Closest chat-btn:', e.target.closest('.chat-btn'));
                    
                    if (e.target.closest('.delete-btn')) {
                        e.stopPropagation();
                        console.log('🗑️ Delete button area clicked');
                        const deleteBtn = e.target.closest('.delete-btn');
                        const siteId = deleteBtn.getAttribute('data-site-id');
                        console.log('🗑️ Site ID to delete:', siteId);
                        deleteWebsiteData(siteId, deleteBtn);
                    } else if (!e.target.closest('.chat-btn')) {
                        console.log('📄 Loading website data for:', siteId);
                        loadWebsiteData(siteId);
                    }
                });
                
                savedSitesList.appendChild(li);
                console.log(`✅ Added list item for site: ${siteId}`);
            });
            
            console.log('✅ renderSavedSitesList completed');
        }

        // Analyze and preview links/files
        async function analyzeAndPreviewLinks() {
            const rawUrl = websiteUrlInput.value.trim();
            const maxPages = parseInt(maxPagesSelect.value);
            
            if (!rawUrl) {
                alert('Please enter a website URL or GitHub repository');
                return;
            }
            
            // Normalize the URL
            const url = normalizeUrl(rawUrl);
            
            // Validate URL format
            try {
                new URL(url);
            } catch (e) {
                alert('Please enter a valid URL (e.g., example.com or github.com/user/repo)');
                return;
            }
            
            try {
                setButtonLoading(analyzeBtn, true);
                
                if (isGitHubRepo(url)) {
                    await analyzeGitHubRepository(url, maxPages);
                } else {
                    await analyzeWebsite(url, maxPages);
                }
                
            } catch (error) {
                console.error('Error analyzing source:', error);
                
                // Show user-friendly error message
                const errorMessage = error.message || 'An unexpected error occurred while analyzing the source.';
                alert(`Error analyzing source:\n\n${errorMessage}\n\nTips:\n• Try a different URL\n• Check your internet connection\n• Make sure the URL is correct and accessible`);
            } finally {
                setButtonLoading(analyzeBtn, false);
            }
        }

        // Analyze GitHub repository
        async function analyzeGitHubRepository(url, maxFiles) {
            const repoInfo = parseGitHubUrl(url);
            if (!repoInfo) {
                throw new Error('Invalid GitHub repository URL');
            }
            
            console.log('Analyzing GitHub repository:', repoInfo);
            
            // Fetch repository information
            const repoResponse = await fetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`);
            if (!repoResponse.ok) {
                throw new Error(`GitHub repository not found or not accessible (${repoResponse.status})`);
            }
            
            const repoData = await repoResponse.json();
            
            // Fetch repository file tree
            const treeResponse = await fetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/git/trees/${repoData.default_branch}?recursive=1`);
            if (!treeResponse.ok) {
                throw new Error(`Failed to fetch repository file tree (${treeResponse.status})`);
            }
            
            const treeData = await treeResponse.json();
            
            // Filter files (exclude directories and binary files)
            const allFiles = treeData.tree.filter(item => {
                if (item.type !== 'blob') return false;
                
                const path = item.path.toLowerCase();
                const textExtensions = [
                    '.md', '.txt', '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
                    '.css', '.scss', '.html', '.xml', '.json', '.yaml', '.yml', '.toml', '.ini',
                    '.sh', '.bat', '.ps1', '.sql', '.go', '.rs', '.php', '.rb', '.swift', '.kt',
                    '.scala', '.clj', '.hs', '.elm', '.vue', '.svelte', '.r', '.m', '.pl', '.lua',
                    '.dockerfile', '.gitignore', '.gitattributes', 'readme', 'license', 'changelog',
                    'contributing', 'code_of_conduct', 'security', 'makefile', 'rakefile'
                ];
                
                // Check if file has a text extension or is a common text file
                return textExtensions.some(ext => path.endsWith(ext)) || 
                       textExtensions.some(name => path.includes(name));
            });
            
            console.log('Filtered files:', allFiles);
            
            if (allFiles.length === 0) {
                throw new Error('No readable text files found in this repository');
            }
            
            // Use AI to identify valuable files
            const valuableFiles = await identifyValuableFiles(repoData, allFiles);
            console.log('AI-suggested files:', valuableFiles);
            
            // Store pending scan details
            pendingScanDetails = {
                type: 'github',
                initialUrl: url,
                maxPages: maxFiles,
                websiteTitle: repoData.full_name,
                repoData: repoData,
                allFiles: allFiles,
                aiSuggestedFiles: valuableFiles
            };
            
            // Display preview modal
            displayGitHubPreviewModal();
        }

        // Analyze website (existing function)
        async function analyzeWebsite(url, maxPages) {
            console.log('Fetching initial page:', url);
            
            let response;
            try {
                /**
                 * PUTER.JS TUTORIAL: Network Requests
                 * puter.net.fetch() makes HTTP requests to external websites and APIs.
                 * - Similar to browser's fetch API but with CORS restrictions bypassed
                 * - Allows your app to access external content that would normally be blocked
                 * - Returns a standard Response object with methods like .text(), .json(), etc.
                 * - Handles errors gracefully with try/catch
                 */
                response = await puter.net.fetch(url);
            } catch (fetchError) {
                // Handle specific fetch errors
                if (fetchError.message.includes('ERR_BLOCKED_BY_CLIENT')) {
                    throw new Error('The website is being blocked by your browser, ad blocker, or security software. Please try disabling ad blockers or check your browser settings.');
                } else if (fetchError.message.includes('Failed to fetch')) {
                    throw new Error('Unable to connect to the website. This could be due to:\n• The website is down or unreachable\n• Network connectivity issues\n• The website blocks automated requests\n• CORS restrictions\n\nPlease try a different website or check your internet connection.');
                } else {
                    throw new Error(`Network error: ${fetchError.message}`);
                }
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}. The website returned an error response.`);
            }
            
            const html = await response.text();
            
            if (!html || html.trim().length === 0) {
                throw new Error('The website returned empty content. It may be a single-page application that requires JavaScript to load content.');
            }
            
            // Extract title
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const title = doc.querySelector('title')?.textContent?.trim() || 'Unknown Website';
            
            // Extract all internal links
            const allLinks = extractInternalLinks(html, url);
            console.log('Extracted links:', allLinks);
            
            if (allLinks.length === 0) {
                throw new Error('No internal links found on this page. This might be a single-page website or the content is dynamically loaded with JavaScript.');
            }
            
            // Use AI to identify valuable links
            const valuableLinks = await identifyValuableLinks(html, url, allLinks);
            console.log('AI-suggested links:', valuableLinks);
            
            // Store pending scan details
            pendingScanDetails = {
                type: 'website',
                initialUrl: url,
                maxPages: maxPages,
                websiteTitle: title,
                allLinks: allLinks,
                aiSuggestedUrls: valuableLinks
            };
            
            // Display preview modal
            displayLinkPreviewModal();
        }

        // Use AI to identify valuable files in GitHub repository
        async function identifyValuableFiles(repoData, allFiles) {
            const fileList = allFiles.map(file => ({
                path: file.path,
                size: file.size
            }));
            
            const prompt = `You are analyzing a GitHub repository to identify the most valuable files to scan for creating a knowledge base.

Repository: ${repoData.full_name}
Description: ${repoData.description || 'No description available'}
Language: ${repoData.language || 'Mixed'}
Total files available: ${allFiles.length}

Available files in the repository:
${JSON.stringify(fileList.slice(0, 100), null, 2)}${fileList.length > 100 ? '\n... and more files' : ''}

Please select the most valuable files from the provided list that would be useful for understanding this codebase. Focus on:
- README files and documentation
- Main source code files
- Configuration files
- API documentation
- Important scripts
- License and contributing guidelines

Avoid selecting:
- Test files (unless they're examples)
- Build artifacts
- Very large files (>50KB)
- Duplicate or generated files

Return ONLY a comma-separated list of the selected file paths from the provided list. Do not add any paths that weren't in the original list.`;

            try {
                const response = await puter.ai.chat(prompt, { model: 'gpt-4o-mini' });
                const selectedFiles = response.split(',')
                    .map(path => path.trim().replace(/['"]/g, ''))
                    .filter(path => allFiles.some(file => file.path === path))
                    .slice(0, 20); // Allow more suggestions, user can deselect
                
                return selectedFiles;
            } catch (error) {
                console.error('Error getting AI file suggestions:', error);
                // Fallback: return important files based on patterns
                return allFiles
                    .filter(file => {
                        const path = file.path.toLowerCase();
                        return path.includes('readme') || 
                               path.includes('index') || 
                               path.endsWith('.md') ||
                               path.includes('main') ||
                               path.includes('app');
                    })
                    .slice(0, 10)
                    .map(file => file.path);
            }
        }

        // Display GitHub preview modal
        function displayGitHubPreviewModal() {
            const { repoData, allFiles, aiSuggestedFiles } = pendingScanDetails;
            
            // Update modal for GitHub
            modalTitle.textContent = 'Select Repository Files to Scan';
            modalDescription.textContent = 'Choose which files you want to include in the scan. AI-suggested files are pre-selected.';
            
            // Show GitHub repo info
            githubRepoInfo.style.display = 'block';
            repoName.textContent = repoData.full_name;
            repoDescription.textContent = repoData.description || 'No description available';
            repoLanguage.textContent = repoData.language || 'Mixed';
            repoFileCount.textContent = allFiles.length;
            
            // Hide website sections, show GitHub section
            websiteUrlSelection.style.display = 'none';
            additionalUrlSelection.style.display = 'none';
            githubFileSelection.style.display = 'block';
            
            // Display all files with checkboxes
            githubFilesList.innerHTML = '';
            allFiles.forEach(file => {
                const isAISuggested = aiSuggestedFiles.includes(file.path);
                
                const fileItem = document.createElement('div');
                fileItem.className = `file-item ${isAISuggested ? 'ai-suggested' : ''}`;
                
                // Get file extension for icon
                const ext = file.path.split('.').pop().toLowerCase();
                const fileIcon = getFileIcon(ext);
                
                fileItem.innerHTML = `
                    <input type="checkbox" ${isAISuggested ? 'checked' : ''} onchange="updateFileSelectionSummary()">
                    <div class="file-item-content">
                        <div class="file-item-path">${fileIcon} ${file.path}</div>
                        <div class="file-item-info">${formatFileSize(file.size)}</div>
                        ${isAISuggested ? '<span class="file-item-badge">AI Suggested</span>' : ''}
                    </div>
                `;
                
                githubFilesList.appendChild(fileItem);
            });
            
            // Update selection summary
            updateFileSelectionSummary();
            
            linkPreviewModal.classList.add('show');
        }

        // Get file icon based on extension
        function getFileIcon(ext) {
            const icons = {
                'md': '📝', 'txt': '📄', 'js': '🟨', 'ts': '🔷', 'jsx': '⚛️', 'tsx': '⚛️',
                'py': '🐍', 'java': '☕', 'cpp': '⚙️', 'c': '⚙️', 'h': '📋',
                'css': '🎨', 'scss': '🎨', 'html': '🌐', 'xml': '📋', 'json': '📋',
                'yaml': '📋', 'yml': '📋', 'toml': '📋', 'ini': '📋',
                'sh': '🐚', 'bat': '🐚', 'ps1': '🐚', 'sql': '🗃️',
                'go': '🐹', 'rs': '🦀', 'php': '🐘', 'rb': '💎', 'swift': '🍎',
                'kt': '🟣', 'scala': '🔴', 'clj': '🟢', 'hs': '🟤'
            };
            return icons[ext] || '📄';
        }

        // Format file size
        function formatFileSize(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        }

        // File selection control functions
        function selectAllFiles() {
            const checkboxes = githubFilesList.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = true);
            updateFileSelectionSummary();
        }

        function selectNoneFiles() {
            const checkboxes = githubFilesList.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = false);
            updateFileSelectionSummary();
        }

        function selectAISuggestedFiles() {
            const fileItems = githubFilesList.querySelectorAll('.file-item');
            fileItems.forEach(item => {
                const checkbox = item.querySelector('input[type="checkbox"]');
                const isAISuggested = item.classList.contains('ai-suggested');
                checkbox.checked = isAISuggested;
            });
            updateFileSelectionSummary();
        }

        // Update file selection summary
        function updateFileSelectionSummary() {
            const checkedBoxes = githubFilesList.querySelectorAll('input[type="checkbox"]:checked');
            const totalSelected = checkedBoxes.length;
            const maxFiles = pendingScanDetails.maxPages;
            
            let summaryText = `Selected: ${totalSelected} files`;
            
            if (totalSelected > maxFiles) {
                summaryText += ` - ⚠️ Only the first ${maxFiles} files will be scanned based on your max files setting.`;
                confirmScanBtn.querySelector('.btn-text').textContent = `Scan First ${maxFiles} Files`;
            } else {
                confirmScanBtn.querySelector('.btn-text').textContent = `Start Scanning ${totalSelected} Files`;
            }
            
            selectionSummary.textContent = summaryText;
        }

        // Get selected files for scanning
        function getSelectedFiles() {
            const selectedFiles = [];
            
            const fileItems = githubFilesList.querySelectorAll('.file-item');
            fileItems.forEach(item => {
                const checkbox = item.querySelector('input[type="checkbox"]');
                if (checkbox.checked) {
                    const filePath = item.querySelector('.file-item-path').textContent.trim();
                    // Remove the icon from the beginning
                    const cleanPath = filePath.replace(/^[^\w\/]+\s*/, '');
                    selectedFiles.push(cleanPath);
                }
            });
            
            // Respect max files limit
            return selectedFiles.slice(0, pendingScanDetails.maxPages);
        }

        // Extract internal links from HTML (existing function)
        function extractInternalLinks(html, baseUrl) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = doc.querySelectorAll('a[href]');
            const baseUrlObj = new URL(baseUrl);
            const internalLinks = new Set();
            
            links.forEach(link => {
                try {
                    const href = link.getAttribute('href');
                    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
                        return;
                    }
                    
                    const absoluteUrl = new URL(href, baseUrl);
                    
                    // Check if it's the same domain
                    if (absoluteUrl.hostname === baseUrlObj.hostname) {
                        // Filter out common file extensions
                        const path = absoluteUrl.pathname.toLowerCase();
                        const skipExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.zip', '.doc', '.docx', '.mp4', '.mp3'];
                        const hasSkipExtension = skipExtensions.some(ext => path.endsWith(ext));
                        
                        if (!hasSkipExtension && path !== '/' && path !== '/index.html') {
                            internalLinks.add(absoluteUrl.href);
                        }
                    }
                } catch (e) {
                    // Invalid URL, skip
                }
            });
            
            return Array.from(internalLinks);
        }

        // Use AI to identify valuable links (existing function)
        async function identifyValuableLinks(html, initialUrl, allLinks) {
            const truncatedHtml = html.length > 8000 ? html.substring(0, 8000) + '...' : html;
            
            const prompt = `You are analyzing a website to identify the most valuable pages to scan for creating a knowledge base.

Initial URL: ${initialUrl}

HTML Content (truncated):
${truncatedHtml}

Available internal links found on this page:
${JSON.stringify(allLinks, null, 2)}

Please select the most valuable links from the provided list that would be useful for understanding this website's content. Focus on:
- Documentation, guides, tutorials
- Product/service information
- About us, company information
- Features, capabilities
- Help, support content

Avoid selecting:
- Contact pages
- Privacy policy, terms of service
- Login/signup pages
- Generic navigation links

Return ONLY a comma-separated list of the selected URLs from the provided list. Do not add any URLs that weren't in the original list.`;

            try {
                const response = await puter.ai.chat(prompt, { model: 'gpt-4o-mini' });
                const selectedLinks = response.split(',')
                    .map(link => link.trim().replace(/['"]/g, ''))
                    .filter(link => allLinks.includes(link))
                    .slice(0, 15); // Allow more suggestions, user can deselect
                
                return selectedLinks;
            } catch (error) {
                console.error('Error getting AI link suggestions:', error);
                // Fallback: return first few links
                return allLinks.slice(0, 8);
            }
        }

        // Display link preview modal (existing function)
        function displayLinkPreviewModal() {
            const { initialUrl, allLinks, aiSuggestedUrls } = pendingScanDetails;
            
            // Update modal for website
            modalTitle.textContent = 'Select Pages to Scan';
            modalDescription.textContent = 'Choose which pages you want to include in the scan. AI-suggested pages are pre-selected.';
            
            // Hide GitHub sections, show website sections
            githubRepoInfo.style.display = 'none';
            githubFileSelection.style.display = 'none';
            websiteUrlSelection.style.display = 'block';
            additionalUrlSelection.style.display = 'block';
            
            // Display initial URL
            initialUrlDisplay.textContent = initialUrl;
            
            // Display all additional links with checkboxes
            additionalUrlsList.innerHTML = '';
            allLinks.forEach(url => {
                const isAISuggested = aiSuggestedUrls.includes(url);
                
                const urlItem = document.createElement('div');
                urlItem.className = `url-item ${isAISuggested ? 'ai-suggested' : ''}`;
                
                urlItem.innerHTML = `
                    <input type="checkbox" ${isAISuggested ? 'checked' : ''} onchange="updateSelectionSummary()">
                    <div class="url-item-content">
                        <div class="url-item-url">${url}</div>
                        ${isAISuggested ? '<span class="url-item-badge">AI Suggested</span>' : ''}
                    </div>
                `;
                
                additionalUrlsList.appendChild(urlItem);
            });
            
            // Update selection summary
            updateSelectionSummary();
            
            linkPreviewModal.classList.add('show');
        }

        // URL selection control functions (existing)
        function selectAllUrls() {
            const checkboxes = additionalUrlsList.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = true);
            updateSelectionSummary();
        }

        function selectNoneUrls() {
            const checkboxes = additionalUrlsList.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = false);
            updateSelectionSummary();
        }

        function selectAISuggested() {
            const urlItems = additionalUrlsList.querySelectorAll('.url-item');
            urlItems.forEach(item => {
                const checkbox = item.querySelector('input[type="checkbox"]');
                const isAISuggested = item.classList.contains('ai-suggested');
                checkbox.checked = isAISuggested;
            });
            updateSelectionSummary();
        }

        // Update selection summary (existing)
        function updateSelectionSummary() {
            const checkedBoxes = additionalUrlsList.querySelectorAll('input[type="checkbox"]:checked');
            const totalSelected = checkedBoxes.length + 1; // +1 for initial URL
            const maxPages = pendingScanDetails.maxPages;
            
            let summaryText = `Selected: ${totalSelected} pages (including initial URL)`;
            
            if (totalSelected > maxPages) {
                summaryText += ` - ⚠️ Only the first ${maxPages} pages will be scanned based on your max pages setting.`;
                confirmScanBtn.querySelector('.btn-text').textContent = `Scan First ${maxPages} Pages`;
            } else {
                confirmScanBtn.querySelector('.btn-text').textContent = `Start Scanning ${totalSelected} Pages`;
            }
            
            selectionSummary.textContent = summaryText;
        }

        // Get selected URLs for scanning (existing)
        function getSelectedUrls() {
            const selectedUrls = [pendingScanDetails.initialUrl]; // Always include initial URL
            
            const urlItems = additionalUrlsList.querySelectorAll('.url-item');
            urlItems.forEach(item => {
                const checkbox = item.querySelector('input[type="checkbox"]');
                if (checkbox.checked) {
                    const url = item.querySelector('.url-item-url').textContent;
                    selectedUrls.push(url);
                }
            });
            
            // Respect max pages limit
            return selectedUrls.slice(0, pendingScanDetails.maxPages);
        }

        // Start confirmed scan
        async function startScanConfirmed() {
            try {
                linkPreviewModal.classList.remove('show');
                setButtonLoading(confirmScanBtn, true);
                
                if (pendingScanDetails.type === 'github') {
                    await scanGitHubRepository();
                } else {
                    await scanWebsite();
                }
                
            } catch (error) {
                console.error('Error during scan:', error);
                addChatMessage('error', '❌ Error during scan: ' + error.message);
                analyzeBtn.disabled = false;
            } finally {
                setButtonLoading(confirmScanBtn, false);
            }
        }

        // Scan GitHub repository
        async function scanGitHubRepository() {
            const siteId = puter.randName();
            const { initialUrl, maxPages, websiteTitle, repoData } = pendingScanDetails;
            const selectedFiles = getSelectedFiles();
            
            console.log('Selected files for scanning:', selectedFiles);
            console.log('Max files limit:', maxPages);
            
            // Show progress in chat
            clearChat();
            addChatMessage('status', `🚀 Initiating scan of ${selectedFiles.length} files from ${websiteTitle}...`);
            
            // Disable scan button
            analyzeBtn.disabled = true;
            
            // Parse GitHub URL for API calls
            const repoInfo = parseGitHubUrl(initialUrl);
            const chunksWithSource = [];
            const processedFiles = [];
            
            let fetchedCount = 0;
            for (const filePath of selectedFiles) {
                if (fetchedCount >= maxPages) {
                    break; // Respect max files limit strictly
                }
                
                try {
                    addChatMessage('status', `📄 Fetching file ${fetchedCount + 1}/${Math.min(selectedFiles.length, maxPages)}: ${filePath}`);
                    
                    // Fetch file content from GitHub API
                    const fileResponse = await fetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/contents/${filePath}`);
                    
                    if (!fileResponse.ok) {
                        console.warn(`HTTP error ${fileResponse.status} for ${filePath}`);
                        addChatMessage('status', `⚠️ Skipped ${filePath} (HTTP ${fileResponse.status})`);
                        continue;
                    }
                    
                    const fileData = await fileResponse.json();
                    
                    // Decode base64 content
                    const content = atob(fileData.content);
                    
                    if (!content || content.trim().length === 0) {
                        console.warn(`Empty content from ${filePath}`);
                        addChatMessage('status', `⚠️ Skipped ${filePath} (empty content)`);
                        continue;
                    }
                    
                    // Process the file content
                    const fileUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}/blob/${repoData.default_branch}/${filePath}`;
                    processedFiles.push({
                        path: filePath,
                        content: content,
                        url: fileUrl
                    });
                    
                    // Create chunks for this file
                    const chunks = chunkText(content, 1000, 100);
                    chunks.forEach(chunk => {
                        chunksWithSource.push({
                            content: chunk,
                            source_url: fileUrl,
                            source_file: filePath
                        });
                    });
                    
                    fetchedCount++;
                    
                } catch (error) {
                    console.warn(`Unexpected error processing ${filePath}:`, error);
                    addChatMessage('status', `⚠️ Error processing ${filePath}: ${error.message}`);
                }
            }
            
            addChatMessage('status', `✅ Successfully processed ${processedFiles.length} files. Generating summary...`);
            
            if (chunksWithSource.length === 0) {
                throw new Error('No meaningful content could be extracted from the repository files');
            }
            
            // Generate AI summary
            const combinedTextForSummary = processedFiles.map(file => 
                `File: ${file.path}\n${file.content}`
            ).join('\n\n--- FILE BREAK ---\n\n');
            
            const siteSummary = await summarizeGitHubRepository(combinedTextForSummary, repoData);
            
            addChatMessage('status', '☁️ Saving data to cloud...');
            
            // Save to Puter cloud
            const siteMetadata = {
                id: siteId,
                url: initialUrl,
                title: websiteTitle,
                type: 'github',
                scanned_at: Date.now(),
                num_pages_scanned: processedFiles.length,
                num_chunks: chunksWithSource.length,
                summary: siteSummary,
                repo_info: {
                    owner: repoInfo.owner,
                    repo: repoInfo.repo,
                    description: repoData.description,
                    language: repoData.language
                }
            };
            
            await saveWebsiteData(siteId, siteMetadata, chunksWithSource);
            
            // Update saved sites index
            savedSitesIndex[siteId] = siteMetadata;
            await puter.kv.set(SAVED_SITES_KEY, JSON.stringify(savedSitesIndex));
            
            // Prepare chatbot
            websiteContentChunks = chunksWithSource;
            conversationHistory = [{
                role: 'system',
                content: `You are a helpful AI assistant that answers questions about the GitHub repository "${websiteTitle}". Here's a summary of the repository:

${siteSummary}

Answer questions based on the provided code and documentation. If you don't know something based on the repository content, say so clearly. When referencing code, mention the specific file when possible.`
            }];
            
            currentLoadedSiteId = siteId;
            currentSiteTitle.textContent = websiteTitle;
            currentSiteDisplay.style.display = 'block';
            
            botReady = true;
            chatInput.disabled = false;
            sendBtn.disabled = false;
            
            clearChat();
            addChatMessage('bot', `🎉 Hi! I've successfully analyzed the GitHub repository "${websiteTitle}" (${processedFiles.length} files) and I'm ready to answer your questions about the code and documentation. What would you like to know?`);
            
            // Update UI
            renderSavedSitesList();
            websiteUrlInput.value = '';
            analyzeBtn.disabled = false;
        }

        // Scan website (existing function with minor updates)
        async function scanWebsite() {
            const siteId = puter.randName();
            const { initialUrl, maxPages, websiteTitle } = pendingScanDetails;
            const selectedUrls = getSelectedUrls();
            
            console.log('Selected URLs for scanning:', selectedUrls);
            console.log('Max pages limit:', maxPages);
            
            // Show progress in chat
            clearChat();
            addChatMessage('status', `🚀 Initiating scan of ${selectedUrls.length} pages...`);
            
            // Disable scan button
            analyzeBtn.disabled = true;
            
            // Collect HTML content
            const collectedHtmlContents = new Map();
            const processedUrls = new Set();
            
            let fetchedCount = 0;
            for (const currentUrl of selectedUrls) {
                if (fetchedCount >= maxPages || processedUrls.has(currentUrl)) {
                    break; // Respect max pages limit strictly
                }
                
                try {
                    addChatMessage('status', `📄 Fetching page ${fetchedCount + 1}/${Math.min(selectedUrls.length, maxPages)}: ${currentUrl}`);
                    
                    let response;
                    try {
                        response = await puter.net.fetch(currentUrl);
                    } catch (fetchError) {
                        console.warn(`Network error fetching ${currentUrl}:`, fetchError);
                        if (fetchError.message.includes('ERR_BLOCKED_BY_CLIENT')) {
                            addChatMessage('status', `⚠️ Skipped ${currentUrl} (blocked by browser/ad blocker)`);
                        } else {
                            addChatMessage('status', `⚠️ Skipped ${currentUrl} (network error: ${fetchError.message})`);
                        }
                        continue;
                    }
                    
                    if (!response.ok) {
                        console.warn(`HTTP error ${response.status} for ${currentUrl}`);
                        addChatMessage('status', `⚠️ Skipped ${currentUrl} (HTTP ${response.status})`);
                        continue;
                    }
                    
                    const html = await response.text();
                    
                    if (!html || html.trim().length === 0) {
                        console.warn(`Empty content from ${currentUrl}`);
                        addChatMessage('status', `⚠️ Skipped ${currentUrl} (empty content)`);
                        continue;
                    }
                    
                    collectedHtmlContents.set(currentUrl, html);
                    processedUrls.add(currentUrl);
                    fetchedCount++;
                    
                } catch (error) {
                    console.warn(`Unexpected error processing ${currentUrl}:`, error);
                    addChatMessage('status', `<i class="fas fa-exclamation-triangle" style="color: #e74c3c;"></i> Error processing ${currentUrl}: ${error.message}`);
                }
            }
            
            addChatMessage('status', `<i class="fas fa-check-circle" style="color: #2ecc71;"></i> Successfully fetched ${collectedHtmlContents.size} pages. Processing content...`);
            
            // Extract and chunk text
            const chunksWithSource = [];
            const allExtractedText = [];
            
            for (const [url, html] of collectedHtmlContents) {
                const text = extractTextFromHtml(html);
                if (text.length > 50) {
                    allExtractedText.push(text);
                    const chunks = chunkText(text, 1000, 100);
                    chunks.forEach(chunk => {
                        chunksWithSource.push({
                            content: chunk,
                            source_url: url
                        });
                    });
                }
            }
            
            if (chunksWithSource.length === 0) {
                throw new Error('No meaningful content could be extracted from the website');
            }
            
            addChatMessage('status', `<i class="fas fa-file-alt" style="color: #3498db;"></i> Created ${chunksWithSource.length} content chunks. Generating summary...`);
            
            // Generate AI summary
            const combinedTextForSummary = allExtractedText.join('\n\n--- PAGE BREAK ---\n\n');
            const siteSummary = await summarizeContentForBotSystemMessage(combinedTextForSummary, websiteTitle);
            
            addChatMessage('status', '☁️ Saving data to cloud...');
            
            // Save to Puter cloud
            const siteMetadata = {
                id: siteId,
                url: initialUrl,
                title: websiteTitle,
                type: 'website',
                scanned_at: Date.now(),
                num_pages_scanned: collectedHtmlContents.size,
                num_chunks: chunksWithSource.length,
                summary: siteSummary
            };
            
            await saveWebsiteData(siteId, siteMetadata, chunksWithSource);
            
            // Update saved sites index
            savedSitesIndex[siteId] = siteMetadata;
            await puter.kv.set(SAVED_SITES_KEY, JSON.stringify(savedSitesIndex));
            
            // Prepare chatbot
            websiteContentChunks = chunksWithSource;
            conversationHistory = [{
                role: 'system',
                content: `You are a helpful AI assistant that answers questions about the website "${websiteTitle}" (${initialUrl}). Here's a summary of the website content:

${siteSummary}

Answer questions based on the provided context. If you don't know something based on the website content, say so clearly.`
            }];
            
            currentLoadedSiteId = siteId;
            currentSiteTitle.textContent = websiteTitle;
            currentSiteDisplay.style.display = 'block';
            
            botReady = true;
            chatInput.disabled = false;
            sendBtn.disabled = false;
            
            clearChat();
            addChatMessage('bot', `🎉 Hi! I've successfully scanned "${websiteTitle}" (${collectedHtmlContents.size} pages) and I'm ready to answer your questions about it. What would you like to know?`);
            
            // Update UI
            renderSavedSitesList();
            websiteUrlInput.value = '';
            analyzeBtn.disabled = false;
        }

        // Summarize GitHub repository for bot system message
        async function summarizeGitHubRepository(combinedText, repoData) {
            const prompt = `Please create a concise, informative summary of this GitHub repository for training an AI chatbot.

Repository: ${repoData.full_name}
Description: ${repoData.description || 'No description available'}
Language: ${repoData.language || 'Mixed'}

Repository content:
${combinedText.substring(0, 12000)}

Create a factual summary that covers:
- What this repository/project is about
- Main technologies and frameworks used
- Key features and functionality
- Project structure and important files
- Any setup or usage instructions found

Keep the summary concise but comprehensive. Focus on technical details that would help answer questions about the codebase.`;

            try {
                const response = await puter.ai.chat(prompt, { model: 'gpt-4o' });
                return response;
            } catch (error) {
                console.error('Error generating repository summary:', error);
                return `This is a GitHub repository: ${repoData.full_name}. ${repoData.description || 'The AI assistant can answer questions about the code and documentation found in this repository.'}`;
            }
        }

        // Extract text from HTML (existing function)
        function extractTextFromHtml(html) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Remove script and style elements
            const scripts = doc.querySelectorAll('script, style, nav, header, footer');
            scripts.forEach(el => el.remove());
            
            // Try to find main content
            const mainContent = doc.querySelector('main, article, .content, .main-content, #content, #main');
            const textSource = mainContent || doc.body || doc;
            
            return textSource.textContent || textSource.innerText || '';
        }

        // Chunk text into smaller pieces (existing function)
        function chunkText(text, chunkSize = 1000, overlap = 100) {
            const chunks = [];
            const words = text.split(/\s+/);
            
            for (let i = 0; i < words.length; i += chunkSize - overlap) {
                const chunk = words.slice(i, i + chunkSize).join(' ');
                if (chunk.trim().length > 0) {
                    chunks.push(chunk.trim());
                }
            }
            
            return chunks;
        }

        // Summarize content for bot system message (existing function)
        async function summarizeContentForBotSystemMessage(combinedText, websiteTitle) {
            const prompt = `Please create a concise, informative summary of this website content for training an AI chatbot. The website is titled "${websiteTitle}".

Content:
${combinedText.substring(0, 12000)}

Create a factual summary that covers:
- What this website/organization is about
- Key topics, products, or services covered
- Main sections or areas of focus
- Any important details that would help answer user questions

Keep the summary concise but comprehensive. Avoid phrases like "This website" or "The content covers" - just provide the factual information directly.`;

            try {
                const response = await puter.ai.chat(prompt, { model: 'gpt-4o' });
                return response;
            } catch (error) {
                console.error('Error generating summary:', error);
                return `This is content from ${websiteTitle}. The AI assistant can answer questions about the information found on this website.`;
            }
        }

        // Save website data to Puter filesystem (existing function)
        async function saveWebsiteData(siteId, metadata, chunks) {
            const siteDirPath = `${APP_DATA_DIR}/${siteId}`;
            const chunksDirPath = `${siteDirPath}/chunks`;
            
            /**
             * PUTER.JS TUTORIAL: File System Operations
             * puter.fs provides a complete virtual file system in the cloud.
             * 
             * puter.fs.mkdir() creates directories in the cloud file system.
             * - createMissingParents: true automatically creates parent directories
             * - overwrite: false prevents accidental overwriting of existing directories
             * - Files and directories persist across sessions and devices
             * - Mimics traditional file system operations in a cloud environment
             */
            // Create directories
            await puter.fs.mkdir(APP_DATA_DIR, { createMissingParents: true, overwrite: false });
            await puter.fs.mkdir(siteDirPath, { createMissingParents: true });
            await puter.fs.mkdir(chunksDirPath, { createMissingParents: true });
            
            /**
             * PUTER.JS TUTORIAL: File Writing
             * puter.fs.write() creates or overwrites files in the cloud file system.
             * - First parameter: path to the file (can include directories)
             * - Second parameter: content to write (strings, JSON, or Blob objects)
             * - Perfect for storing structured data, configurations, or user-generated content
             * - Files persist across sessions and devices
             */
            // Save metadata
            await puter.fs.write(`${siteDirPath}/metadata.json`, JSON.stringify(metadata, null, 2));
            
            // Save chunks
            for (let i = 0; i < chunks.length; i++) {
                const chunkFileName = `chunk_${i.toString().padStart(4, '0')}.json`;
                await puter.fs.write(`${chunksDirPath}/${chunkFileName}`, JSON.stringify(chunks[i], null, 2));
            }
        }

        // Load website data from Puter filesystem (existing function)
        async function loadWebsiteData(siteId) {
            try {
                addChatMessage('status', '📂 Loading data...');
                
                const siteDirPath = `${APP_DATA_DIR}/${siteId}`;
                
                /**
                 * PUTER.JS TUTORIAL: File Reading
                 * puter.fs.read() retrieves file contents from the cloud file system.
                 * - Returns a Blob object containing the file data
                 * - Use .text() or .json() methods to convert to usable formats
                 * - Handles files of any type (text, JSON, binary)
                 * - Throws error if file doesn't exist (use try/catch)
                 */
                // Load metadata
                const metadataBlob = await puter.fs.read(`${siteDirPath}/metadata.json`);
                const metadata = JSON.parse(await metadataBlob.text());
                
                // Load chunks
                const chunksDirPath = `${siteDirPath}/chunks`;
                /**
                 * PUTER.JS TUTORIAL: Directory Listing
                 * puter.fs.readdir() lists all files and subdirectories in a directory.
                 * - Returns an array of file/directory objects with properties:
                 *   - name: filename or directory name
                 *   - path: full path to the item
                 *   - isDir: boolean indicating if it's a directory
                 *   - size: file size in bytes
                 *   - ...and more metadata
                 * - Perfect for building file browsers or processing multiple files
                 */
                const chunkFiles = await puter.fs.readdir(chunksDirPath);
                
                const chunks = [];
                for (const chunkFile of chunkFiles) {
                    if (chunkFile.name.endsWith('.json')) {
                        const chunkBlob = await puter.fs.read(chunkFile.path);
                        const chunkData = JSON.parse(await chunkBlob.text());
                        chunks.push(chunkData);
                    }
                }
                
                // Set up chatbot
                websiteContentChunks = chunks;
                
                const systemMessage = metadata.type === 'github' 
                    ? `You are a helpful AI assistant that answers questions about the GitHub repository "${metadata.title}". Here's a summary of the repository:

${metadata.summary}

Answer questions based on the provided code and documentation. If you don't know something based on the repository content, say so clearly. When referencing code, mention the specific file when possible.`
                    : `You are a helpful AI assistant that answers questions about the website "${metadata.title}" (${metadata.url}). Here's a summary of the website content:

${metadata.summary}

Answer questions based on the provided context. If you don't know something based on the website content, say so clearly.`;
                
                conversationHistory = [{
                    role: 'system',
                    content: systemMessage
                }];
                
                currentLoadedSiteId = siteId;
                currentSiteTitle.textContent = metadata.title;
                currentSiteDisplay.style.display = 'block';
                
                botReady = true;
                chatInput.disabled = false;
                sendBtn.disabled = false;
                
                clearChat();
                const welcomeMessage = metadata.type === 'github' 
                    ? `👋 Hi! I'm ready to answer questions about the GitHub repository "${metadata.title}". What would you like to know about the code or documentation?`
                    : `👋 Hi! I'm ready to answer questions about "${metadata.title}". What would you like to know?`;
                
                addChatMessage('bot', welcomeMessage);
                
                // Update UI
                renderSavedSitesList();
                
            } catch (error) {
                console.error('Error loading data:', error);
                addChatMessage('error', '❌ Error loading data: ' + error.message);
            }
        }

        // Load website data and switch to chat tab (existing function)
        async function loadWebsiteDataAndChat(siteId, event) {
            event.stopPropagation();
            
            const chatButton = event.target.closest('.chat-btn');
            
            try {
                // Show loading state
                chatButton.classList.add('loading');
                chatButton.disabled = true;
                
                // Load the website data
                await loadWebsiteData(siteId);
                
            } catch (error) {
                console.error('Error loading data for chat:', error);
                addChatMessage('error', '❌ Error loading data for chat: ' + error.message);
            } finally {
                // Remove loading state
                chatButton.classList.remove('loading');
                chatButton.disabled = false;
            }
        }

        // Delete website data (existing function)
        async function deleteWebsiteData(siteId, deleteButton) {
            console.log('🗑️ DELETE PROCESS STARTED');
            console.log('🗑️ Site ID to delete:', siteId);
            console.log('🗑️ Delete button element:', deleteButton);
            console.log('🗑️ Current savedSitesIndex before deletion:', savedSitesIndex);

            const site = savedSitesIndex[siteId];
            console.log('🗑️ Site data found:', site);

            if (!site) {
                console.error('🗑️ ERROR: Site not found in savedSitesIndex');
                return;
            }

            try {
                console.log('🗑️ Showing confirmation dialog...');
                
                // Use standard browser confirm instead of puter.ui.alert
                const confirmed = confirm(`Are you sure you want to delete "${site.title}"? This action cannot be undone.`);
                
                console.log('🗑️ User confirmation result:', confirmed);
                
                if (!confirmed) {
                    console.log('🗑️ User cancelled deletion');
                    return;
                }
                
                console.log('🗑️ User confirmed deletion, proceeding...');
                console.log('🗑️ Setting loading state on delete button...');
                
                // Show loading state on delete button
                deleteButton.classList.add('loading');
                deleteButton.disabled = true;
                console.log('🗑️ Delete button loading state set');
                
                console.log('🗑️ Adding status message to chat...');
                addChatMessage('status', `🗑️ Deleting "${site.title}"...`);
                
                // Delete from filesystem
                const siteDirPath = `${APP_DATA_DIR}/${siteId}`;
                console.log('🗑️ Site directory path:', siteDirPath);
                
                try {
                    console.log('🗑️ Starting filesystem deletion...');
                    
                    // Try recursive delete first (simpler approach)
                    console.log('🗑️ Attempting recursive delete of entire site directory...');
                    /**
                     * PUTER.JS TUTORIAL: File and Directory Deletion
                     * puter.fs.delete() removes files or directories from the cloud file system.
                     * - First parameter: path to delete
                     * - recursive: true allows deleting directories with contents
                     * - Use with caution as deleted data cannot be recovered
                     * - Returns a promise that resolves when deletion is complete
                     */
                    await puter.fs.delete(siteDirPath, { recursive: true });
                    console.log('🗑️ Recursive delete completed successfully');
                    
                } catch (fsError) {
                    console.error('🗑️ Filesystem deletion failed:', fsError);
                    throw new Error(`Failed to delete files: ${fsError.message}`);
                }
                
                console.log('🗑️ Filesystem deletion completed');
                
                // Remove from index
                console.log('🗑️ Removing from savedSitesIndex...');
                console.log('🗑️ Before deletion - savedSitesIndex keys:', Object.keys(savedSitesIndex));
                delete savedSitesIndex[siteId];
                console.log('🗑️ After deletion - savedSitesIndex keys:', Object.keys(savedSitesIndex));
                
                console.log('🗑️ Updating KV store...');
                /**
                 * PUTER.JS TUTORIAL: Storing Data in Cloud Key-Value Store
                 * puter.kv.set() saves data to Puter's cloud key-value store.
                 * - First parameter: unique key to identify the data
                 * - Second parameter: string data to store (use JSON.stringify for objects)
                 * - Data persists across sessions and devices
                 * - Perfect for app settings, user preferences, or small datasets
                 * - No size limits for practical use cases
                 */
                await puter.kv.set(SAVED_SITES_KEY, JSON.stringify(savedSitesIndex));
                console.log('🗑️ KV store updated successfully');
                
                // Reset chatbot if this was the loaded site
                if (currentLoadedSiteId === siteId) {
                    console.log('🗑️ Resetting chatbot (deleted site was currently loaded)');
                    resetChatbot();
                }
                
                console.log('🗑️ Calling renderSavedSitesList to update UI...');
                // Update UI - this will remove the item from the list
                renderSavedSitesList();
                console.log('🗑️ UI updated');
                
                console.log('🗑️ Adding success message to chat...');
                addChatMessage('status', `✅ "${site.title}" has been deleted successfully.`);
                
                console.log('🗑️ DELETE PROCESS COMPLETED SUCCESSFULLY');
                
            } catch (error) {
                console.error('🗑️ ERROR during deletion process:', error);
                console.error('🗑️ Error stack:', error.stack);
                addChatMessage('error', '❌ Error deleting data: ' + error.message);
                
                // Restore delete button on error
                if (deleteButton) {
                    console.log('🗑️ Restoring delete button state after error');
                    deleteButton.classList.remove('loading');
                    deleteButton.disabled = false;
                }
            }
        }

        // Handle chat input (existing function)
        async function handleChatInput() {
            const userInput = chatInput.value.trim();
            if (!userInput || !botReady) return;
            
            // Add user message
            addChatMessage('user', userInput);
            conversationHistory.push({ role: 'user', content: userInput });
            
            // Clear input and disable
            chatInput.value = '';
            chatInput.style.height = 'auto';
            chatInput.disabled = true;
            setButtonLoading(sendBtn, true);
            
            try {
                // Retrieve relevant chunks (simple keyword matching)
                const relevantChunks = retrieveRelevantChunks(userInput);
                
                // Prepare context for AI
                const contextForAI = relevantChunks.length > 0 
                    ? `Based on the following relevant content:

${relevantChunks.map((chunk, i) => {
    const sourceInfo = chunk.source_file 
        ? `File: ${chunk.source_file}` 
        : `Source: ${chunk.source_url}`;
    return `[${i+1}] ${chunk.content}\n${sourceInfo}`;
}).join('\n\n')}

User question: ${userInput}`
                    : userInput;
                
                // Prepare messages for AI
                const messagesToSend = [
                    conversationHistory[0], // System message
                    ...conversationHistory.slice(1, -1), // Previous conversation
                    { role: 'user', content: contextForAI } // Current question with context
                ];
                
                /**
                 * PUTER.JS TUTORIAL: Streaming AI Responses
                 * puter.ai.chat() with streaming option provides real-time AI responses.
                 * - stream: true enables response streaming for better user experience
                 * - Returns an async iterator that yields response chunks as they arrive
                 * - Perfect for chat interfaces where immediate feedback is important
                 * - Allows showing partial responses while the AI is still generating
                 */
                // Get AI response with streaming
                const response = await puter.ai.chat(messagesToSend, { stream: true });
                
                // Add bot message container
                const botMessageElement = addChatMessage('bot', '');
                
                // Stream response
                let fullResponse = '';
                for await (const part of response) {
                    if (part.text) {
                        fullResponse += part.text;
                        // Parse markdown and update the message
                        const htmlContent = marked.parse(fullResponse);
                        botMessageElement.innerHTML = htmlContent;
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    }
                }
                
                // Add to conversation history
                conversationHistory.push({ role: 'assistant', content: fullResponse });
                
            } catch (error) {
                console.error('Error getting AI response:', error);
                addChatMessage('error', '❌ Error getting response: ' + error.message);
            } finally {
                chatInput.disabled = false;
                setButtonLoading(sendBtn, false);
                chatInput.focus();
            }
        }

        // Retrieve relevant chunks using keyword matching (existing function)
        function retrieveRelevantChunks(userInput, maxChunks = 4) {
            if (websiteContentChunks.length === 0) return [];
            
            // Extract keywords from user input and recent conversation
            const recentMessages = conversationHistory.slice(-5).map(msg => msg.content).join(' ');
            const allText = (userInput + ' ' + recentMessages).toLowerCase();
            const keywords = allText.match(/\b\w{3,}\b/g) || [];
            
            // Score chunks based on keyword matches
            const scoredChunks = websiteContentChunks.map(chunk => {
                const chunkText = chunk.content.toLowerCase();
                const score = keywords.reduce((acc, keyword) => {
                    return acc + (chunkText.includes(keyword) ? 1 : 0);
                }, 0);
                return { ...chunk, score };
            });
            
            // Return top scoring chunks
            return scoredChunks
                .filter(chunk => chunk.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, maxChunks);
        }

        // Chat UI helpers (existing functions)
        function addChatMessage(type, content) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${type}`;
            
            if (type === 'bot' && content.trim()) {
                // Parse markdown for bot messages
                messageDiv.innerHTML = marked.parse(content);
            } else {
                // Regular text for other message types
                messageDiv.innerHTML = content.replace(/\n/g, '<br>');
            }
            
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            return messageDiv;
        }

        function clearChat() {
            chatMessages.innerHTML = '';
        }

        function resetChatbot() {
            botReady = false;
            websiteContentChunks = [];
            conversationHistory = [];
            currentLoadedSiteId = null;
            currentSiteDisplay.style.display = 'none';
            chatInput.disabled = true;
            sendBtn.disabled = true;
            clearChat();
            addChatMessage('status', '👋 Welcome! Please scan a website or GitHub repository to start chatting.');
        }

        // UI helpers (existing function)
        function setButtonLoading(button, loading) {
            const textSpan = button.querySelector('.btn-text');
            const spinner = button.querySelector('.spinner');
            
            if (loading) {
                textSpan.style.display = 'none';
                spinner.style.display = 'inline-block';
                button.disabled = true;
            } else {
                textSpan.style.display = 'inline';
                spinner.style.display = 'none';
                button.disabled = false;
            }
        }

        // Event listeners
        analyzeBtn.addEventListener('click', analyzeAndPreviewLinks);
        confirmScanBtn.addEventListener('click', startScanConfirmed);
        cancelScanBtn.addEventListener('click', () => {
            linkPreviewModal.classList.remove('show');
            setButtonLoading(confirmScanBtn, false);
        });

        sendBtn.addEventListener('click', handleChatInput);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleChatInput();
            }
        });

        // Close modal when clicking outside
        linkPreviewModal.addEventListener('click', (e) => {
            if (e.target === linkPreviewModal) {
                linkPreviewModal.classList.remove('show');
                setButtonLoading(confirmScanBtn, false);
            }
        });

        // Initialize app when page loads
        document.addEventListener('DOMContentLoaded', initializeApp);