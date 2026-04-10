// ── Cross-chart event bus ──────────────────────────────────────────────────
window.dashSync = {
  _h: {},
  on(event, key, fn) {
    if (!this._h[event]) this._h[event] = {};
    this._h[event][key] = fn;
  },
  emit(event, data, sourceKey) {
    const h = this._h[event];
    if (!h) return;
    Object.entries(h).forEach(([k, fn]) => { if (k !== sourceKey) fn(data); });
  },
  clearAll() { this._h = {}; }
};

const monthSelect = document.getElementById("month-select");
const chartSelect = document.getElementById("chart-select");
const tooltip = d3.select("#tooltip");

let rawData = [];

d3.csv("data.csv").then(data => {
  console.log("CSV loaded:", data[0]);

  data.forEach(d => {
    // CHANGE THESE if your column names are different
    d.date = new Date(d.date);
    d.pool_price = +d.pool_price;
    d.volatility = +d.volatility;
    d.demand = +d.demand;
    d.reserve_margin = +d.reserve_margin;
    d.hour = +d.hour;
  });

  rawData = data.filter(d => !isNaN(d.date));

  const hourSlider = document.getElementById("hourFilter");
  const hourDisplay = document.getElementById("hour-display");

  hourSlider.addEventListener("input", () => {
    const v = +hourSlider.value;
    hourDisplay.textContent = v === 0 ? "All" : `${String(v).padStart(2, "0")}:00`;
    updateDashboard();
  });

  updateDashboard();

  monthSelect.addEventListener("change", updateDashboard);
  chartSelect.addEventListener("change", updateDashboard);
}).catch(err => {
  console.error("CSV loading error:", err);
});

function updateDashboard() {
  const selectedMonth = monthSelect.value;
  const selectedChart = chartSelect.value;
  const hourFilter = document.getElementById("hourFilter");
  const selectedHour = +hourFilter.value === 0 ? null : +hourFilter.value;
  
  toggleHourFilter(selectedChart);

  const filteredData = rawData.filter(d => {
    const monthName = d.date.toLocaleString("en-US", { month: "long" });
    return monthName === selectedMonth;
  });

  console.log("Selected month:", selectedMonth);
  console.log("Selected chart:", selectedChart);
  console.log("Filtered rows:", filteredData.length);

  const scatterData = selectedHour !== null
    ? rawData.filter(d => d.hour === selectedHour)
    : rawData;

  clearAllCharts();
  showSelectedChart(selectedChart);

  if (selectedChart === "overview") {
    const bothMonths = rawData.filter(d => d.date.getMonth() === 11 || d.date.getMonth() === 6);
    drawOverviewKPI(bothMonths);
    if (filteredData.length > 0) {
      drawLineChart(filteredData);
      drawHeatmap(filteredData, selectedHour);
    }
    drawReserveMarginScatter(scatterData);
    return;
  }

  if (filteredData.length === 0 && selectedChart !== "scatter") {
    d3.select(getChartSelector(selectedChart))
      .append("p")
      .text("No data found for this month.");
    return;
  }

  if (selectedChart === "line") {
    drawLineChart(filteredData);
  } else if (selectedChart === "scatter") {
    drawReserveMarginScatter(scatterData);
  } else if (selectedChart === "heatmap") {
    drawHeatmap(filteredData, selectedHour);
  }
}

function getChartSelector(chart) {
  if (chart === "line") return "#line-chart";
  if (chart === "scatter") return "#scatter-chart";
  if (chart === "heatmap") return "#heatmap-chart";
}

function showSelectedChart(selectedChart) {
  const isOverview = selectedChart === "overview";
  d3.select("#chart-area").classed("overview-mode", isOverview);
  d3.select("#overview-kpi").classed("active", isOverview);
  if (isOverview) {
    d3.selectAll(".chart-view").classed("active", true);
  } else {
    d3.select("#overview-kpi").html("");
    d3.selectAll(".chart-view").classed("active", false);
    d3.select(getChartSelector(selectedChart)).classed("active", true);
  }
}

