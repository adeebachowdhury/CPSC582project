function drawHeatmap(data, highlightHour = null) {
  const FONT = "Inter, system-ui, sans-serif";

  const { svg, g, width, height, innerWidth, innerHeight } =
    makeSVG("#heatmap-chart", 1400, 520);

  const dayOrder = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  const heatData = d3.rollups(
    data,
    v => d3.mean(v, d => d.demand),
    d => dayOrder[d.date.getDay()],
    d => d.hour
  ).flatMap(([day, hours]) =>
    hours.map(([hour, avg]) => ({ day, hour: +hour, avg: +avg }))
  );

  const x = d3.scaleBand().domain(d3.range(1, 25)).range([0, innerWidth]).padding(0.05);
  const y = d3.scaleBand().domain(dayOrder).range([0, innerHeight]).padding(0.05);

  const globalValues = data.map(d => d.demand).filter(v => !isNaN(v) && v > 0).sort(d3.ascending);
  const minScale    = d3.quantile(globalValues, 0.05);
  const maxScale    = d3.quantile(globalValues, 0.90);
  const yellowPoint = d3.median(globalValues);

  const color = d3.scaleLinear()
    .domain([minScale, yellowPoint, maxScale])
    .range(["#39864d", "#fcd600", "#880000"])
    .clamp(true);

  // ── SVG background ─────────────────────────────────────────────────────────
  svg.insert("rect", ":first-child")
    .attr("width", width).attr("height", height)
    .attr("fill", "#f8f9fb");

  // ── Defs: shadow ───────────────────────────────────────────────────────────
  const defs = svg.append("defs");
  defs.append("filter").attr("id", "heat-shadow")
    .attr("x", "-4%").attr("y", "-4%").attr("width", "108%").attr("height", "108%")
    .append("feDropShadow")
    .attr("dx", 0).attr("dy", 2).attr("stdDeviation", 4)
    .attr("flood-color", "#00000012");

  // ── Plot area background ───────────────────────────────────────────────────
  g.append("rect")
    .attr("width", innerWidth).attr("height", innerHeight)
    .attr("fill", "#ffffff")
    .attr("stroke", "#000000").attr("stroke-width", 1)
    .attr("rx", 8).attr("filter", "url(#heat-shadow)");

  // ── Shared reset: restores base state respecting highlightHour ────────────
  function resetCells() {
    g.selectAll(".heat-cell")
      .style("opacity", d => (highlightHour === null || d.hour === highlightHour) ? 1 : 0.12)
      .attr("stroke", "#000000")
      .attr("stroke-width", 0.6);
    g.selectAll(".x-tick-text")
      .attr("fill", d => (highlightHour === null || d === highlightHour) ? "#64748b" : "#cbd5e1")
      .attr("font-weight", d => (highlightHour !== null && d === highlightHour) ? "700" : "400");
    g.selectAll(".y-tick-text")
      .attr("fill", "#64748b")
      .attr("font-weight", "400");
  }

  // ── Heat cells ─────────────────────────────────────────────────────────────
  g.selectAll(".heat-cell")
    .data(heatData).enter().append("rect")
    .attr("class", "heat-cell")
    .attr("x", d => x(d.hour))
    .attr("y", d => y(d.day))
    .attr("width", x.bandwidth())
    .attr("height", y.bandwidth())
    .attr("rx", 3).attr("ry", 3)
    .attr("fill", d => color(d.avg))
    .attr("stroke", "#000000").attr("stroke-width", 0.6)
    .style("transition", "opacity 80ms, stroke-width 80ms")
    .on("mousemove", function(event, d) {
      // Dim / highlight cells (respect highlightHour for out-of-filter cells)
      g.selectAll(".heat-cell")
        .style("opacity", c => {
          if (c.day === d.day || c.hour === d.hour) return 1;
          return (highlightHour === null || c.hour === highlightHour) ? 0.18 : 0.06;
        })
        .attr("stroke", c => c === d ? "#ffffff" : "#000000")
        .attr("stroke-width", c => c === d ? 2.5 : 0.6);

      // Highlight axis labels
      g.selectAll(".x-tick-text")
        .attr("fill", c => c === d.hour ? "#1e293b" : "#64748b")
        .attr("font-weight", c => c === d.hour ? "700" : "400");
      g.selectAll(".y-tick-text")
        .attr("fill", c => c === d.day ? "#1e293b" : "#64748b")
        .attr("font-weight", c => c === d.day ? "700" : "400");

      tooltip.style("opacity", 1)
        .html(`<strong style="color:#1e293b">${d.day}</strong> &nbsp;
               <span style="color:#64748b">Hour ${d.hour}</span><br>
               <span style="color:#64748b">Avg Demand</span> &nbsp;<strong style="color:#1e293b">${d3.format(",.0f")(d.avg)} MW</strong>`)
        .style("left", `${event.pageX + 14}px`)
        .style("top", `${event.pageY - 36}px`);
    })
    .on("mouseleave", () => {
      resetCells();
      tooltip.style("opacity", 0);
    });

  // Apply initial hour filter state
  if (highlightHour !== null) resetCells();

  // ── X axis ─────────────────────────────────────────────────────────────────
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickValues(d3.range(24)))
    .call(a => a.select(".domain").remove())
    .call(a => a.selectAll(".tick line").attr("stroke", "#cbd5e1"))
    .call(a => a.selectAll(".tick text")
      .attr("class", "x-tick-text")
      .each(function(d) { d3.select(this).datum(+d); })
      .attr("font-size", "11px").attr("fill", "#64748b").attr("font-family", FONT)
      .text(d => d));

  // ── Y axis ─────────────────────────────────────────────────────────────────
  g.append("g")
    .call(d3.axisLeft(y))
    .call(a => a.select(".domain").remove())
    .call(a => a.selectAll(".tick line").attr("stroke", "#cbd5e1"))
    .call(a => a.selectAll(".tick text")
      .attr("class", "y-tick-text")
      .attr("font-size", "13px").attr("fill", "#64748b").attr("font-family", FONT));

  // ── Title ──────────────────────────────────────────────────────────────────
  g.append("text")
    .attr("x", innerWidth / 2).attr("y", -50)
    .attr("text-anchor", "middle")
    .attr("font-size", "20px").attr("font-weight", "700")
    .attr("fill", "#1e293b").attr("font-family", FONT)
    .text("Average Electricity Demand by Hour and Day");

  g.append("text")
    .attr("x", innerWidth / 2).attr("y", -22)
    .attr("text-anchor", "middle")
    .attr("font-size", "13px").attr("fill", "#64748b").attr("font-family", FONT)
    .text("Average electricity demand (MW) by hour and day of the week — reveals recurring load patterns and identifies consistent peak-demand periods.");

  // ── Axis labels ────────────────────────────────────────────────────────────
  g.append("text")
    .attr("x", innerWidth / 2).attr("y", innerHeight + 48)
    .attr("text-anchor", "middle")
    .attr("font-size", "16px").attr("font-weight", "600").attr("fill", "#475569").attr("font-family", FONT)
    .text("Hour of Day (1 = 00:00–01:00, 24 = 23:00–24:00)");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2).attr("y", -85)
    .attr("text-anchor", "middle")
    .attr("font-size", "16px").attr("font-weight", "600").attr("fill", "#475569").attr("font-family", FONT)
    .text("Day of Week");

  // ── Legend card ────────────────────────────────────────────────────────────
  const LEG_W = 200;
  const LEG_H = 12;
  const legX  = innerWidth - LEG_W;
  const legY  = innerHeight + 22;

  // Card shadow filter
  defs.append("filter").attr("id", "heat-card-shadow")
    .attr("x", "-8%").attr("y", "-20%").attr("width", "116%").attr("height", "140%")
    .append("feDropShadow")
    .attr("dx", 0).attr("dy", 2).attr("stdDeviation", 4)
    .attr("flood-color", "#0000001a");

  const CPAD = 12;
  g.append("rect")
    .attr("x", legX - CPAD).attr("y", legY - 18)
    .attr("width", LEG_W + CPAD * 2).attr("height", 52)
    .attr("fill", "#ffffff").attr("stroke", "#000000").attr("stroke-width", 1)
    .attr("rx", 8).attr("filter", "url(#heat-card-shadow)");

  // Gradient
  const gradId = "heatmap-legend-gradient";
  const grad   = defs.append("linearGradient").attr("id", gradId)
    .attr("x1", "0%").attr("x2", "100%").attr("y1", "0%").attr("y2", "0%");

  grad.selectAll("stop")
    .data(d3.range(0, 1.01, 0.1))
    .enter().append("stop")
    .attr("offset", d => `${d * 100}%`)
    .attr("stop-color", d => color(minScale + d * (maxScale - minScale)));

  g.append("text")
    .attr("x", legX).attr("y", legY - 4)
    .attr("font-size", "10px").attr("font-weight", "700")
    .attr("fill", "#475569").attr("font-family", FONT)
    .attr("letter-spacing", "0.5")
    .text("AVG DEMAND (MW)");

  g.append("rect")
    .attr("x", legX).attr("y", legY + 6)
    .attr("width", LEG_W).attr("height", LEG_H)
    .attr("fill", `url(#${gradId})`)
    .attr("rx", 3);

  const legScale = d3.scaleLinear().domain([minScale, maxScale]).range([0, LEG_W]);
  const legTicks = d3.range(3).map(i => minScale + i * (maxScale - minScale) / 2);

  g.append("g")
    .attr("transform", `translate(${legX},${legY + LEG_H + 6})`)
    .call(d3.axisBottom(legScale).tickValues(legTicks).tickFormat(d => d3.format(",.0f")(d)).tickSize(3))
    .call(a => a.select(".domain").remove())
    .call(a => a.selectAll("text").attr("font-size", "9px").attr("fill", "#64748b").attr("font-family", FONT))
    .call(a => a.selectAll("line").attr("stroke", "#cbd5e1"));

}
