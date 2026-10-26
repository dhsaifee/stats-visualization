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
// Parse user-entered observations.
// Accept commas, spaces, tabs, and newlines as separators.
// Invalid entries are ignored and reported to the user.
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
// Compute percentiles using NumPy's default "linear" method.
// The position is (n - 1) * p, with interpolation between
// neighboring sorted observations when necessary.
// ------------------------------------------------------------
function percentile(sorted, p) {
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const fraction = position - lower;

  return sorted[lower] + fraction * (sorted[upper] - sorted[lower]);
}

// ------------------------------------------------------------
// Calculate the nine statistics.
// Population standard deviation divides by n, not n - 1.
// Tukey whiskers are the most extreme observed values
// within the 1.5 * IQR fences, not the fences themselves.
// ------------------------------------------------------------
function computeStats(values) {
  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);

  const mean = values.reduce((sum, x) => sum + x, 0) / n;
  const median = percentile(sorted, 0.5);

  const variance = values.reduce((sum, x) => sum + (x - mean) ** 2, 0) / n;

  const std = Math.sqrt(variance);
  const q1 = percentile(sorted, 0.25);
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
// Format numbers to three significant digits.
// ------------------------------------------------------------
function formatNumber(value) {
  return Number(value.toPrecision(3)).toString();
}

// ------------------------------------------------------------
// Use textContent so user inputs cannot inject HTML.
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
// Draw the histogram and box plot.
// Plotly handles rendering, zooming, and responsive resizing.
// ------------------------------------------------------------
function drawPlots(values, bins) {
  const sorted = [...values].sort((a, b) => a - b);
  const stats = computeStats(values);

  // Histogram: equal-width bins, matching the notebook's
  // requested number of bins and approximate bar spacing.
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  // A constant dataset needs a nonzero plotting interval.
  const start = min === max ? min - 0.5 : min;
  const end = min === max ? max + 0.5 : max;
  const binSize = (end - start) / bins;

  const histogramTrace = {
    type: "histogram",
    x: values,
    xbins: {
      start,
      end,
      size: binSize,
    },
    marker: {
      color: "lightblue",
      line: { color: "white", width: 0.5 },
    },
    autobinx: false,
    hovertemplate: "Number: %{x}<br>Frequency: %{y}<extra></extra>",
  };

  const histogramLayout = {
    title: { text: "Histogram", font: { size: 17 } },
    xaxis: { title: "Number", automargin: true },
    yaxis: { title: "Frequency", automargin: true },
    bargap: 0.025,
    margin: { l: 55, r: 15, t: 55, b: 55 },
    paper_bgcolor: "white",
    plot_bgcolor: "white",
    showlegend: false,
  };

  // Box plot: use our computed quartiles and Tukey whiskers
  // so the chart agrees with the displayed statistics.
  const outliers = values.filter(
    (x) => x < stats.lowerWhisker || x > stats.upperWhisker,
  );

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

  // Separate red diamond marker for the mean.
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
    title: { text: "Box Plot", font: { size: 17 } },
    xaxis: {
      range: [-0.7, 0.7],
      showticklabels: false,
      zeroline: false,
    },
    yaxis: { title: "Number", automargin: true },
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
// Update the application.
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

    // Clear outdated charts when no valid observations remain.
    Plotly.purge("histogram-chart");
    Plotly.purge("boxplot-chart");
    return;
  }

  displayStats(computeStats(values));

  // Redraw both charts using the current observations and bins.
  drawPlots(values, Number(binsSlider.value));
}

// ------------------------------------------------------------
// Register interactions.
// The Update button recalculates statistics.
// The slider displays its current number of bins.
// ------------------------------------------------------------
updateButton.addEventListener("click", update);

binsSlider.addEventListener("input", () => {
  binsValue.value = binsSlider.value;
});

binsSlider.addEventListener("change", update);

// Initialize the application with the sample dataset.
numbersInput.value = INITIAL_DATA;

update();