function clearAllCharts() {
  dashSync.clearAll();
  d3.select("#line-chart").html("");
  d3.select("#scatter-chart").selectAll("svg").remove(); // preserve slider bar
  d3.select("#heatmap-chart").html("");
}

function makeSVG(containerSelector, width = 900, height = 400) {
  const margin = { top: 100, right: 40, bottom: 85, left: 120 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = d3.select(containerSelector)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  return { svg, g, width, height, margin, innerWidth, innerHeight };
}

function drawLineChart(data) {
  const FONT = "Inter, system-ui, sans-serif";

  const daily = d3.rollups(
    data,
    v => ({ avg: d3.mean(v, d => d.pool_price), vol: d3.mean(v, d => d.volatility) }),
    d => d3.timeDay(d.date)
  ).map(([date, { avg, vol }]) => ({ date, avg, vol }))
   .sort((a, b) => a.date - b.date);

  const p95 = d3.quantile(daily.map(d => d.avg).sort(d3.ascending), 0.95);

  const { svg, g, width, height, innerWidth, innerHeight } = makeSVG("#line-chart", 1600, 680);

  // SVG background
  svg.insert("rect", ":first-child")
    .attr("width", width).attr("height", height)
    .attr("fill", "#f8f9fb");

  const x = d3.scaleTime()
    .domain(d3.extent(daily, d => d.date))
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(daily, d => d.avg) * 1.1])
    .nice()
    .range([innerHeight, 0]);

  // Defs: drop shadow + clip path
  const defs = svg.append("defs");
  defs.append("filter").attr("id", "line-shadow")
    .attr("x", "-4%").attr("y", "-4%").attr("width", "108%").attr("height", "108%")
    .append("feDropShadow")
    .attr("dx", 0).attr("dy", 2).attr("stdDeviation", 4)
    .attr("flood-color", "#00000012");

  defs.append("clipPath").attr("id", "line-clip")
    .append("rect").attr("width", innerWidth).attr("height", innerHeight);

  // Plot area background
  g.append("rect")
    .attr("width", innerWidth).attr("height", innerHeight)
    .attr("fill", "#ffffff")
    .attr("stroke", "#000000").attr("stroke-width", 1)
    .attr("rx", 8).attr("filter", "url(#line-shadow)");

  // Y grid lines
  g.append("g")
    .call(d3.axisLeft(y).ticks(6).tickSize(-innerWidth).tickFormat(""))
    .call(a => a.selectAll("line").attr("stroke", "#f1f5f9").attr("stroke-width", 1))
    .call(a => a.select(".domain").remove());

  // X grid lines
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(d3.timeDay.every(3)).tickSize(-innerHeight).tickFormat(""))
    .call(a => a.selectAll("line").attr("stroke", "#f1f5f9").attr("stroke-width", 1))
    .call(a => a.select(".domain").remove());

  // P95 zone
  g.append("rect")
    .attr("clip-path", "url(#line-clip)")
    .attr("x", 0).attr("y", 0)
    .attr("width", innerWidth).attr("height", y(p95))
    .attr("fill", "#fcc740").attr("opacity", 0.6);

  // P95 threshold line
  g.append("line")
    .attr("clip-path", "url(#line-clip)")
    .attr("x1", 0).attr("x2", innerWidth)
    .attr("y1", y(p95)).attr("y2", y(p95))
    .attr("stroke", "#dc2626").attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "7,4").attr("opacity", 0.85);

  // Line path
  g.append("path")
    .attr("clip-path", "url(#line-clip)")
    .datum(daily)
    .attr("fill", "none")
    .attr("stroke", "#00268d").attr("stroke-width", 2.5)
    .attr("stroke-linejoin", "round").attr("stroke-linecap", "round")
    .attr("d", d3.line().x(d => x(d.date)).y(d => y(d.avg)));

  // Dots (static — hover handled by overlay bisector below)
  g.selectAll("circle")
    .data(daily).enter().append("circle")
    .attr("clip-path", "url(#line-clip)")
    .attr("cx", d => x(d.date)).attr("cy", d => y(d.avg)).attr("r", 4)
    .attr("fill", d => d.avg > p95 ? "#dc2626" : "#1d4ed8")
    .attr("stroke", "#000000").attr("stroke-width", 1);

  // ── Bisector crosshair overlay ────────────────────────────────────────────
  const bisect = d3.bisector(d => d.date).left;

  const xhair = g.append("g").attr("display", "none").attr("pointer-events", "none");
  const vLine = xhair.append("line")
    .attr("y1", 0).attr("y2", innerHeight)
    .attr("stroke", "#94a3b8").attr("stroke-width", 1).attr("stroke-dasharray", "5,3");
  const hLine = xhair.append("line")
    .attr("x1", 0).attr("x2", innerWidth)
    .attr("stroke", "#94a3b8").attr("stroke-width", 1).attr("stroke-dasharray", "5,3");
  const focusRing = xhair.append("circle")
    .attr("r", 7).attr("fill", "none").attr("stroke", "#1e293b").attr("stroke-width", 2);
  const yTag = xhair.append("g");
  yTag.append("rect").attr("x", -110).attr("y", -11).attr("width", 104).attr("height", 22)
    .attr("rx", 4).attr("fill", "#1e293b");
  const yTagText = yTag.append("text").attr("x", -58).attr("y", 4)
    .attr("text-anchor", "middle")
    .attr("fill", "#ffffff").attr("font-size", "11px").attr("font-family", FONT);
  const xTag = xhair.append("g");
  xTag.append("rect").attr("y", innerHeight + 2).attr("width", 72).attr("height", 22)
    .attr("rx", 4).attr("fill", "#1e293b");
  const xTagText = xTag.append("text").attr("y", innerHeight + 16)
    .attr("text-anchor", "middle")
    .attr("fill", "#ffffff").attr("font-size", "11px").attr("font-family", FONT);

  // Shared snap function — used by own mousemove AND external dashSync
  function snapCrosshair(d) {
    const cx = x(d.date), cy = y(d.avg), isSpike = d.avg > p95;
    xhair.attr("display", null);
    vLine.attr("x1", cx).attr("x2", cx);
    hLine.attr("y1", cy).attr("y2", cy);
    focusRing.attr("cx", cx).attr("cy", cy)
      .attr("stroke", isSpike ? "#dc2626" : "#1e293b");
    yTag.attr("transform", `translate(0,${cy})`);
    yTagText.text(`$${d.avg.toFixed(2)}`);
    xTag.attr("transform", `translate(${cx - 36},0)`);
    xTagText.attr("x", 36).text(d3.timeFormat("%b %d")(d.date));
  }

  // React to scatter hover: snap crosshair to nearest daily point for that date
  dashSync.on("hover:date", "line", (date) => {
    const i = bisect(daily, date, 1);
    const d0 = daily[Math.max(0, i - 1)];
    const d1 = daily[Math.min(i, daily.length - 1)];
    if (!d0) return;
    snapCrosshair((!d1 || (date - d0.date < d1.date - date)) ? d0 : d1);
  });
  dashSync.on("clear", "line", () => xhair.attr("display", "none"));

  // Transparent overlay for mouse events
  g.append("rect")
    .attr("width", innerWidth).attr("height", innerHeight)
    .attr("fill", "none").attr("pointer-events", "all")
    .on("mousemove", function(event) {
      const [mx] = d3.pointer(event);
      const date0 = x.invert(mx);
      const i = bisect(daily, date0, 1);
      if (i >= daily.length) return;
      const d0 = daily[i - 1], d1 = daily[i];
      const d = !d1 || (date0 - d0.date < d1.date - date0) ? d0 : d1;
      snapCrosshair(d);
      dashSync.emit("hover:date", d.date, "line");
      const isSpike = d.avg > p95;
      tooltip.style("opacity", 1)
        .html(`<strong style="color:#1e293b">${d3.timeFormat("%B %d")(d.date)}</strong><br>
               <span style="color:#64748b">Avg Price</span> &nbsp;<strong style="color:${isSpike ? "#dc2626" : "#1e293b"}">$${d.avg.toFixed(2)}</strong>/MWh<br>
               <span style="color:#64748b">Volatility</span> &nbsp;<strong style="color:#1e293b">${d.vol.toFixed(2)}</strong>`
               + (isSpike ? `<br><span style="color:#dc2626;font-size:11px">&#9650; Above 95th percentile</span>` : ""))
        .style("left", `${event.pageX + 14}px`)
        .style("top", `${event.pageY - 36}px`);
    })
    .on("mouseleave", function() {
      xhair.attr("display", "none");
      tooltip.style("opacity", 0);
      dashSync.emit("clear", null, "line");
    });

  // X axis
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(d3.timeDay.every(3)).tickFormat(d3.timeFormat("%b %d")))
    .call(a => a.select(".domain").remove())
    .call(a => a.selectAll(".tick line").attr("stroke", "#cbd5e1"))
    .call(a => a.selectAll(".tick text").attr("font-size", "12px").attr("fill", "#64748b").attr("font-family", FONT));

  // Y axis
  g.append("g")
    .call(d3.axisLeft(y))
    .call(a => a.select(".domain").remove())
    .call(a => a.selectAll(".tick line").attr("stroke", "#cbd5e1"))
    .call(a => a.selectAll(".tick text").attr("font-size", "12px").attr("fill", "#64748b").attr("font-family", FONT));

  // Title
  g.append("text")
    .attr("x", innerWidth / 2).attr("y", -52)
    .attr("text-anchor", "middle")
    .attr("font-size", "22px").attr("font-weight", "700")
    .attr("fill", "#1e293b").attr("font-family", FONT)
    .text("Average Daily Pool Price Over Time");

  // Subtitle
  g.append("text")
    .attr("x", innerWidth / 2).attr("y", -32)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px").attr("fill", "#64748b").attr("font-family", FONT)
    .text("This chart highlights when price spikes occur over time, showing that electricity prices remain stable for most hours but occasionally experience sharp, short-lived increases.");

  g.append("text")
    .attr("x", innerWidth / 2).attr("y", -18)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px").attr("fill", "#64748b").attr("font-family", FONT)
    .text("These spikes are not random—they tend to cluster during specific periods, indicating moments of system stress rather than continuous volatility.");

  // Axis labels
  g.append("text")
    .attr("x", innerWidth / 2).attr("y", innerHeight + 45)
    .attr("text-anchor", "middle")
    .attr("font-size", "14px").attr("font-weight", "600").attr("fill", "#475569").attr("font-family", FONT)
    .text("Date");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2).attr("y", -65)
    .attr("text-anchor", "middle")
    .attr("font-size", "14px").attr("font-weight", "600").attr("fill", "#475569").attr("font-family", FONT)
    .text("Average Pool Price ($/MWh)");

  // P95 annotation
  g.append("text")
    .attr("x", innerWidth - 10).attr("y", y(p95) - 8)
    .attr("text-anchor", "end")
    .attr("font-size", "11px").attr("font-weight", "600")
    .attr("fill", "#dc2626").attr("font-family", FONT)
    .text("95th percentile threshold");
}

