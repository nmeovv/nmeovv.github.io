// Global state
let rawData = null;
let currentView = 0;
let simulation = null;

// Color schemes
const clusterColors = {
  HYBE: "#FF6B6B",
  "SM Entertainment": "#4ECDC4",
  "JYP Entertainment": "#45B7D1",
  "YG Entertainment": "#96CEB4",
  "Starship Entertainment": "#FFEAA7",
  "Cube Entertainment": "#DDA0DD",
  "The Black Label": "#2C3E50",
  Others: "#95A5A6",
  Modhaus: "#E74C3C",
  XGALX: "#9B59B6",
};

const defaultColor = "#8b5cf6";

function getClusterColor(cluster) {
  return clusterColors[cluster] || defaultColor;
}

async function init() {
  try {
    rawData = await d3.json("./cluster.json");
    const category = rawData[0];
    const datasets = category.datasets;

    // Update title
    document.getElementById("chart-title").textContent = category.name;

    // Create navigation tabs
    createTabs(datasets);

    // Render first view
    renderView(0);
  } catch (error) {
    console.error("Error loading data:", error);
    document.getElementById("chart-title").textContent = "Error loading data";
  }
}

function createTabs(datasets) {
  const tabContainer = document.getElementById("tab-container");
  tabContainer.innerHTML = "";

  datasets.forEach((dataset, index) => {
    const tab = document.createElement("button");
    tab.className = `tab-btn px-4 py-2 rounded-lg font-medium transition-all ${index === 0 ? "bg-accent-violet text-white" : "bg-surface-light text-gray-400 hover:text-white"}`;
    tab.textContent = dataset.name;
    tab.onclick = () => {
      // Update active tab styling
      document.querySelectorAll(".tab-btn").forEach((t, i) => {
        t.className = `tab-btn px-4 py-2 rounded-lg font-medium transition-all ${i === index ? "bg-accent-violet text-white" : "bg-surface-light text-gray-400 hover:text-white"}`;
      });
      renderView(index);
    };
    tabContainer.appendChild(tab);
  });
}

function renderView(index) {
  currentView = index;
  const container = document.getElementById("chart-container");
  container.innerHTML = "";

  // Stop any running simulation
  if (simulation) {
    simulation.stop();
    simulation = null;
  }

  const category = rawData[0];
  const dataset = category.datasets[index];

  document.getElementById("chart-subtitle").textContent =
    dataset.description || `Данные: ${dataset.name}`;

  // Detect view type based on data structure or description
  const description = (dataset.description || "").toLowerCase();
  const data = dataset.data;

  if (
    description.includes("heatmap") ||
    description.includes("matrix") ||
    description.includes("scatter")
  ) {
    renderHeatmap(data);
  } else if (
    description.includes("network") ||
    description.includes("graph") ||
    description.includes("gephi")
  ) {
    renderNetworkGraph(data);
  } else if (data[0] && data[0].assigned_cluster) {
    renderClusterCards(data);
  } else {
    renderBarChart(data);
  }
}

