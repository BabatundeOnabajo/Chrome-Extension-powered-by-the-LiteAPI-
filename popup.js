// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup loaded');
  
  // Load saved API key
  chrome.storage.local.get(['apiKey'], function(result) {
    if (result.apiKey) {
      const apiKeyInput = document.getElementById('apiKey');
      if (apiKeyInput) {
        apiKeyInput.value = result.apiKey;
      }
    }
  });
  
  // Attach event listeners
  const saveKeyBtn = document.getElementById('saveKey');
  if (saveKeyBtn) {
    saveKeyBtn.addEventListener('click', function() {
      const apiKeyInput = document.getElementById('apiKey');
      if (apiKeyInput) {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
          chrome.storage.local.set({apiKey: apiKey}, function() {
            console.log('API Key saved');
            alert('API Key saved successfully!');
          });
        } else {
          alert('Please enter an API key');
        }
      }
    });
  } else {
    console.error('Save key button not found');
  }
  
  // Search button
  const searchBtn = document.getElementById('searchBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', searchHotels);
  } else {
    console.error('Search button not found');
  }
  
  // Enter key handlers
  const cityNameInput = document.getElementById('cityName');
  if (cityNameInput) {
    cityNameInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        searchHotels();
      }
    });
  }
  
  const countryCodeInput = document.getElementById('countryCode');
  if (countryCodeInput) {
    countryCodeInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        searchHotels();
      }
    });
  }
});

function searchHotels() {
  console.log('Search hotels called');
  
  const apiKeyInput = document.getElementById('apiKey');
  const countryCodeInput = document.getElementById('countryCode');
  const cityNameInput = document.getElementById('cityName');
  const resultsDiv = document.getElementById('results');
  const errorDiv = document.getElementById('error');
  const loadingDiv = document.getElementById('loading');
  
  // Check if elements exist
  if (!apiKeyInput || !countryCodeInput || !cityNameInput) {
    console.error('Required input elements not found');
    return;
  }
  
  const apiKey = apiKeyInput.value.trim();
  const countryCode = countryCodeInput.value.trim().toUpperCase();
  const cityName = cityNameInput.value.trim();
  
  console.log('Search parameters:', {apiKey: apiKey ? 'Set' : 'Not set', countryCode, cityName});
  
  // Clear previous results and errors
  if (resultsDiv) resultsDiv.innerHTML = '';
  if (errorDiv) errorDiv.classList.add('hidden');
  
  // Validation
  if (!apiKey) {
    showError('Please enter your API key first');
    return;
  }
  
  if (!countryCode || countryCode.length !== 2) {
    showError('Please enter a valid 2-letter country code');
    return;
  }
  
  if (!cityName) {
    showError('Please enter a city name');
    return;
  }
  
  // Show loading
  if (loadingDiv) {
    loadingDiv.classList.remove('hidden');
  }
  
  // Send message to background script
  chrome.runtime.sendMessage({
    action: "searchHotels",
    apiKey: apiKey,
    countryCode: countryCode,
    cityName: cityName
  }, function(response) {
    console.log('Response received:', response);
    
    if (loadingDiv) {
      loadingDiv.classList.add('hidden');
    }
    
    if (response && response.success) {
      displayResults(response.data);
    } else {
      showError('Error: ' + (response ? response.error : 'No response received'));
    }
  });
}

function displayResults(data) {
  const resultsDiv = document.getElementById('results');
  if (!resultsDiv) {
    console.error('Results div not found');
    return;
  }
  
  console.log('Display results called with:', data);
  
  // Check if we have hotels in the response
  if (!data || !data.data || data.data.length === 0) {
    resultsDiv.innerHTML = '<div class="no-results">No hotels found</div>';
    return;
  }
  
  // Display hotels
  let hotelsHtml = '';
  
  for (let i = 0; i < data.data.length; i++) {
    const hotel = data.data[i];
    
    hotelsHtml += '<div class="hotel">';
    
    // Add hotel image if available
    if (hotel.hotelImages && hotel.hotelImages.length > 0) {
      const imageUrl = hotel.hotelImages[0].url;
      hotelsHtml += '<img src="' + imageUrl + '" alt="' + (hotel.name || 'Hotel') + '" class="hotel-image" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';">';
      hotelsHtml += '<div class="no-image" style="display:none;">No image</div>';
    } else {
      hotelsHtml += '<div class="no-image">No image</div>';
    }
    
    hotelsHtml += '<div class="hotel-info">';
    hotelsHtml += '<div class="hotel-name">' + (hotel.name || 'Unnamed Hotel') + '</div>';
    hotelsHtml += '<div class="hotel-details">';
    
    if (hotel.address) {
      hotelsHtml += '📍 ' + hotel.address;
    }
    
    if (hotel.hotelId) {
      hotelsHtml += '<br>ID: ' + hotel.hotelId;
    }
    
    if (hotel.latitude && hotel.longitude) {
      hotelsHtml += '<br>📌 ' + hotel.latitude + ', ' + hotel.longitude;
    }
    
    hotelsHtml += '</div>';
    hotelsHtml += '</div>';
    hotelsHtml += '</div>';
  }
  
  resultsDiv.innerHTML = hotelsHtml;
}

function showError(message) {
  console.error('Error:', message);
  const errorDiv = document.getElementById('error');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
  } else {
    alert(message);
  }
}