class BarChartRace {
    constructor(selector, options = {}) {
        this.selector = selector;
        this.options = {
            width: options.width || 1000,
            margin: options.margin || { top: 30, right: 120, bottom: 20, left: 200 },
            barPadding: options.barPadding || 0.1,
            topN: options.topN != null ? options.topN : 0,
            duration: options.duration || 200,
            barSlotHeight: options.barSlotHeight || 33,
            ...options
        };
        this.ids = options.ids || {};

        this.data = [];
        this.dateValues = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.timer = null;
        this.onDateChange = null;

        this.init();
    }

    sel(name) { return this.ids[name] ? '#' + this.ids[name] : null; }

    init() {
        const { width, margin } = this.options;

        this.innerWidth = width - margin.left - margin.right;
        this.innerHeight = 400;
        const height = margin.top + this.innerHeight + margin.bottom;

        this.svg = d3.select(this.selector)
            .append('svg')
            .attr('viewBox', `0 0 ${width} ${height}`);

        this.g = this.svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        this.x = d3.scaleLinear().range([0, this.innerWidth]);
        this.y = d3.scaleBand().range([0, this.innerHeight]).padding(this.options.barPadding);

        if (!this.colorMap) this.colorMap = new Map();

        this.gridG = this.g.append('g').attr('class', 'grid');
        this.xAxisG = this.g.append('g').attr('class', 'axis x-axis');
        this.barsG = this.g.append('g').attr('class', 'bars');

        this.dateLabel = this.sel('dateOverlay') ? d3.select(this.sel('dateOverlay')) : null;

        this.tooltip = d3.select('body')
            .append('div')
            .attr('class', 'tooltip');

        this.setupControls();
    }

    setupControls() {
        const s = (n) => this.sel(n);
        if (s('playPauseBtn')) {
            d3.select(s('playPauseBtn')).on('click', () => {
                if (this.isPlaying) this.pause();
                else this.start();
            });
        }
        if (s('speedSlider')) {
            d3.select(s('speedSlider')).on('input', (event) => {
                const daysPerSec = +event.target.value;
                this.options.duration = Math.round(1000 / daysPerSec);
                if (s('speedValue')) d3.select(s('speedValue')).text(`${daysPerSec} дней/сек`);
                if (this.isPlaying) { this.pause(); this.start(); }
            });
        }
        if (s('topN')) {
            d3.select(s('topN')).on('change', (event) => {
                this.options.topN = +event.target.value;
                this.updateChart(this.dateValues[this.currentIndex].date, false);
            });
        }
        if (s('dateStart') || s('dateEnd')) {
            const applyRange = () => {
                const startEl = s('dateStart') ? document.querySelector(s('dateStart')) : null;
                const endEl = s('dateEnd') ? document.querySelector(s('dateEnd')) : null;
                this.setDateRange(startEl ? startEl.value : null, endEl ? endEl.value : null);
            };
            if (s('dateStart')) d3.select(s('dateStart')).on('change', applyRange);
            if (s('dateEnd')) d3.select(s('dateEnd')).on('change', applyRange);
            if (s('dateReset')) {
                d3.select(s('dateReset')).on('click', () => {
                    if (s('dateStart')) document.querySelector(s('dateStart')).value = '';
                    if (s('dateEnd')) document.querySelector(s('dateEnd')).value = '';
                    this.setDateRange(null, null);
                });
            }
        }
    }

    // Called after data is loaded to set input min/max and default values
    initDateInputs() {
        if (!this.allDateValues || this.allDateValues.length === 0) return;
        const first = this.allDateValues[0].date;
        const last = this.allDateValues[this.allDateValues.length - 1].date;
        const s = (n) => this.sel(n);
        if (s('dateStart')) {
            const el = document.querySelector(s('dateStart'));
            if (el) { el.min = first; el.max = last; el.placeholder = first; }
        }
        if (s('dateEnd')) {
            const el = document.querySelector(s('dateEnd'));
            if (el) { el.min = first; el.max = last; el.placeholder = last; }
        }
    }

    async loadData(url) {
        d3.select(this.selector).html('<div class="loading">Загрузка данных</div>');

        try {
            this.data = await d3.json(url);

            const grouped = d3.group(this.data, d => d.date);
            this.allDateValues = Array.from(grouped, ([date, values]) => ({
                date,
                values: values.sort((a, b) => b.value - a.value)
            })).sort((a, b) => new Date(a.date) - new Date(b.date));
            this.dateValues = this.allDateValues;

            const allNames = [...new Set(this.data.map(d => d.name))];
            const goldenAngle = 137.508;
            const chromaLevels = [45, 60, 75, 55, 70];
            const lightLevels = [55, 70, 82, 63, 76];
            allNames.forEach((name, i) => {
                const hue = (i * goldenAngle) % 360;
                const chroma = chromaLevels[i % chromaLevels.length];
                const lightness = lightLevels[i % lightLevels.length];
                this.colorMap.set(name, d3.hcl(hue, chroma, lightness).formatRgb());
            });

            d3.select(this.selector).html('');
            this.init();

            if (this.dateValues.length > 0) {
                this.updateChart(this.dateValues[0].date, false);
                this.initScrubber();
                this.initDateInputs();
                this.start();
            }

            console.log(`Loaded ${this.data.length} records, ${this.dateValues.length} dates`);
        } catch (error) {
            console.error('Error loading data:', error);
            d3.select(this.selector).html(`<div class="loading" style="color: red;">Error: ${error.message}</div>`);
        }
    }

