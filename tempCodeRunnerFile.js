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