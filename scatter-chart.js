function drawReserveMarginScatter(data) {
  d3.select("#scatter-chart").selectAll("svg").remove();

  // Zone map (SVG y):
  //   28        — main title
  //   52 / 67   — subtitle lines
  //   90–125    — legend row (Regression | Lerner Index)
  //   145       — panel titles "December" / "July"
  //   165       — chart area begins
  const totalWidth  = 1400;
  const totalHeight = 690;
  const margin      = { top: 165, right: 40, bottom: 90, left: 110 };
  const innerWidth  = totalWidth  - margin.left - margin.right;  // 1250
  const innerHeight = totalHeight - margin.top  - margin.bottom; // 435

  const svg = d3.select("#scatter-chart")
    .append("svg")
    .attr("viewBox", `0 0 ${totalWidth} ${totalHeight}`);

  // ── SVG background ─────────────────────────────────────────────────────────
  svg.append("rect")
    .attr("width", totalWidth).attr("height", totalHeight)
    .attr("fill", "#f8f9fb");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const cx = totalWidth / 2;

  const panelGap    = 70;
  const panelWidth  = (innerWidth - panelGap) / 2;
  const panelHeight = innerHeight;

  // ── Shared defs (filters + gradient) ──────────────────────────────────────
  const defs = svg.append("defs");

  const shadow = defs.append("filter").attr("id", "panel-shadow")
    .attr("x", "-4%").attr("y", "-4%").attr("width", "108%").attr("height", "108%");
  shadow.append("feDropShadow")
    .attr("dx", 0).attr("dy", 2).attr("stdDeviation", 4)
    .attr("flood-color", "#00000012");

  // ── Title ──────────────────────────────────────────────────────────────────
  svg.append("text")
    .attr("x", cx).attr("y", 28)
    .attr("text-anchor", "middle")
    .attr("font-size", "28px").attr("font-weight", "700")
    .attr("fill", "#1e293b").attr("font-family", "Inter, system-ui, sans-serif")
    .text("Reserve Margin vs Pool Price");

  // ── Subtitle ───────────────────────────────────────────────────────────────
  const subtitleStyle = sel => sel
    .attr("x", cx).attr("text-anchor", "middle")
    .attr("font-size", "11px").attr("fill", "#64748b")
    .attr("font-family", "Inter, system-ui, sans-serif");

  svg.append("text").call(subtitleStyle).attr("y", 52)
    .text("This chart explains why price spikes occur by illustrating the relationship between reserve margin and price. An inverse relationship emerges, where lower reserve margins—indicating tighter");

  svg.append("text").call(subtitleStyle).attr("y", 67)
    .text("supply conditions—are associated with significantly higher prices, particularly in July. This demonstrates that extreme price events are driven by scarcity rather than randomness.");

  // ── Parse ──────────────────────────────────────────────────────────────────
  const parsed = data.map(d => {
    const date = d.date instanceof Date ? d.date : new Date(d.date);
    const monthName = !isNaN(date)
      ? date.toLocaleString("en-US", { month: "long" }) : "";
    return {
      ...d, date, monthName,
      pool_price:     +d.pool_price,
      reserve_margin: +d.reserve_margin,
      lerner_index:   +d.lerner_index,
      hour:           +d.hour
    };
  }).filter(d =>
    !isNaN(d.date) && !isNaN(d.pool_price) &&
    !isNaN(d.reserve_margin) && !isNaN(d.lerner_index) &&
    (d.monthName === "December" || d.monthName === "July")
  );

  const decData = parsed.filter(d => d.monthName === "December");
  const julData = parsed.filter(d => d.monthName === "July");
  const allData = [...decData, ...julData];

  if (!allData.length) {
    g.append("text")
      .attr("x", innerWidth / 2).attr("y", innerHeight / 2)
      .attr("text-anchor", "middle").attr("font-size", "18px").attr("fill", "#666")
      .text("No valid December or July data found.");
    return;
  }

  // ── Shared scales ──────────────────────────────────────────────────────────
  const xExtent      = d3.extent(allData, d => d.reserve_margin);
  const lernerExtent = d3.extent(allData, d => d.lerner_index);
  const xPad         = (xExtent[1] - xExtent[0]) * 0.04;

  const x = d3.scaleLinear()
    .domain([xExtent[0] - xPad, xExtent[1] + xPad]).nice()
    .range([0, panelWidth]);

  const yDec = d3.scaleLinear()
    .domain([0, d3.extent(decData, d => d.pool_price)[1] * 1.1]).nice()
    .range([panelHeight, 0]);

  const yJul = d3.scaleLinear()
    .domain([0, d3.extent(julData, d => d.pool_price)[1] * 1.1]).nice()
    .range([panelHeight, 0]);

  // Plasma reversed: high Lerner index → dark purple, low → bright yellow
  const color = d3.scaleSequential()
    .domain([lernerExtent[1], lernerExtent[0]])
    .interpolator(d3.interpolatePlasma);

  // ── Tooltip ────────────────────────────────────────────────────────────────
  const tooltip = d3.select("body")
    .selectAll(".scatter-tooltip").data([null]).join("div")
    .attr("class", "scatter-tooltip")
    .style("position", "absolute")
    .style("background", "#ffffff")
    .style("border", "1px solid #000000")
    .style("border-radius", "10px")
    .style("padding", "10px 14px")
    .style("font-size", "13px")
    .style("font-family", "Inter, system-ui, sans-serif")
    .style("line-height", "1.6")
    .style("color", "#1e293b")
    .style("pointer-events", "none")
    .style("opacity", 0)
    .style("box-shadow", "0 8px 24px rgba(0,0,0,0.12)");

  // ── Deterministic jitter ───────────────────────────────────────────────────
  function jitter(d) {
    const h = ((d.reserve_margin * 7919 + d.lerner_index * 3571) % 1 + 1) % 1;
    return h * 8 - 4;
  }

  // ── Regression helper ──────────────────────────────────────────────────────
  function getRegressionStats(pd) {
    const n     = pd.length;
    const sumX  = d3.sum(pd, d => d.reserve_margin);
    const sumY  = d3.sum(pd, d => d.pool_price);
    const sumXY = d3.sum(pd, d => d.reserve_margin * d.pool_price);
    const sumX2 = d3.sum(pd, d => d.reserve_margin ** 2);
    const slope     = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX ** 2);
    const intercept = (sumY - slope * sumX) / n;
    const yMean = sumY / n;
    const ssTot = d3.sum(pd, d => (d.pool_price - yMean) ** 2);
    const ssRes = d3.sum(pd, d => (d.pool_price - (slope * d.reserve_margin + intercept)) ** 2);
    const r2    = 1 - ssRes / ssTot;
    const [x0, x1] = x.domain();
    return { r2, points: [
      { x: x0, y: slope * x0 + intercept },
      { x: x1, y: slope * x1 + intercept }
    ]};
  }

  // ── Draw panel ─────────────────────────────────────────────────────────────
  function drawPanel(panelData, xOffset, label, yScale) {
    const panel = g.append("g").attr("transform", `translate(${xOffset},0)`);

    // Panel title
    panel.append("text")
      .attr("x", panelWidth / 2).attr("y", -10)
      .attr("text-anchor", "middle")
      .attr("font-size", "18px").attr("font-weight", "700")
      .attr("fill", "#1e293b").attr("font-family", "Inter, system-ui, sans-serif")
      .attr("letter-spacing", "0.3")
      .text(label);

    // Clip path
    const clipId = `panel-clip-${label.toLowerCase()}`;
    panel.append("clipPath").attr("id", clipId)
      .append("rect").attr("width", panelWidth).attr("height", panelHeight);

    // Panel background with shadow
    panel.append("rect")
      .attr("width", panelWidth).attr("height", panelHeight)
      .attr("fill", "#ffffff")
      .attr("stroke", "#000000").attr("stroke-width", 1)
      .attr("rx", 8)
      .attr("filter", "url(#panel-shadow)");

    // Y grid (subtle dotted)
    panel.append("g")
      .call(d3.axisLeft(yScale).ticks(6).tickSize(-panelWidth).tickFormat(""))
      .call(g => g.selectAll("line")
        .attr("stroke", "#f1f5f9").attr("stroke-width", 1))
      .call(g => g.select(".domain").remove());

    // X grid
    panel.append("g")
      .attr("transform", `translate(0,${panelHeight})`)
      .call(d3.axisBottom(x).ticks(6).tickSize(-panelHeight).tickFormat(""))
      .call(g => g.selectAll("line")
        .attr("stroke", "#f1f5f9").attr("stroke-width", 1))
      .call(g => g.select(".domain").remove());

    // Y axis — no domain line, muted ticks
    panel.append("g")
      .call(d3.axisLeft(yScale).ticks(6))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").attr("stroke", "#cbd5e1").attr("stroke-width", 1))
      .call(g => g.selectAll(".tick text")
        .attr("font-size", "12px").attr("fill", "#64748b")
        .attr("font-family", "Inter, system-ui, sans-serif"));

    // X axis — no domain line
    panel.append("g")
      .attr("transform", `translate(0,${panelHeight})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format(".2f")))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").attr("stroke", "#cbd5e1").attr("stroke-width", 1))
      .call(g => g.selectAll(".tick text")
        .attr("font-size", "12px").attr("fill", "#64748b")
        .attr("font-family", "Inter, system-ui, sans-serif"));

    // Count label
    panel.append("text")
      .attr("x", panelWidth - 10).attr("y", 22)
      .attr("text-anchor", "end")
      .attr("font-size", "11px").attr("fill", "#94a3b8")
      .attr("font-family", "Inter, system-ui, sans-serif")
      .text(`n = ${panelData.length.toLocaleString()}`);

    // Dots — white stroke separates overlapping points
    panel.append("g").attr("clip-path", `url(#${clipId})`)
      .selectAll("circle")
      .data(panelData).enter().append("circle")
      .attr("class", "scatter-dot")
      .attr("cx", d => x(d.reserve_margin) + jitter(d))
      .attr("cy", d => yScale(d.pool_price))
      .attr("r", 6)
      .attr("fill", d => color(d.lerner_index))
      .attr("stroke", "#000000").attr("stroke-width", 0.5)
      .attr("opacity", 0.88)
      .on("mouseover", function(_event, d) {
        d3.select(this).attr("r", 9).attr("opacity", 1)
          .attr("stroke", "#000000").attr("stroke-width", 1);
        tooltip.style("opacity", 1).html(`
          <strong style="color:#1e293b">${label}</strong><br>
          <span style="color:#64748b">Date</span> &nbsp;${d3.timeFormat("%b %d")(d.date)}<br>
          <span style="color:#64748b">Hour</span> &nbsp;${String(d.hour).padStart(2,"0")}:00<br>
          <span style="color:#64748b">Pool Price</span> &nbsp;<strong>$${d.pool_price.toFixed(2)}</strong>/MWh<br>
          <span style="color:#64748b">Reserve Margin</span> &nbsp;${d.reserve_margin.toFixed(3)}<br>
          <span style="color:#64748b">Lerner Index</span> &nbsp;${d.lerner_index.toFixed(3)}
        `);
        dashSync.emit("hover:date", d.date, "scatter");
      })
      .on("mousemove", function(event) {
        tooltip.style("left", `${event.pageX + 14}px`).style("top", `${event.pageY - 28}px`);
      })
      .on("mouseout", function(_event) {
        d3.select(this).attr("r", 6).attr("opacity", 0.88)
          .attr("stroke", "#000000").attr("stroke-width", 0.5);
        tooltip.style("opacity", 0);
        dashSync.emit("clear", null, "scatter");
      });

    // Regression line (on top of dots)
    const reg  = getRegressionStats(panelData);
    const line = d3.line().x(d => x(d.x)).y(d => yScale(d.y));

    panel.append("path")
      .datum(reg.points)
      .attr("fill", "none").attr("stroke", "#D55E00")
      .attr("stroke-width", 2.5).attr("stroke-dasharray", "7,4")
      .attr("stroke-linecap", "round")
      .attr("opacity", 0.95)
      .attr("clip-path", `url(#${clipId})`)
      .attr("d", line);

    // R² badge — small pill in the panel corner
    const r2Text = `R² = ${reg.r2.toFixed(3)}`;
    const badgeX = panelWidth - 10;
    const badgeY = panelHeight - 12;
    panel.append("text")
      .attr("x", badgeX).attr("y", badgeY)
      .attr("text-anchor", "end")
      .attr("font-size", "11px").attr("fill", "#D55E00").attr("font-weight", "700")
      .attr("font-family", "Inter, system-ui, sans-serif")
      .text(r2Text);
  }

  drawPanel(decData, 0,                    "December", yDec);
  drawPanel(julData, panelWidth + panelGap, "July",     yJul);

  // ── Cross-chart sync handlers ─────────────────────────────────────────────
  const fmtDay = d3.timeFormat("%Y-%m-%d");
  dashSync.on("hover:date", "scatter", (date) => {
    const ds = fmtDay(date);
    d3.selectAll(".scatter-dot")
      .style("opacity", d => fmtDay(d.date) === ds ? 1 : 0.07)
      .attr("r",        d => fmtDay(d.date) === ds ? 8 : 5);
  });

  dashSync.on("clear", "scatter", () => {
    d3.selectAll(".scatter-dot").style("opacity", 0.88).attr("r", 6);
  });

  // ── Axis labels ────────────────────────────────────────────────────────────
  g.append("text")
    .attr("x", innerWidth / 2).attr("y", innerHeight + 40)
    .attr("text-anchor", "middle")
    .attr("font-size", "14px").attr("font-weight", "600").attr("fill", "#475569")
    .attr("font-family", "Inter, system-ui, sans-serif")
    .text("Reserve Margin");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2).attr("y", -60)
    .attr("text-anchor", "middle")
    .attr("font-size", "14px").attr("font-weight", "600").attr("fill", "#475569")
    .attr("font-family", "Inter, system-ui, sans-serif")
    .text("Pool Price ($/MWh)");

  // ── Legend card ────────────────────────────────────────────────────────────
  const LERNER_W  = 190;
  const CARD_PAD  = 14;
  const REG_W     = 130;
  const COL_GAP   = 20;
  const CARD_W    = REG_W + COL_GAP + LERNER_W + CARD_PAD * 2;
  const CARD_H    = 60;
  const cardX     = innerWidth - CARD_W;
  const cardY     = -90;

  // Card shadow filter
  const cardShadow = defs.append("filter").attr("id", "card-shadow")
    .attr("x", "-8%").attr("y", "-15%").attr("width", "116%").attr("height", "130%");
  cardShadow.append("feDropShadow")
    .attr("dx", 0).attr("dy", 2).attr("stdDeviation", 5)
    .attr("flood-color", "#0000001a");

  g.append("rect")
    .attr("x", cardX).attr("y", cardY)
    .attr("width", CARD_W).attr("height", CARD_H)
    .attr("fill", "#ffffff").attr("stroke", "#000000").attr("stroke-width", 0.5)
    .attr("rx", 8).attr("filter", "url(#card-shadow)");

  const regX    = cardX + CARD_PAD;
  const lernerX = regX + REG_W + COL_GAP;

  const ROW1 = cardY + 17;
  const ROW2 = cardY + 36;
  const ROW3 = cardY + 51;

  // ── Regression column ──────────────────────────────────────────────────────
  g.append("text")
    .attr("x", regX).attr("y", ROW1)
    .attr("font-size", "10px").attr("font-weight", "700").attr("fill", "#475569")
    .attr("font-family", "Inter, system-ui, sans-serif")
    .attr("letter-spacing", "0.5")
    .text("TREND LINE");

  g.append("line")
    .attr("x1", regX).attr("y1", ROW2)
    .attr("x2", regX + 36).attr("y2", ROW2)
    .attr("stroke", "#D55E00").attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "6,3").attr("stroke-linecap", "round")
    .attr("opacity", 0.95);

  g.append("text")
    .attr("x", regX + 42).attr("y", ROW2)
    .attr("font-size", "10px").attr("fill", "#64748b")
    .attr("font-family", "Inter, system-ui, sans-serif")
    .attr("dominant-baseline", "middle")
    .text("OLS regression");

  // ── Lerner Index column ────────────────────────────────────────────────────
  g.append("text")
    .attr("x", lernerX).attr("y", ROW1)
    .attr("font-size", "10px").attr("font-weight", "700").attr("fill", "#475569")
    .attr("font-family", "Inter, system-ui, sans-serif")
    .attr("letter-spacing", "0.5")
    .text("LERNER INDEX (MARKET POWER)");

  const gradient = defs.append("linearGradient")
    .attr("id", "lerner-gradient")
    .attr("x1", "0%").attr("x2", "100%").attr("y1", "0%").attr("y2", "0%");

  gradient.selectAll("stop")
    .data(d3.range(0, 1.01, 0.1).map(t => ({
      offset: `${t * 100}%`,
      color:  color(lernerExtent[0] + t * (lernerExtent[1] - lernerExtent[0]))
    })))
    .enter().append("stop")
    .attr("offset", d => d.offset).attr("stop-color", d => d.color);

  g.append("rect")
    .attr("x", lernerX).attr("y", ROW2 - 7)
    .attr("width", LERNER_W).attr("height", 12)
    .attr("fill", "url(#lerner-gradient)")
    .attr("rx", 3);

  const lernerScale = d3.scaleLinear().domain(lernerExtent).range([0, LERNER_W]);
  const lernerTicks = d3.range(4).map(i =>
    lernerExtent[0] + i * (lernerExtent[1] - lernerExtent[0]) / 3
  );
  g.append("g")
    .attr("transform", `translate(${lernerX},${ROW3 - 4})`)
    .call(d3.axisBottom(lernerScale).tickValues(lernerTicks).tickFormat(d3.format(".2f")).tickSize(3))
    .call(ax => ax.select(".domain").remove())
    .call(ax => ax.selectAll("text")
      .attr("font-size", "9px").attr("fill", "#64748b")
      .attr("font-family", "Inter, system-ui, sans-serif"))
    .call(ax => ax.selectAll("line").attr("stroke", "#cbd5e1"));
}
