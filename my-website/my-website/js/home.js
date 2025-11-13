// --- Configuration Constants ---
const API_CONFIG = {
  KEY: '420dd26414b8bcb319a5d49051b6ac25',
  BASE_URL: 'https://api.themoviedb.org/3',
  IMG_URL: 'https://image.tmdb.org/t/p/original',
};

// --- State Variables ---
let currentItem = null;

// --- API Fetching Functions ---

/**
 * Fetches trending movies or TV shows from TMDB.
 * @param {'movie' | 'tv'} type - The media type to fetch.
 * @returns {Promise<Array<Object>>} - Array of media items.
 */
async function fetchTrending(type) {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/trending/${type}/week?api_key=${API_CONFIG.KEY}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error(`Error fetching trending ${type}:`, error);
    return [];
  }
}

/**
 * Fetches trending TV shows and filters for Japanese anime.
 * @returns {Promise<Array<Object>>} - Array of anime items.
 */
async function fetchTrendingAnime() {
  let allResults = [];
  const MAX_PAGES = 3; 
  const ANIME_GENRE_ID = 16; // TMDB Genre ID for Animation

  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/trending/tv/week?api_key=${API_CONFIG.KEY}&page=${page}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      const filtered = data.results.filter(item =>
        item.original_language === 'ja' && // Japanese language
        item.genre_ids && item.genre_ids.includes(ANIME_GENRE_ID) // Must include Animation genre
      );
      allResults = allResults.concat(filtered);
    } catch (error) {
      console.error(`Error fetching trending anime page ${page}:`, error);
      // Continue to next page or break, depending on desired robustness
    }
  }

  return allResults;
}

// --- DOM Manipulation / Display Functions ---

/**
 * Displays the main banner background and title.
 * @param {Object} item - The media item for the banner.
 */
function displayBanner(item) {
  const bannerElement = document.getElementById('banner');
  const titleElement = document.getElementById('banner-title');
  
  if (item && item.backdrop_path) {
    bannerElement.style.backgroundImage = `url(${API_CONFIG.IMG_URL}${item.backdrop_path})`;
    titleElement.textContent = item.title || item.name || '';
  }
}

/**
 * Populates a horizontal list container with media posters.
 * @param {Array<Object>} items - Array of media items.
 * @param {string} containerId - ID of the container element.
 */
function displayList(items, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return; 

  container.innerHTML = ''; // Clear previous content
  items.forEach(item => {
    if (!item.poster_path) return; // Skip items without a poster
    
    const img = document.createElement('img');
    img.src = `${API_CONFIG.IMG_URL}${item.poster_path}`;
    img.alt = `Poster for ${item.title || item.name}`;
    img.classList.add('media-poster');
    img.setAttribute('role', 'button');
    img.setAttribute('tabindex', '0');
    
    // Attach click and keyboard event handlers
    const clickHandler = () => showDetails(item);
    img.onclick = clickHandler;
    img.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            clickHandler();
        }
    };
    
    container.appendChild(img);
  });
}

/**
 * Renders the star rating based on the vote average.
 * @param {number} voteAverage - The average vote (out of 10).
 * @returns {string} - HTML string of star characters.
 */
function renderRating(voteAverage) {
  // TMDB is out of 10, common star rating is out of 5
  const ratingOutOfFive = Math.round(voteAverage / 2); 
  return '★'.repeat(ratingOutOfFive) + '☆'.repeat(5 - ratingOutOfFive);
}

// --- Modal and Details Logic ---

/**
 * Shows the modal with details for a selected media item.
 * @param {Object} item - The media item to display.
 */
function showDetails(item) {
  currentItem = item;
  
  // Set media details
  document.getElementById('modal-title').textContent = item.title || item.name;
  document.getElementById('modal-description').textContent = item.overview || 'No description available.';
  document.getElementById('modal-image').src = `${API_CONFIG.IMG_URL}${item.poster_path}`;
  document.getElementById('modal-image').alt = `Poster for ${item.title || item.name}`;
  
  // Set rating
  document.getElementById('modal-rating').innerHTML = renderRating(item.vote_average);
  
  // Reset server selector and load iframe
  document.getElementById('server').value = 'vidsrc.cc'; // Default to first server
  changeServer(); 
  
  // Display modal
  document.getElementById('modal').style.display = 'flex';
  document.body.style.overflow = 'hidden'; // Prevent scrolling background
}

