import React, { Component } from "react";
import "./App.css";
import FileUpload from "./FileUpload";
import * as d3 from "d3";

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      data: [],
    };
  }

  componentDidMount() {
    this.renderChart();
  }

  componentDidUpdate() {
    this.renderChart();
  }

  set_data = (csv_data) => {
    this.setState({ data: csv_data }, this.renderChart);
  };

  colorScale = () =>
    d3
      .scaleOrdinal()
      .domain(["GPT-4", "Gemini", "PaLM-2", "Claude", "LLaMA-3.1"])
      .range(["#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00"]);

  drawMiniBarChart(data, model) {
    // Select the tooltip container and ensure it's visible
    const tooltip = d3.select(".tooltip");
    
    // If the svg doesn't exist in the tooltip, create it
    let svg = tooltip.select("svg");
    if (svg.empty()) {
      svg = tooltip.append("svg")
        .attr("width", 300)
        .attr("height", 200);  // Increased height for room for axes
    } else {
      svg.selectAll("*").remove(); // Clear previous chart if svg already exists
    }
  
    const width = 300;
    const height = 200;
    const margin = { top: 10, right: 10, bottom: 25, left: 30 }; // Add margins for axes
  
    // Define the scales for x and y axes based on the data
    const x = d3
      .scaleBand()
      .domain(data.map(d => d.month)) // Use the month for x-axis
      .range([margin.left, width - margin.right])
      .padding(0.1);
  
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, d => d.value)]) // Set the y-axis to the max value
      .nice()  // Make sure y-axis starts at zero
      .range([height - margin.bottom, margin.top]);
  
    const color = this.colorScale(); // Access the color scale
  
    // Draw the bars of the mini bar chart
    svg
      .selectAll("rect")
      .data(data)
      .join("rect")
      .attr("x", d => x(d.month))
      .attr("y", d => y(d.value))
      .attr("width", x.bandwidth())
      .attr("height", d => height - margin.bottom - y(d.value)) // Adjust for the margin
      .attr("fill", color(model)); // Use the model to get the correct color from the color scale
    
    // x-axis
    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickSize(0))
      .selectAll("text")
      .style("font-size", "10px")
      .style("text-anchor", "middle")
      .style("fill", "black")
      .attr("x", 0);

    // Add y-axis
    svg.append("g")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(y).ticks(d3.max(data, d => d.value) / 20))  // Automatically create ticks every 20 units
      .style("font-size", "10px");  // Adjust font size for readability
  }      
    
  // Helper function to group data by month and LLM
  groupDataByMonth = (data) => {
    const parseDate = d3.timeParse("%m/%d/%y");

    // Parse the Date and group by month for each LLM
    const groupedData = Array.from(
      d3.rollup(
        data,
        (values) => {
          // Aggregate values per LLM
          const aggregated = {};
          values.forEach((d) => {
            aggregated["GPT-4"] = (aggregated["GPT-4"] || 0) + +d["GPT4"];
            aggregated["Gemini"] = (aggregated["Gemini"] || 0) + +d["Gemini"];
            aggregated["PaLM-2"] = (aggregated["PaLM-2"] || 0) + +d["PaLM2"];
            aggregated["Claude"] = (aggregated["Claude"] || 0) + +d["Claude"];
            aggregated["LLaMA-3.1"] = (aggregated["LLaMA-3.1"] || 0) + +d["LLaMA31"];
          });
          return aggregated;
        },
        (d) => d3.timeMonth(parseDate(d.Date)) // Group by month
      )
    );    

    return groupedData;
  };


  renderChart = () => {
    const { data } = this.state;
    if (data.length === 0) return;

    d3.select(".container").selectAll("*").remove();

    const svg = d3.select(".container");
    const width = 400;
    const height = 400;
    const margin = { top: 20, right: 30, bottom: 30, left: 50 };
    const legendWidth = 150;

    const groupedData = this.groupDataByMonth(data)

    const parseDate = d3.timeParse("%m/%d/%y");
    const formattedData = data.map((d) => ({
      ...d,
      Date: parseDate(d.Date),
      "GPT-4": +d["GPT4"],
      "Gemini": +d["Gemini"],
      "PaLM-2": +d["PaLM2"],
      "Claude": +d["Claude"],
      "LLaMA-3.1": +d["LLaMA31"],
    }));

    const keys = ["GPT-4", "Gemini", "PaLM-2", "Claude", "LLaMA-3.1"];

    const stack = d3.stack().keys(keys).offset(d3.stackOffsetSilhouette);
    const layers = stack(formattedData);

    const x = d3
      .scaleTime()
      .domain(d3.extent(formattedData, (d) => d.Date))
      .range([margin.left, width - margin.right]);

    const y = d3
      .scaleLinear()
      .domain([
        d3.min(layers, (layer) => d3.min(layer, (d) => d[0])),
        d3.max(layers, (layer) => d3.max(layer, (d) => d[1])),
      ])
      .range([height - margin.bottom, margin.top]);

    const color = this.colorScale();

    const area = d3
      .area()
      .x((d) => x(d.data.Date))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]))
      .curve(d3.curveCardinal);

    svg.attr("width", width + legendWidth).attr("height", height);

    svg
      .selectAll("path")
      .data(layers)
      .join("path")
      .attr("d", area)
      .attr("fill", ({ key }) => color(key))
      .attr("opacity", 0.9)
      .on("mouseenter", (event, d) => {
        const model = d.key;
      
        const monthlyValues = groupedData.map(([date, values]) => ({
          month: date.toLocaleString("default", { month: "short" }),
          value: values[model],
        }));

        const tooltip = d3.select(".tooltip");
        tooltip
          .transition()
          .duration(300)
          .style("display", "block") // Make the tooltip visible
          .style("left", `${event.pageX + 10}px`) // Position the tooltip
          .style("top", `${event.pageY + 10}px`)
          .style("width", "300px") // Increase tooltip size for mini chart visibility
          .style("height", "200px");

        // Update the tooltip content with model name and the mini bar chart
        tooltip.html(`<strong></strong>`);

        // Call the function to draw the mini bar chart inside the tooltip
        this.drawMiniBarChart(monthlyValues, model);
      });      

    svg
      .append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.timeFormat("%b")));

    const legend = svg
      .append("g")
      .attr("transform", `translate(${width + 10}, ${margin.top})`);

    keys.forEach((key, i) => {
      const legendRow = legend
        .append("g")
        .attr("transform", `translate(0, ${i * 25})`);

      legendRow
        .append("rect")
        .attr("width", 18)
        .attr("height", 18)
        .attr("fill", color(key));

      legendRow
        .append("text")
        .attr("x", 24)
        .attr("y", 14)
        .style("font-size", "14px")
        .text(key);
    });

    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("background", "#fff")
      .style("border", "1px solid #ccc")
      .style("padding", "10px")
      .style("border-radius", "8px")
      .style("box-shadow", "0 4px 6px rgba(0,0,0,0.1)")
      .style("display", "none");

    tooltip.append("svg").attr("width", 120).attr("height", 80);
  };

  render() {
    return (
      <div>
        <FileUpload set_data={this.set_data} />
        <div>
          <svg className="container"></svg>
        </div>
      </div>
    );
  }
}

export default App;
