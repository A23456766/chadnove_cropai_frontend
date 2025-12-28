const API_BASE_URL = "http://127.0.0.1:5000/api";

///////////////////////////
// METADATA
///////////////////////////

async function populateDropdowns(countryId, cropId) {
    try {
        const res = await fetch(`${API_BASE_URL}/get_metadata`);
        if (!res.ok) throw new Error("Failed to fetch metadata");

        const data = await res.json();
        const countrySelect = document.getElementById(countryId);
        const cropSelect = document.getElementById(cropId);

        if (!countrySelect || !cropSelect) return;

        countrySelect.innerHTML = `<option value="" disabled selected>Select country</option>`;
        cropSelect.innerHTML = `<option value="" disabled selected>Select crop</option>`;

        data.countries.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c;
            opt.textContent = c;
            countrySelect.appendChild(opt);
        });

        data.crops.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c;
            opt.textContent = c;
            cropSelect.appendChild(opt);
        });

    } catch (err) {
        console.error("Metadata error:", err);
    }
}

///////////////////////////
// PREDICT PAGE
///////////////////////////

async function runPrediction(data) {
    try {
        const res = await fetch(`${API_BASE_URL}/simulate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        if (!res.ok) throw new Error("Prediction failed");

        const result = await res.json();
        localStorage.setItem("chadnova_query", JSON.stringify(data));
        localStorage.setItem("chadnova_result", JSON.stringify(result));

        window.location.href = "/dashboard.html";

    } catch (err) {
        alert("Unable to reach AI service");
        console.error(err);
    }
}

///////////////////////////
// DASHBOARD – CHART
///////////////////////////

let trendChart = null;

function initChart() {
    const ctx = document.getElementById("yieldTrendChart").getContext("2d");

    trendChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: [],
            datasets: [
                {
                    label: "Historical Yield (hg/ha)",
                    data: [],
                    tension: 0.4,
                    borderWidth: 2,
                    fill: false
                },
                {
                    label: "AI Forecast",
                    data: [],
                    type: "scatter",
                    pointRadius: 8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: "Year" } },
                y: { title: { display: true, text: "Yield (hg/ha)" } }
            }
        }
    });
}


async function updateChart() {
    const country = document.getElementById("countrySelect").value;
    const crop = document.getElementById("cropSelect").value;
    if (!country || !crop) return;

    const res = await fetch(`${API_BASE_URL}/trend/${country}/${crop}`);
    const data = await res.json();

    // Historical curve
    trendChart.data.labels = data.years.map(String);
    trendChart.data.datasets[0].data = data.yields;

    // Clear old forecast
    trendChart.data.datasets[1].data = [];

    trendChart.update();
}


///////////////////////////
// DASHBOARD – SIMULATION
///////////////////////////

async function runSimulation() {
    const payload = {
        country: document.getElementById("countrySelect").value,
        crop: document.getElementById("cropSelect").value,
        rainfall: parseFloat(document.getElementById("simRain").value),
        temp: parseFloat(document.getElementById("simTemp").value),
        pesticides: parseFloat(document.getElementById("simPest").value),
        year: parseInt(document.getElementById("simYear").value)
    };

    const res = await fetch(`${API_BASE_URL}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    const result = await res.json();

    /* ================================
       CHART UPDATE (CORRECT WAY)
       ================================ */

    // Ensure forecast dataset exists (Dataset[1])
    if (!trendChart.data.datasets[1]) {
        trendChart.data.datasets.push({
            label: "AI Forecast",
            type: "scatter",
            data: [],
            pointRadius: 8
        });
    }

    // Replace previous forecast point
    trendChart.data.datasets[1].data = [{
        x: result.year.toString(),
        y: result.prediction
    }];

    trendChart.update();

    /* ================================
       REPORT SECTION
       ================================ */

    document.getElementById("reportSection").classList.remove("d-none");
    document.getElementById("reportYearHeader").innerText = result.year;
    document.getElementById("forecastTableHeader").innerText = `${result.year} AI Forecast`;
    document.getElementById("tableForecast").innerText = result.prediction.toLocaleString();
    document.getElementById("tableBaseline").innerText = result.baseline ?? "N/A";

    if (result.baseline) {
        const diff = ((result.prediction - result.baseline) / result.baseline) * 100;
        document.getElementById("tableDelta").innerText =
            `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}%`;
    }

    document.getElementById("legendYear").innerText = result.year;
    document.getElementById("predictionLegend").classList.remove("d-none");
}

///////////////////////////
// WEATHER
///////////////////////////

async function fetchWeatherData() {
    const country = document.getElementById("countrySelect").value;
    const res = await fetch(`${API_BASE_URL}/get_live_weather/${country}`);
    const data = await res.json();

    if (!data.error) {
        document.getElementById("simTemp").value = Math.round(data.temp);
        document.getElementById("simRain").value = data.rain;
    }
}

function toggleManualMode() {
    const live = document.getElementById("liveToggle").checked;
    document.getElementById("liveFetchContainer").classList.toggle("d-none", !live);
    document.getElementById("simRain").readOnly = live;
    document.getElementById("simTemp").readOnly = live;
}

///////////////////////////
// INIT
///////////////////////////

document.addEventListener("DOMContentLoaded", async () => {

    // Predict page
    if (document.getElementById("predictForm")) {
        await populateDropdowns("countrySelect", "cropSelect");

        document.getElementById("predictForm").addEventListener("submit", e => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.target));
            data.year = parseInt(data.year);
            data.temp = parseFloat(data.temp);
            data.rainfall = parseFloat(data.rainfall);
            data.pesticides = parseFloat(data.pesticides);
            runPrediction(data);
        });
    }

    // Dashboard page
    if (document.getElementById("yieldTrendChart")) {
        await populateDropdowns("countrySelect", "cropSelect");
        initChart();

        document.getElementById("countrySelect").addEventListener("change", updateChart);
        document.getElementById("cropSelect").addEventListener("change", updateChart);

        const saved = localStorage.getItem("chadnova_query");
        if (saved) {
            const q = JSON.parse(saved);
            countrySelect.value = q.country;
            cropSelect.value = q.crop;
            simRain.value = q.rainfall;
            simTemp.value = q.temp;
            simPest.value = q.pesticides;
            simYear.value = q.year;
            updateChart();
        }
    }
});