    loadFromParsed(barsData) {
        const grouped = d3.group(barsData, d => d.date);
        this.allDateValues = Array.from(grouped, ([date, values]) => ({
            date,
            values: values.sort((a, b) => b.value - a.value)
        })).sort((a, b) => new Date(a.date) - new Date(b.date));
        this.dateValues = this.allDateValues;

        const allNames = [...new Set(barsData.map(d => d.name))];
        const goldenAngle = 137.508;
        const chromaLevels = [40, 55, 70, 85, 50, 65, 80, 45, 60, 75];
        const lightLevels = [50, 65, 80, 58, 73, 55, 70, 85, 62, 77];
        allNames.forEach((name, i) => {
            const hue = (i * goldenAngle) % 360;
            const chroma = chromaLevels[i % chromaLevels.length];
            const lightness = lightLevels[i % lightLevels.length];
            this.colorMap.set(name, d3.hcl(hue, chroma, lightness).formatRgb());
        });

        d3.select(this.selector).html('');
        this.init();

        if (this.dateValues.length > 0) {
            this.updateChart(this.dateValues[0].date, false);
            this.initScrubber();
            this.initDateInputs();
            this.start();
        }
    }

    getDateData(date) {
        const entry = this.dateValues.find(d => d.date === date);
        if (!entry) return [];
        return this.options.topN > 0 ? entry.values.slice(0, this.options.topN) : entry.values;
    }

    // Apply a date range filter. Pass null/undefined to reset to full range.
    setDateRange(startStr, endStr) {
        if (!this.allDateValues) return;

        const startDate = startStr ? new Date(startStr) : null;
        const endDate = endStr ? new Date(endStr) : null;

        if (startDate && endDate && startDate > endDate) return; // invalid range

        this.dateValues = this.allDateValues.filter(d => {
            const t = new Date(d.date);
            if (startDate && t < startDate) return false;
            if (endDate && t > endDate) return false;
            return true;
        });

        if (this.dateValues.length === 0) {
            // Nothing to show — revert silently
            this.dateValues = this.allDateValues;
            return;
        }

        this.pause();
        this.currentIndex = 0;
        this.updateChart(this.dateValues[0].date, false);
        this.initScrubber();
        this.start();
    }

    updateChart(date, animate = true) {
        const data = this.getDateData(date);
        const duration = animate ? this.options.duration : 0;
        if (data.length === 0) return;

        const barSlotHeight = this.options.barSlotHeight;
        const { width, margin } = this.options;
        this.innerHeight = Math.max(200, data.length * barSlotHeight);
        const totalHeight = margin.top + this.innerHeight + margin.bottom;

        this.svg.attr('viewBox', `0 0 ${width} ${totalHeight}`);
        this.y.range([0, this.innerHeight]);

        if (this.dateLabel) this.dateLabel.text(this.formatDate(date));
        if (this.onDateChange) this.onDateChange(date);

        this.x.domain([0, d3.max(data, d => d.value) * 1.1]);
        this.y.domain(data.map(d => d.name));

        const maxVal = d3.max(data, d => d.value) * 1.1;
        const tickStep = this.options.tickStep || (maxVal > 50000 ? 10000 : maxVal > 5000 ? 5000 : maxVal > 50 ? 10 : maxVal > 20 ? 5 : 2);
        const tickVals = d3.range(0, maxVal + tickStep, tickStep);

        const valueFormat = this.options.valueFormat || (maxVal > 100 ? d3.format(',d') : (d => d % 1 === 0 ? d : d.toFixed(1)));

        this.xAxisG.transition()
            .duration(duration)
            .call(d3.axisTop(this.x)
                .tickValues(tickVals)
                .tickFormat(valueFormat)
                .tickSize(0))
            .call(g => g.select('.domain').remove());

        const gridLines = this.gridG.selectAll('line').data(tickVals, d => d);
        gridLines.exit().remove();
        gridLines.enter()
            .append('line')
            .attr('class', 'grid-line')
            .attr('y1', 0)
            .attr('stroke', '#444')
            .attr('stroke-width', 0.5)
            .attr('stroke-dasharray', '2,2')
          .merge(gridLines)
            .transition().duration(duration)
            .attr('x1', d => this.x(d))
            .attr('x2', d => this.x(d))
            .attr('y2', this.innerHeight);

        const bars = this.barsG.selectAll('.bar-group').data(data, d => d.name);

        bars.exit()
            .transition().duration(duration * 3).ease(d3.easeLinear)
            .attr('transform', `translate(0,${this.innerHeight})`)
            .style('opacity', 0)
            .remove();

        const barsEnter = bars.enter()
            .append('g')
            .attr('class', 'bar-group')
            .attr('transform', `translate(0,${this.innerHeight})`)
            .style('opacity', 0);

        barsEnter.append('rect')
            .attr('class', 'bar')
            .attr('height', this.y.bandwidth())
            .attr('fill', d => this.colorMap.get(d.name) || '#999');

        barsEnter.append('text')
            .attr('class', 'label')
            .attr('x', -5)
            .attr('y', this.y.bandwidth() / 2)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'end');