// ============================================
// VIEW 1: Cluster Cards
// ============================================
function renderClusterCards(data) {
  const container = document.getElementById("chart-container");
  container.style.height = "auto";

  // Sort by cluster strength
  const sortedData = [...data].sort(
    (a, b) => b.cluster_strength - a.cluster_strength,
  );

  // Create grid container
  const grid = document.createElement("div");
  grid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4";

  sortedData.forEach(user => {
    const card = document.createElement("div");
    card.className =
      "bg-surface-light rounded-xl p-4 border border-border hover:border-accent-violet transition-all cursor-pointer";

    const clusterColor = getClusterColor(user.assigned_cluster);

    card.innerHTML = `
            <div class="flex items-start justify-between mb-3">
                <div>
                    <h3 class="font-display font-bold text-white text-lg">${user.voter_name}</h3>
                    <span class="inline-block px-2 py-1 rounded text-xs font-medium mt-1" style="background-color: ${clusterColor}20; color: ${clusterColor}">
                        ${user.assigned_cluster}
                    </span>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-bold font-mono" style="color: ${clusterColor}">${user.cluster_strength.toFixed(1)}%</div>
                    <div class="text-xs text-gray-500">сила кластера</div>
                </div>
            </div>
            <div class="flex items-center gap-2 mb-3">
                <span class="text-gray-400 text-sm">Всего голосов:</span>
                <span class="font-mono text-white">${user.total_user_votes}</span>
            </div>
            <div class="text-xs text-gray-500 border-t border-border pt-3 mt-2 max-h-24 overflow-y-auto">
                ${formatPortfolio(user.full_portfolio)}
            </div>
        `;

    // Hover effect with D3
    d3.select(card)
      .on("mouseenter", function () {
        d3.select(this)
          .style("transform", "translateY(-2px)")
          .style("box-shadow", `0 8px 30px ${clusterColor}30`);
      })
      .on("mouseleave", function () {
        d3.select(this)
          .style("transform", "translateY(0)")
          .style("box-shadow", "none");
      });

    grid.appendChild(card);
  });

  container.appendChild(grid);

  // Add summary stats
  const stats = calculateClusterStats(data);
  addStatsSummary(container, stats);
}

function formatPortfolio(portfolio) {
  if (!portfolio) return "Нет данных";
  return portfolio
    .split(", ")
    .map(item => {
      const [name, count] = item.split(": ");
      const color = getClusterColor(name);
      return `<span class="inline-block mr-1 mb-1 px-1.5 py-0.5 rounded" style="background-color: ${color}15; color: ${color}">${name}: ${count}</span>`;
    })
    .join(" ");
}

