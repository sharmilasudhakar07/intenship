// ================== CONFIGURATION ==================

// Initialize global tracking of processed invitations
if (typeof window.processedInvitations === 'undefined') {
    window.processedInvitations = new Set();
}

// Initialize counters for processed, accepted, and rejected invitations
if (typeof window.invitationCounters === 'undefined') {
    window.invitationCounters = {
        processed: 0,
        accepted: 0,
        rejected: 0
    };
}

// ================== HELPER FUNCTIONS ==================
function getCurrentDateTime() {
    return new Date().toLocaleString();
}

// Load the live log script
function loadLiveLogScript() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('livelog.js');
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load live log script'));
        document.body.appendChild(script);
    });
}

/* // Adding missing debugLog function
function console.log(message, type = 'info') {
    const types = {
        info: 'color: #0073e6',
        success: 'color: #2e8b57',
        warning: 'color: #ff9900',
        error: 'color: #d9534f',
        processing: 'color: #9932cc'
    };
   
    console.log(`%c[${getCurrentDateTime()}] ${message}`, types[type] || types.info);
    // Update LiveLog if it's available
    if (typeof window.updateLiveLog === 'function') {
        // Map log types to LiveLog states
        const liveLogState = {
            'info': 'processing',
            'success': 'success',
            'warning': 'waiting',
            'error': 'error',
            'processing': 'processing'
        };
        window.console.log(message, liveLogState[type] || 'processing');
    }
} */

async function loadCriteria() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['criteria'], function(result) {
            if (result.criteria) {
                resolve(result.criteria);
            } else {
                // Default criteria if none saved
                resolve({
                    relevantTitles: ['Data Analyst', 'Software Engineer', 'Developer', 'student', 'python'],
                    relevantInstitutions: ['wcc', 'sdnb'],
                    minMutualConnections: 0,
                    batchLimit: 10,
                    testingMode: false, // Added missing testingMode default
                    processingDelay: 50000 // Default 50 seconds delay for "Start Accept" button
                });
            }
        });
    });
}

async function scrollLikeHuman() {
    return new Promise((resolve) => {
        const scrollStep = 200; // Scroll distance per step
        const scrollDelay = 800; // Delay between scrolls
        const scrollCount = 3; // Number of dummy scrolls to perform

        let currentScroll = 0;

        const scrollInterval = setInterval(() => {
            window.scrollBy(0, scrollStep);
            currentScroll++;

            if (currentScroll >= scrollCount) {
                clearInterval(scrollInterval);
                resolve();
            }
        }, scrollDelay);
    });
}

async function extractLinkedInInvitations(batchLimit) {
    const invitationCards = Array.from(document.querySelectorAll('.display-flex.flex-1.align-items-center.pl0'));
    let invitations = {};

    const unprocessedCards = invitationCards.filter(card => {
        const nameElement = card.querySelector('.invitation-card__tvm-title strong');
        const name = nameElement?.innerText.trim() || 'Name not found';
        return !window.processedInvitations.has(name);
    });

    const cardsToProcess = unprocessedCards.slice(0, batchLimit);

    cardsToProcess.forEach((card, index) => {
        const nameElement = card.querySelector('.invitation-card__tvm-title strong');
        const subtitleElement = card.querySelector('.invitation-card__subtitle');
        const mutualConnectionsElement = card.querySelector('.member-insights span');
        const timestampElement = card.querySelector('.time-badge');

        const name = nameElement?.innerText.trim() || 'Name not found';

        invitations[`invitation${index + 1}`] = {
            name: name,
            subtitle: subtitleElement?.innerText.trim() || 'Subtitle not found',
            mutualConnections: mutualConnectionsElement?.innerText.trim() || 'Mutual connections not found',
            timestamp: timestampElement?.innerText.trim() || 'Timestamp not found',
            status: 'pending',
            reason: ''
        };

        window.processedInvitations.add(name);
    });

    return invitations;
}

// Function to check if we're on the LinkedIn invitations manager page
function isInvitationManagerPage() {
    return window.location.href.includes('mynetwork/invitation-manager');
}

