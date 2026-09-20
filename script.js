document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  initDefaultLocation();
  setupSidebarNavigation();
  initAutocomplete(); // Initialize LocationIQ autocomplete
});

function setupSidebarNavigation() {
  const sideButtons = document.querySelectorAll(".desktop-sidebar .side-btn");
  const sidebarCityName = document.getElementById("sidebarCityName");
  const mainCityName = document.getElementById("cityName");

  // 1. Sync city name from main header to sidebar dynamically
  if (mainCityName && sidebarCityName) {
    const observer = new MutationObserver(() => {
      sidebarCityName.textContent = mainCityName.textContent;
    });
    observer.observe(mainCityName, { childList: true, characterData: true, subtree: true });
    
    // Initial sync
    sidebarCityName.textContent = mainCityName.textContent;
  }

  // 2. Navigation smooth scrolling and active state switching
  sideButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      
      // Remove active class from all buttons and add to clicked one
      sideButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const targetSectionName = btn.getAttribute("data-target");
      let targetElement = null;

      // Map target attributes to corresponding sections in your HTML
      switch (targetSectionName) {
        case "current":
          targetElement = document.querySelector(".hero-weather");
          break;
        case "hourly":
          targetElement = document.querySelector(".hourly-card");
          break;
        case "details":
          targetElement = document.querySelector(".details-grid");
          break;
        case "maps":
          targetElement = document.querySelector(".map-card");
          break;
        case "monthly":
          targetElement = document.querySelector(".monthly-card");
          break;
        default:
          break;
      }

      // Smooth scroll to the target section
      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    });
  });
}

// ==========================================
// Weather Application Logic & APIs
// ==========================================

const apiKey = "2538f57997e4797d91b1900eb39ecc93";
const weatherApiKey = "f4e16ddf629a43eaad4113350262009"; // WeatherAPI key for Astronomy endpoint
const locationIqKey = "pk.e4b4dd8dff40666b2dd895e2b1af6681"; // Updated with your LocationIQ key

const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const locationBtn = document.getElementById("locationBtn");
const voiceBtn = document.getElementById("voiceBtn");
const appLogo = document.getElementById("appLogo");

// State variables
let map;
let weatherTileLayer;
let currentMarker;

let currentBaseTemp = 28;
let currentLat = 28.6139; // Default latitude (New Delhi)
let currentSelectedMonth = 0; // Relative index (0 to 11)
let currentYear = new Date().getFullYear();

function setupEventListeners() {
  if (searchBtn) searchBtn.addEventListener("click", handleSearch);
  
  if (cityInput) {
    cityInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        handleSearch();
        hideAutocompleteDropdown();
      }
    });
  }

  if (locationBtn) {
    locationBtn.addEventListener("click", getUserLocation);
  }

  // Refresh view on logo click
  if (appLogo) {
    appLogo.addEventListener("click", () => {
      getUserLocation();
    });
  }

  // Hide autocomplete dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-container")) {
      hideAutocompleteDropdown();
    }
  });
}

// --- LOCATIONIQ AUTOCOMPLETE INTEGRATION ---
function initAutocomplete() {
  if (!cityInput) return;

  // Create dropdown container dynamically if it doesn't exist
  let dropdown = document.getElementById("autocompleteDropdown");
  if (!dropdown) {
    dropdown = document.createElement("div");
    dropdown.id = "autocompleteDropdown";
    dropdown.className = "autocomplete-dropdown";
    dropdown.style.position = "absolute";
    dropdown.style.zIndex = "1000";
    dropdown.style.width = "100%";
    dropdown.style.maxHeight = "200px";
    dropdown.style.overflowY = "auto";
    dropdown.style.background = "#fff";
    dropdown.style.color = "#333";
    dropdown.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
    dropdown.style.borderRadius = "0 0 8px 8px";
    
    // Ensure parent has relative positioning for proper absolute dropdown placement
    if (cityInput.parentElement) {
      cityInput.parentElement.style.position = "relative";
      cityInput.parentElement.appendChild(dropdown);
    }
  }

  let debounceTimer;
  cityInput.addEventListener("input", (e) => {
    const query = e.target.value.trim();
    clearTimeout(debounceTimer);

    if (query.length < 2) {
      hideAutocompleteDropdown();
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const url = `https://api.locationiq.com/v1/autocomplete?key=${locationIqKey}&q=${encodeURIComponent(query)}&limit=5&dedupe=1`;
        const response = await fetch(url, { method: "GET" });
        if (!response.ok) throw new Error("Autocomplete fetch failed");

        const data = await response.json();
        renderAutocompleteDropdown(data);
      } catch (error) {
        console.error("Error fetching location suggestions:", error);
      }
    }, 300); // 300ms debounce delay
  });
}

