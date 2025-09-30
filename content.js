// List of cities and their country codes
const CITIES = {
  'London': 'GB',
  'Paris': 'FR',
  'Rome': 'IT',
  'Berlin': 'DE',
  'Madrid': 'ES',
  'Barcelona': 'ES',
  'Amsterdam': 'NL',
  'Vienna': 'AT',
  'Prague': 'CZ',
  'Budapest': 'HU',
  'Tokyo': 'JP',
  'New York': 'US',
  'Los Angeles': 'US',
  'Chicago': 'US',
  'San Francisco': 'US',
  'Sydney': 'AU',
  'Melbourne': 'AU',
  'Dubai': 'AE',
  'Singapore': 'SG',
  'Hong Kong': 'HK',
  'Bangkok': 'TH',
  'Mumbai': 'IN',
  'Delhi': 'IN',
  'Toronto': 'CA',
  'Vancouver': 'CA'
};

// Country names to codes
const COUNTRIES = {
  'United Kingdom': 'GB',
  'UK': 'GB',
  'France': 'FR',
  'Italy': 'IT',
  'Germany': 'DE',
  'Spain': 'ES',
  'Netherlands': 'NL',
  'Austria': 'AT',
  'Czech Republic': 'CZ',
  'Hungary': 'HU',
  'Japan': 'JP',
  'United States': 'US',
  'USA': 'US',
  'Australia': 'AU',
  'UAE': 'AE',
  'Singapore': 'SG',
  'Hong Kong': 'HK',
  'Thailand': 'TH',
  'India': 'IN',
  'Canada': 'CA'
};

let apiKey = null;
let tooltip = null;

// Load API key from storage
chrome.storage.local.get(['apiKey'], function(result) {
  if (result.apiKey) {
    apiKey = result.apiKey;
    highlightLocations();
  }
});

// Listen for API key updates
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === 'local' && changes.apiKey) {
    apiKey = changes.apiKey.newValue;
    if (apiKey) {
      highlightLocations();
    }
  }
});

function highlightLocations() {
  if (!apiKey) return;

  // Create regex patterns for cities and countries
  const cityNames = Object.keys(CITIES).join('|');
  const countryNames = Object.keys(COUNTRIES).join('|');
  const cityPattern = new RegExp('\\b(' + cityNames + ')\\b', 'gi');
  const countryPattern = new RegExp('\\b(' + countryNames + ')\\b', 'gi');

  // Walk through all text nodes
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip script and style tags
        if (node.parentElement.tagName === 'SCRIPT' || 
            node.parentElement.tagName === 'STYLE' ||
            node.parentElement.classList.contains('liteapi-highlight')) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Check if text contains any cities or countries
        if (cityPattern.test(node.textContent) || countryPattern.test(node.textContent)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        
        return NodeFilter.FILTER_REJECT;
      }
    }
  );

  const nodesToReplace = [];
  let node;
  
  while (node = walker.nextNode()) {
    nodesToReplace.push(node);
  }

  // Replace text nodes with highlighted spans
  nodesToReplace.forEach(function(textNode) {
    const text = textNode.textContent;
    const parent = textNode.parentElement;
    
    // Create a temporary container
    const temp = document.createElement('div');
    
    // Replace cities and countries with highlighted spans
    let processedText = text;
    
    // Highlight cities
    processedText = processedText.replace(cityPattern, function(match) {
      const cityKey = Object.keys(CITIES).find(function(c) {
        return c.toLowerCase() === match.toLowerCase();
      });
      if (cityKey) {
        return '<span class="liteapi-highlight liteapi-city" data-city="' + cityKey + '" data-country="' + CITIES[cityKey] + '">' + match + '</span>';
      }
      return match;
    });
    
    // Highlight countries
    processedText = processedText.replace(countryPattern, function(match) {
      const countryKey = Object.keys(COUNTRIES).find(function(c) {
        return c.toLowerCase() === match.toLowerCase();
      });
      if (countryKey) {
        return '<span class="liteapi-highlight liteapi-country" data-country="' + COUNTRIES[countryKey] + '">' + match + '</span>';
      }
      return match;
    });
    
    temp.innerHTML = processedText;
    
    // Replace the text node with the new nodes
    while (temp.firstChild) {
      parent.insertBefore(temp.firstChild, textNode);
    }
    parent.removeChild(textNode);
  });

  // Add event listeners to highlighted elements
  setupHoverEvents();
}

function setupHoverEvents() {
  const highlights = document.querySelectorAll('.liteapi-highlight');
  
  highlights.forEach(function(element) {
    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);
  });
}