// Function to process connections with a delay between each acceptance
async function processConnectionsWithDelay() {
    console.log('Starting to process connections with delay...', 'processing');
    
    // Check if there's a LiveLog update function available
    if (typeof window.updateLiveLog === 'function') {
        window.console.log("⏱️ Starting to process connections with delay...", "processing");
    }
    
    // Find all accept buttons on the page
    const acceptButtons = Array.from(document.querySelectorAll('button[aria-label*="Accept"]'));
    
    if (acceptButtons.length === 0) {
        console.log('No accept buttons found on the page.', 'warning');
        if (typeof window.updateLiveLog === 'function') {
            window.console.log("No accept buttons found on the page.", "error");
        }
        return;
    }
    
    console.log(`Found ${acceptButtons.length} accept buttons. Processing one by one...`, 'info');
    if (typeof window.updateLiveLog === 'function') {
        window.console.log(`Found ${acceptButtons.length} accept buttons. Processing with delay...`, "processing");
    }
    
    // Load criteria for decision making
    const criteria = await loadCriteria();
    const delay = criteria.processingDelay || 50000; // Default 50 seconds if not specified
    
    // Process each button with a delay
    let processedCount = 0;
    for (const button of acceptButtons) {
        const ariaLabel = button.getAttribute('aria-label') || '';
        const nameMatch = ariaLabel.match(/Accept\s(.+?)('s invitation)?$/);
        const name = nameMatch ? nameMatch[1] : 'Unknown';

        console.log(`Processing connection request from: ${name}`, 'processing');
        if (typeof window.updateLiveLog === 'function') {
            window.console.log(`Processing connection for: ${name}`, "processing");
        }

        try {
            // Scroll to make button visible
            button.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Small random delay before clicking to appear more human-like
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 500));
            
            // Click the accept button
            button.click();
            processedCount++;

            // Update counters
            window.invitationCounters.processed++;
            window.invitationCounters.accepted++;

            // Update the stats popup
            createOrUpdatePopup();
            
            console.log(`Accepted connection from ${name} (${processedCount}/${acceptButtons.length})`, 'success');
            if (typeof window.updateLiveLog === 'function') {
                window.console.log(`✅ Accepted connection from ${name} (${processedCount}/${acceptButtons.length})`, "success");
            }

            // Wait before processing next invitation
            const progressMessage = `Waiting ${delay/1000} seconds before next connection...`;
            console.log(progressMessage, 'info');
            if (typeof window.updateLiveLog === 'function') {
                window.console.log(progressMessage, "processing");
            }
            
            await new Promise(resolve => setTimeout(resolve, delay));

        } catch (error) {
            console.log(`Error processing connection from ${name}: ${error.message}`, 'error');
            if (typeof window.updateLiveLog === 'function') {
                window.console.log(`❌ Error with ${name}: ${error.message}`, "error");
            }
        }
    }
    
    console.log(`Finished processing ${processedCount} connections.`, 'success');
    if (typeof window.updateLiveLog === 'function') {
        window.console.log(`✅ Finished processing ${processedCount} connections.`, "success");
    }
}