function renderAutocompleteDropdown(results) {
  const dropdown = document.getElementById("autocompleteDropdown");
  if (!dropdown) return;

  dropdown.innerHTML = "";
  if (!results || results.length === 0) {
    hideAutocompleteDropdown();
    return;
  }

  results.forEach(item => {
    const div = document.createElement("div");
    div.className = "autocomplete-item";
    div.style.padding = "10px 15px";
    div.style.cursor = "pointer";
    div.style.borderBottom = "1px solid #eee";
    div.textContent = item.display_name;

    div.addEventListener("click", () => {
      cityInput.value = item.display_name;
      hideAutocompleteDropdown();
      // Fetch weather using exact coordinates returned by LocationIQ for pinpoint accuracy!
      fetchWeatherByCoords(parseFloat(item.lat), parseFloat(item.lon));
    });

    dropdown.appendChild(div);
  });

  dropdown.style.display = "block";
}

function hideAutocompleteDropdown() {
  const dropdown = document.getElementById("autocompleteDropdown");
  if (dropdown) {
    dropdown.style.display = "none";
  }
}

function handleSearch() {
  const query = cityInput ? cityInput.value.trim() : "";
  if (query) {
    fetchWeather(query);
    hideAutocompleteDropdown();
  }
}

function getUserLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        fetchWeatherByCoords(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        console.warn("Geolocation denied/failed. Falling back to default location.", error);
        fetchWeather("New Delhi");
      }
    );
  } else {
    fetchWeather("New Delhi");
  }
}

function initDefaultLocation() {
  getUserLocation();
}

async function fetchWeather(city) {
  if (!city) return;

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) throw new Error("City not found");

    const data = await response.json();
    updateUI(data);
    
    // Fetch Astronomy data using WeatherAPI
    fetchAstronomyData(data.name);
  } catch (error) {
    alert(error.message);
  }
}

async function fetchWeatherByCoords(lat, lon) {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) throw new Error("Unable to fetch weather for your location");

    const data = await response.json();
    updateUI(data);

    // Fetch Astronomy data using WeatherAPI with coordinates
    fetchAstronomyData(`${lat},${lon}`);
  } catch (error) {
    alert(error.message);
  }
}

// --- WEATHERAPI ASTRONOMY INTEGRATION ---
async function fetchAstronomyData(locationQuery) {
  const url = `https://api.weatherapi.com/v1/astronomy.json?key=${weatherApiKey}&q=${encodeURIComponent(locationQuery)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch astronomy data");
    
    const data = await response.json();
    const astro = data.astronomy.astro;

    // Update text elements with accurate rise/set schedules
    setElementContent("sunriseTime", astro.sunrise);
    setElementContent("sunsetTime", astro.sunset);
    
    setElementContent("moonriseTime", astro.moonrise);
    setElementContent("moonsetTime", astro.moonset);

    let phasePercent = 50; // fallback default
    if (astro.moon_illumination !== undefined) {
      phasePercent = parseInt(astro.moon_illumination, 10);
    }

    animateValue("moonPhasePercentVal", 0, phasePercent, 900, "%");

    const moonPieChart = document.getElementById("moonPieChart");
    if (moonPieChart) {
      moonPieChart.style.background = `conic-gradient(#ffcc00 0% ${phasePercent}%, #203554 ${phasePercent}% 100%)`;
    }
  } catch (error) {
    console.error("Error fetching WeatherAPI astronomy data:", error);
    updateSunAndMoonUIFallback();
  }
}