        barsEnter.append('text')
            .attr('class', 'value-label')
            .attr('y', this.y.bandwidth() / 2)
            .attr('dy', '0.35em');

        const barsUpdate = barsEnter.merge(bars);

        barsUpdate.transition().duration(duration).ease(d3.easeLinear)
            .attr('transform', d => `translate(0,${this.y(d.name)})`)
            .style('opacity', 1);

        barsUpdate.select('.bar')
            .transition().duration(duration).ease(d3.easeLinear)
            .attr('width', d => Math.max(0, this.x(d.value)))
            .attr('height', this.y.bandwidth());

        barsUpdate.select('.label')
            .text(d => this.truncateName(d.name, 25))
            .attr('y', this.y.bandwidth() / 2);

        const labelFormat = this.options.labelFormat || (maxVal > 100
            ? (prev, val) => {
                const interp = d3.interpolateNumber(prev, val);
                return t => d3.format(',d')(Math.round(interp(t)));
            }
            : (prev, val) => {
                const interp = d3.interpolateNumber(prev, val);
                return t => interp(t).toFixed(1);
            });

        barsUpdate.select('.value-label')
            .transition().duration(duration)
            .attr('x', d => this.x(d.value) + 5)
            .attr('y', this.y.bandwidth() / 2)
            .tween('text', function(d) {
                const node = this;
                const prev = parseFloat(node.textContent.replace(/,/g, '')) || 0;
                const fn = labelFormat(prev, d.value);
                return t => { node.textContent = fn(t); };
            });

        const tooltipHtml = this.options.tooltipHtml || (d =>
            `<strong>${d.name}</strong><br>Posts: ${d3.format(',d')(d.value)}<br>ID: ${d.identity_key || 'N/A'}`);

        barsUpdate
            .on('mouseenter', (event, d) => {
                this.tooltip.classed('visible', true)
                    .html(tooltipHtml(d))
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
            })
            .on('mousemove', (event) => {
                this.tooltip
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseleave', () => { this.tooltip.classed('visible', false); });
    }

    truncateName(name, max) {
        if (!name) return '';
        return name.length > max ? name.substring(0, max) + '...' : name;
    }

    formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    }

    start() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.updatePlayIcon();