function handleMouseEnter(event) {
  const element = event.target;
  const isCity = element.classList.contains('liteapi-city');
  const city = element.dataset.city;
  const countryCode = element.dataset.country;
  
  // Create tooltip
  createTooltip(element);
  
  // Fetch hotels
  if (isCity && city) {
    fetchHotels(countryCode, city);
  } else if (countryCode) {
    // For countries, show capital city hotels or major city
    const capitalCity = getCapitalCity(countryCode);
    if (capitalCity) {
      fetchHotels(countryCode, capitalCity);
    }
  }
}

function handleMouseLeave(event) {
  if (tooltip && !tooltip.matches(':hover')) {
    removeTooltip();
  }
}

function createTooltip(element) {
  removeTooltip();
  
  tooltip = document.createElement('div');
  tooltip.className = 'liteapi-tooltip';
  tooltip.innerHTML = '<div class="liteapi-loading">Loading hotels...</div>';
  
  document.body.appendChild(tooltip);
  
  // Position tooltip
  const rect = element.getBoundingClientRect();
  tooltip.style.left = rect.left + 'px';
  tooltip.style.top = (rect.bottom + window.scrollY + 5) + 'px';
  
  // Add hover event to tooltip itself
  tooltip.addEventListener('mouseleave', removeTooltip);
}

function removeTooltip() {
  if (tooltip) {
    tooltip.remove();
    tooltip = null;
  }
}

function fetchHotels(countryCode, cityName) {
  chrome.runtime.sendMessage({
    action: "searchHotels",
    apiKey: apiKey,
    countryCode: countryCode,
    cityName: cityName
  }, function(response) {
    if (response && response.success && tooltip) {
      displayHotelsInTooltip(response.data, cityName);
    } else if (tooltip) {
      tooltip.innerHTML = '<div class="liteapi-error">Failed to load hotels</div>';
    }
  });
}

function displayHotelsInTooltip(data, cityName) {
  if (!tooltip || !data || !data.data) return;
  
  const hotels = data.data.slice(0, 5); // Top 5 hotels
  
  if (hotels.length === 0) {
    tooltip.innerHTML = '<div class="liteapi-no-results">No hotels found in ' + cityName + '</div>';
    return;
  }
  
  let hotelsHtml = '<div class="liteapi-tooltip-header">Top Hotels in ' + cityName + '</div>';
  hotelsHtml += '<div class="liteapi-hotels-list">';
  
  for (let i = 0; i < hotels.length; i++) {
    const hotel = hotels[i];
    const hotelNumber = i + 1;
    
    hotelsHtml += '<div class="liteapi-hotel-item">';
    
    // Add hotel image
    if (hotel.hotelImages && hotel.hotelImages.length > 0) {
      const imageUrl = hotel.hotelImages[0].url;
      hotelsHtml += '<img src="' + imageUrl + '" alt="Hotel" class="liteapi-hotel-image" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';">';
      hotelsHtml += '<div class="liteapi-no-image" style="display:none;">No img</div>';
    } else {
      hotelsHtml += '<div class="liteapi-no-image">No img</div>';
    }
    
    hotelsHtml += '<div class="liteapi-hotel-number">' + hotelNumber + '</div>';
    hotelsHtml += '<div class="liteapi-hotel-info">';
    hotelsHtml += '<div class="liteapi-hotel-name">' + (hotel.name || 'Unnamed Hotel') + '</div>';
    
    if (hotel.address) {
      hotelsHtml += '<div class="liteapi-hotel-address">' + hotel.address + '</div>';
    }
    
    // Add star rating
    if (hotel.starRating) {
      hotelsHtml += '<span class="liteapi-hotel-rating">★ ' + hotel.starRating + '</span>';
    }
    
    // Add review score
    if (hotel.averageReviewScore) {
      hotelsHtml += '<span class="liteapi-hotel-review">📝 ' + hotel.averageReviewScore + '/10</span>';
    }
    
    hotelsHtml += '</div>';
    hotelsHtml += '</div>';
  }
  
  hotelsHtml += '</div>';
  
  tooltip.innerHTML = hotelsHtml;
}

function getCapitalCity(countryCode) {
  const capitals = {
    'GB': 'London',
    'FR': 'Paris',
    'IT': 'Rome',
    'DE': 'Berlin',
    'ES': 'Madrid',
    'NL': 'Amsterdam',
    'AT': 'Vienna',
    'CZ': 'Prague',
    'HU': 'Budapest',
    'JP': 'Tokyo',
    'US': 'Washington',
    'AU': 'Sydney',
    'AE': 'Dubai',
    'SG': 'Singapore',
    'HK': 'Hong Kong',
    'TH': 'Bangkok',
    'IN': 'Delhi',
    'CA': 'Toronto'
  };
  
  return capitals[countryCode] || null;
}