// --- DYNAMIC CALCULATING / COUNTING ANIMATION EFFECT (Updated for .degree support) ---
function animateValue(id, start, end, duration = 800, suffix = "", useDegreeSpan = false) {
  const obj = document.getElementById(id);
  if (!obj) return;
  
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const easedProgress = progress * (2 - progress);
    const currentVal = Math.floor(easedProgress * (end - start) + start);
    
    if (useDegreeSpan && suffix.includes("°")) {
      const cleanSuffix = suffix.replace("°", "");
      obj.innerHTML = `${currentVal}<span class="degree">°</span>${cleanSuffix}`;
    } else {
      obj.innerHTML = currentVal + suffix;
    }
    
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      if (useDegreeSpan && suffix.includes("°")) {
        const cleanSuffix = suffix.replace("°", "");
        obj.innerHTML = `${end}<span class="degree">°</span>${cleanSuffix}`;
      } else {
        obj.innerHTML = end + suffix;
      }
    }
  };
  window.requestAnimationFrame(step);
}

// --- FALLBACK SUN & MOON PHASE CALCULATOR ---
function updateSunAndMoonUIFallback() {
  const now = new Date();
  const lp = 2551443; // seconds in lunar cycle
  const newMoonRef = Date.UTC(2000, 0, 6, 18, 14) / 1000;
  const nowSec = now.getTime() / 1000;
  const phaseSec = (nowSec - newMoonRef) % lp;
  let phasePercent = Math.round((phaseSec / lp) * 100);
  if (phasePercent < 0) phasePercent += 100;

  animateValue("moonPhasePercentVal", 0, phasePercent, 900, "%");

  const moonPieChart = document.getElementById("moonPieChart");
  if (moonPieChart) {
    moonPieChart.style.background = `conic-gradient(#ffcc00 0% ${phasePercent}%, #203554 ${phasePercent}% 100%)`;
  }
}

// --- NEW HELPER FUNCTIONS FOR DYNAMIC BADGES ---

function getWindForce(speedMs) {
  const kmh = speedMs * 3.6;
  if (kmh < 1) return { force: 0, text: "Calm", icon: "🟡" };
  if (kmh <= 5) return { force: 1, text: "Light Air", icon: "🟡" };
  if (kmh <= 11) return { force: 2, text: "Light Breeze", icon: "🟡" };
  if (kmh <= 19) return { force: 3, text: "Gentle Breeze", icon: "🟡" };
  if (kmh <= 28) return { force: 4, text: "Moderate Breeze", icon: "🟠" };
  if (kmh <= 38) return { force: 5, text: "Fresh Breeze", icon: "🟠" };
  return { force: 6, text: "Strong Breeze", icon: "🔴" };
}

function getHumidityStatus(humidity) {
  if (humidity < 30) return { text: "Dry", icon: "🟠" };
  if (humidity <= 60) return { text: "Normal", icon: "🟡" };
  if (humidity <= 80) return { text: "Humid", icon: "🔵" };
  return { text: "Very Humid", icon: "🔵" };
}

function getPressureTrend(pressure) {
  if (pressure < 1005) return { text: "Falling quickly", icon: "🔵" };
  if (pressure < 1012) return { text: "Falling slowly", icon: "🔵" };
  if (pressure <= 1016) return { text: "Steady", icon: "🟡" };
  if (pressure <= 1025) return { text: "Rising slowly", icon: "🟢" };
  return { text: "Rising quickly", icon: "🟢" };
}