        const tick = () => {
            if (this.currentIndex >= this.dateValues.length - 1) {
                this.pause();
                return;
            }
            this.currentIndex++;
            this.updateChart(this.dateValues[this.currentIndex].date, true);
            this.updateScrubberPosition();
            if (this.isPlaying) {
                this.timer = setTimeout(tick, this.options.duration);
            }
        };
        tick();
    }

    pause() {
        this.isPlaying = false;
        this.updatePlayIcon();
        if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    }

    goToDate(date) {
        const index = this.dateValues.findIndex(d => d.date === date);
        if (index !== -1) {
            this.currentIndex = index;
            this.updateChart(date, false);
            this.updateScrubberPosition();
        }
    }

    initScrubber() {
        const scrubberSel = this.sel('scrubber');
        if (!scrubberSel) return;
        const scrubberEl = d3.select(scrubberSel);
        scrubberEl.html('');

        const totalWidth = this.options.width;
        const scrubberHeight = 60;
        const playBtnSize = 30;
        const trackLeft = 60;
        const trackRight = 20;
        const trackWidth = totalWidth - trackLeft - trackRight;

        this.scrubberScale = d3.scaleLinear()
            .domain([0, this.dateValues.length - 1])
            .range([0, trackWidth])
            .clamp(true);

        const scrubberSvg = scrubberEl.append('svg')
            .attr('viewBox', `0 0 ${totalWidth} ${scrubberHeight}`)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .attr('class', 'scrubber-svg');

        const playBtn = scrubberSvg.append('g')
            .attr('class', 'scrubber-play-btn')
            .attr('transform', `translate(${playBtnSize / 2 + 4}, ${scrubberHeight / 2 - 8})`)
            .style('cursor', 'pointer');

        playBtn.append('circle')
            .attr('r', playBtnSize / 2)
            .attr('fill', '#ccc');

        this.playIcon = playBtn.append('path')
            .attr('d', 'M-5,-8 L-5,8 L8,0 Z')
            .attr('fill', '#1a1a2e');

        playBtn.on('click', () => {
            if (this.isPlaying) this.pause(); else this.start();
            this.updatePlayIcon();
        });

        const trackG = scrubberSvg.append('g')
            .attr('transform', `translate(${trackLeft}, ${scrubberHeight / 2 - 8})`);

        trackG.append('line')
            .attr('x1', 0).attr('x2', trackWidth)
            .attr('y1', 0).attr('y2', 0)
            .attr('stroke', '#666').attr('stroke-width', 2);

        const tickCount = Math.min(10, this.dateValues.length);
        const tickStep = Math.floor((this.dateValues.length - 1) / (tickCount - 1));
        const tickIndices = [];
        for (let i = 0; i < tickCount - 1; i++) tickIndices.push(i * tickStep);
        tickIndices.push(this.dateValues.length - 1);

        tickIndices.forEach(i => {
            const xPos = this.scrubberScale(i);
            trackG.append('line')
                .attr('x1', xPos).attr('x2', xPos).attr('y1', -4).attr('y2', 4)
                .attr('stroke', '#666').attr('stroke-width', 1);
            trackG.append('text')
                .attr('x', xPos).attr('y', 20).attr('text-anchor', 'middle')
                .attr('fill', '#888').style('font-size', '10px')
                .text(this.dateValues[i].date);
        });

        this.scrubberHandle = trackG.append('path')
            .attr('d', 'M-6,-10 L6,-10 L0,0 Z')
            .attr('fill', '#aaa').attr('stroke', '#888').attr('stroke-width', 0.5)
            .style('pointer-events', 'none');

        this.updateScrubberPosition();

        const scrubberJump = (localX) => {
            const idx = Math.round(this.scrubberScale.invert(localX));
            const clamped = Math.max(0, Math.min(this.dateValues.length - 1, idx));
            if (clamped !== this.currentIndex) {
                this.currentIndex = clamped;
                this.updateChart(this.dateValues[clamped].date, false);
                this.updateScrubberPosition();
            }
        };

        const drag = d3.drag()
            .on('start', (event) => { scrubberJump(d3.pointer(event, trackG.node())[0]); })
            .on('drag', (event) => { scrubberJump(d3.pointer(event, trackG.node())[0]); });

        trackG.append('rect')
            .attr('x', 0).attr('y', -15).attr('width', trackWidth).attr('height', 30)
            .attr('fill', 'transparent').style('cursor', 'pointer')
            .call(drag);
    }

    updateScrubberPosition() {
        if (!this.scrubberHandle || !this.scrubberScale) return;
        this.scrubberHandle.attr('transform', `translate(${this.scrubberScale(this.currentIndex)}, 0)`);
    }

    updatePlayIcon() {
        if (this.playIcon) {
            this.playIcon.attr('d', this.isPlaying
                ? 'M-6,-8 L-6,8 L-2,8 L-2,-8 Z M3,-8 L3,8 L7,8 L7,-8 Z'
                : 'M-5,-8 L-5,8 L8,0 Z');
        }
        const s = this.sel('playPauseBtn');
        if (s) {
            const btn = d3.select(s);
            if (!btn.empty()) btn.text(this.isPlaying ? 'Пауза' : 'Запустить анимацию');
        }
    }
}


class SpeedOverlay {
    constructor(selector) {
        this.selector = selector;
        this.data = [];
        this.dateIndex = new Map();
        this.barChart = null;
    }

    async load(url) {
        const raw = await d3.json(url);
        this.data = raw.daily;
        this.data.forEach((d, i) => this.dateIndex.set(d.date, i));
        this.render();
    }