/**
 * Updates the video iframe source based on the selected server.
 */
function changeServer() {
  if (!currentItem) return;

  const server = document.getElementById('server').value;
  // Determine if it's a movie or TV show for the embed URL
  const type = (currentItem.media_type === "movie" || currentItem.title) ? "movie" : "tv";
  let embedURL = "";

  // Mapping server values to the correct embed URLs
  if (server === "vidsrc.cc") {
    embedURL = `https://vidsrc.cc/v2/embed/${type}/${currentItem.id}`;
  } else if (server === "vidsrc.net") { // Corrected from vidsrc.me
    embedURL = `https://vidsrc.net/embed/${type}/?tmdb=${currentItem.id}`;
  } else if (server === "player.videasy.net") {
    embedURL = `https://player.videasy.net/${type}/${currentItem.id}`;
  }

  document.getElementById('modal-video').src = embedURL;
}

/**
 * Closes the details modal and stops the video.
 */
function closeModal() {
  document.getElementById('modal').style.display = 'none';
  document.getElementById('modal-video').src = ''; // Stop video playback
  document.body.style.overflow = 'auto'; 
}

/**
 * Opens the search overlay modal.
 */
function openSearchModal() {
  document.getElementById('search-modal').style.display = 'flex';
  document.getElementById('search-input').focus();
  document.body.style.overflow = 'hidden'; // Prevent scrolling background
}

/**
 * Closes the search overlay modal.
 */
function closeSearchModal() {
  document.getElementById('search-modal').style.display = 'none';
  document.getElementById('search-results').innerHTML = '';
  document.getElementById('search-input').value = '';
  document.body.style.overflow = 'auto';
}

/**
 * Searches TMDB for media based on user input.
 */
async function searchTMDB() {
  const query = document.getElementById('search-input').value.trim();
  const container = document.getElementById('search-results');
  container.innerHTML = '';
  
  if (!query) {
    return;
  }

  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/search/multi?api_key=${API_CONFIG.KEY}&query=${encodeURIComponent(query)}`);
    if (!response.ok) {
        throw new Error(`Search error! status: ${response.status}`);
    }
    const data = await response.json();

    data.results.forEach(item => {
      // Filter out people, items without a title/name, and items without a poster
      if (item.media_type === 'person' || (!item.poster_path && !item.backdrop_path) || (!item.title && !item.name)) return;
      
      const img = document.createElement('img');
      img.src = `${API_CONFIG.IMG_URL}${item.poster_path}`;
      img.alt = `Poster for ${item.title || item.name}`;
      img.classList.add('media-poster');
      img.setAttribute('role', 'button');
      img.setAttribute('tabindex', '0');
      
      const clickHandler = () => {
        closeSearchModal();
        showDetails(item);
      };
      
      img.onclick = clickHandler;
      img.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            clickHandler();
        }
      };
      
      container.appendChild(img);
    });

    if (container.children.length === 0) {
        container.innerHTML = '<p class="no-results-message">No results found. Try a different search term.</p>';
    }

  } catch (error) {
    console.error("Error during search:", error);
    container.innerHTML = '<p class="error-message">Could not perform search. Please try again.</p>';
  }
}

// --- Initialization ---

/**
 * Main function to initialize the application.
 */
async function init() {
  // Fetch data concurrently for faster loading
  const [movies, tvShows, anime] = await Promise.all([
    fetchTrending('movie'),
    fetchTrending('tv'),
    fetchTrendingAnime()
  ]);

  // Display banner with a random movie (or first if random fails)
  if (movies.length > 0) {
    displayBanner(movies[Math.floor(Math.random() * movies.length)]);
  }

  // Display lists
  displayList(movies, 'movies-list');
  displayList(tvShows, 'tvshows-list');
  displayList(anime, 'anime-list');
  
  // Expose functions globally for HTML inline handlers (a common pattern for this style of app)
  window.closeModal = closeModal;
  window.changeServer = changeServer;
  window.openSearchModal = openSearchModal;
  window.closeSearchModal = closeSearchModal;
  window.searchTMDB = searchTMDB;
}

// Start the application
init();