function getVisibilityStatus(visibilityKm) {
  if (visibilityKm >= 10) return { text: "Good", icon: "🔵", desc: `Clear visibility distance of ${visibilityKm} km expected.` };
  if (visibilityKm >= 4) return { text: "Moderate", icon: "🟡", desc: `Moderate haze or mist reducing visibility to ${visibilityKm} km.` };
  return { text: "Poor", icon: "🔴", desc: `Low visibility conditions of ${visibilityKm} km. Exercise caution.` };
}

function setElementContent(id, content, isHTML = false) {
  const el = document.getElementById(id);
  if (el) {
    if (isHTML) el.innerHTML = content;
    else el.innerText = content;
  }
}

function setWeatherBackground(data) {
  const weatherId = data.weather[0].id;
  const cloudsAll = data.clouds ? data.clouds.all : 0;
  const weatherIcon = data.weather[0].icon || "";
  const isNight = weatherIcon.endsWith("n");
  const overlay = document.getElementById("weatherBgOverlay");

  document.body.classList.remove(
    "bg-thunderstorm", "bg-rain", "bg-clouds", "bg-clouds-night",
    "bg-clear-day", "bg-clear-night", "clear-sky", "clouds", "rain"
  );

  if (overlay) overlay.innerHTML = "";

  if (weatherId >= 200 && weatherId <= 232) {
    document.body.classList.add("bg-thunderstorm");
    if (overlay) {
      for (let i = 0; i < 65; i++) {
        const drop = document.createElement("div");
        drop.className = "drop";
        drop.style.left = `${Math.random() * 100}vw`;
        drop.style.animationDuration = `${0.4 + Math.random() * 0.5}s`;
        drop.style.animationDelay = `${Math.random() * 2}s`;
        overlay.appendChild(drop);
      }
    }
  } else if ((weatherId >= 300 && weatherId <= 531) || (weatherId >= 600 && weatherId <= 622)) {
    document.body.classList.add("bg-rain");
    if (overlay) {
      for (let i = 0; i < 45; i++) {
        const drop = document.createElement("div");
        drop.className = "drop";
        drop.style.left = `${Math.random() * 100}vw`;
        drop.style.animationDuration = `${0.4 + Math.random() * 0.5}s`;
        drop.style.animationDelay = `${Math.random() * 2}s`;
        overlay.appendChild(drop);
      }
    }
  } else if (weatherId === 800 || (weatherId >= 801 && cloudsAll < 25)) {
    if (isNight) {
      document.body.classList.add("bg-clear-night");
      if (overlay) overlay.innerHTML = `<div class="star-layer"></div>`;
    } else {
      document.body.classList.add("bg-clear-day");
    }
  } else if (weatherId >= 802 || cloudsAll >= 25) {
    if (isNight) {
      document.body.classList.add("bg-clouds-night");
      if (overlay) overlay.innerHTML = `<div class="star-layer"></div><div class="cloud-layer cloud-layer-1 night-cloud"></div><div class="cloud-layer cloud-layer-2 night-cloud"></div>`;
    } else {
      document.body.classList.add("bg-clouds");
      if (overlay) overlay.innerHTML = `<div class="cloud-layer cloud-layer-1"></div><div class="cloud-layer cloud-layer-2"></div>`;
    }
  } else {
    if (isNight) {
      document.body.classList.add("bg-clear-night");
      if (overlay) overlay.innerHTML = `<div class="star-layer"></div>`;
    } else {
      document.body.classList.add("bg-clear-day");
    }
  }
}