    render() {
        const el = d3.select(this.selector);
        el.html('');

        const margin = { top: 14, right: 10, bottom: 20, left: 40 };
        const width = 380;
        const height = 130;
        const w = width - margin.left - margin.right;
        const h = height - margin.top - margin.bottom;

        const svg = el.append('svg')
            .attr('viewBox', `0 0 ${width} ${height}`);

        const defs = svg.append('defs');
        const grad = defs.append('linearGradient')
            .attr('id', 'speedGradient')
            .attr('x1', '0%').attr('y1', '0%')
            .attr('x2', '0%').attr('y2', '100%');
        grad.append('stop').attr('offset', '0%').attr('stop-color', '#3a7bd5').attr('stop-opacity', 0.4);
        grad.append('stop').attr('offset', '100%').attr('stop-color', '#3a7bd5').attr('stop-opacity', 0.05);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const parseDate = d => new Date(d.date);

        this.xScale = d3.scaleTime()
            .domain(d3.extent(this.data, parseDate))
            .range([0, w]);

        this.yScale = d3.scaleLinear()
            .domain([0, d3.max(this.data, d => d.rolling_30d) * 1.15])
            .range([h, 0]);

        g.append('g')
            .attr('class', 'speed-axis')
            .attr('transform', `translate(0,${h})`)
            .call(d3.axisBottom(this.xScale).ticks(5).tickFormat(d3.timeFormat('%b %y')).tickSize(3))
            .call(ax => ax.select('.domain').remove());

        g.append('g')
            .attr('class', 'speed-axis')
            .call(d3.axisLeft(this.yScale).ticks(3).tickFormat(d3.format('~s')).tickSize(3))
            .call(ax => ax.select('.domain').remove());

        const area = d3.area()
            .x(d => this.xScale(parseDate(d)))
            .y0(h)
            .y1(d => this.yScale(d.rolling_30d))
            .curve(d3.curveBasis);

        const line = d3.line()
            .x(d => this.xScale(parseDate(d)))
            .y(d => this.yScale(d.rolling_30d))
            .curve(d3.curveBasis);

        g.append('path').datum(this.data).attr('class', 'speed-area').attr('d', area);
        g.append('path').datum(this.data).attr('class', 'speed-line').attr('d', line);

        this.marker = g.append('line')
            .attr('class', 'speed-marker')
            .attr('y1', 0).attr('y2', h)
            .attr('stroke-dasharray', '3,2')
            .style('display', 'none');

        this.dot = g.append('circle').attr('r', 3).attr('fill', '#fff').style('display', 'none');

        this.valueLabel = g.append('text')
            .attr('class', 'speed-value')
            .attr('text-anchor', 'end');

        g.append('text')
            .attr('class', 'speed-label')
            .attr('x', w).attr('y', -4)
            .attr('text-anchor', 'end')
            .text('постов/день (вкл. анонимов)');

        // Scrubber interaction
        const bisect = d3.bisector(d => new Date(d.date)).left;
        const jumpToX = (mx) => {
            if (!this.barChart) return;
            const dateAtMouse = this.xScale.invert(mx);
            const idx = bisect(this.data, dateAtMouse);
            const clamped = Math.max(0, Math.min(this.data.length - 1, idx));
            const dateStr = this.data[clamped].date;
            this.barChart.goToDate(dateStr);
        };

        const drag = d3.drag()
            .on('start', (event) => { jumpToX(d3.pointer(event, g.node())[0]); })
            .on('drag', (event) => { jumpToX(d3.pointer(event, g.node())[0]); });

        g.append('rect')
            .attr('width', w).attr('height', h)
            .attr('fill', 'transparent')
            .style('cursor', 'ew-resize')
            .call(drag);

        this.g = g;
        this.w = w;
        this.h = h;
    }

    highlightDate(dateStr) {
        const idx = this.dateIndex.get(dateStr);
        if (idx == null) {
            this.marker.style('display', 'none');
            this.dot.style('display', 'none');
            this.valueLabel.text('');
            return;
        }
        const d = this.data[idx];
        const x = this.xScale(new Date(d.date));
        const y = this.yScale(d.rolling_30d);

        this.marker.style('display', null).attr('x1', x).attr('x2', x);
        this.dot.style('display', null).attr('cx', x).attr('cy', y);
        this.valueLabel
            .attr('x', x + 8)
            .attr('y', y)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'start')
            .text(d3.format(',.0f')(d.rolling_30d));
    }
}


class UserLineChart {
    constructor(selector) {
        this.selector = selector;
        this.selectedUsers = new Set(); // Multi-select instead of single soloUser
        this.linesData = [];
        this.colorMap = new Map();
        this.searchFilter = '';
    }

