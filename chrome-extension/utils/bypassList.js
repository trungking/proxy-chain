/**
 * Bypass list utilities for URL pattern matching and formatting
 */

// Update the formatBypassEntry function to better handle domains
export function formatBypassEntry(entry) {
  entry = entry.trim().toLowerCase();
  if (!entry) return null;

  try {
    // If it's already a pattern like *.example.com or <local> or an IP, keep it
    if (entry === '<local>' || /^\d{1,3}(\.\d{1,3}){3}(?:\/\d{1,2})?$/.test(entry)) {
      return entry;
    }
    
    // Add a scheme if missing, for URL constructor to work reliably
    let urlToParse = entry;
    if (!urlToParse.includes('://')) {
      urlToParse = 'http://' + urlToParse; 
    }
    const url = new URL(urlToParse);
    let hostname = url.hostname;
    
    // Always remove www. prefix if present
    hostname = hostname.replace(/^www\./, '');
    
    // If it's not already a wildcard pattern, make it one
    if (!hostname.startsWith('*.')) {
      hostname = '*.' + hostname;
    }
    
    return hostname;
  } catch (e) {
    // If parsing fails, try to handle it as a simple hostname
    entry = entry.replace(/^www\./, ''); // Remove www. if present
    if (entry.includes('/') || entry.includes(':') || entry.includes('?')){
      console.warn(`Bypass entry "${entry}" could not be parsed as URL and seems complex, not auto-formatting.`);
      return entry;
    }
    // Add wildcard for subdomains if not present
    if (!entry.startsWith('*.')) {
      entry = '*.' + entry;
    }
    return entry;
  }
}

// Update the isUrlInBypassList function to better handle paths and subdomains
export function isUrlInBypassList(url, bypassList) {
  if (!url || !bypassList) return false;
  
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname;
    
    // Remove www. from the hostname for comparison
    hostname = hostname.replace(/^www\./, '');
    
    // Debug log to trace bypass checks
    console.log(`Checking if ${hostname} is in bypass list...`);
    
    for (const pattern of bypassList) {
      // For <local> patterns
      if (pattern === '<local>') {
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('.local')) {
          console.log(`✓ ${hostname} matches <local> pattern`);
          return true;
        }
        continue;
      }
      
      // For IP addresses
      if (/^\d{1,3}(\.\d{1,3}){3}(?:\/\d{1,2})?$/.test(pattern)) {
        if (hostname === pattern) {
          console.log(`✓ ${hostname} matches IP pattern ${pattern}`);
          return true;
        }
        continue;
      }
      
      // For domain patterns - strip any wildcards for comparison
      const domainPattern = pattern.replace(/^\*\./, '');
      
      // Check for exact match
      if (hostname === domainPattern) {
        console.log(`✓ ${hostname} exact match with ${pattern}`);
        return true;
      }
      
      // Check if hostname is a subdomain of pattern (e.g., assets.twitch.tv matches twitch.tv)
      if (hostname.endsWith('.' + domainPattern)) {
        console.log(`✓ ${hostname} is subdomain of ${pattern}`);
        return true;
      }
    }
    
    console.log(`✗ ${hostname} NOT found in bypass list`);
    return false;
  } catch (e) {
    console.error('Error checking URL against bypass list:', e);
    return false;
  }
}

export function formatBypassListForChrome(userBypassList) {
  // Format the bypass list patterns for Chrome's proxy API
  // Chrome's proxy API uses a different format than our internal bypass list
  return userBypassList.map(pattern => {
    // Keep <local> as is (Chrome understands this)
    if (pattern === '<local>') {
      return pattern;
    }
    
    // For IP addresses with CIDR notation, keep as is
    if (/^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/.test(pattern)) {
      return pattern;
    }
    
    // Remove any * prefix if present
    pattern = pattern.replace(/^\*\./, '');
    
    // Add the required * prefix for Chrome's proxy API to match all subdomains
    // This ensures that subdomains like assets.twitch.tv will be bypassed if twitch.tv is in the list
    return `*${pattern.startsWith('.') ? '' : '.'}${pattern}`;
  });
} 