function updateUI(data) {
  currentBaseTemp = Math.round(data.main.temp);
  currentLat = data.coord.lat;

  setElementContent("cityName", data.name);
  setElementContent("condition", data.weather[0].main);
  
  // Apply degree span configuration to main temperatures
  animateValue("temperature", 0, Math.round(data.main.temp), 700, "°", true);
  animateValue("tempMax", 0, Math.round(data.main.temp_max), 700, "°", true);
  animateValue("tempMin", 0, Math.round(data.main.temp_min), 700, "°", true);

  const feelsLikeTemp = Math.round(data.main.feels_like);
  animateValue("cardFeelsLikeVal", 0, feelsLikeTemp, 800, "°", true);
  
  let subtitleText = "Similar to the actual temperature";
  let feelsLikeStatus = "Normal";
  let feelsLikeIcon = "🟡";
  
  if (feelsLikeTemp > 35) {
    subtitleText = "Scorching hot. Feels warmer due to humidity.";
    feelsLikeStatus = "Very hot";
    feelsLikeIcon = "🔵";
  } else if (feelsLikeTemp > 30) {
    subtitleText = "Humid and warm.";
    feelsLikeStatus = "Hot";
    feelsLikeIcon = "🔵";
  } else if (feelsLikeTemp < 15) {
    subtitleText = "Brisk and chilly.";
    feelsLikeStatus = "Cold";
    feelsLikeIcon = "🔵";
  }
  setElementContent("cardFeelsLikeText", subtitleText);
  setElementContent("feelsLikeBadge", `${feelsLikeStatus} <span class="badge-icon">${feelsLikeIcon}</span>`, true);

  const maxRange = 50;
  let percentage = Math.max(0, Math.min(100, (feelsLikeTemp / maxRange) * 100));
  const feelsLikeThumb = document.getElementById("feelsLikeThumb");
  if (feelsLikeThumb) feelsLikeThumb.style.left = `${percentage}%`;

  const humidity = data.main.humidity;
  animateValue("humidity", 0, humidity, 800, "%");
  const dewPoint = Math.round(data.main.temp - ((100 - humidity) / 5));
  const humStatus = getHumidityStatus(humidity);
  
  setElementContent("humidityBadge", `${humStatus.text} <span class="badge-icon">${humStatus.icon}</span>`, true);
  animateValue("dewPointVal", 0, dewPoint, 800, "°", true);

  const windSpeedMs = data.wind.speed;
  const windKmh = Math.round(windSpeedMs * 3.6);
  animateValue("wind", 0, windKmh, 800, " km/h");
  const windInfo = getWindForce(windSpeedMs);
  
  setElementContent("windForceBadge", `Force: ${windInfo.force} (${windInfo.text}) <span class="badge-icon">${windInfo.icon}</span>`, true);

  const pressure = data.main.pressure;
  animateValue("pressureVal", 1000, pressure, 900, " mb");
  const pressureInfo = getPressureTrend(pressure);
  setElementContent("pressureBadge", `${pressureInfo.text} <span class="badge-icon">${pressureInfo.icon}</span>`, true);

  const conditionMain = data.weather[0].main.toLowerCase();
  let visibilityKm;
  if (data.visibility >= 10000) {
    visibilityKm = conditionMain.includes("clear") ? 16.0 : (conditionMain.includes("cloud") ? 12.0 : 10.0);
  } else {
    visibilityKm = parseFloat((data.visibility / 1000).toFixed(1));
  }
  animateValue("visibility", 0, visibilityKm, 800, " km");
  const visInfo = getVisibilityStatus(visibilityKm);
  
  setElementContent("visibilityBadge", `${visInfo.text} <span class="badge-icon">${visInfo.icon}</span>`, true);
  setElementContent("visibilityDesc", visInfo.desc);

  setWeatherBackground(data);
  fetchAirQuality(data.coord.lat, data.coord.lon);
  fetchForecast(data.coord.lat, data.coord.lon);
  updateMap(data.coord.lat, data.coord.lon, conditionMain, data.name);

  setupMonthTabs();
  const now = new Date();
  renderMonthlyCalendar(now.getMonth(), now.getFullYear());

  speakResponse(`The weather in ${data.name} is ${Math.round(data.main.temp)} degrees with ${data.weather[0].main}.`);
}

