"use strict";

// ============================================================
// DESCRIPTIVE STATISTICS APPLICATION
// ============================================================

const numbersInput = document.getElementById("numbers-input");
const binsSlider = document.getElementById("bins-slider");
const binsValue = document.getElementById("bins-value");
const updateButton = document.getElementById("update-button");
const statsMessage = document.getElementById("stats-message");
const statsResults = document.getElementById("stats-results");

// ------------------------------------------------------------
// Parse observations separated by commas or whitespace.
// Ignore and report invalid entries.
// ------------------------------------------------------------
function parseNumbers(text) {
  const tokens = text
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  const values = [];
  const badTokens = [];

  for (const token of tokens) {
    const value = Number(token);

    if (Number.isFinite(value)) {
      values.push(value);
    } else {
      badTokens.push(token);
    }
  }

  return { values, badTokens };
}

// ------------------------------------------------------------
// NumPy-compatible linear percentile interpolation.
// ------------------------------------------------------------
function percentile(sorted, p) {
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const fraction = position - lower;

  return sorted[lower] + fraction * (sorted[upper] - sorted[lower]);
}

// ------------------------------------------------------------
// Calculate descriptive statistics.
// Standard deviation uses the population definition.
// Whiskers are actual observations within Tukey fences.
// ------------------------------------------------------------
function computeStats(values) {
  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);

  const mean = values.reduce((sum, x) => sum + x, 0) / n;

  const variance = values.reduce((sum, x) => sum + (x - mean) ** 2, 0) / n;

  const std = Math.sqrt(variance);
  const q1 = percentile(sorted, 0.25);
  const median = percentile(sorted, 0.5);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;

  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;

  const lowerWhisker = sorted.find((x) => x >= lowerFence);

  const upperWhisker = sorted.findLast((x) => x <= upperFence);

  return {
    count: n,
    mean,
    std,
    q1,
    median,
    q3,
    iqr,
    lowerWhisker,
    upperWhisker,
  };
}

// ------------------------------------------------------------
// Format statistics to three significant digits.
// ------------------------------------------------------------
function formatNumber(value) {
  return Number(value.toPrecision(3)).toString();
}

// ------------------------------------------------------------
// Display statistics without inserting user-generated HTML.
// ------------------------------------------------------------
function displayStats(stats) {
  const rows = [
    ["Count", stats.count],
    ["Mean", stats.mean],
    ["Std Dev (Population)", stats.std],
    ["25th Percentile (Q1)", stats.q1],
    ["Median", stats.median],
    ["75th Percentile (Q3)", stats.q3],
    ["Interquartile Range (IQR)", stats.iqr],
    ["Lower Whisker", stats.lowerWhisker],
    ["Upper Whisker", stats.upperWhisker],
  ];

  statsResults.replaceChildren();

  for (const [label, value] of rows) {
    const row = document.createElement("div");
    row.className = "stat-row";

    const heading = document.createElement("strong");
    heading.textContent = `${label}: `;

    row.append(
      heading,
      document.createTextNode(
        label === "Count" ? String(value) : formatNumber(value),
      ),
    );

    statsResults.appendChild(row);
  }
}

// ------------------------------------------------------------
// Calculate histogram frequencies explicitly.
//
// Bins have equal widths.
// Every observation is assigned to exactly one bin.
// The maximum observation belongs to the final bin.
// ------------------------------------------------------------
function computeHistogram(values, bins) {
  const min = Math.min(...values);
  const max = Math.max(...values);

  // Avoid zero-width bins for identical observations.
  const start = min === max ? min - 0.5 : min;
  const end = min === max ? max + 0.5 : max;
  const binWidth = (end - start) / bins;

  const frequencies = Array(bins).fill(0);

  for (const value of values) {
    // Clamp the index so the maximum is included.
    const index = Math.max(
      0,
      Math.min(bins - 1, Math.floor((value - start) / binWidth)),
    );

    frequencies[index]++;
  }

  const centers = [];
  const labels = [];

  for (let i = 0; i < bins; i++) {
    const lower = start + i * binWidth;
    const upper = start + (i + 1) * binWidth;

    centers.push((lower + upper) / 2);

    labels.push(`${formatNumber(lower)} to ${formatNumber(upper)}`);
  }

  return {
    centers,
    frequencies,
    labels,
    binWidth,
    start,
    end,
  };
}

