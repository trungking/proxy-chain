// proxy-chain/chrome-extension/popup.js

document.addEventListener('DOMContentLoaded', () => {
  // Main view elements
  const mainView = document.getElementById('main-view');
  const pasteProxyUrlInput = document.getElementById('paste-proxy-url');
  const editingProxyIndexInput = document.getElementById('editing-proxy-index'); // Hidden input
  const proxyNameInput = document.getElementById('proxy-name');
  const proxyTypeSelect = document.getElementById('proxy-type');
  const proxyHostInput = document.getElementById('proxy-host');
  const proxyPortInput = document.getElementById('proxy-port');
  const proxyUsernameInput = document.getElementById('proxy-username');
  const proxyPasswordInput = document.getElementById('proxy-password');

  // Action buttons
  const connectBtn = document.getElementById('connect-btn');
  const saveAsNewBtn = document.getElementById('save-as-new-btn');
  const deleteSelectedBtn = document.getElementById('delete-selected-btn');
  const connectCurrentSiteBtn = document.getElementById('connect-current-site-btn');
  const currentSiteDomainSpan = document.getElementById('current-site-domain');

  // Proxy list
  const proxyListSelect = document.getElementById('proxy-list-select');

  // Status display
  const nodeAppStatusSpan = document.getElementById('node-app-status');
  const chromeProxyStatusSpan = document.getElementById('chrome-proxy-status');
  const currentUpstreamSpan = document.getElementById('current-upstream'); // Displays Node's reported upstream

  // Settings view elements
  const settingsView = document.getElementById('settings-view');
  const settingsBtn = document.getElementById('settings-btn');
  const backToMainIconBtn = document.getElementById('back-to-main-icon-btn'); // New back icon button
  const bypassListTextarea = document.getElementById('bypass-list-textarea'); // New textarea
  const clearBypassListBtn = document.getElementById('clear-bypass-list-btn');

  // --- Sync Settings Management ---
  const syncToggle = document.getElementById('sync-toggle');
  const syncStatusText = document.getElementById('sync-status-text');
  const syncStorageUsage = document.getElementById('sync-storage-usage');
  
  let displayedNodeUpstreamUrl = null; // Stores the upstream URL as reported by Node.js app's /status
  let configuredProxyUrlInPopup = null; // Stores the URL the popup believes it has configured
  let isInitialLoad = true; // Flag to help with initial sync

  function showUIMessage(message, type = 'info') {
    // alert(message); // Alerts removed as per user request
    console.log(`UI Message (${type}): ${message}`);
  }

  // Function to get the active storage based on sync setting
  async function getActiveStorage() {
    const syncEnabled = await getSyncSettings();
    return syncEnabled ? chrome.storage.sync : chrome.storage.local;
  }

  async function getSavedProxies() {
    const storage = await getActiveStorage();
    return new Promise((resolve) => {
      storage.get({ savedProxies: [] }, (result) => {
        resolve(Array.isArray(result.savedProxies) ? result.savedProxies : []);
      });
    });
  }

  async function saveProxies(proxies) {
    const storage = await getActiveStorage();
    
    return new Promise((resolve, reject) => {
      try {
        // Check size limits for sync storage
        const proxyData = JSON.stringify({ savedProxies: proxies });
        const isSyncStorage = (storage === chrome.storage.sync);
        
        if (isSyncStorage && proxyData.length > 100000) { // Chrome sync storage has a limit of ~100KB per item
          console.warn("Proxy list is too large for sync storage! Size: " + proxyData.length + " bytes");
          showUIMessage("Warning: Proxy list is too large for sync. Some items may not be saved.", "warning");
          // Trim the proxy list to fit by removing oldest entries first
          while (JSON.stringify({ savedProxies: proxies }).length > 90000 && proxies.length > 1) {
            proxies.shift(); // Remove the oldest entry
          }
        }
        
        storage.set({ savedProxies: proxies }, () => {
          if (chrome.runtime.lastError) {
            console.error("Error saving to storage:", chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      } catch (err) {
        console.error("Error preparing data for storage:", err);
        reject(err);
      }
    });
  }

  function buildProxyUrl(proxy) {
    if (!proxy) {
      console.error('NULL proxy object for URL building');
      return null;
    }
    
    // Special case for empty proxies that don't have a host yet
    if (!proxy.host || proxy.host.trim() === '') {
      // Return null for empty proxies, but don't log an error as this is expected for new entries
      return null;
    }
    
    if (!proxy.type || proxy.port === undefined) {
      console.error('Invalid proxy object for URL building:', proxy);
      return null;
    }
    
    // Make sure port is a number
    const port = parseInt(proxy.port);
    if (isNaN(port)) {
      console.error('Invalid port in proxy config:', proxy.port);
      return null;
    }
    
    let authString = '';
    if (proxy.username) { // Only add if username exists
      authString = `${encodeURIComponent(proxy.username)}`;
      if (proxy.password) {
        authString += `:${encodeURIComponent(proxy.password)}`;
      }
      authString += '@';
    }
    return `${proxy.type.toLowerCase()}://${authString}${proxy.host}:${port}`;
  }

  function parseProxyUrl(url) {
    if (!url) return null;
    let parsed = null;

    // Regex expects a scheme. Host part adjusted: [^:\/@]+
    const regexWithScheme = /^(?<type>https?|socks(?:4|5)?):\/\/(?:(?<username>[^:@\/]+)(?::(?<password>[^@\/]*))?@)?(?<host>[^:\/@]+)(?::(?<port>\d+))?\/?$/i;
    
    let match = url.match(regexWithScheme);
    let typeFromMatch = null;

    if (match && match.groups) {
        typeFromMatch = match.groups.type;
    } else if (!url.includes("://")) {
        // If no scheme detected and original parse failed, try prepending socks5://
        const tempUrl = "socks5://" + url;
        match = tempUrl.match(regexWithScheme);
        if (match && match.groups) {
            typeFromMatch = 'socks5'; // Force type if successfully parsed with prepended socks5
        }
    }

    if (match && match.groups) {
        // Use group names directly if they exist, otherwise they'll be undefined
        const groupUsername = match.groups.username;
        const groupPassword = match.groups.password;
        const groupHost = match.groups.host;
        const groupPort = match.groups.port;

        // Basic validation: Host must exist from the regex match
        if (!groupHost) return null;

        let parsedType = typeFromMatch ? typeFromMatch.toLowerCase() : 'socks5';
        if (parsedType === 'socks') parsedType = 'socks5';
        // We don't explicitly support socks4 in the UI type dropdown, so default to socks5 or keep http/s
        if (parsedType === 'socks4') parsedType = 'socks5'; 

        parsed = {
            type: parsedType,
            host: groupHost,
            port: groupPort ? parseInt(groupPort) : (parsedType === 'http' ? 80 : parsedType === 'https' ? 443 : 1080),
            username: groupUsername || '',
            password: groupPassword || '',
            name: groupHost, // Default name to host
        };
    } else {
        return null; // Explicitly return null if no successful match
    }
    
    return parsed;
  }

  pasteProxyUrlInput.addEventListener('input', async (event) => {
    const pastedUrl = event.target.value;
    const parsed = parseProxyUrl(pastedUrl);
    if (parsed) {
      proxyNameInput.value = parsed.name; 
      proxyTypeSelect.value = parsed.type;
      proxyHostInput.value = parsed.host;
      proxyPortInput.value = parsed.port;
      proxyUsernameInput.value = parsed.username;
      proxyPasswordInput.value = parsed.password;
      
      // Auto-save the parsed proxy data
      await autoSaveProxy();
    } else if (pastedUrl.trim() !== '') {
      // Failure alert removed as per request
    }
    updateConnectButtonState(); // Update button state after paste/parse attempt
  });

  function clearForm() {
    pasteProxyUrlInput.value = '';
    editingProxyIndexInput.value = '-1';
    proxyNameInput.value = '';
    proxyTypeSelect.value = 'socks5';
    proxyHostInput.value = '';
    proxyPortInput.value = '';
    proxyUsernameInput.value = '';
    proxyPasswordInput.value = '';
    if (proxyListSelect.options.length > 0 && proxyListSelect.value === "") {
      if (proxyListSelect.options.length > 0) proxyListSelect.value = "0";
    } else if (proxyListSelect.options.length === 0) {
      proxyListSelect.value = null;
    }
    deleteSelectedBtn.disabled = (proxyListSelect.value === "" || proxyListSelect.value === null || proxyListSelect.options.length === 0);
    updateConnectButtonState();
  }

  // Modified to accept a preferred proxy URL to select and a flag to skip form update
  async function populateProxyList(preferredProxyUrl = null, skipFormUpdate = false) {
    const proxies = await getSavedProxies();
    const currentSelectedListValue = proxyListSelect.value; // Save before clearing
    proxyListSelect.innerHTML = '';
    let preferredIndex = -1;
    let actuallySelectedValue = null; // What will actually be selected

    proxies.forEach((proxy, index) => {
      const option = document.createElement('option');
      option.value = index.toString();
      // Handle empty host/port for display
      const hostDisplay = proxy.host || '[empty]';
      const portDisplay = proxy.port || '0';
      const proxyText = `${proxy.name} (${proxy.type}://${hostDisplay}:${portDisplay})`;
      option.textContent = proxyText;
      proxyListSelect.appendChild(option);
      if (preferredProxyUrl && proxies[index] && buildProxyUrl(proxies[index]) === preferredProxyUrl) {
        preferredIndex = index;
      }
    });

    if (proxies.length > 0) {
      if (preferredIndex !== -1) {
        proxyListSelect.value = preferredIndex.toString();
        actuallySelectedValue = preferredIndex.toString();
      } else if (document.querySelector(`#proxy-list-select option[value='${currentSelectedListValue}']`)) {
        // If no preferred, try to keep old selection if it still exists (e.g. list just reordered)
        proxyListSelect.value = currentSelectedListValue;
        actuallySelectedValue = currentSelectedListValue;
      } else {
        // Default to first item if no preferred and old selection is gone
        proxyListSelect.value = "0";
        actuallySelectedValue = "0";
      }
      // Dispatch change event only if a selection was made and it potentially updates the form
      // and we haven't asked to skip form updates
      if (actuallySelectedValue !== null && !skipFormUpdate) {
         proxyListSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else {
      clearForm(); // This will also call updateConnectButtonState
      actuallySelectedValue = null;
    }
    // updateConnectButtonState(); // Called by change event or clearForm typically
    // If no items and clearForm is called, button state is handled.
    // If items exist and change is dispatched, button state is handled by the change handler indirectly calling it.
    // If items exist but no change event is dispatched (e.g. selection was already correct and didn't change),
    // we might need an explicit call. However, the main call in init after populateProxyList should cover it.
  }

  function updateConnectButtonState() {
    const currentFormData = getCurrentFormData();
    // Remove previous console logs for clarity now
    // console.log('[Popup] updateConnectButtonState: currentFormData:', currentFormData);
    // console.log('[Popup] updateConnectButtonState: configuredProxyUrlInPopup at start:', configuredProxyUrlInPopup);
    connectBtn.disabled = !currentFormData;

    if (configuredProxyUrlInPopup && currentFormData) {
      const formProxyUrl = buildProxyUrl(currentFormData);
      // If formProxyUrl is null (e.g., for empty proxy), treat it as different from configured
      if (formProxyUrl && formProxyUrl === configuredProxyUrlInPopup) {
        connectBtn.textContent = "Disconnect";
        connectBtn.dataset.action = "disconnect_selected";
        connectBtn.classList.remove('primary-action');
        connectBtn.classList.add('disconnect-button');
        // console.log('[Popup] updateConnectButtonState: Set to Disconnect');
      } else {
        connectBtn.textContent = "Connect";
        connectBtn.dataset.action = "connect_selected";
        connectBtn.classList.remove('disconnect-button');
        connectBtn.classList.add('primary-action');
        // console.log('[Popup] updateConnectButtonState: Set to Connect (configured and form differ)');
      }
    } else { // configuredProxyUrlInPopup is null (or form invalid)
      connectBtn.textContent = "Connect";
      connectBtn.dataset.action = "connect_selected";
      connectBtn.classList.remove('disconnect-button');
      connectBtn.classList.add('primary-action');
      // console.log('[Popup] updateConnectButtonState: Set to Connect (configuredProxyUrlInPopup is null or form invalid)');
    }
  }

  proxyListSelect.addEventListener('change', async () => {
    const selectedIndex = proxyListSelect.value;
    if (proxyListSelect.options.length === 0 || selectedIndex === "") {
      clearForm();
      return;
    }
    const proxies = await getSavedProxies();
    const proxy = proxies[parseInt(selectedIndex)];
    if (proxy) {
      editingProxyIndexInput.value = selectedIndex;
      proxyNameInput.value = proxy.name;
      proxyTypeSelect.value = proxy.type;
      proxyHostInput.value = proxy.host;
      proxyPortInput.value = proxy.port;
      proxyUsernameInput.value = proxy.username || '';
      proxyPasswordInput.value = proxy.password || '';
      
      // Also update the full proxy URL field
      const fullUrl = buildProxyUrl(proxy);
      pasteProxyUrlInput.value = fullUrl || '';
      
      deleteSelectedBtn.disabled = false;
    } else {
      clearForm();
    }
    updateConnectButtonState();
  });

  // Add event listeners to form inputs to update connect button state dynamically
  [proxyNameInput, proxyTypeSelect, proxyHostInput, proxyPortInput, proxyUsernameInput, proxyPasswordInput].forEach(input => {
    input.addEventListener('input', updateConnectButtonState);
  });

  async function updateStatusDisplay() {
    // Fetch Node App Status
    chrome.runtime.sendMessage({ action: "getNodeAppStatus" }, (response) => {
      if (chrome.runtime.lastError) {
        nodeAppStatusSpan.textContent = 'Error: BG script.';
        console.error("getNodeAppStatus error:", chrome.runtime.lastError.message);
        displayedNodeUpstreamUrl = null;
        currentUpstreamSpan.textContent = '-';
        if (isInitialLoad) { // On initial load, if error, assume disconnected
            configuredProxyUrlInPopup = null;
        }
        updateConnectButtonState(); // Update button based on (possibly now null) configuredProxyUrlInPopup
        return;
      }

      if (response && response.success) {
        nodeAppStatusSpan.textContent = response.running ? `Online` : 'Offline/Error';
        displayedNodeUpstreamUrl = response.upstreamProxyUrl || null;
        currentUpstreamSpan.textContent = displayedNodeUpstreamUrl || '-';
        if (response.running && response.listeningAddress) {
          nodeAppStatusSpan.textContent += ` (Relay: ${response.listeningAddress})`;
        }
        
        if (isInitialLoad) { // Sync on initial load
            configuredProxyUrlInPopup = (response.running && displayedNodeUpstreamUrl) ? displayedNodeUpstreamUrl : null;
        }
      } else {
        nodeAppStatusSpan.textContent = `Offline: ${response ? response.message : 'Unknown'}`;
        displayedNodeUpstreamUrl = null;
        currentUpstreamSpan.textContent = '-';
        if (isInitialLoad) { // On initial load, if offline, assume disconnected
            configuredProxyUrlInPopup = null;
        }
      }
      // console.log('[Popup] updateStatusDisplay: Node App Response:', response);
      // console.log('[Popup] updateStatusDisplay: displayedNodeUpstreamUrl set to:', displayedNodeUpstreamUrl);
      // console.log('[Popup] updateStatusDisplay: (during initialLoad?',isInitialLoad,') configuredProxyUrlInPopup set to:', configuredProxyUrlInPopup);
      updateConnectButtonState();
    });

    // Fetch Chrome Proxy Status (remains largely the same, updates its own span)
    chrome.runtime.sendMessage({ action: "getChromeProxyStatus" }, (response) => {
      if (chrome.runtime.lastError) {
        chromeProxyStatusSpan.textContent = 'Error';
        console.error("getChromeProxyStatus error:", chrome.runtime.lastError.message);
        return;
      }
      chromeProxyStatusSpan.textContent = (response && response.status === 'success') ? response.proxyStatus : 'Error';
    });
  }

  function getCurrentFormData() {
    const name = proxyNameInput.value.trim();
    const type = proxyTypeSelect.value;
    const host = proxyHostInput.value.trim();
    const port = parseInt(proxyPortInput.value.trim());
    const username = proxyUsernameInput.value.trim();
    const password = proxyPasswordInput.value; // Don't trim

    if (!name || !host || !port || isNaN(port)) {
      // No UI message here as button state will reflect this
      return null;
    }
    return { name, type, host, port, username, password };
  }

  // Add auto-save event listeners to all input fields
  [proxyNameInput, proxyTypeSelect, proxyHostInput, proxyPortInput, proxyUsernameInput, proxyPasswordInput].forEach(input => {
    input.addEventListener('change', autoSaveProxy);
    input.addEventListener('input', () => {
      // Small delay to avoid too frequent saves while typing
      clearTimeout(input.saveTimeout);
      input.saveTimeout = setTimeout(autoSaveProxy, 500);
    });
  });

  async function autoSaveProxy() {
    const proxyData = getCurrentFormData();
    if (!proxyData) return; // Don't save if data is invalid

    const proxies = await getSavedProxies();
    const editIndex = parseInt(editingProxyIndexInput.value);

    if (editIndex > -1 && editIndex < proxies.length) {
      // Update existing proxy
      proxies[editIndex] = proxyData;
      await saveProxies(proxies);
      await populateProxyList();
      proxyListSelect.value = editIndex.toString();
      updateConnectButtonState();
    } else if (editIndex === -1 && proxyData.host && proxyData.host.trim() !== '') {
      // Create a new proxy if we're not editing an existing one 
      // and the host is filled (don't save completely empty proxies)
      proxies.push(proxyData);
      await saveProxies(proxies);
      const newIndex = proxies.length - 1;
      await populateProxyList();
      proxyListSelect.value = newIndex.toString();
      editingProxyIndexInput.value = newIndex.toString();
      updateConnectButtonState();
      showUIMessage('New proxy saved', 'info');
    }
  }

  // Create new empty proxy button
  saveAsNewBtn.addEventListener('click', async () => {
    try {
      // Get existing proxies
      const proxies = await getSavedProxies();
      
      // Generate a unique name by adding a number suffix if needed
      let baseName = 'New Proxy';
      let uniqueName = baseName;
      let counter = 2;
      
      // Check if the name exists and add a suffix if needed
      while (proxies.some(proxy => proxy.name === uniqueName)) {
        uniqueName = `${baseName} ${counter}`;
        counter++;
      }
      
      // First create and save a new proxy entry with the unique name
      const newProxy = {
        name: uniqueName,
        type: 'socks5',
        host: '',
        port: 0,
        username: '',
        password: ''
      };

      // Save to storage
      proxies.push(newProxy);
      await saveProxies(proxies);
      
      // Now manually clear the form
      pasteProxyUrlInput.value = '';
      proxyNameInput.value = uniqueName;
      proxyTypeSelect.value = 'socks5';
      proxyHostInput.value = '';
      proxyPortInput.value = '';
      proxyUsernameInput.value = '';
      proxyPasswordInput.value = '';

      // Mark this as editing the new proxy
      const newIndex = proxies.length - 1;
      editingProxyIndexInput.value = newIndex.toString();
      
      // Update the select list without triggering form changes
      // (we'll manually select the right option)
      proxyListSelect.innerHTML = '';
      proxies.forEach((proxy, index) => {
        const option = document.createElement('option');
        option.value = index.toString();
        // Handle empty host/port for display
        const hostDisplay = proxy.host || '[empty]';
        const portDisplay = proxy.port || '0';
        const proxyText = `${proxy.name} (${proxy.type}://${hostDisplay}:${portDisplay})`;
        option.textContent = proxyText;
        proxyListSelect.appendChild(option);
      });
      
      // Select the new proxy in the list
      proxyListSelect.value = newIndex.toString();
      
      // Enable delete button and update connect button
      deleteSelectedBtn.disabled = false;
      updateConnectButtonState();
      
      // Focus the name field for immediate editing
      proxyNameInput.focus();
      proxyNameInput.select();
      
      showUIMessage(`Created new empty proxy configuration: ${uniqueName}`, 'info');
    } catch (error) {
      console.error('Error creating new proxy:', error);
      showUIMessage('Failed to create new proxy', 'error');
    }
  });

  deleteSelectedBtn.addEventListener('click', async () => {
    const selectedIndex = parseInt(editingProxyIndexInput.value);
    if (selectedIndex < 0) {
      showUIMessage('No proxy loaded to delete. Select one from the list first.', 'warning');
      return;
    }
    const proxies = await getSavedProxies();
    if (selectedIndex >= 0 && selectedIndex < proxies.length) {
      const deletedProxyUrl = buildProxyUrl(proxies[selectedIndex]);
      const wasActiveInPopup = (deletedProxyUrl === configuredProxyUrlInPopup);

      proxies.splice(selectedIndex, 1);
      await saveProxies(proxies);
      await populateProxyList(); 
      showUIMessage('Proxy deleted.', 'success');

      if (wasActiveInPopup) {
        configuredProxyUrlInPopup = null; // Clear our popup's configured state
        // Also tell background to disconnect Chrome and Node app
        chrome.runtime.sendMessage({ action: "disconnectProxy" }, (response) => {
          if (chrome.runtime.lastError || !response || !response.success) {
            console.error('Error auto-disconnecting after delete:', response ? response.message : chrome.runtime.lastError.message);
          }
          // updateStatusDisplay will refresh displayedNodeUpstreamUrl and call updateConnectButtonState
          // updateConnectButtonState will use the now-null configuredProxyUrlInPopup
          updateStatusDisplay(); 
        });
      } else {
         updateConnectButtonState(); // Update button if a non-active proxy was deleted
      }
    } else {
      showUIMessage('Error: Could not delete proxy. Index out of bounds.', 'error');
      clearForm(); 
    }
  });

  connectBtn.addEventListener('click', () => {
    const action = connectBtn.dataset.action; // "connect_selected" or "disconnect_selected"

    if (action === "disconnect_selected") {
      // We assume disconnect is for the `configuredProxyUrlInPopup`
      chrome.runtime.sendMessage({ action: "disconnectProxy" }, (bgResponse) => {
        if (chrome.runtime.lastError || !bgResponse || !bgResponse.success) {
          showUIMessage(`Disconnection failed: ${bgResponse ? bgResponse.message : (chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Unknown error')}`, 'error');
        } else {
          showUIMessage('Proxy disconnected.', 'success');
          configuredProxyUrlInPopup = null; // Update popup's state: we are now disconnected
        }
        // updateStatusDisplay(); // To refresh displayed Node status and Chrome status
        // updateConnectButtonState(); // Crucially, update button based on new configuredProxyUrlInPopup
        // Let's call updateStatusDisplay, which in turn calls updateConnectButtonState
        updateStatusDisplay(); 
      });
    } else if (action === "connect_selected") {
      const proxyDataToConnect = getCurrentFormData();
      if (!proxyDataToConnect) {
        showUIMessage('Cannot connect. Please ensure proxy details are filled correctly.', 'error');
        return;
      }
      
      const upstreamToConnect = buildProxyUrl(proxyDataToConnect);
      if (!upstreamToConnect) {
        showUIMessage('Could not build proxy URL from current details.', 'error');
        return;
      }

      chrome.runtime.sendMessage({ action: "connectProxy", data: { upstreamProxyUrl: upstreamToConnect } }, (bgResponse) => {
        if (chrome.runtime.lastError || !bgResponse || !bgResponse.success) {
          showUIMessage(`Connection failed: ${bgResponse ? bgResponse.message : (chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Unknown error')}`, 'error');
          // Should we set configuredProxyUrlInPopup = null here? Or leave it as it was?
          // If connection fails, the previous state (if any) or null (if none) remains.
          // No change to configuredProxyUrlInPopup on failure of connect.
        } else {
          showUIMessage('Proxy connected.', 'success');
          configuredProxyUrlInPopup = upstreamToConnect; // Update popup's state: connected with this URL
        }
        // updateStatusDisplay(); // Refresh displayed Node/Chrome status
        // updateConnectButtonState(); // Update button based on new configuredProxyUrlInPopup
        updateStatusDisplay();
      });
    }
  });

  // --- Bypass List Management --- (UPDATED SECTION)
  async function getBypassList() {
    const storage = await getActiveStorage();
    return new Promise((resolve) => {
      storage.get({ bypassList: [] }, (result) => {
        resolve(Array.isArray(result.bypassList) ? result.bypassList : []);
      });
    });
  }

  async function saveBypassList(list) {
    // Filter out empty strings that might result from split an empty textarea or multiple newlines
    const cleanedList = list.filter(entry => entry && entry.trim() !== '');
    const storage = await getActiveStorage();
    
    return new Promise((resolve, reject) => {
      try {
        // Check size limits for sync storage
        const bypassData = JSON.stringify({ bypassList: cleanedList });
        const isSyncStorage = (storage === chrome.storage.sync);
        
        if (isSyncStorage && bypassData.length > 8000) { // Keep well under the per-item limit
          console.warn("Bypass list is too large for sync storage! Size: " + bypassData.length + " bytes");
          showUIMessage("Warning: Bypass list is too large. Some items may not be saved.", "warning");
          
          // Trim the bypass list to fit by removing entries from the end
          while (JSON.stringify({ bypassList: cleanedList }).length > 7000 && cleanedList.length > 3) {
            cleanedList.pop(); // Remove the last entry, preserving essential entries
          }
        }
        
        storage.set({ bypassList: cleanedList }, () => {
          if (chrome.runtime.lastError) {
            console.error("Error saving bypass list to storage:", chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      } catch (err) {
        console.error("Error preparing bypass list for storage:", err);
        reject(err);
      }
    });
  }

  // Basic formatter: extracts hostname, converts to lowercase.
  // Tries to create a wildcard for subdomains if www. is present, otherwise just hostname.
  // Does not handle IP addresses, CIDR, or <local> specifically, assumes user inputs them correctly.
  function formatBypassEntry(entry) {
    entry = entry.trim().toLowerCase();
    if (!entry) return null;

    try {
      // If it's already a simple pattern like *.example.com or <local> or an IP, keep it.
      if (entry.startsWith('*') || entry === '<local>' || /^\d{1,3}(\.\d{1,3}){3}(?:\/\d{1,2})?$/.test(entry)) {
        return entry;
      }
      
      // Add a scheme if missing, for URL constructor to work reliably
      let urlToParse = entry;
      if (!urlToParse.includes('://')) {
        urlToParse = 'http://' + urlToParse; 
      }
      const url = new URL(urlToParse);
      let hostname = url.hostname;
      // Remove www. and prepend *. if www. was there to make it a wildcard for subdomains.
      // Otherwise, use the plain hostname. Chrome's bypass rules are quite flexible.
      // Example: example.com will match example.com and www.example.com.
      // *.example.com is more explicit for all subdomains.
      // For simplicity, we'll just return the hostname. Users can add '*' if needed.
      // if (hostname.startsWith('www.')) {
      //   hostname = hostname.substring(4);
      //   return '*.' + hostname; 
      // }
      return hostname; // Chrome's rules are flexible with hostnames
    } catch (e) {
      // If parsing fails (e.g., it's not a valid URL structure but maybe a simple host or pattern)
      // return the original entry, cleaned up, if it seems like a valid pattern fragment.
      // This allows for things like just 'my-local-server'
      if (entry.includes('/') || entry.includes(':') || entry.includes('?')){
          console.warn(`Bypass entry "${entry}" could not be parsed as URL and seems complex, not auto-formatting.`);
          return entry; // Don't attempt to format if it looks like a path/query and isn't a valid URL
      }
      return entry; // Return as is if it's simple like 'localhost'
    }
  }

  async function loadBypassListToTextarea() {
    const list = await getBypassList();
    bypassListTextarea.value = list.join('\n');
  }

  async function saveTextareaToBypassList() {
    const lines = bypassListTextarea.value.split('\n');
    const formattedList = lines.map(line => formatBypassEntry(line)).filter(item => item !== null && item.trim() !== '');
    const uniqueList = [...new Set(formattedList)]; // Ensure uniqueness
    await saveBypassList(uniqueList);
    // Reload into textarea to show the formatted/deduplicated version
    bypassListTextarea.value = uniqueList.join('\n'); 
    showUIMessage('Bypass list updated.', 'info');
  }

  // Auto-save on textarea blur
  bypassListTextarea.addEventListener('blur', saveTextareaToBypassList);

  clearBypassListBtn.addEventListener('click', async () => {
    await saveBypassList([]);
    bypassListTextarea.value = ''; // Clear textarea as well
    showUIMessage('Bypass list cleared.', 'info');
  });

  // --- Current Site Specific Proxy ---
  async function getCurrentTabDomain() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) return null;
      
      const url = new URL(tab.url);
      const domain = url.hostname.replace(/^www\./, '');
      return domain;
    } catch (e) {
      console.error('Error getting current tab domain:', e);
      return null;
    }
  }

  // Update the current site domain span
  async function updateCurrentSiteDomain() {
    const domain = await getCurrentTabDomain();
    if (domain) {
      currentSiteDomainSpan.textContent = domain;
      connectCurrentSiteBtn.disabled = false;
    } else {
      currentSiteDomainSpan.textContent = 'current site';
      connectCurrentSiteBtn.disabled = true;
    }
  }

  // Connect only for current site button
  connectCurrentSiteBtn.addEventListener('click', async () => {
    const proxyDataToConnect = getCurrentFormData();
    if (!proxyDataToConnect) {
      showUIMessage('Cannot connect. Please ensure proxy details are filled correctly.', 'error');
      return;
    }
    
    const upstreamToConnect = buildProxyUrl(proxyDataToConnect);
    if (!upstreamToConnect) {
      showUIMessage('Could not build proxy URL from current details.', 'error');
      return;
    }

    const domain = await getCurrentTabDomain();
    if (!domain) {
      showUIMessage('Could not determine current site domain.', 'error');
      return;
    }

    // Get current bypass list
    const currentBypassList = await getBypassList();
    
    // Create a "proxy only" list by adding all domains except the current one to the bypass list
    // This is the inverse of what we normally do
    const allBypassedDomains = [...currentBypassList];
    
    // Make sure the current domain is not in the bypass list (we want to proxy it)
    const domainIndex = allBypassedDomains.findIndex(item => 
      item === domain || item === '*.' + domain || domain.endsWith('.' + item.replace(/^\*\./, ''))
    );
    
    if (domainIndex !== -1) {
      allBypassedDomains.splice(domainIndex, 1);
    }
    
    // Add a special "PROXY_ONLY:domain.com" marker to the bypass list 
    // The background script will use this to identify sites that should only be proxied
    allBypassedDomains.push(`PROXY_ONLY:${domain}`);
    
    // Save the modified bypass list
    await saveBypassList(allBypassedDomains);
    
    // Connect via the proxy with the "proxy only" bypass list
    chrome.runtime.sendMessage({ 
      action: "connectProxy", 
      data: { 
        upstreamProxyUrl: upstreamToConnect,
        siteSpecific: true,
        targetDomain: domain
      }
    }, (bgResponse) => {
      if (chrome.runtime.lastError || !bgResponse || !bgResponse.success) {
        showUIMessage(`Connection failed: ${bgResponse ? bgResponse.message : (chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Unknown error')}`, 'error');
      } else {
        showUIMessage(`Proxy connected for ${domain} only.`, 'success');
        configuredProxyUrlInPopup = upstreamToConnect; // Update popup's state: connected with this URL
      }
      updateStatusDisplay();
    });
  });

  // --- View Switching --- 
  settingsBtn.addEventListener('click', () => {
    mainView.style.display = 'none';
    settingsView.style.display = 'block';
    loadBypassListToTextarea(); // Populate textarea when settings view is shown
    updateSyncUI(); // Update the sync UI when showing settings
    // Set badge to BYPASS
    chrome.action.setBadgeText({ text: 'BYPASS' });
    chrome.action.setBadgeBackgroundColor({ color: '#FFA500' }); // Orange color
  });

  backToMainIconBtn.addEventListener('click', () => {
    settingsView.style.display = 'none';
    mainView.style.display = 'block';
    // Restore the original badge state based on proxy connection
    chrome.storage.sync.get(['currentProxyStatus'], (data) => {
      if (data.currentProxyStatus === 'connected') {
        chrome.action.setBadgeText({ text: 'ON' });
        chrome.action.setBadgeBackgroundColor({ color: [76, 175, 80, 255] }); // Green
      } else {
        chrome.action.setBadgeText({ text: '' });
      }
    });
  });

  // --- Sync Settings Management ---
  // Function to get the current sync settings
  async function getSyncSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get({ syncEnabled: true }, (result) => {
        resolve(result.syncEnabled);
      });
    });
  }
  
  // Function to save sync settings
  async function saveSyncSettings(enabled) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ syncEnabled: enabled }, resolve);
    });
  }
  
  // Function to update the UI based on sync settings
  async function updateSyncUI() {
    const isSyncEnabled = await getSyncSettings();
    syncToggle.checked = isSyncEnabled;
    syncStatusText.textContent = isSyncEnabled ? 'Enabled' : 'Disabled';
    
    // Update the sync storage usage display
    await updateSyncStorageUsage();
  }
  
  // Function to calculate and display sync storage usage
  async function updateSyncStorageUsage() {
    try {
      // Get all sync storage data
      const syncData = await new Promise((resolve) => {
        chrome.storage.sync.get(null, (items) => {
          if (chrome.runtime.lastError) {
            console.error('Error getting sync storage items:', chrome.runtime.lastError);
            resolve({});
          } else {
            resolve(items);
          }
        });
      });
      
      // Calculate the size
      const jsonSize = JSON.stringify(syncData).length;
      const quotaInBytes = 102400; // Chrome sync storage quota is 100KB
      const usedPercentage = Math.round((jsonSize / quotaInBytes) * 100);
      
      syncStorageUsage.textContent = `${jsonSize.toLocaleString()} / ${quotaInBytes.toLocaleString()} bytes (${usedPercentage}%)`;
      
      // Change color based on usage
      if (usedPercentage > 80) {
        syncStorageUsage.style.color = '#dc3545'; // red
      } else if (usedPercentage > 60) {
        syncStorageUsage.style.color = '#fd7e14'; // orange
      } else {
        syncStorageUsage.style.color = '#28a745'; // green
      }
    } catch (error) {
      console.error('Error calculating sync storage usage:', error);
      syncStorageUsage.textContent = 'Error calculating usage';
      syncStorageUsage.style.color = '#dc3545';
    }
  }
  
  // Event listener for the sync toggle
  syncToggle.addEventListener('change', async () => {
    const isSyncEnabled = syncToggle.checked;
    await saveSyncSettings(isSyncEnabled);
    syncStatusText.textContent = isSyncEnabled ? 'Enabled' : 'Disabled';
    
    // If we're turning off sync, move data from sync to local
    if (!isSyncEnabled) {
      try {
        // Move data from sync to local
        const syncData = await new Promise((resolve) => {
          chrome.storage.sync.get(null, resolve);
        });
        
        // Save to local storage
        await new Promise((resolve) => {
          chrome.storage.local.set(syncData, resolve);
        });
        
        showUIMessage('Proxy settings moved to local storage.', 'info');
      } catch (error) {
        console.error('Error moving data from sync to local:', error);
        showUIMessage('Error moving data to local storage.', 'error');
      }
    } else {
      // If we're turning on sync, move data from local to sync
      try {
        // Move data from local to sync
        const localData = await new Promise((resolve) => {
          chrome.storage.local.get(null, resolve);
        });
        
        // Remove syncEnabled from the data to avoid overriding it
        delete localData.syncEnabled;
        
        // Save to sync storage
        await new Promise((resolve) => {
          chrome.storage.sync.set(localData, resolve);
        });
        
        showUIMessage('Proxy settings moved to sync storage.', 'info');
      } catch (error) {
        console.error('Error moving data from local to sync:', error);
        showUIMessage('Error moving data to sync storage.', 'error');
      }
    }
    
    // Update the UI after the change
    updateSyncUI();
  });

  async function init() {
    isInitialLoad = true;
    // DO NOT call populateProxyList here yet.

    const initialStatusPromise = new Promise(resolve => {
        chrome.runtime.sendMessage({ action: "getNodeAppStatus" }, (response) => {
            if (chrome.runtime.lastError) {
                displayedNodeUpstreamUrl = null;
                configuredProxyUrlInPopup = null;
                console.error("getNodeAppStatus error during init:", chrome.runtime.lastError.message);
            } else if (response && response.success) {
                displayedNodeUpstreamUrl = response.upstreamProxyUrl || null;
                configuredProxyUrlInPopup = (response.running && displayedNodeUpstreamUrl) ? displayedNodeUpstreamUrl : null;
            } else {
                displayedNodeUpstreamUrl = null;
                configuredProxyUrlInPopup = null;
                console.log("getNodeAppStatus non-success during init:", response);
            }
            
            nodeAppStatusSpan.textContent = response && response.success && response.running ? `Online${response.listeningAddress ? ` (Relay: ${response.listeningAddress})` : ''}` : (response && !response.success ? `Offline: ${response.message}` : 'Offline/Error');
            currentUpstreamSpan.textContent = displayedNodeUpstreamUrl || '-';
            
            // Set initial badge state based on which view is visible
            if (settingsView.style.display === 'block') {
                chrome.action.setBadgeText({ text: 'BYPASS' });
                chrome.action.setBadgeBackgroundColor({ color: '#FFA500' });
            } else {
                chrome.storage.sync.get(['currentProxyStatus'], (data) => {
                    if (data.currentProxyStatus === 'connected') {
                        chrome.action.setBadgeText({ text: 'ON' });
                        chrome.action.setBadgeBackgroundColor({ color: [76, 175, 80, 255] });
                    } else {
                        chrome.action.setBadgeText({ text: '' });
                    }
                });
            }
            
            chrome.runtime.sendMessage({ action: "getChromeProxyStatus" }, (chromeStatusResponse) => {
                 if (!chrome.runtime.lastError && chromeStatusResponse && chromeStatusResponse.status === 'success') {
                    chromeProxyStatusSpan.textContent = chromeStatusResponse.proxyStatus;
                 } else {
                    chromeProxyStatusSpan.textContent = 'Error';
                    if(chrome.runtime.lastError) console.error("getChromeProxyStatus error during init:", chrome.runtime.lastError.message);
                 }
                 resolve();
            });
        });
    });

    initialStatusPromise.then(async () => {
        isInitialLoad = false;
        console.log('[Popup] Init: Initial status fetched. configuredProxyUrlInPopup:', configuredProxyUrlInPopup);
        
        // Now populate the list, trying to select the configured proxy
        await populateProxyList(configuredProxyUrlInPopup);
        // populateProxyList will dispatch 'change' if selection happens, which updates form.
        // Form fields should now be in sync with the selected item from the list (or empty if list is empty).
        
        updateConnectButtonState(); // Ensure button state is correct based on form and configuredProxyUrlInPopup
        
        // Update the current site domain in the button
        updateCurrentSiteDomain();

        // Regular updates and listeners
        chrome.storage.onChanged.addListener(async (changes, namespace) => {
          if (namespace === 'sync') {
            let listNeedsRepopulate = false;
            if (changes.savedProxies) {
                console.log('[Popup] Storage: savedProxies changed.');
                listNeedsRepopulate = true;
            }
            
            // If currentUpstream changed in storage (by background.js), it implies Node app state might have changed.
            // We should re-sync our configuredProxyUrlInPopup with this reported state IF it's a reliable source.
            // However, the user wanted to decouple button from Node's reported state post-action.
            // For now, storage change to currentUpstream will just trigger updateStatusDisplay for info spans.
            // `configuredProxyUrlInPopup` is primarily managed by user direct actions (connect/disconnect) or initial load sync.

            if (listNeedsRepopulate) {
                // Repopulate list, trying to maintain selection of configuredProxyUrlInPopup if it still exists
                await populateProxyList(configuredProxyUrlInPopup);
            }
            
            // Always refresh displayed statuses and button if relevant storage items change.
            // updateStatusDisplay no longer changes configuredProxyUrlInPopup after initial load.
            if (changes.savedProxies || changes.currentProxyStatus || changes.currentUpstream || changes.bypassList) {
                 updateStatusDisplay(); 
            }
          }
        });
        setInterval(updateStatusDisplay, 5000);
    });
  }

  init();
}); 