async function updateMap(lat, lon, weatherType, locationName) {
  const mapElement = document.getElementById('weatherMap');
  if (!mapElement) return;

  const zoomLevel = 6;

  if (!map) {
    map = L.map('weatherMap', { maxZoom: 7, minZoom: 3 }).setView([lat, lon], zoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    currentMarker = L.marker([lat, lon]).addTo(map).bindPopup(`<b>${locationName}</b>`).openPopup();
  } else {
    map.flyTo([lat, lon], zoomLevel);
    currentMarker.setLatLng([lat, lon]).setPopupContent(`<b>${locationName}</b>`).openPopup();
  }

  try {
    const radarApiUrl = "https://api.rainviewer.com/public/weather-maps.json";
    const response = await fetch(radarApiUrl);
    const radarData = await response.json();

    if (radarData && radarData.radar && radarData.radar.past) {
      const latestFrame = radarData.radar.past[radarData.radar.past.length - 1];
      const radarTileUrl = `${radarData.host}${latestFrame.path}/256/{z}/{x}/{y}/2/1_1.png`;

      if (weatherTileLayer) map.removeLayer(weatherTileLayer);

      weatherTileLayer = L.tileLayer(radarTileUrl, { opacity: 0.6, maxZoom: 7, tileSize: 256 }).addTo(map);
    }
  } catch (error) {
    console.error("Error loading live radar layer:", error);
  }
}

function calculateUSAQI(pm25) {
  if (pm25 <= 12.0) return Math.round((50 / 12.0) * pm25);
  if (pm25 <= 35.4) return Math.round(51 + ((100 - 51) / (35.4 - 12.1)) * (pm25 - 12.1));
  if (pm25 <= 55.4) return Math.round(101 + ((150 - 101) / (55.4 - 35.5)) * (pm25 - 35.5));
  if (pm25 <= 150.4) return Math.round(151 + ((200 - 151) / (150.4 - 55.5)) * (pm25 - 55.5));
  if (pm25 <= 250.4) return Math.round(201 + ((300 - 201) / (250.4 - 150.5)) * (pm25 - 150.5));
  return 301;
}

function getAqiStatus(aqi) {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Lightly\npolluted";
  if (aqi <= 150) return "Moderate";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very\nUnhealthy";
  return "Hazardous";
}

function positionGaugeThumb(aqi) {
  const thumb = document.getElementById('aqiThumb');
  if (!thumb) return;

  const clampedAqi = Math.max(0, Math.min(300, aqi));
  const angleRad = Math.PI - (clampedAqi / 300) * Math.PI;
  const cx = 60 + 45 * Math.cos(angleRad);
  const cy = 85 - 45 * Math.sin(angleRad);

  thumb.setAttribute('cx', cx);
  thumb.setAttribute('cy', cy);
}

function updateAirQualityUI(aqiData) {
  const components = aqiData.list[0].components;
  const calculatedAqi = calculateUSAQI(components.pm2_5);
  const statusText = getAqiStatus(calculatedAqi);

  animateValue("aqi-main-value", 0, calculatedAqi, 900);
  
  const aqiStatusElem = document.querySelector('.aqi-status');
  if (aqiStatusElem) aqiStatusElem.innerText = statusText;

  positionGaugeThumb(calculatedAqi);

  const getPercentage = (value, max) => Math.min(100, Math.round((value / max) * 100));

  setElementContent("pm25-val", Math.round(components.pm2_5));
  setElementContent("pm10-val", Math.round(components.pm10));
  setElementContent("so2-val", Math.round(components.so2));
  setElementContent("co-val", Math.round(components.co / 100));

  const pm25Bar = document.getElementById('pm25-bar');
  if (pm25Bar) pm25Bar.style.width = `${getPercentage(components.pm2_5, 100)}%`;
  const pm10Bar = document.getElementById('pm10-bar');
  if (pm10Bar) pm10Bar.style.width = `${getPercentage(components.pm10, 150)}%`;
  const so2Bar = document.getElementById('so2-bar');
  if (so2Bar) so2Bar.style.width = `${getPercentage(components.so2, 80)}%`;
  const coBar = document.getElementById('co-bar');
  if (coBar) coBar.style.width = `${getPercentage(components.co / 100, 50)}%`;
}

async function fetchAirQuality(lat, lon) {
  const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Air pollution data not found");
    const data = await response.json();
    updateAirQualityUI(data);
  } catch (error) {
    console.error("Error fetching air pollution data:", error);
  }
}