    render(linesData, colorMap) {
        this.linesData = linesData;
        this.colorMap = colorMap;
        this.selectedUsers = new Set();
        this.searchFilter = '';

        const el = d3.select(this.selector);
        el.html('');

        const margin = { top: 24, right: 20, bottom: 28, left: 50 };
        const width = 1400;
        const height = 400;
        const w = width - margin.left - margin.right;
        const h = height - margin.top - margin.bottom;

        const svg = el.append('svg')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .attr('preserveAspectRatio', 'none');

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const allDates = linesData.flatMap(u => u.data.map(d => new Date(d.date)));
        const allValues = linesData.flatMap(u => u.data.map(d => d.value));

        // Store original extents for reset
        this.allDateExtent = d3.extent(allDates);
        this.allMaxValue = d3.max(allValues) * 1.1;

        this.xScale = d3.scaleTime()
            .domain(this.allDateExtent)
            .range([0, w]);

        this.yScale = d3.scaleLinear()
            .domain([0, this.allMaxValue])
            .range([h, 0]);

        this.xAxisG = g.append('g')
            .attr('class', 'line-axis')
            .attr('transform', `translate(0,${h})`)
            .call(d3.axisBottom(this.xScale).ticks(10).tickFormat(d3.timeFormat('%b %y')).tickSize(4))
            .call(a => a.select('.domain').remove());

        this.yAxisG = g.append('g')
            .attr('class', 'line-axis')
            .call(d3.axisLeft(this.yScale).ticks(5).tickFormat(d3.format('~s')).tickSize(4))
            .call(a => a.select('.domain').remove());

        g.append('text')
            .attr('x', 0).attr('y', -10)
            .attr('fill', '#888').style('font-size', '12px')
            .text('пост/день');

        this.lineFn = d3.line()
            .x(d => this.xScale(new Date(d.date)))
            .y(d => this.yScale(d.value))
            .curve(d3.curveLinear);
        const lineFn = this.lineFn;

        // Build date index per user for hover lookup
        this.userDateIndex = {};
        linesData.forEach(user => {
            const map = new Map();
            user.data.forEach((d, i) => map.set(d.date, i));
            this.userDateIndex[user.identity_key] = map;
        });

        this.paths = {};
        linesData.forEach(user => {
            const color = colorMap.get(user.name) || '#999';
            this.paths[user.identity_key] = g.append('path')
                .datum(user.data)
                .attr('class', 'user-line')
                .attr('d', lineFn)
                .attr('stroke', color);
        });

        // HTML legend
        const legendEl = d3.select('#speed-legend');
        legendEl.html('');
        this.legendEl = legendEl;

        // Search/filter input
        const searchWrapper = legendEl.append('div').attr('class', 'legend-search-wrapper');
        this.searchInput = searchWrapper.append('input')
            .attr('type', 'text')
            .attr('class', 'legend-search')
            .attr('placeholder', 'Поиск...')
            .on('input', (event) => {
                this.searchFilter = event.target.value.toLowerCase();
                this.updateLegendFilter();
            });

        // Pinned/selected users chips container
        this.pinnedContainer = legendEl.append('div').attr('class', 'legend-pinned-container');

        legendEl.append('div').attr('class', 'legend-title').text('нажмите чтобы выделить · макс скорость →');

        // Container for legend items (for filtering)
        this.legendContainer = legendEl.append('div').attr('class', 'legend-items-container');

        const sorted = [...linesData].sort((a, b) => b.peak - a.peak);
        this.legendItems = {};
        this.sortedUsers = sorted; // Store for filtering
        this.userMap = new Map(linesData.map(u => [u.identity_key, u])); // Quick lookup

        sorted.forEach(user => {
            const color = colorMap.get(user.name) || '#999';
            const item = this.legendContainer.append('div')
                .attr('class', 'legend-item')
                .attr('data-name', user.name.toLowerCase())
                .attr('data-identity', user.identity_key)
                .on('click', () => this.toggleSelection(user.identity_key));

            item.append('span')
                .attr('class', 'legend-color')
                .style('background', color);

            item.append('span')
                .attr('class', 'legend-check')
                .text('✓');

            item.append('span')
                .attr('class', 'legend-name')
                .attr('title', user.name)
                .text(user.name);

            item.append('span')
                .attr('class', 'legend-peak')
                .text(user.peak.toFixed(1));

            this.legendItems[user.identity_key] = item;
        });

        // Vertical date marker (from animation sync)
        this.marker = g.append('line')
            .attr('class', 'line-marker')
            .attr('y1', 0).attr('y2', h)
            .style('display', 'none');

        // Hover dot + tooltip
        this.hoverDot = g.append('circle')
            .attr('r', 4).attr('fill', '#fff').attr('stroke', '#000').attr('stroke-width', 1)
            .style('display', 'none').style('pointer-events', 'none');

        this.tooltip = d3.select('body')
            .append('div')
            .attr('class', 'tooltip');

        // Invisible overlay for mouse events
        const bisect = d3.bisector(d => new Date(d.date)).left;

        g.append('rect')
            .attr('width', w).attr('height', h)
            .attr('fill', 'transparent')
            .style('cursor', 'crosshair')
            .on('mousemove', (event) => {
                const [mx, my] = d3.pointer(event, g.node());
                const dateAtMouse = this.xScale.invert(mx);
                const dateStr = d3.timeFormat('%Y-%m-%d')(dateAtMouse);

                let closest = null;
                let closestDist = Infinity;

                const hasSelection = this.selectedUsers.size > 0;
                const activeUsers = hasSelection
                    ? linesData.filter(u => this.selectedUsers.has(u.identity_key))
                    : linesData;

                const useSelectionSnap = hasSelection;

                for (const user of activeUsers) {
                    const idx = bisect(user.data, dateAtMouse);
                    for (const ci of [idx - 1, idx]) {
                        if (ci < 0 || ci >= user.data.length) continue;
                        const d = user.data[ci];
                        const px = this.xScale(new Date(d.date));
                        const py = this.yScale(d.value);
                        const dist = useSelectionSnap ? Math.abs(px - mx) : Math.hypot(px - mx, py - my);
                        if (dist < closestDist) {
                            closestDist = dist;
                            closest = { user, d, px, py };
                        }
                    }
                }

                if (closest && (useSelectionSnap || closestDist < 40)) {
                    const color = colorMap.get(closest.user.name) || '#999';
                    this.hoverDot
                        .style('display', null)
                        .attr('cx', closest.px).attr('cy', closest.py)
                        .attr('fill', color);
                    this.tooltip.classed('visible', true)
                        .html(`<strong>${closest.user.name}</strong><br>${closest.d.date}<br>${closest.d.value.toFixed(1)} пост/день`)
                        .style('left', (event.pageX + 12) + 'px')
                        .style('top', (event.pageY - 12) + 'px');
                } else {
                    this.hoverDot.style('display', 'none');
                    this.tooltip.classed('visible', false);
                }
            })
            .on('mouseleave', () => {
                this.hoverDot.style('display', 'none');
                this.tooltip.classed('visible', false);
            });

        this.g = g;
        this.h = h;
        this.w = w;
    }

    toggleSelection(identityKey) {
        if (this.selectedUsers.has(identityKey)) {
            this.selectedUsers.delete(identityKey);
        } else {
            this.selectedUsers.add(identityKey);
        }
        this.updateVisibility();
    }

