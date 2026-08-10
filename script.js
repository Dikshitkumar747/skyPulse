const apiKey = "2538f57997e4797d91b1900eb39ecc93";

const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const locationBtn = document.getElementById("locationBtn");

// State variables
let map;
let weatherTileLayer;
let currentMarker;

let currentBaseTemp = 28;
let currentLat = 28.6139; // Default latitude (New Delhi)
let currentSelectedMonth = new Date().getMonth(); // 0 to 11
let currentYear = new Date().getFullYear();

async function fetchWeather(city) {
  if (!city) return;

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) throw new Error("City not found");

    const data = await response.json();
    updateUI(data);
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
  } catch (error) {
    alert(error.message);
  }
}

// Helper to handle dynamic background themes and animated elements
function setWeatherBackground(data) {
  const weatherMain = data.weather[0].main.toLowerCase();
  const weatherIcon = data.weather[0].icon || "";
  const isNight = weatherIcon.endsWith("n");
  const overlay = document.getElementById("weatherBgOverlay");

  // Remove existing dynamic theme classes from body
  document.body.classList.remove(
    "bg-thunderstorm",
    "bg-rain",
    "bg-clouds",
    "bg-clear-day",
    "bg-clear-night",
    "clear-sky",
    "clouds",
    "rain"
  );

  // Clear previous overlay DOM nodes
  if (overlay) overlay.innerHTML = "";

  // Apply dynamic background animations
  if (weatherMain.includes("thunder") || weatherMain.includes("rain") || weatherMain.includes("drizzle")) {
    const isThunder = weatherMain.includes("thunder");
    document.body.classList.add(isThunder ? "bg-thunderstorm" : "bg-rain");

    if (overlay) {
      const dropCount = isThunder ? 65 : 45;
      for (let i = 0; i < dropCount; i++) {
        const drop = document.createElement("div");
        drop.className = "drop";
        drop.style.left = `${Math.random() * 100}vw`;
        drop.style.animationDuration = `${0.4 + Math.random() * 0.5}s`;
        drop.style.animationDelay = `${Math.random() * 2}s`;
        overlay.appendChild(drop);
      }
    }
  } else if (weatherMain.includes("cloud")) {
    document.body.classList.add("bg-clouds");

    if (overlay) {
      const cloud1 = document.createElement("div");
      cloud1.className = "cloud-layer cloud-layer-1";
      
      const cloud2 = document.createElement("div");
      cloud2.className = "cloud-layer cloud-layer-2";

      overlay.appendChild(cloud1);
      overlay.appendChild(cloud2);
    }
  } else if (isNight) {
    document.body.classList.add("bg-clear-night");

    if (overlay) {
      const stars = document.createElement("div");
      stars.className = "star-layer";
      overlay.appendChild(stars);
    }
  } else {
    document.body.classList.add("bg-clear-day");
  }
}

function updateUI(data) {
  currentBaseTemp = Math.round(data.main.temp);
  currentLat = data.coord.lat; // Save location latitude for location-aware monthly estimation

  document.getElementById("cityName").innerText = data.name;
  document.getElementById("condition").innerText = data.weather[0].main;
  document.getElementById("temperature").innerText = Math.round(data.main.temp);
  document.getElementById("tempMax").innerText = Math.round(data.main.temp_max);
  document.getElementById("tempMin").innerText = Math.round(data.main.temp_min);
  
  const feelsLikeTemp = Math.round(data.main.feels_like);
  document.getElementById("cardFeelsLikeVal").innerText = feelsLikeTemp;
  
  let subtitleText = "Similar to the actual temperature";
  if (feelsLikeTemp > 35) {
    subtitleText = "Scorching hot";
  } else if (feelsLikeTemp > 30) {
    subtitleText = "Humid and warm";
  } else if (feelsLikeTemp < 15) {
    subtitleText = "Brisk and chilly";
  }
  document.getElementById("cardFeelsLikeText").innerText = subtitleText;

  const maxRange = 50; 
  let percentage = (feelsLikeTemp / maxRange) * 100;
  percentage = Math.max(0, Math.min(100, percentage)); 

  const feelsLikeThumb = document.getElementById("feelsLikeThumb");
  if (feelsLikeThumb) {
      feelsLikeThumb.style.left = percentage + "%";
  }
  
  document.getElementById("humidity").innerText = `${data.main.humidity}%`;
  document.getElementById("wind").innerText = `${data.wind.speed} km/h`;
  
  let visibilityKm;
  const conditionMain = data.weather[0].main.toLowerCase();
  
  if (data.visibility >= 10000) {
    if (conditionMain.includes("clear")) {
      visibilityKm = "16.0"; 
    } else if (conditionMain.includes("cloud")) {
      visibilityKm = "12.0"; 
    } else {
      visibilityKm = "10.0";
    }
  } else {
    visibilityKm = (data.visibility / 1000).toFixed(1);
  }
  document.getElementById("visibility").innerText = `${visibilityKm} km`;

  setWeatherBackground(data);
  
  fetchAirQuality(data.coord.lat, data.coord.lon);
  fetchForecast(data.coord.lat, data.coord.lon);
  updateMap(data.coord.lat, data.coord.lon, conditionMain, data.name);
  
  // Re-render Monthly Calendar View based on updated city location & temp
  setupMonthTabs();
  renderMonthlyCalendar(currentSelectedMonth, currentYear);
}