function getWeatherSymbol(item) {
  const weatherId = item.weather && item.weather[0] ? item.weather[0].id : 800;
  const cloudsAll = item.clouds ? item.clouds.all : 0;

  if (weatherId >= 200 && weatherId <= 232) return "⛈️";
  if ((weatherId >= 300 && weatherId <= 531) || (weatherId >= 600 && weatherId <= 622)) return "🌧️";
  if (weatherId === 800 || (weatherId >= 801 && cloudsAll < 25)) return "☀️";
  if (weatherId >= 802 || cloudsAll >= 25) return "⛅";
  return "🌤️";
}

async function fetchForecast(lat, lon) {
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Forecast data not available");
    const data = await response.json();
    updateForecastUI(data);
  } catch (error) {
    console.error("Error fetching forecast:", error);
  }
}

function updateForecastUI(data) {
  const hourlyList = document.getElementById("hourlyList");
  if (hourlyList) {
    hourlyList.innerHTML = "";
    data.list.slice(0, 8).forEach((item, index) => {
      const dateObj = new Date(item.dt * 1000);
      let timeStr = index === 0 ? "Now" : dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      const popPercent = Math.round((item.pop || 0) * 100);
      const symbol = getWeatherSymbol(item);

      const hourlyItem = document.createElement("div");
      hourlyItem.className = "hourly-item";
      hourlyItem.innerHTML = `
        <span class="hourly-time">${timeStr}</span>
        <span class="hourly-icon">${symbol}</span>
        <span class="hourly-temp">${Math.round(item.main.temp)}<span class="degree">°</span></span>
        ${popPercent > 10 ? `<span class="hourly-pop">${popPercent}%</span>` : ""}
      `;
      hourlyList.appendChild(hourlyItem);
    });
  }

  const forecastList = document.getElementById("forecastList");
  if (!forecastList) return;
  forecastList.innerHTML = "";

  const dailyData = {};
  data.list.forEach((item) => {
    const dateObj = new Date(item.dt * 1000);
    const dateKey = `${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')}`;

    if (!dailyData[dateKey]) {
      dailyData[dateKey] = {
        dateStr: dateKey,
        dayName: dateObj.toLocaleDateString("en-US", { weekday: "short" }),
        tempMin: item.main.temp_min,
        tempMax: item.main.temp_max,
        pop: item.pop || 0,
        weather: item.weather[0],
        clouds: item.clouds
      };
    } else {
      dailyData[dateKey].tempMin = Math.min(dailyData[dateKey].tempMin, item.main.temp_min);
      dailyData[dateKey].tempMax = Math.max(dailyData[dateKey].tempMax, item.main.temp_max);
      dailyData[dateKey].pop = Math.max(dailyData[dateKey].pop, item.pop || 0);
    }
  });

  Object.values(dailyData).slice(0, 5).forEach((day, index) => {
    const popPercent = Math.round(day.pop * 100);
    let dayLabel = index === 0 ? "Today" : (index === 1 ? "Tomorrow" : day.dayName);

    const row = document.createElement("div");
    row.className = "forecast-row";
    row.innerHTML = `
      <div class="forecast-date-group">
        <span class="forecast-date">${day.dateStr}</span>
        <span class="forecast-day">${dayLabel}</span>
      </div>
      <div class="forecast-icon-group">
        <span class="forecast-icon">${getWeatherSymbol(day)}</span>
        ${popPercent > 10 ? `<span class="forecast-pop">${popPercent}%</span>` : ""}
      </div>
      <div class="forecast-temps">
        <span class="forecast-temp-min">${Math.round(day.tempMin)}<span class="degree">°</span></span>
        <span class="forecast-temp-max">${Math.round(day.tempMax)}<span class="degree">°</span></span>
      </div>
    `;
    forecastList.appendChild(row);
  });
}

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function setupMonthTabs() {
  const monthTabsContainer = document.getElementById("monthTabs");
  if (!monthTabsContainer) return;
  monthTabsContainer.innerHTML = "";
  const now = new Date();

  for (let i = 0; i < 12; i++) {
    const monthIndex = (now.getMonth() + i) % 12;
    const yearOffset = Math.floor((now.getMonth() + i) / 12);
    const year = now.getFullYear() + yearOffset;

    const btn = document.createElement("button");
    btn.className = `month-btn ${i === currentSelectedMonth ? "active" : ""}`;
    btn.textContent = yearOffset > 0 ? `${year} ${monthNames[monthIndex]}` : monthNames[monthIndex];
    
    btn.addEventListener("click", () => {
      document.querySelectorAll(".month-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentSelectedMonth = i;
      currentYear = year;
      renderMonthlyCalendar(monthIndex, year);
    });

    monthTabsContainer.appendChild(btn);
  }
}

function renderMonthlyCalendar(month, year) {
  const grid = document.getElementById("calendarGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const today = new Date();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const symbolsPool = ["☀️", "⛅", "🌤️", "🌧️", "⛈️"];
  let seasonalShift = Math.sin((month / 11) * Math.PI - (currentLat >= 0 ? 0.8 : 3.8)) * 8;

  for (let i = firstDay - 1; i >= 0; i--) {
    grid.appendChild(createCalendarDayElem(daysInPrevMonth - i, true, false));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = (day === today.getDate() && month === today.getMonth() && year === today.getFullYear());
    const high = Math.round(currentBaseTemp + seasonalShift + Math.sin((day / daysInMonth) * Math.PI * 2) * 3);
    const low = Math.round(high - 7 - (day % 3));
    const symbol = symbolsPool[(day + month + Math.abs(Math.round(currentLat))) % symbolsPool.length];
    grid.appendChild(createCalendarDayElem(day, false, isToday, high, low, symbol));
  }

  const totalSlots = firstDay + daysInMonth;
  const nextMonthDays = totalSlots > 35 ? 42 - totalSlots : 35 - totalSlots;

  for (let day = 1; day <= nextMonthDays; day++) {
    grid.appendChild(createCalendarDayElem(day, true, false));
  }
}

function createCalendarDayElem(num, isOtherMonth, isToday, high = 30, low = 22, symbol = "☀️") {
  const div = document.createElement("div");
  div.className = `cal-day ${isOtherMonth ? "other-month" : ""} ${isToday ? "today" : ""}`;
  if (isOtherMonth) {
    div.innerHTML = `<span class="cal-num">${num}</span>`;
  } else {
    div.innerHTML = `
      <span class="cal-num">${num}</span>
      <span class="cal-icon">${symbol}</span>
      <div class="cal-temps">
        <span class="cal-high">${high}<span class="degree">°</span></span>
        <span class="cal-min">${low}<span class="degree">°</span></span>
      </div>
    `;
  }
  return div;
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition && voiceBtn) {
  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  voiceBtn.addEventListener('click', () => {
    try {
      recognition.start();
      voiceBtn.classList.add('listening');
      if (cityInput) cityInput.placeholder = "Listening... Speak a city name";
    } catch (e) {
      console.log("Speech recognition is already active.");
    }
  });

  recognition.onresult = (event) => {
    let transcript = event.results[0][0].transcript.trim().replace(/\.$/, '');
    if (cityInput) cityInput.value = transcript;
    fetchWeather(transcript);
    voiceBtn.classList.remove('listening');
    if (cityInput) cityInput.placeholder = "Search city...";
  };

  ['onerror', 'onend'].forEach(evt => {
    recognition[evt] = () => {
      voiceBtn.classList.remove('listening');
      if (cityInput) cityInput.placeholder = "Search city...";
    };
  });
}

function speakResponse(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel(); // Stop any ongoing speech
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  }
}