function populateHourFilter() {
  // Slider is pre-configured in HTML (min=0, max=24); nothing to populate.
}
function toggleHourFilter(selectedChart) {
  // Slider is now inside #scatter-chart and shows/hides with it automatically.
  // Only need to hide the month selector when scatter is selected alone.
  const monthLabel  = document.querySelector('label[for="month-select"]');
  const monthSelect = document.getElementById("month-select");
  const isScatter   = selectedChart === "scatter";
  monthLabel.style.display  = isScatter ? "none" : "";
  monthSelect.style.display = isScatter ? "none" : "";
}

function drawOverviewKPI(data) {
  const dec = data.filter(d => d.date.getMonth() === 11);
  const jul = data.filter(d => d.date.getMonth() === 6);

  const avgDecPrice = d3.mean(dec, d => d.pool_price);
  const avgJulPrice = d3.mean(jul, d => d.pool_price);
  const priceDiff   = ((avgJulPrice - avgDecPrice) / avgDecPrice * 100);

  const allPrices = data.map(d => d.pool_price).sort(d3.ascending);
  const p95        = d3.quantile(allPrices, 0.95);
  const spikeCount = data.filter(d => d.pool_price > p95).length;
  const spikePct   = (spikeCount / data.length * 100).toFixed(1);

  const peakDemand    = d3.max(data, d => d.demand);
  const avgDemand     = d3.mean(data, d => d.demand);

  const avgLerner     = d3.mean(data, d => d.lerner_index);
  const highLernerPct = (data.filter(d => d.lerner_index > 0.5).length / data.length * 100).toFixed(1);

  const diffLabel = `${priceDiff >= 0 ? "+" : ""}${priceDiff.toFixed(0)}% Jul vs Dec`;
  const diffColor = priceDiff >= 0 ? "#dc2626" : "#16a34a";
  const diffBg    = priceDiff >= 0 ? "#fef2f2" : "#f0fdf4";

  const kpi = d3.select("#overview-kpi").html("");

  // Card 1 — Pool Price comparison
  const c1 = kpi.append("div").attr("class", "kpi-card");
  c1.append("div").attr("class", "kpi-label").text("Avg Pool Price");
  const cmp = c1.append("div").attr("class", "kpi-compare");
  const dec_ = cmp.append("div").attr("class", "kpi-compare-item");
  dec_.append("div").attr("class", "kpi-compare-val")
    .style("color", "#1d4ed8").text(`$${avgDecPrice.toFixed(2)}`);
  dec_.append("div").attr("class", "kpi-compare-lbl").text("December");
  const jul_ = cmp.append("div").attr("class", "kpi-compare-item");
  jul_.append("div").attr("class", "kpi-compare-val")
    .style("color", "#ea580c").text(`$${avgJulPrice.toFixed(2)}`);
  jul_.append("div").attr("class", "kpi-compare-lbl").text("July");
  c1.append("div").attr("class", "kpi-badge")
    .style("background", diffBg).style("color", diffColor)
    .text(diffLabel);

  // Card 2 — Price Spikes
  const c2 = kpi.append("div").attr("class", "kpi-card");
  c2.append("div").attr("class", "kpi-label").text("Price Spikes");
  c2.append("div").attr("class", "kpi-main")
    .style("color", "#dc2626").text(spikeCount.toLocaleString());
  c2.append("div").attr("class", "kpi-unit").text("hours above 95th percentile");
  c2.append("div").attr("class", "kpi-sub").text(`${spikePct}% of all observed hours`);

  // Card 3 — Demand
  const c3 = kpi.append("div").attr("class", "kpi-card");
  c3.append("div").attr("class", "kpi-label").text("Electricity Demand");
  c3.append("div").attr("class", "kpi-main")
    .style("color", "#0f766e").text(d3.format(",d")(peakDemand));
  c3.append("div").attr("class", "kpi-unit").text("MW peak observed");
  c3.append("div").attr("class", "kpi-sub")
    .text(`Avg ${d3.format(",d")(Math.round(avgDemand))} MW across all hours`);

  // Card 4 — Market Power
  const c4 = kpi.append("div").attr("class", "kpi-card");
  c4.append("div").attr("class", "kpi-label").text("Market Power (Lerner Index)");
  c4.append("div").attr("class", "kpi-main")
    .style("color", "#7c3aed").text(avgLerner.toFixed(3));
  c4.append("div").attr("class", "kpi-unit").text("average across all hours");
  c4.append("div").attr("class", "kpi-sub")
    .text(`${highLernerPct}% of hours with Lerner > 0.5`);
}