// --- Leaflet Weather Map Function ---
async function updateMap(lat, lon, weatherType, locationName) {
  const mapElement = document.getElementById('weatherMap');
  if (!mapElement) return;

  const zoomLevel = 6;

  if (!map) {
    map = L.map('weatherMap', {
      maxZoom: 7,
      minZoom: 3
    }).setView([lat, lon], zoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    currentMarker = L.marker([lat, lon]).addTo(map)
      .bindPopup(`<b>${locationName}</b>`)
      .openPopup();
  } else {
    map.flyTo([lat, lon], zoomLevel);
    currentMarker.setLatLng([lat, lon])
      .setPopupContent(`<b>${locationName}</b>`)
      .openPopup();
  }

  try {
    const radarApiUrl = "https://api.rainviewer.com/public/weather-maps.json";
    const response = await fetch(radarApiUrl);
    const radarData = await response.json();

    if (radarData && radarData.radar && radarData.radar.past) {
      const latestFrame = radarData.radar.past[radarData.radar.past.length - 1];
      const radarTileUrl = `${radarData.host}${latestFrame.path}/256/{z}/{x}/{y}/2/1_1.png`;

      if (weatherTileLayer) {
        map.removeLayer(weatherTileLayer);
      }

      weatherTileLayer = L.tileLayer(radarTileUrl, {
        opacity: 0.6,
        maxZoom: 7,
        tileSize: 256
      }).addTo(map);
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

  const centerX = 60;
  const centerY = 85;
  const radius = 45;

  const cx = centerX + radius * Math.cos(angleRad);
  const cy = centerY - radius * Math.sin(angleRad);

  thumb.setAttribute('cx', cx);
  thumb.setAttribute('cy', cy);
}

function updateAirQualityUI(aqiData) {
  const components = aqiData.list[0].components;

  const pm25 = Math.round(components.pm2_5);
  const pm10 = Math.round(components.pm10);
  const so2 = Math.round(components.so2);
  const co = Math.round(components.co / 100);

  const calculatedAqi = calculateUSAQI(components.pm2_5);
  const statusText = getAqiStatus(calculatedAqi);

  const aqiValueElem = document.querySelector('.aqi-main-value');
  const aqiStatusElem = document.querySelector('.aqi-status');

  if (aqiValueElem) aqiValueElem.textContent = calculatedAqi;
  if (aqiStatusElem) aqiStatusElem.innerText = statusText;

  positionGaugeThumb(calculatedAqi);

  const pm25Elem = document.getElementById('pm25-val');
  const pm10Elem = document.getElementById('pm10-val');
  const so2Elem = document.getElementById('so2-val');
  const coElem = document.getElementById('co-val');

  if (pm25Elem) pm25Elem.textContent = pm25;
  if (pm10Elem) pm10Elem.textContent = pm10;
  if (so2Elem) so2Elem.textContent = so2;
  if (coElem) coElem.textContent = co;

  const getPercentage = (value, max) => Math.min(100, Math.round((value / max) * 100));

  const pm25Bar = document.getElementById('pm25-bar');
  const pm10Bar = document.getElementById('pm10-bar');
  const so2Bar = document.getElementById('so2-bar');
  const coBar = document.getElementById('co-bar');

  if (pm25Bar) pm25Bar.style.width = `${getPercentage(pm25, 100)}%`;
  if (pm10Bar) pm10Bar.style.width = `${getPercentage(pm10, 150)}%`;
  if (so2Bar) so2Bar.style.width = `${getPercentage(so2, 80)}%`;
  if (coBar) coBar.style.width = `${getPercentage(co, 50)}%`;
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

function getWeatherSymbol(condition) {
  const main = condition.toLowerCase();
  if (main.includes("thunderstorm")) return "⛈️";
  if (main.includes("drizzle") || main.includes("rain")) return "🌧️";
  if (main.includes("snow")) return "❄️";
  if (main.includes("clear")) return "☀️";
  if (main.includes("cloud")) return "⛅";
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
    const nextHours = data.list.slice(0, 8);

    nextHours.forEach((item, index) => {
      const dateObj = new Date(item.dt * 1000);
      let timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      if (index === 0) timeStr = "Now";

      const popPercent = Math.round((item.pop || 0) * 100);
      const symbol = getWeatherSymbol(item.weather[0].main);

      const hourlyItem = document.createElement("div");
      hourlyItem.className = "hourly-item";
      hourlyItem.innerHTML = `
        <span class="hourly-time">${timeStr}</span>
        <span class="hourly-icon">${symbol}</span>
        <span class="hourly-temp">${Math.round(item.main.temp)}°</span>
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
        weather: item.weather[0]
      };
    } else {
      dailyData[dateKey].tempMin = Math.min(dailyData[dateKey].tempMin, item.main.temp_min);
      dailyData[dateKey].tempMax = Math.max(dailyData[dateKey].tempMax, item.main.temp_max);
      dailyData[dateKey].pop = Math.max(dailyData[dateKey].pop, item.pop || 0);
    }
  });

  Object.values(dailyData).slice(0, 5).forEach((day, index) => {
    const popPercent = Math.round(day.pop * 100);
    const symbol = getWeatherSymbol(day.weather.main);
    
    let dayLabel = day.dayName;
    if (index === 0) dayLabel = "Today";
    if (index === 1) dayLabel = "Tomorrow";

    const row = document.createElement("div");
    row.className = "forecast-row";
    row.innerHTML = `
      <div class="forecast-date-group">
        <span class="forecast-date">${day.dateStr}</span>
        <span class="forecast-day">${dayLabel}</span>
      </div>
      <div class="forecast-icon-group">
        <span class="forecast-icon">${symbol}</span>
        ${popPercent > 10 ? `<span class="forecast-pop">${popPercent}%</span>` : ""}
      </div>
      <div class="forecast-temps">
        <span class="forecast-temp-min">${Math.round(day.tempMin)}°</span>
        <span class="forecast-temp-max">${Math.round(day.tempMax)}°</span>
      </div>
    `;
    forecastList.appendChild(row);
  });
}

// --- Monthly Calendar Rendering Logic ---
const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

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
      currentSelectedMonth = monthIndex;
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

  // Latitude factor: Northern Hemisphere gets warmer mid-year (June-July), Southern Hemisphere opposite
  const isNorthernHemisphere = currentLat >= 0;
  const monthOffset = month - today.getMonth();
  
  // Seasonal temperature variation based on month distance
  let seasonalShift = Math.sin((month / 11) * Math.PI - (isNorthernHemisphere ? 0.8 : 3.8)) * 8;

  for (let i = firstDay - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const dayElem = createCalendarDayElem(dayNum, true, false);
    grid.appendChild(dayElem);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = (day === today.getDate() && month === today.getMonth() && year === today.getFullYear());
    
    // Calculate realistic dynamic daily fluctuations based on target city's base temperature
    const dailyFluctuation = Math.sin((day / daysInMonth) * Math.PI * 2) * 3;
    const high = Math.round(currentBaseTemp + seasonalShift + dailyFluctuation);
    const low = Math.round(high - 7 - (day % 3));
    const symbol = symbolsPool[(day + month + Math.abs(Math.round(currentLat))) % symbolsPool.length];

    const dayElem = createCalendarDayElem(day, false, isToday, high, low, symbol);
    grid.appendChild(dayElem);
  }

  const totalSlots = firstDay + daysInMonth;
  const nextMonthDays = totalSlots > 35 ? 42 - totalSlots : 35 - totalSlots;

  for (let day = 1; day <= nextMonthDays; day++) {
    const dayElem = createCalendarDayElem(day, true, false);
    grid.appendChild(dayElem);
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
        <span class="cal-high">${high}°</span>
        <span class="cal-min">${low}°</span>
      </div>
    `;
  }
  return div;
}

// Event Listeners
searchBtn.addEventListener("click", () => fetchWeather(cityInput.value));
cityInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") fetchWeather(cityInput.value);
});

locationBtn.addEventListener("click", () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        fetchWeatherByCoords(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        alert("Unable to retrieve your location.");
        console.error(error);
      }
    );
  } else {
    alert("Geolocation is not supported by your browser.");
  }
});

// Auto-fetch current location on load
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      fetchWeatherByCoords(position.coords.latitude, position.coords.longitude);
    },
    (error) => {
      fetchWeather("New Delhi");
    }
  );
} else {
  fetchWeather("New Delhi");
}