    removeSelection(identityKey) {
        this.selectedUsers.delete(identityKey);
        this.updateVisibility();
    }

    updateLegendFilter() {
        const filter = this.searchFilter;
        for (const user of this.linesData) {
            const item = this.legendItems[user.identity_key];
            if (!item) continue;
            const name = user.name.toLowerCase();
            const matches = !filter || name.includes(filter);
            item.style('display', matches ? null : 'none');
        }
    }

    updatePinnedChips() {
        if (!this.pinnedContainer) return;
        this.pinnedContainer.html('');

        if (this.selectedUsers.size === 0) {
            this.pinnedContainer.style('display', 'none');
            return;
        }

        this.pinnedContainer.style('display', null);

        for (const ik of this.selectedUsers) {
            const user = this.userMap.get(ik);
            if (!user) continue;

            const color = this.colorMap.get(user.name) || '#999';
            const chip = this.pinnedContainer.append('div')
                .attr('class', 'legend-chip');

            chip.append('span')
                .attr('class', 'legend-chip-color')
                .style('background', color);

            chip.append('span')
                .attr('class', 'legend-chip-name')
                .text(user.name);

            chip.append('button')
                .attr('class', 'legend-chip-remove')
                .attr('title', 'Убрать')
                .text('×')
                .on('click', (event) => {
                    event.stopPropagation();
                    this.removeSelection(ik);
                });
        }
    }

    updateVisibility() {
        const hasSelection = this.selectedUsers.size > 0;

        // Update pinned chips
        this.updatePinnedChips();

        // Rescale both axes to fit the selected users' range
        if (hasSelection) {
            const selectedUsers = this.linesData.filter(u => this.selectedUsers.has(u.identity_key));
            const selectedDates = selectedUsers.flatMap(u => u.data.map(d => new Date(d.date)));
            const selectedValues = selectedUsers.flatMap(u => u.data.map(d => d.value));

            // X axis - zoom to date range of selected users
            const dateExtent = d3.extent(selectedDates);
            // Add 2% padding on each side for better visibility
            const dateRange = dateExtent[1] - dateExtent[0];
            const datePadding = dateRange * 0.02;
            this.xScale.domain([
                new Date(dateExtent[0].getTime() - datePadding),
                new Date(dateExtent[1].getTime() + datePadding)
            ]);

            // Y axis - zoom to value range
            const maxVal = d3.max(selectedValues) * 1.15;
            this.yScale.domain([0, maxVal]);
        } else {
            // Reset to full extent
            this.xScale.domain(this.allDateExtent);
            this.yScale.domain([0, this.allMaxValue]);
        }

        // Update X axis
        const xAxisGen = d3.axisBottom(this.xScale).ticks(10).tickFormat(d3.timeFormat('%b %y')).tickSize(4);
        this.xAxisG.transition().duration(300).call(xAxisGen);
        this.xAxisG.select('.domain').remove();
        this.xAxisG.selectAll('text').attr('fill', '#888');
        this.xAxisG.selectAll('line').attr('stroke', '#444');

        // Update Y axis
        const yAxisGen = d3.axisLeft(this.yScale).ticks(5).tickFormat(d3.format('~s')).tickSize(4);
        this.yAxisG.transition().duration(300).call(yAxisGen);
        this.yAxisG.select('.domain').remove();
        this.yAxisG.selectAll('text').attr('fill', '#888');
        this.yAxisG.selectAll('line').attr('stroke', '#444');

        for (const user of this.linesData) {
            const ik = user.identity_key;
            const path = this.paths[ik];
            const legend = this.legendItems[ik];
            const isSelected = this.selectedUsers.has(ik);

            path.transition().duration(300).attr('d', this.lineFn);

            // Update chart lines
            if (!hasSelection) {
                path.attr('class', 'user-line');
            } else if (isSelected) {
                path.attr('class', 'user-line solo');
            } else {
                path.attr('class', 'user-line dimmed');
            }

            // Update legend items - show checkmark but don't dim
            legend.classed('selected', isSelected);
        }
    }

    highlightDate(dateStr) {
        if (!this.xScale) return;
        const x = this.xScale(new Date(dateStr));
        this.marker.style('display', null).attr('x1', x).attr('x2', x);
    }
}


// Tab management
const tabs = {
    charts: {},
    active: null,

    init() {
        document.querySelectorAll('.tab').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = link.dataset.tab;
                history.replaceState(null, '', `#tab=${tab}`);
                this.switchTo(tab);
            });
        });

        const hash = location.hash.match(/tab=(\w+)/);
        const initial = hash ? hash[1] : 'posts';

        // Pause all non-initial charts
        for (const [name, chart] of Object.entries(this.charts)) {
            if (name !== initial) chart.pause();
        }

        this.switchTo(initial);
    },

    switchTo(name) {
        if (this.active && this.charts[this.active]) {
            this.charts[this.active].pause();
        }

        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));

        const content = document.getElementById('tab-' + name);
        const link = document.querySelector(`.tab[data-tab="${name}"]`);
        if (content) content.classList.add('active');
        if (link) link.classList.add('active');

        this.active = name;

        if (this.charts[name] && !this.charts[name].isPlaying) {
            this.charts[name].start();
        }
    },

    register(name, chart) {
        this.charts[name] = chart;
    }
};