function calculateClusterStats(data) {
  const clusterCounts = {};
  data.forEach(d => {
    clusterCounts[d.assigned_cluster] =
      (clusterCounts[d.assigned_cluster] || 0) + 1;
  });
  return Object.entries(clusterCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function addStatsSummary(container, stats) {
  const summary = document.createElement("div");
  summary.className = "mt-6 p-4 bg-surface rounded-xl border border-border";
  summary.innerHTML = `
        <h4 class="font-display font-bold text-white mb-3">Распределение по кластерам</h4>
        <div class="flex flex-wrap gap-3">
            ${stats
              .map(
                s => `
                <div class="flex items-center gap-2 px-3 py-2 rounded-lg" style="background-color: ${getClusterColor(s.name)}15">
                    <span class="w-3 h-3 rounded-full" style="background-color: ${getClusterColor(s.name)}"></span>
                    <span class="text-sm text-gray-300">${s.name}:</span>
                    <span class="font-mono font-bold" style="color: ${getClusterColor(s.name)}">${s.count}</span>
                </div>
            `,
              )
              .join("")}
        </div>
    `;
  container.appendChild(summary);
}

// ============================================
// VIEW 2: Heatmap
// ============================================
function renderHeatmap(data) {
  const container = document.getElementById("chart-container");
  const margin = { top: 80, right: 30, bottom: 60, left: 140 };
  const width =
    Math.min(container.clientWidth, 900) - margin.left - margin.right;
  const height = data.length * 40;

  container.style.height = `${height + margin.top + margin.bottom + 100}px`;

  // Get column names (excluding voter_name and total_votes)
  const columns = Object.keys(data[0]).filter(
    k => k !== "voter_name" && k !== "total_votes",
  );
  const voters = data.map(d => d.voter_name);

  // Find max value for color scale
  let maxVal = 0;
  data.forEach(row => {
    columns.forEach(col => {
      if (row[col] > maxVal) maxVal = row[col];
    });
  });

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Scales
  const x = d3.scaleBand().domain(columns).range([0, width]).padding(0.05);

  const y = d3.scaleBand().domain(voters).range([0, height]).padding(0.05);

  // Color scale
  const colorScale = d3
    .scaleSequential()
    .domain([0, maxVal])
    .interpolator(d3.interpolateViridis);

  // Column labels (agencies)
  const columnLabels = {
    hybe_votes: "HYBE",
    sm_votes: "SM Ent",
    jyp_votes: "JYP Ent",
    yg_votes: "YG Ent",
    other_votes: "Others",
  };

  // X axis
  svg
    .append("g")
    .attr("transform", `translate(0, -10)`)
    .selectAll("text")
    .data(columns)
    .enter()
    .append("text")
    .text(d => columnLabels[d] || d)
    .attr("x", d => x(d) + x.bandwidth() / 2)
    .attr("y", 0)
    .attr("text-anchor", "middle")
    .attr("fill", "#e5e7eb")
    .attr("font-size", "12px")
    .attr("font-weight", "bold");

  // Y axis
  svg
    .append("g")
    .selectAll("text")
    .data(voters)
    .enter()
    .append("text")
    .text(d => d)
    .attr("x", -10)
    .attr("y", d => y(d) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "end")
    .attr("fill", "#e5e7eb")
    .attr("font-size", "12px");

  // Tooltip
  const tooltip = d3.select("#tooltip");
  const tooltipTitle = d3.select("#tt-title");
  const tooltipValue = d3.select("#tt-value");
  const tooltipDesc = d3.select("#tt-desc");

  // Cells
  data.forEach(row => {
    columns.forEach(col => {
      svg
        .append("rect")
        .attr("x", x(col))
        .attr("y", y(row.voter_name))
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .attr("fill", colorScale(row[col]))
        .attr("rx", 4)
        .attr("stroke", "#1a1a26")
        .attr("stroke-width", 2)
        .style("opacity", 0)
        .on("mouseover", function (event) {
          d3.select(this).attr("stroke", "#fff").attr("stroke-width", 2);
          tooltip.style("opacity", 1);
          tooltipTitle.text(row.voter_name);
          tooltipValue.text(`${row[col]} голосов`);
          tooltipDesc.text(
            `${columnLabels[col] || col} (${((row[col] / row.total_votes) * 100).toFixed(1)}% от общего)`,
          );
        })
        .on("mousemove", function (event) {
          const containerRect = container.getBoundingClientRect();
          tooltip
            .style("left", event.clientX - containerRect.left + 15 + "px")
            .style("top", event.clientY - containerRect.top + 15 + "px");
        })
        .on("mouseout", function () {
          d3.select(this).attr("stroke", "#1a1a26").attr("stroke-width", 2);
          tooltip.style("opacity", 0);
        })
        .transition()
        .duration(500)
        .delay((_, i) => i * 20)
        .style("opacity", 1);

      // Value labels inside cells
      svg
        .append("text")
        .attr("x", x(col) + x.bandwidth() / 2)
        .attr("y", y(row.voter_name) + y.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .attr("fill", row[col] > maxVal / 2 ? "#000" : "#fff")
        .attr("font-size", "11px")
        .attr("font-weight", "bold")
        .attr("pointer-events", "none")
        .text(row[col] || "");
    });
  });

  // Color legend
  const legendWidth = 200;
  const legendHeight = 15;
  const legendX = width - legendWidth;
  const legendY = height + 30;

  const legendScale = d3
    .scaleLinear()
    .domain([0, maxVal])
    .range([0, legendWidth]);

  const legendAxis = d3.axisBottom(legendScale).ticks(5);

  // Gradient for legend
  const defs = svg.append("defs");
  const linearGradient = defs
    .append("linearGradient")
    .attr("id", "heatmap-gradient");

  linearGradient
    .selectAll("stop")
    .data(d3.range(0, 1.01, 0.1))
    .enter()
    .append("stop")
    .attr("offset", d => d * 100 + "%")
    .attr("stop-color", d => colorScale(d * maxVal));

  svg
    .append("rect")
    .attr("x", legendX)
    .attr("y", legendY)
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .style("fill", "url(#heatmap-gradient)")
    .attr("rx", 3);

  svg
    .append("g")
    .attr("transform", `translate(${legendX}, ${legendY + legendHeight})`)
    .call(legendAxis)
    .call(g => g.select(".domain").remove())
    .call(g =>
      g.selectAll("text").attr("fill", "#9ca3af").attr("font-size", "10px"),
    );

  svg
    .append("text")
    .attr("x", legendX)
    .attr("y", legendY - 5)
    .attr("fill", "#9ca3af")
    .attr("font-size", "11px")
    .text("Количество голосов");
}

// ============================================
// VIEW 3: Network Graph (Bipartite Layout)
// ============================================
let minWeightThreshold = 3;
let lockedNode = null;
let showAllLinks = true; // Show all by default

function renderNetworkGraph(data) {
  const container = document.getElementById("chart-container");
  const width = container.clientWidth;
  const height = 800;

  container.style.height = `${height + 120}px`;
  lockedNode = null;

  // Filter edges by weight threshold
  const filteredData = data.filter(d => d.weight >= minWeightThreshold);

  // Build nodes from filtered edges
  const usersMap = new Map();
  const agenciesMap = new Map();

  filteredData.forEach(d => {
    if (!usersMap.has(d.source)) {
      usersMap.set(d.source, {
        id: d.source,
        type: "user",
        weight: 0,
        connections: [],
      });
    }
    if (!agenciesMap.has(d.target)) {
      agenciesMap.set(d.target, {
        id: d.target,
        type: "agency",
        weight: 0,
        connections: [],
      });
    }
    usersMap.get(d.source).weight += d.weight;
    usersMap
      .get(d.source)
      .connections.push({ target: d.target, weight: d.weight });
    agenciesMap.get(d.target).weight += d.weight;
    agenciesMap
      .get(d.target)
      .connections.push({ source: d.source, weight: d.weight });
  });

  // Sort by weight
  const users = Array.from(usersMap.values()).sort(
    (a, b) => b.weight - a.weight,
  );
  const agencies = Array.from(agenciesMap.values()).sort(
    (a, b) => b.weight - a.weight,
  );

  // Layout constants
  const margin = { top: 100, right: 200, bottom: 40, left: 140 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  // Add controls first
  addNetworkControls(container, data, users, agencies);

  // Create SVG
  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  // Y scales for bipartite layout
  const userY = d3
    .scalePoint()
    .domain(users.map(d => d.id))
    .range([0, chartHeight])
    .padding(0.5);

  const agencyY = d3
    .scalePoint()
    .domain(agencies.map(d => d.id))
    .range([0, chartHeight])
    .padding(0.5);

  // X positions
  const userX = 0;
  const agencyX = chartWidth;

  // Size scales
  const maxUserWeight = d3.max(users, d => d.weight);
  const maxAgencyWeight = d3.max(agencies, d => d.weight);
  const maxLinkWeight = d3.max(filteredData, d => d.weight);

  const userRadiusScale = d3
    .scaleSqrt()
    .domain([0, maxUserWeight])
    .range([8, 22]);
  const agencyRadiusScale = d3
    .scaleSqrt()
    .domain([0, maxAgencyWeight])
    .range([12, 40]);
  const linkWidthScale = d3
    .scaleLinear()
    .domain([minWeightThreshold, maxLinkWeight])
    .range([2, 12]);
  const linkOpacityScale = d3
    .scaleLinear()
    .domain([minWeightThreshold, maxLinkWeight])
    .range([0.15, 0.5]);

  // Tooltip
  const tooltip = d3.select("#tooltip");
  const tooltipTitle = d3.select("#tt-title");
  const tooltipValue = d3.select("#tt-value");
  const tooltipDesc = d3.select("#tt-desc");

  // Draw links with curves - HIDDEN BY DEFAULT
  const links = g.append("g").attr("class", "links");

  const linkPaths = {};
  filteredData.forEach(d => {
    const sourceNode = usersMap.get(d.source);
    const targetNode = agenciesMap.get(d.target);
    if (!sourceNode || !targetNode) return;

    const x1 = userX + userRadiusScale(sourceNode.weight) + 4;
    const y1 = userY(d.source);
    const x2 = agencyX - agencyRadiusScale(targetNode.weight) - 4;
    const y2 = agencyY(d.target);

    // Control points for bezier curve
    const midX = (x1 + x2) / 2;

    const path = links
      .append("path")
      .attr("d", `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`)
      .attr("fill", "none")
      .attr("stroke", getClusterColor(d.target))
      .attr("stroke-width", linkWidthScale(d.weight))
      .attr("stroke-opacity", showAllLinks ? linkOpacityScale(d.weight) : 0)
      .attr("stroke-linecap", "round")
      .attr("class", `link`)
      .attr("data-source", d.source)
      .attr("data-target", d.target)
      .datum(d);

    const key = `${d.source}|||${d.target}`;
    linkPaths[key] = path;
  });

  // Helper to highlight a node's connections
  function highlightNode(nodeId, nodeType) {
    // Reset all links
    g.selectAll(".link").attr("stroke-opacity", 0);

    // Show only this node's links
    g.selectAll(".link").each(function (d) {
      const link = d3.select(this);
      const isConnected =
        (nodeType === "user" && d.source === nodeId) ||
        (nodeType === "agency" && d.target === nodeId);
      if (isConnected) {
        link
          .attr("stroke-opacity", 0.85)
          .attr("stroke-width", linkWidthScale(d.weight) + 2);
      }
    });

    // Dim other nodes
    g.selectAll(".user-node").attr("opacity", n => {
      if (nodeType === "user") return n.id === nodeId ? 1 : 0.3;
      const connections = usersMap.get(n.id)?.connections || [];
      return connections.some(c => c.target === nodeId) ? 1 : 0.3;
    });
    g.selectAll(".agency-node").attr("opacity", n => {
      if (nodeType === "agency") return n.id === nodeId ? 1 : 0.3;
      const connections = agenciesMap.get(n.id)?.connections || [];
      return connections.some(c => c.source === nodeId) ? 1 : 0.3;
    });
  }

  function resetHighlight() {
    if (lockedNode) return; // Don't reset if locked
    g.selectAll(".link").each(function (d) {
      d3.select(this)
        .attr("stroke-opacity", showAllLinks ? linkOpacityScale(d.weight) : 0)
        .attr("stroke-width", linkWidthScale(d.weight));
    });
    g.selectAll(".user-node, .agency-node").attr("opacity", 1);
  }

  // Draw user nodes (left side)
  const userNodes = g.append("g").attr("class", "user-nodes");

  users.forEach(user => {
    const nodeG = userNodes
      .append("g")
      .attr("class", "user-node")
      .attr("transform", `translate(${userX}, ${userY(user.id)})`)
      .style("cursor", "pointer")
      .datum(user);

    nodeG
      .append("circle")
      .attr("r", userRadiusScale(user.weight))
      .attr("fill", "#8b5cf6")
      .attr("stroke", "#a78bfa")
      .attr("stroke-width", 2);

    nodeG
      .append("text")
      .attr("x", -userRadiusScale(user.weight) - 8)
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .attr("fill", "#e5e7eb")
      .attr("font-size", "12px")
      .text(user.id);

    // Interactions
    nodeG
      .on("mouseover", function () {
        if (!lockedNode) {
          highlightNode(user.id, "user");
        }
        d3.select(this)
          .select("circle")
          .attr("stroke", "#00d4ff")
          .attr("stroke-width", 3);

        tooltip.style("opacity", 1);
        tooltipTitle.text(user.id);
        const topAgencies = [...user.connections].sort(
          (a, b) => b.weight - a.weight,
        );
        tooltipValue.text(
          `${user.weight} голосов → ${topAgencies.length} агентств`,
        );
        tooltipDesc.html(
          topAgencies
            .map(
              c =>
                `<span style="color:${getClusterColor(c.target)}">${c.target}: ${c.weight}</span>`,
            )
            .join("<br>"),
        );
      })
      .on("mousemove", function (event) {
        const containerRect = container.getBoundingClientRect();
        tooltip
          .style("left", event.clientX - containerRect.left + 15 + "px")
          .style("top", event.clientY - containerRect.top + 15 + "px");
      })
      .on("mouseout", function () {
        if (lockedNode !== user.id) {
          d3.select(this)
            .select("circle")
            .attr("stroke", "#a78bfa")
            .attr("stroke-width", 2);
        }
        if (!lockedNode) resetHighlight();
        tooltip.style("opacity", 0);
      })
      .on("click", function (event) {
        event.stopPropagation();
        if (lockedNode === user.id) {
          // Unlock
          lockedNode = null;
          d3.select(this)
            .select("circle")
            .attr("stroke", "#a78bfa")
            .attr("stroke-width", 2);
          resetHighlight();
          updateLockIndicator(null);
        } else {
          // Lock to this node
          if (lockedNode) {
            // Reset previous locked node style
            g.selectAll(".user-node, .agency-node")
              .select("circle")
              .attr("stroke", function (d) {
                return d.type === "user" ? "#a78bfa" : "#fff";
              })
              .attr("stroke-width", 2);
          }
          lockedNode = user.id;
          highlightNode(user.id, "user");
          d3.select(this)
            .select("circle")
            .attr("stroke", "#00d4ff")
            .attr("stroke-width", 4);
          updateLockIndicator(user.id);
        }
      });
  });

  // Draw agency nodes (right side)
  const agencyNodes = g.append("g").attr("class", "agency-nodes");

  agencies.forEach(agency => {
    const nodeG = agencyNodes
      .append("g")
      .attr("class", "agency-node")
      .attr("transform", `translate(${agencyX}, ${agencyY(agency.id)})`)
      .style("cursor", "pointer")
      .datum(agency);

    nodeG
      .append("circle")
      .attr("r", agencyRadiusScale(agency.weight))
      .attr("fill", getClusterColor(agency.id))
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    nodeG
      .append("text")
      .attr("x", agencyRadiusScale(agency.weight) + 10)
      .attr("dy", "0.35em")
      .attr("text-anchor", "start")
      .attr("fill", "#e5e7eb")
      .attr("font-size", "12px")
      .attr("font-weight", "bold")
      .text(
        agency.id.length > 22 ? agency.id.substring(0, 20) + "..." : agency.id,
      );

    // Interactions
    nodeG
      .on("mouseover", function () {
        if (!lockedNode) {
          highlightNode(agency.id, "agency");
        }
        d3.select(this)
          .select("circle")
          .attr("stroke", "#00d4ff")
          .attr("stroke-width", 3);

        tooltip.style("opacity", 1);
        tooltipTitle.text(agency.id);
        const topUsers = [...agency.connections].sort(
          (a, b) => b.weight - a.weight,
        );
        tooltipValue.text(
          `${agency.weight} голосов ← ${topUsers.length} пользователей`,
        );
        tooltipDesc.html(
          topUsers
            .map(
              c =>
                `<span style="color:#8b5cf6">${c.source}: ${c.weight}</span>`,
            )
            .join("<br>"),
        );
      })
      .on("mousemove", function (event) {
        const containerRect = container.getBoundingClientRect();
        tooltip
          .style("left", event.clientX - containerRect.left + 15 + "px")
          .style("top", event.clientY - containerRect.top + 15 + "px");
      })
      .on("mouseout", function () {
        if (lockedNode !== agency.id) {
          d3.select(this)
            .select("circle")
            .attr("stroke", "#fff")
            .attr("stroke-width", 2);
        }
        if (!lockedNode) resetHighlight();
        tooltip.style("opacity", 0);
      })
      .on("click", function (event) {
        event.stopPropagation();
        if (lockedNode === agency.id) {
          lockedNode = null;
          d3.select(this)
            .select("circle")
            .attr("stroke", "#fff")
            .attr("stroke-width", 2);
          resetHighlight();
          updateLockIndicator(null);
        } else {
          if (lockedNode) {
            g.selectAll(".user-node, .agency-node")
              .select("circle")
              .attr("stroke", function (d) {
                return d.type === "user" ? "#a78bfa" : "#fff";
              })
              .attr("stroke-width", 2);
          }
          lockedNode = agency.id;
          highlightNode(agency.id, "agency");
          d3.select(this)
            .select("circle")
            .attr("stroke", "#00d4ff")
            .attr("stroke-width", 4);
          updateLockIndicator(agency.id);
        }
      });
  });

  // Click on background to unlock
  svg.on("click", function () {
    if (lockedNode) {
      lockedNode = null;
      g.selectAll(".user-node")
        .select("circle")
        .attr("stroke", "#a78bfa")
        .attr("stroke-width", 2);
      g.selectAll(".agency-node")
        .select("circle")
        .attr("stroke", "#fff")
        .attr("stroke-width", 2);
      resetHighlight();
      updateLockIndicator(null);
    }
  });

  // Column headers
  svg
    .append("text")
    .attr("x", margin.left)
    .attr("y", margin.top - 20)
    .attr("text-anchor", "start")
    .attr("fill", "#8b5cf6")
    .attr("font-size", "14px")
    .attr("font-weight", "bold")
    .text(`Пользователи (${users.length})`);

  svg
    .append("text")
    .attr("x", margin.left + chartWidth)
    .attr("y", margin.top - 20)
    .attr("text-anchor", "start")
    .attr("fill", "#4ECDC4")
    .attr("font-size", "14px")
    .attr("font-weight", "bold")
    .text(`Агентства (${agencies.length})`);

  // Stats
  const stats = document.createElement("div");
  stats.className =
    "mt-4 p-3 bg-surface-light rounded-lg border border-border text-sm text-gray-400";
  stats.innerHTML = `
        <span class="text-white font-medium">${filteredData.length}</span> связей 
        (мин. вес: ${minWeightThreshold}) | 
        Наведите на узел чтобы увидеть связи | 
        <span class="text-accent-cyan">Кликните чтобы закрепить</span>
    `;
  container.appendChild(stats);
}

function addNetworkControls(container, data, users, agencies) {
  const maxWeight = d3.max(data, d => d.weight);

  const controlsDiv = document.createElement("div");
  controlsDiv.className =
    "flex flex-wrap items-center gap-4 mb-4 p-4 bg-surface-light rounded-lg border border-border";
  controlsDiv.innerHTML = `
        <div class="flex items-center gap-2">
            <label class="text-sm text-gray-400">Мин. вес:</label>
            <input type="range" id="weight-slider" min="1" max="${Math.min(maxWeight, 15)}" value="${minWeightThreshold}" 
                   class="w-32 accent-accent-violet">
            <span id="weight-value" class="font-mono text-accent-cyan w-6">${minWeightThreshold}</span>
        </div>
        <div class="h-6 w-px bg-border"></div>
        <div class="flex items-center gap-2">
            <button id="toggle-links" class="px-3 py-1 rounded text-sm font-medium transition-all ${showAllLinks ? "bg-accent-violet text-white" : "bg-surface border border-border text-gray-400 hover:text-white"}">
                ${showAllLinks ? "✓ Все связи" : "○ Все связи"}
            </button>
        </div>
        <div class="h-6 w-px bg-border"></div>
        <div class="flex items-center gap-2">
            <label class="text-sm text-gray-400">Перейти к:</label>
            <select id="user-select" class="bg-surface border border-border rounded px-2 py-1 text-sm text-white">
                <option value="">— Пользователь —</option>
                ${users.map(u => `<option value="${u.id}">${u.id}</option>`).join("")}
            </select>
            <select id="agency-select" class="bg-surface border border-border rounded px-2 py-1 text-sm text-white">
                <option value="">— Агентство —</option>
                ${agencies.map(a => `<option value="${a.id}">${a.id}</option>`).join("")}
            </select>
        </div>
        <div class="h-6 w-px bg-border"></div>
        <div id="lock-indicator" class="text-sm text-gray-500">
            <span class="text-gray-400">Закреплено:</span> <span id="lock-name">—</span>
        </div>
    `;

  container.appendChild(controlsDiv);

  // Weight slider
  const slider = document.getElementById("weight-slider");
  const valueDisplay = document.getElementById("weight-value");

  slider.addEventListener("input", e => {
    valueDisplay.textContent = e.target.value;
  });

  slider.addEventListener("change", e => {
    minWeightThreshold = parseInt(e.target.value);
    renderView(currentView);
  });

  // Toggle all links button
  document
    .getElementById("toggle-links")
    .addEventListener("click", function () {
      showAllLinks = !showAllLinks;
      renderView(currentView);
    });

  // Dropdown selections
  document
    .getElementById("user-select")
    .addEventListener("change", function () {
      if (this.value) {
        selectNode(this.value, "user");
        this.value = "";
      }
    });

  document
    .getElementById("agency-select")
    .addEventListener("change", function () {
      if (this.value) {
        selectNode(this.value, "agency");
        this.value = "";
      }
    });
}

function selectNode(nodeId, nodeType) {
  // Find and click the node
  const selector = nodeType === "user" ? ".user-node" : ".agency-node";
  d3.selectAll(selector).each(function (d) {
    if (d.id === nodeId) {
      d3.select(this).dispatch("click");
    }
  });
}

function updateLockIndicator(nodeName) {
  const indicator = document.getElementById("lock-name");
  if (indicator) {
    indicator.textContent = nodeName || "—";
    indicator.style.color = nodeName ? "#00d4ff" : "#6b7280";
  }
}

// ============================================
// VIEW 4: Fallback Bar Chart
// ============================================
function renderBarChart(data) {
  const container = document.getElementById("chart-container");
  const margin = { top: 20, right: 30, bottom: 40, left: 200 };
  const width = container.clientWidth - margin.left - margin.right;
  const itemHeight = 35;
  const height = Math.max(400, data.length * itemHeight);

  container.style.height = `${height + margin.top + margin.bottom}px`;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Find the key to display
  const keys = Object.keys(data[0]);
  const nameKey = keys.find(k => k.toLowerCase().includes("name")) || keys[0];
  const valueKey = keys.find(k => typeof data[0][k] === "number") || keys[1];

  const x = d3
    .scaleLinear()
    .domain([0, d3.max(data, d => d[valueKey])])
    .nice()
    .range([0, width]);

  const y = d3
    .scaleBand()
    .domain(data.map(d => d[nameKey]))
    .range([0, height])
    .padding(0.3);

  // Gradient
  const defs = svg.append("defs");
  const gradient = defs
    .append("linearGradient")
    .attr("id", "bar-gradient")
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "100%")
    .attr("y2", "0%");

  gradient.append("stop").attr("offset", "0%").attr("stop-color", "#8b5cf6");
  gradient.append("stop").attr("offset", "100%").attr("stop-color", "#00d4ff");

  // Bars
  svg
    .selectAll(".bar")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", 0)
    .attr("y", d => y(d[nameKey]))
    .attr("width", 0)
    .attr("height", y.bandwidth())
    .attr("fill", "url(#bar-gradient)")
    .attr("rx", 4)
    .transition()
    .duration(800)
    .attr("width", d => x(d[valueKey]));

  // Y axis labels
  svg
    .append("g")
    .selectAll("text")
    .data(data)
    .enter()
    .append("text")
    .attr("x", -10)
    .attr("y", d => y(d[nameKey]) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "end")
    .attr("fill", "#e5e7eb")
    .attr("font-size", "12px")
    .text(d => d[nameKey]);

  // Value labels
  svg
    .selectAll(".value-label")
    .data(data)
    .enter()
    .append("text")
    .attr("x", d => x(d[valueKey]) + 8)
    .attr("y", d => y(d[nameKey]) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("fill", "#9ca3af")
    .attr("font-size", "12px")
    .attr("font-family", "'JetBrains Mono', monospace")
    .text(d => d[valueKey]);
}

// Handle resize
let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    renderView(currentView);
  }, 250);
});

// Initialize
init();