function createOrUpdatePopup() {
    let popup = document.getElementById('invitation-stats-popup');
    if (!popup) {
        // Create the popup if it doesn't exist
        popup = document.createElement('div');
        popup.id = 'invitation-stats-popup';
        popup.style.position = 'fixed';
        popup.style.top = '20px'; // Position at the top
        popup.style.right = '20px'; // Position on the right
        popup.style.backgroundColor = '#f0f8ff'; // Light blue background
        popup.style.border = '1.5px solid rgb(0, 51, 204)'; // Blue border
        popup.style.borderRadius = '10px'; // Rounded corners
        popup.style.padding = '15px 20px'; // Padding for spacing
        popup.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)'; // Subtle shadow
        popup.style.zIndex = '10000'; // Ensure it's on top
        popup.style.fontFamily = 'Arial, sans-serif';
        popup.style.fontSize = '16px'; // Increased font size
        popup.style.color = '#333'; // Dark text color
        popup.style.display = 'flex';
        popup.style.flexDirection = 'column';
        popup.style.gap = '10px'; // Spacing between items
        popup.style.maxWidth = '230px';
        document.body.appendChild(popup);

        // Add drag functionality
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;

        popup.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - popup.getBoundingClientRect().left;
            offsetY = e.clientY - popup.getBoundingClientRect().top;
            popup.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                const x = e.clientX - offsetX;
                const y = e.clientY - offsetY;
                popup.style.left = `${x}px`;
                popup.style.top = `${y}px`;
                popup.style.right = 'auto'; // Allow free dragging
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            popup.style.cursor = 'grab';
        });

        // Optional: change cursor on hover
        popup.addEventListener('mouseover', () => {
            popup.style.cursor = 'grab';
        });
    }

    // Extract total invitation count from the "All (X)" text
    let totalInvitations = window.totalInvitationCount || 0;

    // Try to update the total count from the HTML if available
    const allCountElement = document.querySelector('.artdeco-pill__text');
    if (allCountElement) {
        const countText = allCountElement.textContent.trim();
        const match = countText.match(/All \((\d+)\)/);
        if (match && match[1]) {
            totalInvitations = parseInt(match[1], 10);
            // Update the stored value
            window.totalInvitationCount = totalInvitations;
        }
    }

    // Calculate pending invitations (total - processed)
    const pendingCount = Math.max(0, totalInvitations - window.invitationCounters.processed);

    // Create Start Accept button
    const startAcceptButton = document.createElement('button');
    startAcceptButton.id = 'startAcceptButton';
    startAcceptButton.textContent = 'Start Accept';
    startAcceptButton.style.cssText = `
        background-color: #0078d4;
        color: white;
        border: 1px solid #0078d4;
        border-radius: 4px;
        padding: 8px 16px;
        cursor: pointer;
        font-weight: bold;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        margin-top: 10px;
    `;

    // Add hover effects
    startAcceptButton.onmouseover = () => startAcceptButton.style.backgroundColor = '#005a9e';
    startAcceptButton.onmouseout = () => startAcceptButton.style.backgroundColor = '#0078d4';

    // Add click event listener for Start Accept button
    startAcceptButton.addEventListener('click', async function() {
        console.log('Start Accept button clicked', 'info');
        this.disabled = true;
        this.textContent = 'Processing...';
        this.style.backgroundColor = '#999999';

        try {
            await processConnectionsWithDelay();
        } catch (error) {
            console.log(`Error in processing: ${error.message}`, 'error');
            if (typeof window.updateLiveLog === 'function') {
                window.console.log(`Error in processing: ${error.message}`, "error");
            }
        } finally {
            this.disabled = false;
            this.textContent = 'Start Accept All';
            this.style.backgroundColor = '#0078d4';
        }
    });

    // Update the popup content
    popup.innerHTML = `
    <div style="font-size: 18px; font-weight: bold; color: #0073e6; margin-bottom: 10px;">Invitation Status</div>

    <div style="display: flex; align-items: center; gap: 8px;">
        <svg width="18" height="18" fill="#0073e6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M3 12l18-12v24z"/>
        </svg>
        <strong style="color: #0073e6;">Processed:</strong>
        <span style="color: #0073e6;">${window.invitationCounters.processed}</span>
    </div>

    <div style="display: flex; align-items: center; gap: 8px;">
        <svg width="18" height="18" fill="green" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M10 18l-6-6 1.4-1.4L10 15.2l9.6-9.6L21 7l-11 11z"/>
        </svg>
        <strong style="color: #2e8b57;">Accepted:</strong>
        <span style="color: #2e8b57;">${window.invitationCounters.accepted}</span>
    </div>

    <div style="display: flex; align-items: center; gap: 8px;">
        <svg width="18" height="18" fill="red" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M18.3 5.71L12 12l6.29 6.29-1.42 1.42L12 14.83l-6.29 6.29-1.42-1.42L10.59 12 4.29 5.71 5.71 4.29 12 10.59l6.29-6.3z"/>
        </svg>
        <strong style="color: #d9534f;">Rejected:</strong>
        <span style="color: #d9534f;">${window.invitationCounters.rejected}</span>
    </div>

    <div style="display: flex; align-items: center; gap: 8px;">
        <svg width="18" height="18" fill="orange" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-3a7 7 0 100-14 7 7 0 000 14zm-1-6h2v5h-2v-5zm0-4h2v2h-2V9z"/>
        </svg>
        <strong style="color: #ff9900;">Pending:</strong>
        <span style="color: #ff9900;">${pendingCount}</span>
    </div>

    <div style="margin-top: 5px; font-size: 14px; color: #666;">
        Select your action:
    </div>
    `;

    // Append the button to the popup
    popup.appendChild(startAcceptButton);
}

