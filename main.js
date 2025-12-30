/**
 * CHADNOVA AI - Production Logic Engine
 * Synced to Render Cloud Backend
 */

// 1. PRODUCTION API CONFIGURATION
// Pointing directly to your Render Backend
const API_BASE_URL = "https://chadnove-cropai-backend.onrender.com/api"; 

console.log("🚀 ChadNova Production Engine Initialized at:", API_BASE_URL);

// Global state for Chart stitching
let globalHistory = { years: [], yields: [] };
let globalPrediction = null;

document.addEventListener("DOMContentLoaded", async () => {

    // --- UI ELEMENTS ---
    const countrySelect = document.getElementById("countrySelect");
    const cropSelect = document.getElementById("cropSelect");
    const weatherToggle = document.getElementById("weatherToggle");
    const rainInput = document.getElementById("rainInput");
    const tempInput = document.getElementById("tempInput");
    const rainHint = document.getElementById("rainHint");
    const tempHint = document.getElementById("tempHint");
    const predictForm = document.getElementById("predictForm");

    // ==========================================
    // 1. PREDICT PAGE LOGIC
    // ==========================================
    if (countrySelect && cropSelect) {
        console.log("📍 Predictor UI Detected. Connecting to Render...");

        // Fetch Metadata for Dropdowns
        try {
            const res = await fetch(`${API_BASE_URL}/get_metadata`);
            if (!res.ok) throw new Error("Backend not responding");
            
            const data = await res.json();
            
            // Clear "Syncing..." and populate
            countrySelect.innerHTML = '<option value="" disabled selected>Select a country</option>';
            cropSelect.innerHTML = '<option value="" disabled selected>Select a crop</option>';
            
            data.countries.forEach(c => countrySelect.add(new Option(c, c)));
            data.crops.forEach(c => cropSelect.add(new Option(c, c)));
            console.log("✅ Metadata Synced.");
        } catch (e) { 
            console.error("❌ Connection failed:", e);
            countrySelect.innerHTML = '<option value="" disabled>Server Waking Up... Please Refresh</option>';
        }

        // HYBRID TOGGLE LOGIC (Lock/Unlock Inputs)
        if (weatherToggle) {
            weatherToggle.addEventListener("change", () => {
                const isAuto = weatherToggle.checked;
                rainInput.readOnly = isAuto;
                tempInput.readOnly = isAuto;
                
                if (isAuto) {
                    rainInput.classList.add("bg-light");
                    tempInput.classList.add("bg-light");
                    rainHint.innerHTML = '<i class="fa-solid fa-lock me-1"></i> Locked to Live Data';
                    tempHint.innerHTML = '<i class="fa-solid fa-lock me-1"></i> Locked to Live Data';
                    if(countrySelect.value) fetchWeather(countrySelect.value);
                } else {
                    rainInput.classList.remove("bg-light");
                    tempInput.classList.remove("bg-light");
                    rainHint.innerHTML = '<i class="fa-solid fa-hand me-1"></i> Manual Override Active';
                    tempHint.innerHTML = '<i class="fa-solid fa-hand me-1"></i> Manual Override Active';
                }
            });
        }

        // WEATHER FETCH FUNCTION
        async function fetchWeather(country) {
            if (!weatherToggle || !weatherToggle.checked) return;
            
            rainInput.placeholder = "Syncing...";
            tempInput.placeholder = "Syncing...";

            try {
                const res = await fetch(`${API_BASE_URL}/get_live_weather/${country}`);
                const data = await res.json();
                if (data.temp) {
                    tempInput.value = data.temp;
                    rainInput.value = data.rain;
                    console.log("🌡️ Weather synced for:", country);
                }
            } catch (err) { console.error("❌ Weather sync failed"); }
        }

        countrySelect.addEventListener("change", () => fetchWeather(countrySelect.value));

        // FORM SUBMISSION
        predictForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const loader = document.getElementById("loadingState");
            if (loader) loader.classList.remove("d-none");

            const formData = new FormData(predictForm);
            const payload = Object.fromEntries(formData);

            try {
                const res = await fetch(`${API_BASE_URL}/simulate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                const result = await res.json();
                
                localStorage.setItem("chad_payload", JSON.stringify(payload));
                localStorage.setItem("chad_result", JSON.stringify(result));
                
                window.location.href = "dashboard.html";
            } catch (err) {
                alert("AI Simulation Failed. The server may still be waking up.");
                if (loader) loader.classList.add("d-none");
            }
        });
    }

    // ==========================================
    // 2. DASHBOARD PAGE LOGIC
    // ==========================================
    if (document.getElementById("bigPredictionValue")) {
        console.log("📍 Dashboard UI Detected.");
        loadDashboard();
    }
});

// --- DASHBOARD HELPER FUNCTIONS ---

async function loadDashboard() {
    const payload = JSON.parse(localStorage.getItem("chad_payload"));
    const result = JSON.parse(localStorage.getItem("chad_result"));

    if (!payload || !result) return;

    document.getElementById("bigPredictionValue").innerText = result.prediction.toLocaleString();
    document.getElementById("bigCountryName").innerText = payload.country;
    document.getElementById("bigCropName").innerText = payload.crop;
    document.getElementById("compareYear").innerText = result.year;
    
    const valBaseline = document.getElementById("valBaseline");
    if (valBaseline) valBaseline.innerText = result.baseline ? result.baseline.toLocaleString() : "N/A";

    const deltaEl = document.getElementById("valDelta");
    if (result.baseline && deltaEl) {
        const diff = ((result.prediction - result.baseline) / result.baseline) * 100;
        deltaEl.innerText = `${diff > 0 ? "+" : ""}${diff.toFixed(2)}%`;
        deltaEl.className = diff > 0 ? "fw-bold text-success" : "fw-bold text-danger";
    }

    // Background fetch history for graph
    try {
        const res = await fetch(`${API_BASE_URL}/trend/${payload.country}/${payload.crop}`);
        globalHistory = await res.json();
        globalPrediction = result;
    } catch (e) { console.error("❌ History fetch failed"); }
}

function revealComparison() {
    document.getElementById("sectionComparison").classList.remove("d-none");
    document.getElementById("btnCompare").classList.add("d-none");
}

function revealForecast() {
    document.getElementById("sectionGraph").classList.remove("d-none");
    document.getElementById("btnForecast").classList.add("d-none");
    renderChart();
}

function renderChart() {
    const ctx = document.getElementById("yieldTrendChart").getContext("2d");
    
    const histYears = globalHistory.years || [];
    const histValues = globalHistory.yields || [];
    
    if (histYears.length === 0) return;

    const lastYear = histYears[histYears.length - 1];
    const lastVal = histValues[histValues.length - 1];

    const dataForecast = new Array(histYears.length - 1).fill(null);
    dataForecast.push(lastVal);
    dataForecast.push(globalPrediction.prediction);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: [...histYears, globalPrediction.year],
            datasets: [
                {
                    label: 'Historical Data',
                    data: histValues,
                    borderColor: '#198754',
                    backgroundColor: 'rgba(25, 135, 84, 0.1)',
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'AI Forecast',
                    data: dataForecast,
                    borderColor: '#0d6efd',
                    borderDash: [5, 5],
                    pointRadius: 6,
                    fill: false,
                    tension: 0
                }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' }
            }
        }
    });
}