chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "searchHotels") {
    const countryCode = request.countryCode;
    const cityName = request.cityName;
    const apiKey = request.apiKey;
    
    const searchUrl = 'https://api.liteapi.travel/v3.0/data/hotels?countryCode=' + 
                encodeURIComponent(countryCode) + 
                '&cityName=' + 
                encodeURIComponent(cityName);
    
    fetch(searchUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json'
      }
    })
    .then(function(response) {
      if (!response.ok) {
        throw new Error('HTTP error! status: ' + response.status);
      }
      return response.json();
    })
    .then(function(data) {
      // Only try to get details for first 3 hotels to reduce load
      if (data.data && data.data.length > 0) {
        const limitedHotels = data.data.slice(0, 3);
        const hotelPromises = limitedHotels.map(function(hotel) {
          // Return hotel with basic info if detail fetch fails
          return getHotelDetailsWithReviews(hotel.hotelId, apiKey)
            .then(function(detailedHotel) {
              return detailedHotel || hotel; // Use basic hotel if details fail
            })
            .catch(function(error) {
              console.error('Detail fetch failed for hotel ' + hotel.hotelId, error);
              return hotel; // Return basic hotel info on error
            });
        });
        
        return Promise.all(hotelPromises).then(function(detailedHotels) {
          // Add remaining hotels without details
          const remainingHotels = data.data.slice(3);
          data.data = detailedHotels.concat(remainingHotels);
          sendResponse({success: true, data: data});
        });
      } else {
        sendResponse({success: true, data: data});
      }
    })
    .catch(function(error) {
      sendResponse({success: false, error: error.message});
    });
    
    return true;
  }
});

// Simplified detail fetching
function getHotelDetailsWithReviews(hotelId, apiKey) {
  const detailUrl = 'https://api.liteapi.travel/v3.0/data/hotel?hotelId=' + hotelId;
  
  return fetch(detailUrl, {
    method: 'GET',
    headers: {
      'X-API-Key': apiKey,
      'Accept': 'application/json'
    },
    // Add timeout
    signal: AbortSignal.timeout(3000)
  })
  .then(function(response) {
    if (!response.ok) return null;
    return response.json();
  })
  .then(function(data) {
    if (data && data.data) {
      return data.data;
    }
    return null;
  })
  .catch(function(error) {
    console.error('Error getting hotel details:', error);
    return null;
  });
}