async function processInvitationsWithCriteria(invitations) {
    console.log(" Starting to process invitations with criteria...", "processing");
    console.log('Starting to process invitations with criteria...', 'processing');
    const batchToProcess = Object.values(invitations);
    const acceptedNames = [];

    for (const invitation of batchToProcess) {
        // Add initial delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        const mutualCount = parseInt(invitation.mutualConnections.match(/\d+/)?.[0] || '0');
        const subtitle = invitation.subtitle;
        console.log(`Processing invitation from: ${invitation.name}`, "processing");
        console.log(`Processing invitation from: ${invitation.name}`, 'processing');
        console.log(`Title: ${subtitle}\nMutual Connections: ${mutualCount}`, 'info');

        const criteria = await loadCriteria();
        const { relevantTitles, relevantInstitutions, minMutualConnections, testingMode } = criteria;

        const hasSufficientMutualConnections = mutualCount >= minMutualConnections;
        const hasRelevantTitle = relevantTitles.some(title => new RegExp(title, 'i').test(subtitle));
        const hasRelevantInstitution = relevantInstitutions.some(inst => new RegExp(inst, 'i').test(subtitle));

        let reason = '';
        if (hasSufficientMutualConnections) reason += `Mutual connections: ${mutualCount}`;
        if (hasRelevantTitle) reason += `${reason ? ', ' : ''}Relevant role found`;
        if (hasRelevantInstitution) reason += `${reason ? ', ' : ''}Relevant organization found`;

        if (hasSufficientMutualConnections || hasRelevantTitle || hasRelevantInstitution) {
            try {
                if (testingMode) {
                    invitation.status = 'accepted (simulated)';
                    invitation.reason = `${reason} (testing mode)`; // Fixed typo in "testing mode"
                    console.log(`Simulated accepting invitation from ${invitation.name} (TESTING MODE)`, "success");
                    console.log(`Simulated accepting invitation from ${invitation.name} (TESTING MODE)`, 'success');
                   
                    // Add to accepted names for simulated accepts too
                    acceptedNames.push({ name: invitation.name, reason: reason });
                } else {
                    const acceptButton = document.querySelector(`button[aria-label*="Accept ${invitation.name}"]`);
                    if (acceptButton) {
                        acceptButton.click();
                        invitation.status = 'accepted';
                        invitation.reason = reason;
                        console.log(`Accepted invitation from ${invitation.name}`, "success");

                        console.log(`Accepted invitation from ${invitation.name}`, 'success');
                       
                        acceptedNames.push({ name: invitation.name, reason: reason });

                        // Add longer delay after clicking to ensure page updates
                        await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 2000));

                        // Run the highlighting method after accepting
                        highlightAcceptedInvitationsPostAccept([{ name: invitation.name, reason: reason }]);
                    } else {
                        invitation.status = 'waiting';
                        invitation.reason = 'Accept button not found';
                        console.log(`Could not find accept button for ${invitation.name}`, 'warning');
                    }
                }
            } catch (error) {
                invitation.status = 'waiting';
                invitation.reason = `Error: ${error.message}`;
                console.log(`Error processing invitation from ${invitation.name}: ${error.message}`, 'error');
            }
        } else {
            invitation.status = 'rejected';
            invitation.reason = `Does not meet criteria (Mutual connections: ${mutualCount})`;
            console.log(`Rejected invitation from ${invitation.name}: ${invitation.reason}`, 'warning');
        }

        // Update counters
        window.invitationCounters.processed++;
        if (invitation.status === 'accepted' || invitation.status === 'accepted (simulated)') {
            window.invitationCounters.accepted++;
        } else if (invitation.status === 'rejected') {
            window.invitationCounters.rejected++;
        }

        // Update the popup
        createOrUpdatePopup();

        // Add small delay between processing invitations
        await new Promise(resolve => setTimeout(resolve, 500));
       
        console.log(`Invitation Object for ${invitation.name}:`, 'info');
        console.log(invitation); // Separated log for better debugging
    }

    // Call the highlighting function for all accepted invitations
    highlightAcceptedInvitations(acceptedNames);

    // AFTER processing all invitations but BEFORE return statement:
    try {
        console.log('Sending processed invitations to background script...', 'info');
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
                action: "saveConnectionRequest",
                data: invitations  // This contains all processed invitations
            }, (response) => {
                resolve(response);
            });
        });

        if (response?.success) {
            console.log('Successfully saved connection requests to database', 'success');
        } else {
            console.log(`Failed to save: ${response?.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        console.log(`Error sending to background: ${error.message}`, 'error');
    }
   
    return acceptedNames;
}

function highlightAcceptedInvitations(acceptedInvitations) {
    if (!acceptedInvitations || acceptedInvitations.length === 0) {
        console.log('No accepted invitations to highlight', 'info');
        return;
    }
   
    console.log('Highlighting accepted invitations...', 'processing');

    const invitationCards = Array.from(document.querySelectorAll('.display-flex.flex-1.align-items-center.pl0'));

    // Function to open in new background tab with delay
    const openInBackgroundTab = (url, name, index) => {
        setTimeout(() => {
            try {
                const a = document.createElement('a');
                a.href = url;
                a.target = '_blank';
                a.rel = 'noopener';
               
                // Create and dispatch mouse event (simulates right-click + "Open in New Tab")
                const evt = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    ctrlKey: true  // Ctrl+Click opens in new tab without switching to it
                });
                a.dispatchEvent(evt);
                console.log(`Opened profile of ${name} in background tab (${index + 1}/${acceptedInvitations.length}).`, 'success');
            } catch (error) {
                console.log(`Error opening profile of ${name}: ${error.message}`, 'error');
            }
        }, (index + 1) * 1500); // Increased delay to 1.5 seconds between tabs
    };

    let foundCount = 0;
    acceptedInvitations.forEach(({ name, reason }, index) => {
        const acceptedCard = invitationCards.find(card => {
            const nameElement = card.querySelector('.invitation-card__tvm-title strong');
            return nameElement?.innerText.trim() === name;
        });

        if (acceptedCard) {
            foundCount++;
            // Style the card
            acceptedCard.style.border = '2px solid rgb(0, 51, 204)';
            acceptedCard.style.borderRadius = '8px';
            acceptedCard.style.padding = '8px';
            acceptedCard.style.marginBottom = '8px';
            acceptedCard.style.position = 'relative';

            // Create the icon container with both checkmark and open link icons
            const iconContainer = document.createElement('div');
            iconContainer.style.display = 'flex';
            iconContainer.style.justifyContent = 'flex-end';
            iconContainer.style.alignItems = 'center';
            iconContainer.style.gap = '10px';

            // Checkmark icon
            const checkIcon = document.createElement('span');
            checkIcon.title = `Accepted: ${reason}`;
            checkIcon.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#24268d" viewBox="0 0 24 24">
                <path d="M20.285 2l-11.285 11.285-5.285-5.285-3.715 3.715 9 9 15-15z"></path>
              </svg>
            `;
            checkIcon.style.cursor = 'help';

            // Open in new tab icon
            const openIcon = document.createElement('span');
            openIcon.title = 'Open profile in new tab';
            openIcon.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#24268d" viewBox="0 0 24 24">
                <path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41 9.83-9.83v3.59h2v-7h-7z"></path>
                <path d="M5 5h4V3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-4h-2v4H5V5z"></path>
              </svg>
            `;
            openIcon.style.cursor = 'pointer';

            // Add click handler for opening in new tab
            openIcon.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const profileLink = acceptedCard.querySelector('a');
                if (profileLink) {
                    openInBackgroundTab(profileLink.href, name, 0); // Open immediately on click
                } else {
                    console.log(`Could not find profile link for ${name}`, 'warning');
                }
            });

            // Add icons to container
            iconContainer.appendChild(checkIcon);
            iconContainer.appendChild(openIcon);

            // Add container to card - check if it's already been added
            if (!acceptedCard.querySelector('[data-highlighted="true"]')) {
                iconContainer.setAttribute('data-highlighted', 'true');
                acceptedCard.appendChild(iconContainer);
            }

            console.log(`Highlighted invitation from ${name}`, 'success');

            // Automatically open profile in background tab
            const profileLink = acceptedCard.querySelector('a');
            if (profileLink) {
                openInBackgroundTab(profileLink.href, name, index);
            } else {
                console.log(`Could not find profile link for ${name}`, 'warning');
            }
        }
    });

    console.log(`Found and highlighted ${foundCount} of ${acceptedInvitations.length} accepted invitations.`, 'info');
    if (foundCount > 0) {
        console.log(`Opening ${foundCount} profiles in background tabs...`, 'processing');
    }
    console.log('Highlighting complete.', 'success');
}

function highlightAcceptedInvitationsPostAccept(acceptedInvitations) {
    if (!acceptedInvitations || acceptedInvitations.length === 0) {
        console.log('No accepted invitations to highlight post-accept', 'info');
        return;
    }
   
    console.log('Highlighting accepted invitations after connection...', 'processing');

    // Function to open in new background tab with delay
    const openInBackgroundTab = (url, name, index) => {
        setTimeout(() => {
            try {
                const a = document.createElement('a');
                a.href = url;
                a.target = '_blank';
                a.rel = 'noopener';
               
                // Create and dispatch mouse event (simulates right-click + "Open in New Tab")
                const evt = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    ctrlKey: true  // Ctrl+Click opens in new tab without switching to it
                });
                a.dispatchEvent(evt);
                console.log(`Opened profile of ${name} in background tab (${index + 1}/${acceptedInvitations.length}).`, 'success');
            } catch (error) {
                console.log(`Error opening profile in background tab: ${error.message}`, 'error');
            }
        }, (index + 1) * 1500); // Increased delay to 1.5 seconds between tabs
    };

    // Try both selectors to find all confirmation cards
    const allCards = [
        ...Array.from(document.querySelectorAll('.invitation-card__inline-confirmation')),
        ...Array.from(document.querySelectorAll('.display-flex.flex-1.align-items-center'))
    ];
   
    console.log(`Found ${allCards.length} total cards to check.`, 'info');
   
    let foundCount = 0;
    acceptedInvitations.forEach(({ name, reason }, index) => {
        // Try multiple approaches to find the card
        let acceptedCard = null;
        // Method 1: Try finding by text content
        for (const card of allCards) {
            if (card.textContent.includes(name) ||
                card.textContent.includes(name.split(' ')[0]) ||
                card.textContent.includes(`${name.split(' ')[0]} is now a connection`)) {
                acceptedCard = card;
                break;
            }
        }
       
        if (!acceptedCard) {
            console.log(`Could not find post-accept card for ${name}`, 'warning');
            return;
        }
       
        foundCount++;
       
        // Style the card
        acceptedCard.style.border = '2px solid green';
        acceptedCard.style.borderRadius = '8px';
        acceptedCard.style.padding = '8px';
        acceptedCard.style.marginBottom = '8px';
        acceptedCard.style.position = 'relative';

        // Remove existing highlighted elements if any
        const existingHighlight = acceptedCard.querySelector('[data-highlighted="true"]');
        if (existingHighlight) {
            existingHighlight.remove();
        }

        // Create the icon container
        const iconContainer = document.createElement('div');
        iconContainer.setAttribute('data-highlighted', 'true');
        iconContainer.style.position = 'absolute';
        iconContainer.style.right = '5px';
        iconContainer.style.top = '60%';
        iconContainer.style.transform = 'translateY(-50%)';
        iconContainer.style.display = 'flex';
        iconContainer.style.gap = '10px';
        iconContainer.style.alignItems = 'center';

        // Checkmark icon
        const checkIcon = document.createElement('span');
        checkIcon.innerHTML = '✅';
        checkIcon.style.fontSize = '20px';
        checkIcon.style.cursor = 'help';
        checkIcon.title = `Accepted: ${reason || 'Connection confirmed'}`;

        // Open in new tab icon
        const openIcon = document.createElement('span');
        openIcon.innerHTML = '🔗';
        openIcon.style.fontSize = '20px';
        openIcon.style.cursor = 'pointer';
        openIcon.title = 'Open profile in new tab';

        // Find the profile link
        let profileUrl = '';
        const links = acceptedCard.querySelectorAll('a');
        for (const link of links) {
            if (link.href && link.href.includes('linkedin.com/in/')) {
                profileUrl = link.href;
                break;
            }
        }

        // Add click handler for opening in new tab
        if (profileUrl) {
            openIcon.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openInBackgroundTab(profileUrl, name, 0); // Open immediately on click
            });
           
            // Automatically open profile in background tab
            openInBackgroundTab(profileUrl, name, index);
        } else {
            openIcon.style.opacity = '0.5';
            openIcon.title = 'Profile link not found';
            console.log(`Could not find profile link for ${name}`, 'warning');
        }

        // Add icons to container
        iconContainer.appendChild(checkIcon);
        iconContainer.appendChild(openIcon);
       
        // Add container to card
        acceptedCard.appendChild(iconContainer);
        console.log(`Highlighted post-accept invitation from ${name}`, 'success');
    });

    console.log(`Found and highlighted ${foundCount} of ${acceptedInvitations.length} post-accept invitations.`, 'info');
    console.log('Post-accept highlighting complete.', 'success');
}

// Listen for start message from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message:', 'info');
    console.log(request);
   
    if (request.action === "startProcessing") {
        console.log('Starting processing from message listener', 'info');
        startProcessing(request.criteria.batchLimit);
        // Send response back to indicate we received the message
        sendResponse({ status: 'started' });
    }
    // Required for async response
    return true;
});

// Main processing function
async function startProcessing(batchLimit) {
    console.log('Starting invitation processing...', 'info');
    // Ensure the live log script is loaded
    console.log("Starting invitation processing...", "processing");

    try {
        // Check if we're on the correct page
        if (!window.location.href.includes('linkedin.com/mynetwork/invitation-manager')) {
            console.log('Not on the invitation manager page!', 'error');
            return;
        }

        console.log('Starting script for next batch...', 'processing');
        console.log(`Previously processed ${window.processedInvitations.size} invitations`, 'info');

        await scrollLikeHuman();
        console.log('Scrolled page to load more invitations', 'info');

        const invitations = await extractLinkedInInvitations(batchLimit);
        const batchSize = Object.keys(invitations).length;

        if (batchSize === 0) {
            console.log('No more unprocessed invitations found.', 'warning');
            return;
        }

        console.log(`Processing next batch of ${batchSize} invitations...`, 'processing');
        await processInvitationsWithCriteria(invitations);
        console.log('Batch processing complete.', 'success');
        console.log(`Total processed so far: ${window.processedInvitations.size}`, 'info');

    } catch (error) {
        console.log(`Error during invitation processing: ${error.message}`, 'error');
        console.error(error);
    }
}

function createStartButton() {
    // Check if button already exists
    if (document.getElementById('linkedInStartButton')) return;

    // Inject styles only once
    if (!document.getElementById('dynamic-comment-styles')) {
        const style = document.createElement('style');
        style.id = 'dynamic-comment-styles';
        style.textContent = `
            .dynamic-comment-buttons {
                border: none;
                border-radius: 12px;
                padding: 10px;
                margin: 16px;
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                box-shadow: 0 0 8px rgba(100, 149, 237, 0.2);
                overflow-x: auto;
                background: #ffffff;
                justify-content: flex-start;
            }
            .dynamic-comment-buttons, .comment-btn {
                box-sizing: border-box;
            }
            .comment-btn {
                position: relative;
                overflow: hidden;
                background: #ffffff;
                color: #ffffff;
                border: 1px solid rgb(0, 51, 204);
                padding: 5px 10px;
                border-radius: 50px;
                font-size: 14px;
                font-weight: normal;
                cursor: pointer;
                white-space: nowrap;
                flex-shrink: 0;
                min-width: unset;
                text-align: center;
                transition: all 0.4s ease;
            }
            .comment-btn:hover {
                background: rgb(0, 51, 204);
                color: #ffffff;
            }
           
            .comment-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none !important;
                background: #24268d;
                border: 1px solid #24268d;
                color: #ffffff;
            }
        `;
        document.head.appendChild(style);
    }

    // Create container
const buttonContainer = document.createElement('div');
buttonContainer.style.display = 'inline-block';
buttonContainer.style.marginLeft = '10px';
buttonContainer.style.marginRight = '5px';

buttonContainer.style.cursor = 'move'; // indicate it's draggable

// Create the button
const startButton = document.createElement('button');
startButton.id = 'linkedInStartButton';
startButton.className = 'comment-btn';
startButton.innerText = 'Start Processing';
startButton.style.backgroundColor = 'rgb(0, 115, 230)';
startButton.style.color = 'white';
startButton.style.border = 'none';
startButton.style.padding = '6px 12px';
startButton.style.borderRadius = '999px';
startButton.style.cursor = 'pointer';

// Drag functionality
let isDragging = false;
let currentX, currentY, initialX, initialY, xOffset = 0, yOffset = 0;

buttonContainer.addEventListener('mousedown', dragStart);
document.addEventListener('mousemove', drag);
document.addEventListener('mouseup', dragEnd);

function dragStart(e) {
  initialX = e.clientX - xOffset;
  initialY = e.clientY - yOffset;
  if (e.target === buttonContainer || buttonContainer.contains(e.target)) {
    isDragging = true;
  }
}

function drag(e) {
  if (!isDragging) return;
  e.preventDefault();
  currentX = e.clientX - initialX;
  currentY = e.clientY - initialY;
  xOffset = currentX;
  yOffset = currentY;
  setTranslate(currentX, currentY, buttonContainer);
}

function dragEnd() {
  isDragging = false;
}

function setTranslate(xPos, yPos, el) {
  el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
  el.style.position = 'relative';
  el.style.zIndex = '9999';
}

// Append button to container and place near h1
buttonContainer.appendChild(startButton);

const h1 = document.querySelector('header.mn-invitation-manager__header h1');
if (h1 && h1.parentNode) {
  h1.after(buttonContainer); // cleanly inserts after h1 without affecting gear icon
}

   
    // Add hover effect
    startButton.onmouseover = function() {
        this.style.backgroundColor = '#005bb5';
    };
    startButton.onmouseout = function() {
        this.style.backgroundColor = '#0073e6';
    };
   
    // Add click event
    startButton.addEventListener('click', async function() {
        console.log('Start button clicked', 'info');
        const criteria = await loadCriteria();
        startProcessing(criteria.batchLimit);
    });
   
    // Add button to container and container to page
   /*  buttonContainer.appendChild(startButton);
    document.body.appendChild(buttonContainer);
    */
    console.log('Start Processing button added to page', 'success');
}

// Check if we're on the correct page and initialize
function initializeOnInvitationManager() {
    if (window.location.href.includes('linkedin.com/mynetwork/invitation-manager')) {
        console.log('On invitation manager page, initializing...', 'info');
        createStartButton();
       
        // Also monitor for URL changes (in case user navigates to page after script loads)
        const observer = new MutationObserver(function(mutations) {
            if (window.location.href.includes('linkedin.com/mynetwork/invitation-manager')) {
                createStartButton();
            }
        });
       
        observer.observe(document, {subtree: true, childList: true});
    }
}



// Function to check if we're on the invitation manager page
function isInvitationManagerPage() {
    return window.location.href.includes('linkedin.com/mynetwork/invitation-manager');
}

// Function to remove all extension UI elements
function removeExtensionUI() {
    // Remove debug panel if exists
    const debugPanel = document.getElementById('debug-utils');
    if (debugPanel) debugPanel.remove();
   
    // Remove live log if exists
    const liveLog = document.getElementById('live-log-container');
    if (liveLog) liveLog.remove();
   
    // Remove invitation stats popup if exists
    const statsPopup = document.getElementById('invitation-stats-popup');
    if (statsPopup) statsPopup.remove();
   
    // Remove start button if exists
    const startButton = document.getElementById('linkedInStartButton');
    if (startButton) startButton.parentElement.remove();
}

// Function to handle page changes
function handlePageChange() {
    if (isInvitationManagerPage()) {
        // On invitation manager page - initialize UI
        createStartButton();
    } else {
        // On other pages - remove all extension UI
        removeExtensionUI();
    }
}

// Modified initialization function
function initializeOnInvitationManager() {
    // Initial check
    handlePageChange();
   
    // Monitor for URL changes
    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
        if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            handlePageChange();
        }
    });
   
    observer.observe(document, { subtree: true, childList: true });
}

// Call initialization when script loads
// Call initialization only after the page has fully loaded
if (document.readyState === 'complete') {
    setTimeout(function() {
        initializeOnInvitationManager();
    }, 2000);
} else {
    window.addEventListener('load', function() {
        setTimeout(function() {
            initializeOnInvitationManager();
        }, 2000);
    });
}

