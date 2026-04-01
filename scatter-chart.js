function drawReserveMarginScatter(data) {
  d3.select("#scatter-chart").html("");

  // Use the SAME svg pattern as your working charts
  const { svg, g, width, height, margin, innerWidth, innerHeight } =
    makeSVG("#scatter-chart", 1600, 760);

  const panelGap = 70;
  const panelWidth = (innerWidth - panelGap) / 2;
  const panelHeight = innerHeight;

  // ---------- title ----------
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", 25)
    .attr("text-anchor", "middle")
    .attr("font-size", "28px")
    .attr("font-weight", "700")
    .text("Reserve Margin vs Pool Price");

g.append("text")
  .attr("x", innerWidth / 2)
  .attr("y",-42)
  .attr("text-anchor", "middle")
  .attr("font-size", "11px")
  .attr("fill", "#555")
  .attr("font-family","Inter, times-new-roman")
  .text("This chart explains why price spikes occur by illustrating the relationship between reserve margin and price. An inverse relationship emerges, where lower reserve margins—indicating tighter");

g.append("text")
  .attr("x", innerWidth / 2)
  .attr("y", -54)
  .attr("text-anchor", "middle")
  .attr("font-size", "11px")
  .attr("fill", "#555")
  .attr("font-family","Inter, times-new-roman")
  .text("supply conditions—are associated with significantly higher prices, particularly in July. This demonstrates that extreme price events are driven by scarcity rather than randomness.");

  // ---------- parse ----------
  const parsed = data.map(d => {
    const date = d.date instanceof Date ? d.date : new Date(d.date);
    const monthName = !isNaN(date)
      ? date.toLocaleString("en-US", { month: "long" })
      : "";

    return {
      ...d,
      date,
      monthName,
      pool_price: +d.pool_price,
      reserve_margin: +d.reserve_margin,
      lerner_index: +d.lerner_index,
      hour: +d.hour,
      price_spike:
        d.price_spike === 1 ||
        d.price_spike === "1" ||
        d.price_spike === true ||
        d.price_spike === "true"
    };
  }).filter(d =>
    !isNaN(d.date) &&
    !isNaN(d.pool_price) &&
    !isNaN(d.reserve_margin) &&
    !isNaN(d.lerner_index) &&
    (d.monthName === "December" || d.monthName === "July")
  );

  const decData = parsed.filter(d => d.monthName === "December");
  const julData = parsed.filter(d => d.monthName === "July");
  const allData = [...decData, ...julData];

  if (!allData.length) {
    g.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight / 2)
      .attr("text-anchor", "middle")
      .attr("font-size", "18px")
      .attr("fill", "#666")
      .text("No valid December or July data found.");
    return;
  }

  // ---------- shared scales ----------
  const xExtent = d3.extent(allData, d => d.reserve_margin);
  const yExtent = d3.extent(allData, d => d.pool_price);
  const lernerExtent = d3.extent(allData, d => d.lerner_index);

  const xPad = (xExtent[1] - xExtent[0]) * 0.04;
  const yPad = (yExtent[1] - yExtent[0]) * 0.06;

  const x = d3.scaleLinear()
    .domain([xExtent[0] - xPad, xExtent[1] + xPad])
    .nice()
    .range([0, panelWidth]);

  const yDecExtent = d3.extent(decData, d => d.pool_price);
  const yJulExtent = d3.extent(julData, d => d.pool_price);

  const yDec = d3.scaleLinear()
   .domain([0, yDecExtent[1] * 1.1])
   .nice()
   .range([panelHeight, 0]);

  const yJul = d3.scaleLinear()
   .domain([0, yJulExtent[1] * 1.1])
   .nice()
   .range([panelHeight, 0]);

  const color = d3.scaleSequential()
    .domain(lernerExtent)
    .interpolator(d3.interpolateGnBu);

  const tooltip = d3.select("body")
    .selectAll(".scatter-tooltip")
    .data([null])
    .join("div")
    .attr("class", "scatter-tooltip")
    .style("position", "absolute")
    .style("background", "rgba(255,255,255,0.98)")
    .style("border", "1px solid #ccc")
    .style("border-radius", "8px")
    .style("padding", "10px 12px")
    .style("font-size", "60px")
    .style("line-height", "1.4")
    .style("pointer-events", "none")
    .style("opacity", 0)
    .style("box-shadow", "0 4px 14px rgba(0,0,0,0.12)");

  function getRegressionLine(data) {
  const n = data.length;

  const sumX = d3.sum(data, d => d.reserve_margin);
  const sumY = d3.sum(data, d => d.pool_price);
  const sumXY = d3.sum(data, d => d.reserve_margin * d.pool_price);
  const sumX2 = d3.sum(data, d => d.reserve_margin * d.reserve_margin);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const xMin = x.domain()[0];
  const xMax = x.domain()[1];

  return [
    { x: xMin, y: slope * xMin + intercept },
    { x: xMax, y: slope * xMax + intercept }
  ];
}
const lineGenerator = d3.line()
  .x(d => x(d.x))
  .y(d => yScale(d.y)); // we'll override yScale inside panel

  function drawPanel(panelData, xOffset, label, yScale) {
    const panel = g.append("g")
      .attr("transform", `translate(${xOffset},0)`);

    panel.append("text")
      .attr("x", panelWidth / 2)
      .attr("y", -18)
      .attr("text-anchor", "middle")
      .attr("font-size", "18px")
      .attr("font-weight", "600")
      .text(label);

    panel.append("rect")
      .attr("width", panelWidth)
      .attr("height", panelHeight)
      .attr("fill", "#fafafa")
      .attr("stroke", "#d9d9d9")
      .attr("rx", 4);

    panel.append("g")
      .call(
        d3.axisLeft(yScale)
          .ticks(6)
          .tickSize(-panelWidth)
          .tickFormat("")
      )
      .call(g => g.selectAll("line").attr("stroke", "#e6e6e6"))
      .call(g => g.select(".domain").remove());

    panel.append("g")
      .call(d3.axisLeft(yScale).ticks(6))
      .call(g => g.selectAll("text").attr("font-size", "14px"))
      .call(g => g.selectAll("line").attr("stroke", "#999"))
      .call(g => g.select(".domain").attr("stroke", "#999"));

    panel.append("g")
      .attr("transform", `translate(0,${panelHeight})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format(".2f")))
      .call(g => g.selectAll("text").attr("font-size", "14px"))
      .call(g => g.selectAll("line").attr("stroke", "#999"))
      .call(g => g.select(".domain").attr("stroke", "#999"));

    panel.selectAll("circle")
      .data(panelData)
      .enter()
      .append("circle")
      .attr("cx", d => x(d.reserve_margin) + (Math.random() - 0.5) * 6)
      .attr("cy", d => yScale(d.pool_price))
      .attr("r", d => d.price_spike ? 7 : 6)
      .attr("fill", d => d.price_spike ? "#305ceb" : color(d.lerner_index))
      .attr("stroke", d => d.price_spike ? "#a4161a" : "#333")
      .attr("stroke-width", d => d.price_spike ? 1 : 0.5)
      .attr("opacity", 0.82)
      .on("mouseover", function(event, d) {
        d3.select(this)
          .attr("r", d.price_spike ? 3 : 1)
          .attr("opacity", 1);

        tooltip
          .style("opacity", 1)
          .html(`
            <strong>${label}</strong><br>
            <strong>Date:</strong> ${d3.timeFormat("%b %d")(d.date)}<br>
            <strong>Hour:</strong> ${d.hour}:00<br>
            <strong>Pool Price:</strong> $${d.pool_price.toFixed(2)}/MWh<br>
            <strong>Reserve Margin:</strong> ${d.reserve_margin.toFixed(3)}<br>
            <strong>Lerner Index:</strong> ${d.lerner_index.toFixed(3)}<br>
            <strong>Spike:</strong> ${d.price_spike ? "Yes" : "No"}
          `);
      })
      .on("mousemove", function(event) {
        tooltip
          .style("left", `${event.pageX + 14}px`)
          .style("top", `${event.pageY - 28}px`);
      })
      .on("mouseout", function(event, d) {
        d3.select(this)
          .attr("r", d.price_spike ? 9 : 3)
          .attr("opacity", 0.82);
        tooltip.style("opacity", 0.65);
      });
      const regressionPoints = getRegressionLine(panelData);

const line = d3.line()
  .x(d => x(d.x))
  .y(d => yScale(d.y));

panel.append("path")
  .datum(regressionPoints)
  .attr("fill", "none")
  .attr("stroke", "#6b6060")
  .attr("stroke-width", 1.5)
  .attr("stroke-dasharray", "6,4")
  .attr("opacity", 0.9)
  .attr("d", line);
  }

  drawPanel(decData, 0, "December", yDec);
  drawPanel(julData, panelWidth + panelGap, "July", yJul);

  // ---------- shared axis labels ----------
  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 55)
    .attr("text-anchor", "middle")
    .attr("font-size", "18px")
    .attr("font-weight", "500")
    .text("Reserve Margin");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -55)
    .attr("text-anchor", "middle")
    .attr("font-size", "18px")
    .attr("font-weight", "500")
    .text("Pool Price ($/MWh)");

  // ---------- legend ----------
  const legendX = innerWidth -200;
  const legendY = -60;
  const legendWidth = 200;
  const legendHeight = 12;

  const defs = svg.append("defs");
  const gradient = defs.append("linearGradient")
    .attr("id", "lerner-gradient")
    .attr("x1", "0%")
    .attr("x2", "100%")
    .attr("y1", "0%")
    .attr("y2", "0%");

  gradient.selectAll("stop")
    .data([
      { offset: "0%", color: color(lernerExtent[0]) },
      { offset: "50%", color: color((lernerExtent[0] + lernerExtent[1]) / 2) },
      { offset: "100%", color: color(lernerExtent[1]) }
    ])
    .enter()
    .append("stop")
    .attr("offset", d => d.offset)
    .attr("stop-color", d => d.color);

  g.append("text")
    .attr("x", legendX)
    .attr("y", legendY)
    .attr("font-size", "14px")
    .attr("font-weight", "600")
    .text("Lerner Index");

  g.append("rect")
    .attr("x", legendX)
    .attr("y", legendY + 8)
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("fill", "url(#lerner-gradient)")
    .attr("stroke", "#868686");

  const legendScale = d3.scaleLinear()
    .domain(lernerExtent)
    .range([0, legendWidth]);

  g.append("g")
    .attr("transform", `translate(${legendX}, ${legendY + 20})`)
    .call(d3.axisBottom(legendScale).ticks(3).tickFormat(d3.format(".2f")))
    .call(g => g.selectAll("text").attr("font-size", "11px"));
}