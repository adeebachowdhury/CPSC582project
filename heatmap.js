function drawHeatmap(data) {
  const { svg, g, innerWidth, innerHeight } = makeSVG("#heatmap-chart", 1100, 400);

  const dayOrder = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
  ];

  const heatData = d3.rollups(
    data,
    v => d3.mean(v, d => d.pool_price),
    d => dayOrder[d.date.getDay()],
    d => d.hour
  ).flatMap(([day, hours]) =>
    hours.map(([hour, avg]) => ({
      day,
      hour: +hour,
      avg: +avg
    }))
  );

  const maxAvg = d3.max(heatData, d => d.avg) || 0;

  const x = d3.scaleBand()
    .domain(d3.range(24))
    .range([0, innerWidth])
    .padding(0.03);

  const y = d3.scaleBand()
    .domain(dayOrder)
    .range([0, innerHeight])
    .padding(0.03);

const globalValues = data.map(d => d.pool_price).sort(d3.ascending);

const minScale = d3.quantile(globalValues, 0.05);
const maxScale = d3.quantile(globalValues, 0.90);
const yellowPoint = d3.median(globalValues);

const color = d3.scaleLinear()
  .domain([minScale, yellowPoint, maxScale])
  .range(["#39864d", "#fcd600", "#880000"])
  .clamp(true);

  g.selectAll(".heat-cell")
    .data(heatData)
    .enter()
    .append("rect")
    .attr("class", "heat-cell")
    .attr("x", d => x(d.hour))
    .attr("y", d => y(d.day))
    .attr("width", x.bandwidth())
    .attr("height", y.bandwidth())
    .attr("rx", 2)
    .attr("ry", 2)
    .attr("fill", d => color(d.avg))
    .attr("stroke", "#f2f2f2")
    .attr("stroke-width", 0.8)
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(`
          <strong>${d.day}</strong><br>
          Hour: ${d.hour}:00<br>
          Avg Pool Price: $${d.avg.toFixed(2)}/MWh
        `)
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 28}px`);
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
    });

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickValues(d3.range(24)))
    .call(axis => axis.selectAll("text").style("font-size", "11px"))
    .call(axis => axis.selectAll("path, line").attr("stroke", "#555"));

  g.append("g")
    .call(d3.axisLeft(y))
    .call(axis => axis.selectAll("text").style("font-size", "12px"))
    .call(axis => axis.selectAll("path, line").attr("stroke", "#555"));

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", -40)
    .attr("text-anchor", "middle")
    .attr("font-size", "18px")
    .attr("font-weight", "700")
    .text("Daily Electricity Price Patterns");

  g.append("text")
  .attr("x", innerWidth / 2)
  .attr("y",-25)
  .attr("text-anchor", "middle")
  .attr("font-size", "11px")
  .attr("fill", "#555")
  .attr("font-family","Inter, times-new-roman")
  .text("By aggregating prices across hours of the day, this heatmap reveals recurring temporal patterns, showing that higher price intensity is concentrated during");

g.append("text")
  .attr("x", innerWidth / 2)
  .attr("y", -14)
  .attr("text-anchor", "middle")
  .attr("font-size", "11px")
  .attr("fill", "#555")
  .attr("font-family","Inter, times-new-roman")
  .text("specific peak hours. Unlike the line chart, which shows individual events, this view highlights consistent daily cycles and identifies when price pressure is most likely to occur.");

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 45)
    .attr("text-anchor", "middle")
    .attr("font-size", "13px")
    .attr("font-weight", "600")
    .text("Hour of Day");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -85)
    .attr("text-anchor", "middle")
    .attr("font-size", "13px")
    .attr("font-weight", "600")
    .text("Day of Week");

  const legendWidth = 180;
  const legendHeight = 15;
  const legendX = innerWidth - legendWidth;
  const legendY = 255;

  const defs = svg.append("defs");
  const gradientId = "heatmap-legend-gradient";

  const linearGradient = defs.append("linearGradient")
    .attr("id", gradientId)
    .attr("x1", "0%")
    .attr("x2", "100%")
    .attr("y1", "0%")
    .attr("y2", "0%");

  const legendStops = d3.range(0, 1.01, 0.1);

  linearGradient.selectAll("stop")
    .data(legendStops)
    .enter()
    .append("stop")
    .attr("offset", d => `${d * 100}%`)
    .attr("stop-color", d => color(d * maxAvg));

  g.append("rect")
    .attr("x", legendX)
    .attr("y", legendY)
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("fill", `url(#${gradientId})`)
    .attr("stroke", "#ccc");

  const legendScale = d3.scaleLinear()
    .domain([0, maxAvg])
    .range([0, legendWidth]);

  g.append("g")
    .attr("transform", `translate(${legendX}, ${legendY + legendHeight})`)
    .call(d3.axisBottom(legendScale).ticks(4).tickFormat(d => `$${d3.format(".0f")(d)}`))
    .call(axis => axis.selectAll("text").style("font-size", "10px"))
    .call(axis => axis.selectAll("path, line").attr("stroke", "#666"));

  g.append("text")
    .attr("x", legendX)
    .attr("y", legendY - 8)
    .attr("font-size", "8px")
    .attr("font-weight", "600")
    .text("Average Price");
}