document.addEventListener('DOMContentLoaded', async () => {
    // --- Posts tab ---
    const speedOverlay = new SpeedOverlay('#posts-speedOverlay');
    await speedOverlay.load('speed/speed_data.json');

    const postsChart = new BarChartRace('#posts-chart', {
        width: 1400,
        topN: 0,
        duration: 50,
        barSlotHeight: 33,
        tickStep: 10000,
        ids: {
            playPauseBtn: 'posts-playPauseBtn',
            speedSlider: 'posts-speedSlider',
            speedValue: 'posts-speedValue',
            topN: 'posts-topN',
            dateOverlay: 'posts-dateOverlay',
            scrubber: 'posts-scrubber',
            dateStart: 'posts-dateStart',
            dateEnd: 'posts-dateEnd',
            dateReset: 'posts-dateReset',
        }
    });

    speedOverlay.barChart = postsChart;
    postsChart.onDateChange = (date) => speedOverlay.highlightDate(date);
    postsChart.loadData('poster_data.json');
    tabs.register('posts', postsChart);

    // --- Speed tab ---
    try {
        const raw = await d3.json('user_stats/user_stats.json');

        const speedChart = new BarChartRace('#speed-bars', {
            width: 1400,
            topN: 0,
            duration: 333,
            barSlotHeight: 43,
            tooltipHtml: d => `<strong>${d.name}</strong><br>7д avg: ${d.value.toFixed(1)} пост/день<br>ID: ${d.identity_key || 'N/A'}`,
        ids: {
            playPauseBtn: 'speed-playPauseBtn',
            speedSlider: 'speed-speedSlider',
            speedValue: 'speed-speedValue',
            topN: 'speed-topN',
            dateOverlay: 'speed-dateOverlay',
            scrubber: 'speed-scrubber',
            dateStart: 'speed-dateStart',
            dateEnd: 'speed-dateEnd',
            dateReset: 'speed-dateReset',
        }
        });

        const lineChart = new UserLineChart('#speed-lineChart');

        speedChart.loadFromParsed(raw.bars);
        lineChart.render(raw.lines, speedChart.colorMap);
        speedChart.onDateChange = (date) => lineChart.highlightDate(date);

        tabs.register('speed', speedChart);
    } catch (err) {
        console.error('Speed tab data not loaded:', err);
        d3.select('#speed-bars').html(`<div class="loading" style="color:#e85d04;">Данные скорости не найдены — запустите transform.py</div>`);
    }

    tabs.init();

    // --- Resize divider for speed tab ---
    const resizeDivider = document.getElementById('speed-resize-divider');
    const speedTabContent = document.getElementById('tab-speed');
    const chartWrapper = speedTabContent.querySelector('.chart-wrapper');
    const lineChartRow = speedTabContent.querySelector('.line-chart-row');

    if (resizeDivider && chartWrapper && lineChartRow) {
        let isDragging = false;
        let startY = 0;
        let startChartFlex = 0;
        let startLineFlex = 0;

        const MIN_CHART_PERCENT = 0.10; // 30% min for bar chart
        const MIN_LINE_PERCENT = 0.10;  // 20% min for line chart

        resizeDivider.addEventListener('mousedown', (e) => {
            isDragging = true;
            startY = e.clientY;

            // Get current flex values
            const chartStyle = window.getComputedStyle(chartWrapper);
            const lineStyle = window.getComputedStyle(lineChartRow);
            startChartFlex = parseFloat(chartStyle.flexGrow) || 6;
            startLineFlex = parseFloat(lineStyle.flexGrow) || 4;

            resizeDivider.classList.add('dragging');
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';

            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const deltaY = e.clientY - startY;
            const containerHeight = speedTabContent.clientHeight;
            const totalFlex = startChartFlex + startLineFlex;

            // Convert delta to flex units
            const deltaFlex = (deltaY / containerHeight) * totalFlex * 2;

            let newChartFlex = startChartFlex + deltaFlex;
            let newLineFlex = startLineFlex - deltaFlex;

            // Calculate percentages for constraint checking
            const chartPercent = newChartFlex / totalFlex;
            const linePercent = newLineFlex / totalFlex;

            // Apply constraints
            if (chartPercent < MIN_CHART_PERCENT) {
                newChartFlex = MIN_CHART_PERCENT * totalFlex;
                newLineFlex = totalFlex - newChartFlex;
            } else if (linePercent < MIN_LINE_PERCENT) {
                newLineFlex = MIN_LINE_PERCENT * totalFlex;
                newChartFlex = totalFlex - newLineFlex;
            }

            chartWrapper.style.flex = newChartFlex;
            lineChartRow.style.flex = newLineFlex;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                resizeDivider.classList.remove('dragging');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }

    window.tabs = tabs;
});