// ------------------------------------------------------------
// Draw histogram and box plot.
// ------------------------------------------------------------
function drawPlots(values, bins) {
  const stats = computeStats(values);
  const histogram = computeHistogram(values, bins);

  // Use a bar trace with explicitly calculated frequencies.
  // This avoids Plotly histogram boundary ambiguities.
  const histogramTrace = {
    type: "bar",
    x: histogram.centers,
    y: histogram.frequencies,
    width: histogram.binWidth,
    customdata: histogram.labels,
    marker: {
      color: "lightblue",
      line: { color: "white", width: 0.5 },
    },
    hovertemplate: "Bin: %{customdata}<br>" + "Frequency: %{y}<extra></extra>",
  };

  const histogramLayout = {
    title: {
      text: "Histogram",
      font: { size: 17 },
    },
    xaxis: {
      title: "Number",
      range: [histogram.start, histogram.end],
      automargin: true,
    },
    yaxis: {
      title: "Frequency",
      rangemode: "tozero",
      dtick: 1,
      automargin: true,
    },
    bargap: 0.025,
    margin: { l: 55, r: 15, t: 55, b: 55 },
    paper_bgcolor: "white",
    plot_bgcolor: "white",
    showlegend: false,
  };

  // Box plot uses the same calculated quartiles and whiskers
  // as the displayed descriptive statistics.
  const boxTrace = {
    type: "box",
    q1: [stats.q1],
    median: [stats.median],
    q3: [stats.q3],
    lowerfence: [stats.lowerWhisker],
    upperfence: [stats.upperWhisker],
    y: [values],
    boxpoints: "outliers",
    marker: { color: "black", size: 4 },
    fillcolor: "cyan",
    line: { color: "#444", width: 1.3 },
    width: 0.3,
    hoverinfo: "skip",
  };

  // Red diamond represents the arithmetic mean.
  const meanTrace = {
    type: "scatter",
    mode: "markers",
    x: [0],
    y: [stats.mean],
    marker: {
      symbol: "diamond",
      size: 10,
      color: "red",
    },
    name: "Mean",
    hovertemplate: "Mean: %{y:.3g}<extra></extra>",
  };

  const boxLayout = {
    title: {
      text: "Box Plot",
      font: { size: 17 },
    },
    xaxis: {
      range: [-0.7, 0.7],
      showticklabels: false,
      zeroline: false,
    },
    yaxis: {
      title: "Number",
      automargin: true,
    },
    margin: { l: 55, r: 15, t: 55, b: 55 },
    paper_bgcolor: "white",
    plot_bgcolor: "white",
    showlegend: false,
  };

  const config = {
    responsive: true,
    displaylogo: false,
    scrollZoom: false,
  };

  Plotly.react("histogram-chart", [histogramTrace], histogramLayout, config);

  Plotly.react("boxplot-chart", [boxTrace, meanTrace], boxLayout, config);
}

// ------------------------------------------------------------
// Update statistics and visualizations.
// ------------------------------------------------------------
function update() {
  const { values, badTokens } = parseNumbers(numbersInput.value);

  statsMessage.textContent = badTokens.length
    ? `Warning: ignored non-numeric token(s): ${badTokens.join(", ")}`
    : "";

  if (values.length === 0) {
    statsResults.replaceChildren();

    statsMessage.textContent +=
      (badTokens.length ? " " : "") + "Enter at least one numeric value.";

    Plotly.purge("histogram-chart");
    Plotly.purge("boxplot-chart");
    return;
  }

  displayStats(computeStats(values));

  drawPlots(values, Number(binsSlider.value));
}

// ------------------------------------------------------------
// Register interactions.
// ------------------------------------------------------------
updateButton.addEventListener("click", update);

binsSlider.addEventListener("input", () => {
  binsValue.value = binsSlider.value;
});

binsSlider.addEventListener("change", update);

// Initialize with the notebook's sample dataset.
numbersInput.value = INITIAL_DATA;

update();
