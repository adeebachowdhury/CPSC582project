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
    d.reserve_margin = +d.reserve_margin;
    d.hour = +d.hour;
  });

  rawData = data.filter(d => !isNaN(d.date));
  populateHourFilter();
document.getElementById("hourFilter").addEventListener("change", updateDashboard);

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
  const selectedHours = Array.from(hourFilter.selectedOptions).map(opt => +opt.value);
  
  toggleHourFilter(selectedChart);

  const filteredData = rawData.filter(d => {
    const monthName = d.date.toLocaleString("en-US", { month: "long" });
    return monthName === selectedMonth;
  });

  console.log("Selected month:", selectedMonth);
  console.log("Selected chart:", selectedChart);
  console.log("Filtered rows:", filteredData.length);

  clearAllCharts();
  showSelectedChart(selectedChart);

  if (filteredData.length === 0 && selectedChart !== "scatter") {
    d3.select(getChartSelector(selectedChart))
      .append("p")
      .text("No data found for this month.");
    return;
  }

  if (selectedChart === "line") {
    drawLineChart(filteredData);
  }  else if (selectedChart === "scatter") {
  let scatterData = rawData;
  if (selectedHours.length > 0) {
    scatterData = rawData.filter(d => selectedHours.includes(d.hour));
  }
  drawReserveMarginScatter(scatterData);
  } else if (selectedChart === "heatmap") {
    drawHeatmap(filteredData);
  }
}

function getChartSelector(chart) {
  if (chart === "line") return "#line-chart";
  if (chart === "scatter") return "#scatter-chart";
  if (chart === "heatmap") return "#heatmap-chart";
}

function showSelectedChart(selectedChart) {
  d3.selectAll(".chart-view").classed("active", false);
  d3.select(getChartSelector(selectedChart)).classed("active", true);
}

function clearAllCharts() {
  d3.select("#line-chart").html("");
  d3.select("#scatter-chart").html("");
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
  const daily = d3.rollups(
    data,
    v => d3.mean(v, d => d.pool_price),
    d => d3.timeDay(d.date)
  ).map(([date, avg]) => ({ date, avg }))
   .sort((a, b) => a.date - b.date);

  const p95 = d3.quantile(daily.map(d => d.avg).sort(d3.ascending), 0.95);

  const { g, innerWidth, innerHeight } = makeSVG("#line-chart");

  const x = d3.scaleTime()
    .domain(d3.extent(daily, d => d.date))
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(daily, d => d.avg) * 1.1])
    .nice()
    .range([innerHeight, 0]);

  g.append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", innerWidth)
    .attr("height", y(p95))
    .attr("fill", "#efca7a")
    .attr("opacity", 0.65);

  g.append("line")
    .attr("x1", 0)
    .attr("x2", innerWidth)
    .attr("y1", y(p95))
    .attr("y2", y(p95))
    .attr("stroke", "#b02828")
    .attr("stroke-dasharray", "6,4");

  g.append("path")
    .datum(daily)
    .attr("fill", "none")
    .attr("stroke", "#123b6d")
    .attr("stroke-width", 2)
    .attr("d", d3.line()
      .x(d => x(d.date))
      .y(d => y(d.avg))
    );

  g.selectAll("circle")
    .data(daily)
    .enter()
    .append("circle")
    .attr("cx", d => x(d.date))
    .attr("cy", d => y(d.avg))
    .attr("r", 2.5)
    .attr("fill", d => d.avg > p95 ? "#ba0202" : "#1f3b73")
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(`
          <strong>${d3.timeFormat("%b %d")(d.date)}</strong><br>
          Avg Price: ${d.avg.toFixed(2)}
        `)
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 28}px`);
    })
    .on("mouseleave", () => tooltip.style("opacity", 0));

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(d3.timeDay.every(3)).tickFormat(d3.timeFormat("%b %d")));

  g.append("g")
    .call(d3.axisLeft(y));

g.append("text")
  .attr("x", innerWidth / 2)
  .attr("y", -40)
  .attr("text-anchor", "middle")
  .attr("font-size", "20px")
  .attr("font-weight", "bold")
  .text("Average Daily Pool Price Over Time");

g.append("text")
  .attr("x", innerWidth / 2)
  .attr("y", -10)
  .attr("text-anchor", "middle")
  .attr("font-size", "10px")
  .attr("fill", "#555")
  .attr("font-family","Inter, times-new-roman")
  .text("This chart highlights when price spikes occur over time, showing that electricity prices remain stable for most hours but occasionally experience sharp, short-lived increases,");
g.append("text")
  .attr("x", innerWidth / 2)
  .attr("y", -25)
  .attr("text-anchor", "middle")
  .attr("font-size", "10px")
  .attr("fill", "#555")
  .attr("font-family","Inter, times-new-roman")
  .text("These spikes are not random—they tend to cluster during specific periods, indicating moments of system stress rather than continuous volatility.");

  g.append("text")
  .attr("x", innerWidth / 2)
  .attr("y", innerHeight + 30)
  .attr("text-anchor", "middle")
  .attr("font-size", "13px")
  .text("Date");

g.append("text")
  .attr("transform", "rotate(-90)")
  .attr("x", -innerHeight / 2)
  .attr("y", -50)
  .attr("text-anchor", "middle")
  .attr("font-size", "13px")
  .text("Average Pool Price ($/MWh)");

g.append("text")
  .attr("x", innerWidth - 10)
  .attr("y", y(p95) - 10)
  .attr("text-anchor", "end")
  .style("font-size", "12px")
  .style("fill", "#d62728")
  .text("95th percentile threshold");
}

function populateHourFilter() {
  const hourFilter = document.getElementById("hourFilter");
  hourFilter.innerHTML = "";

  for (let h = 0; h < 24; h++) {
    const option = document.createElement("option");
    option.value = h;
    option.textContent = `${String(h).padStart(2, "0")}:00`;
    hourFilter.appendChild(option);
  }
}
function toggleHourFilter(selectedChart) {
  const hourLabel = document.getElementById("hour-label");
  const hourFilter = document.getElementById("hourFilter");

  if (selectedChart === "scatter") {
    hourLabel.style.display = "inline-block";
    hourFilter.style.display = "inline-block";
  } else {
    hourLabel.style.display = "none";
    hourFilter.style.display = "none";
  }
}
