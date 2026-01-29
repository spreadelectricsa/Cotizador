import React, { useState, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { useData } from '../Shared/DataContext';
import './Dashboard.css';

const Dashboard = () => {
  const { db, lastUpdate, refreshData, loading } = useData();
  const [activeTab, setActiveTab] = useState('operativa');
  const [filters, setFilters] = useState({
    sector: [],
    ticket: [],
    dateStart: '',
    dateEnd: ''
  });
  const [topNCost, setTopNCost] = useState(10);
  const [topNHours, setTopNHours] = useState(10);

  const dashboardData = useMemo(() => {
    return db.ots.map(ot => ({
      sector: ot.sector,
      ticket_id: ot.ticket_id,
      subject: ot.subject,
      ot_id: ot.id,
      total_labor_cost: ot.labor_cost,
      date: new Date(ot.fecha_ejecucion),
      dateStr: ot.fecha_ejecucion,
      hours: ot.labor_hours,
      nro_tec: ot.technicians_count,
    }));
  }, [db.ots]);

  const setQuickDateFilter = (days) => {
    if (days === 'all') {
      setFilters({ ...filters, dateStart: '', dateEnd: '' });
    } else {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);
      setFilters({
        ...filters,
        dateStart: start.toISOString().split('T')[0],
        dateEnd: end.toISOString().split('T')[0]
      });
    }
  };

  const filteredData = useMemo(() => {
    return dashboardData.filter(item => {
      const matchSector = filters.sector.length === 0 || filters.sector.includes(item.sector);
      const matchTicket = filters.ticket.length === 0 || filters.ticket.includes(item.ticket_id);
      const matchDate = (!filters.dateStart || item.dateStr >= filters.dateStart) &&
        (!filters.dateEnd || item.dateStr <= filters.dateEnd);
      return matchSector && matchTicket && matchDate;
    });
  }, [dashboardData, filters]);

  const kpis = useMemo(() => {
    const hours = filteredData.reduce((a, b) => a + b.hours, 0);
    const cost = filteredData.reduce((a, b) => a + b.total_labor_cost, 0);
    return {
      totalHours: hours.toFixed(1),
      totalCost: Math.round(cost).toLocaleString(),
      costPerHour: (cost / (hours || 1)).toFixed(2),
      totalOts: new Set(filteredData.map(i => i.ot_id)).size,
      totalTickets: new Set(filteredData.map(i => i.ticket_id)).size,
      maxTechs: Math.max(...filteredData.map(i => i.nro_tec), 0)
    };
  }, [filteredData]);

  const plotlyLayout = {
    template: 'plotly_dark',
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: 'Inter, sans-serif', size: 11, color: '#ffffff' },
    margin: { l: 60, r: 20, t: 40, b: 60 },
    hovermode: 'closest',
    hoverlabel: {
      bgcolor: '#000',
      bordercolor: '#00d4ff',
      font: { size: 12, color: '#fff' }
    }
  };

  const plotlyConfig = {
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToAdd: ['select2d', 'lasso2d'],
    modeBarButtonsToRemove: [],
    toImageButtonOptions: {
      format: 'png',
      filename: 'chart',
      height: 1080,
      width: 1920,
      scale: 2
    }
  };

  const sectorCostData = useMemo(() => {
    const g = {};
    filteredData.forEach(i => g[i.sector] = (g[i.sector] || 0) + i.total_labor_cost);
    const sorted = Object.entries(g).sort((a, b) => b[1] - a[1]);
    return [{
      type: 'bar',
      x: sorted.map(s => s[0]),
      y: sorted.map(s => s[1]),
      marker: { color: '#00d4ff' },
      hovertemplate: '<b>%{x}</b><br>Costo: $%{y:,.0f}<extra></extra>'
    }];
  }, [filteredData]);

  const sectorHoursData = useMemo(() => {
    const g = {};
    filteredData.forEach(i => g[i.sector] = (g[i.sector] || 0) + i.hours);
    const sorted = Object.entries(g).sort((a, b) => b[1] - a[1]);
    return [{
      type: 'bar',
      y: sorted.map(s => s[0]),
      x: sorted.map(s => s[1]),
      orientation: 'h',
      marker: { color: '#0055ff' },
      hovertemplate: '<b>%{y}</b><br>Horas: %{x:.1f}<extra></extra>'
    }];
  }, [filteredData]);

  const sectorOtsPieData = useMemo(() => {
    const g = {};
    filteredData.forEach(i => {
      if (!g[i.sector]) g[i.sector] = new Set();
      g[i.sector].add(i.ot_id);
    });
    const data = Object.entries(g).map(([k, v]) => ({ sector: k, count: v.size })).sort((a, b) => b.count - a.count);
    return [{
      type: 'pie',
      labels: data.map(d => d.sector),
      values: data.map(d => d.count),
      marker: {
        colors: ['#00d4ff', '#3fb950', '#f85149', '#a371f7', '#d29922', '#1f6feb', '#ff0055', '#00ffcc', '#ffaa00', '#ff00ff']
      },
      hole: 0.4,
      hovertemplate: '<b>%{label}</b><br>OTs: %{value}<br>%{percent}<extra></extra>'
    }];
  }, [filteredData]);

  const techsPerOtData = useMemo(() => {
    const sorted = [...filteredData].sort((a, b) => b.nro_tec - a.nro_tec).slice(0, 10);
    return [{
      type: 'bar',
      x: sorted.map(i => i.ot_id),
      y: sorted.map(i => i.nro_tec),
      marker: { color: '#39ff14' },
      hovertemplate: '<b>%{x}</b><br>Técnicos: %{y}<extra></extra>'
    }];
  }, [filteredData]);

  const topOtsCostData = useMemo(() => {
    const g = {};
    filteredData.forEach(i => g[i.ot_id] = (g[i.ot_id] || 0) + i.total_labor_cost);
    const sorted = Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, topNCost);
    return [{
      type: 'bar',
      y: sorted.map(s => s[0]),
      x: sorted.map(s => s[1]),
      orientation: 'h',
      marker: { color: '#ff0055' },
      hovertemplate: '<b>%{y}</b><br>Costo: $%{x:,.0f}<extra></extra>'
    }];
  }, [filteredData, topNCost]);

  const topOtsHoursData = useMemo(() => {
    const g = {};
    filteredData.forEach(i => g[i.ot_id] = (g[i.ot_id] || 0) + i.hours);
    const sorted = Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, topNHours);
    return [{
      type: 'bar',
      y: sorted.map(s => s[0]),
      x: sorted.map(s => s[1]),
      orientation: 'h',
      marker: { color: '#00ffcc' },
      hovertemplate: '<b>%{y}</b><br>Horas: %{x:.1f}<extra></extra>'
    }];
  }, [filteredData, topNHours]);

  const hoursDistData = useMemo(() => {
    return [{
      type: 'histogram',
      x: filteredData.map(i => i.hours),
      nbinsx: 20,
      marker: { color: '#ffaa00' },
      hovertemplate: 'Rango: %{x}<br>Frecuencia: %{y}<extra></extra>'
    }];
  }, [filteredData]);

  const scatterCostHoursData = useMemo(() => {
    const sectors = Array.from(new Set(filteredData.map(i => i.sector)));
    const colors = ['#00d4ff', '#3fb950', '#f85149', '#a371f7', '#d29922', '#1f6feb', '#ff0055', '#00ffcc'];
    return sectors.map((sector, idx) => ({
      type: 'scatter',
      mode: 'markers',
      name: sector,
      x: filteredData.filter(i => i.sector === sector).map(i => i.hours),
      y: filteredData.filter(i => i.sector === sector).map(i => i.total_labor_cost),
      marker: { color: colors[idx % colors.length], size: 6 },
      hovertemplate: '<b>%{fullData.name}</b><br>Horas: %{x:.1f}<br>Costo: $%{y:,.0f}<extra></extra>'
    }));
  }, [filteredData]);

  const ticketCostData = useMemo(() => {
    const g = {};
    filteredData.forEach(i => g[i.ticket_id] = (g[i.ticket_id] || 0) + i.total_labor_cost);
    const sorted = Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, 15);
    return [{
      type: 'bar',
      x: sorted.map(s => s[0]),
      y: sorted.map(s => s[1]),
      marker: { color: '#ff4b4b' },
      hovertemplate: '<b>%{x}</b><br>Costo: $%{y:,.0f}<extra></extra>'
    }];
  }, [filteredData]);

  const ticketHoursData = useMemo(() => {
    const g = {};
    filteredData.forEach(i => g[i.ticket_id] = (g[i.ticket_id] || 0) + i.hours);
    const sorted = Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, 15);
    return [{
      type: 'bar',
      x: sorted.map(s => s[0]),
      y: sorted.map(s => s[1]),
      marker: { color: '#00ff00' },
      hovertemplate: '<b>%{x}</b><br>Horas: %{y:.1f}<extra></extra>'
    }];
  }, [filteredData]);

  const ticketOtsData = useMemo(() => {
    const g = {};
    filteredData.forEach(i => {
      if (!g[i.ticket_id]) g[i.ticket_id] = new Set();
      g[i.ticket_id].add(i.ot_id);
    });
    const sorted = Object.entries(g).map(([k, v]) => [k, v.size]).sort((a, b) => b[1] - a[1]).slice(0, 15);
    return [{
      type: 'bar',
      x: sorted.map(s => s[0]),
      y: sorted.map(s => s[1]),
      marker: { color: '#ffa500' },
      hovertemplate: '<b>%{x}</b><br>OTs: %{y}<extra></extra>'
    }];
  }, [filteredData]);

  const avgCostPerOtData = useMemo(() => {
    const g = {};
    const counts = {};
    filteredData.forEach(i => {
      g[i.ticket_id] = (g[i.ticket_id] || 0) + i.total_labor_cost;
      if (!counts[i.ticket_id]) counts[i.ticket_id] = new Set();
      counts[i.ticket_id].add(i.ot_id);
    });
    const avg = Object.entries(g).map(([k, v]) => [k, v / counts[k].size]).sort((a, b) => b[1] - a[1]).slice(0, 15);
    return [{
      type: 'bar',
      x: avg.map(s => s[0]),
      y: avg.map(s => s[1]),
      marker: { color: '#00aaff' },
      hovertemplate: '<b>%{x}</b><br>Costo Promedio: $%{y:,.0f}<extra></extra>'
    }];
  }, [filteredData]);

  const subjectCostData = useMemo(() => {
    const g = {};
    filteredData.forEach(i => g[i.subject] = (g[i.subject] || 0) + i.total_labor_cost);
    const sorted = Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, 10);
    return [{
      type: 'bar',
      y: sorted.map(s => s[0]),
      x: sorted.map(s => s[1]),
      orientation: 'h',
      marker: { color: '#ffcc00' },
      hovertemplate: '<b>%{y}</b><br>Costo: $%{x:,.0f}<extra></extra>'
    }];
  }, [filteredData]);

  const subjectTicketsData = useMemo(() => {
    const g = {};
    filteredData.forEach(i => {
      if (!g[i.subject]) g[i.subject] = new Set();
      g[i.subject].add(i.ticket_id);
    });
    const sorted = Object.entries(g).map(([k, v]) => [k, v.size]).sort((a, b) => b[1] - a[1]).slice(0, 10);
    return [{
      type: 'bar',
      y: sorted.map(s => s[0]),
      x: sorted.map(s => s[1]),
      orientation: 'h',
      marker: { color: '#ff00ff' },
      hovertemplate: '<b>%{y}</b><br>Tickets: %{x}<extra></extra>'
    }];
  }, [filteredData]);

  const subjectOtsData = useMemo(() => {
    const g = {};
    filteredData.forEach(i => {
      if (!g[i.subject]) g[i.subject] = new Set();
      g[i.subject].add(i.ot_id);
    });
    const sorted = Object.entries(g).map(([k, v]) => [k, v.size]).sort((a, b) => b[1] - a[1]).slice(0, 10);
    return [{
      type: 'bar',
      y: sorted.map(s => s[0]),
      x: sorted.map(s => s[1]),
      orientation: 'h',
      marker: { color: '#00ffff' },
      hovertemplate: '<b>%{y}</b><br>OTs: %{x}<extra></extra>'
    }];
  }, [filteredData]);

  const paretoData = useMemo(() => {
    const g = {};
    const h = {};
    filteredData.forEach(i => {
      g[i.ticket_id] = (g[i.ticket_id] || 0) + i.total_labor_cost;
      h[i.ticket_id] = (h[i.ticket_id] || 0) + i.hours;
    });
    const sorted = Object.entries(g).sort((a, b) => b[1] - a[1]);
    const totalCost = sorted.reduce((a, b) => a + b[1], 0);
    const totalHours = Object.values(h).reduce((a, b) => a + b, 0);

    let cumCost = 0;
    let cumHours = 0;
    const costPct = sorted.map((s) => {
      cumCost += s[1];
      return (cumCost / (totalCost || 1)) * 100;
    });
    const hoursPct = sorted.map((s) => {
      cumHours += h[s[0]];
      return (cumHours / (totalHours || 1)) * 100;
    });

    return [
      {
        type: 'bar',
        name: 'Costo MO',
        x: sorted.map(s => s[0]),
        y: sorted.map(s => s[1]),
        marker: { color: '#00d4ff' },
        yaxis: 'y',
        hovertemplate: '<b>%{x}</b><br>Costo: $%{y:,.0f}<extra></extra>'
      },
      {
        type: 'scatter',
        name: '% Costo Acum.',
        x: sorted.map(s => s[0]),
        y: costPct,
        mode: 'lines',
        line: { color: '#ff3300', width: 3 },
        yaxis: 'y2',
        hovertemplate: '<b>%{x}</b><br>% Acum: %{y:.1f}%<extra></extra>'
      },
      {
        type: 'scatter',
        name: '% Horas Acum.',
        x: sorted.map(s => s[0]),
        y: hoursPct,
        mode: 'lines',
        line: { color: '#00ff00', width: 2, dash: 'dot' },
        yaxis: 'y2',
        hovertemplate: '<b>%{x}</b><br>% Acum: %{y:.1f}%<extra></extra>'
      }
    ];
  }, [filteredData]);

  const sectorOptions = Array.from(new Set(dashboardData.map(i => i.sector))).sort();
  const ticketOptions = Array.from(new Set(dashboardData.map(i => i.ticket_id))).sort();

  if (loading && dashboardData.length === 0) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div>Cargando datos del dashboard...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h2>📊 Dashboard Analítico</h2>
        <div className="dashboard-info">
          <span className="data-source">
            Fuente: {import.meta.env.VITE_API_TOKEN ? 'API ERP' : 'Datos locales'}
          </span>
          {lastUpdate && (
            <span className="last-update">
              Última actualización: {lastUpdate.toLocaleString()}
            </span>
          )}
          <button className="refresh-btn" onClick={refreshData} disabled={loading}>
            {loading ? '🔄 Actualizando...' : '🔄 Actualizar'}
          </button>
        </div>
      </div>

      <div className="kpis-grid">
        <KpiCard label="Horas Totales" value={kpis.totalHours} />
        <KpiCard label="Costo Total" value={`$${kpis.totalCost}`} />
        <KpiCard label="Costo por Hora" value={`$${kpis.costPerHour}`} />
        <KpiCard label="OTs" value={kpis.totalOts} />
        <KpiCard label="Tickets" value={kpis.totalTickets} />
        <KpiCard label="Máx Técnicos" value={kpis.maxTechs} />
      </div>

      <div className="dashboard-controls">
        <div className="tabs">
          <button className={`tab ${activeTab === 'operativa' ? 'active' : ''}`} onClick={() => setActiveTab('operativa')}>
            📊 Vista Operativa
          </button>
          <button className={`tab ${activeTab === 'analitica' ? 'active' : ''}`} onClick={() => setActiveTab('analitica')}>
            🔍 Vista Analítica
          </button>
        </div>

        <div className="filters-section">
          <div className="quick-filters">
            <button onClick={() => setQuickDateFilter(7)}>7 días</button>
            <button onClick={() => setQuickDateFilter(30)}>30 días</button>
            <button onClick={() => setQuickDateFilter(90)}>3 meses</button>
            <button onClick={() => setQuickDateFilter('all')}>Todo</button>
          </div>
          <div className="date-filters">
            <input type="date" value={filters.dateStart} onChange={e => setFilters({ ...filters, dateStart: e.target.value })} />
            <input type="date" value={filters.dateEnd} onChange={e => setFilters({ ...filters, dateEnd: e.target.value })} />
          </div>
          <div className="select-filters">
            <select multiple value={filters.sector} onChange={e => setFilters({ ...filters, sector: Array.from(e.target.selectedOptions, o => o.value) })}>
              <option value="">Todos los sectores</option>
              {sectorOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select multiple value={filters.ticket} onChange={e => setFilters({ ...filters, ticket: Array.from(e.target.selectedOptions, o => o.value) })}>
              <option value="">Todos los tickets</option>
              {ticketOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {activeTab === 'operativa' ? (
        <>
          <div className="charts-grid">
            <div className="chart-container">
              <h3>Costo de Mano de Obra por Sector</h3>
              <Plot data={sectorCostData} layout={{ ...plotlyLayout, title: '', xaxis: { title: 'Sector' }, yaxis: { title: 'Costo ($)' } }} config={plotlyConfig} style={{ width: '100%', height: '300px' }} />
            </div>
            <div className="chart-container">
              <h3>Horas Totales por Sector</h3>
              <Plot data={sectorHoursData} layout={{ ...plotlyLayout, title: '', xaxis: { title: 'Horas' }, yaxis: { title: 'Sector' } }} config={plotlyConfig} style={{ width: '100%', height: '300px' }} />
            </div>
            <div className="chart-container">
              <h3>Distribución de OTs por Sector</h3>
              <Plot data={sectorOtsPieData} layout={{ ...plotlyLayout, title: '', showlegend: true, legend: { x: 1, y: 0.5 } }} config={plotlyConfig} style={{ width: '100%', height: '300px' }} />
            </div>
            <div className="chart-container">
              <h3>Cant. Técnicos por OT (Top 10)</h3>
              <Plot data={techsPerOtData} layout={{ ...plotlyLayout, title: '', xaxis: { title: 'OT' }, yaxis: { title: 'Cant. Técnicos' } }} config={plotlyConfig} style={{ width: '100%', height: '300px' }} />
            </div>
            <div className="chart-container">
              <div className="chart-header">
                <h3>Top {topNCost} OTs con mayor Costo</h3>
                <div className="slider-control">
                  <input type="range" min="5" max="20" value={topNCost} onChange={e => setTopNCost(+e.target.value)} />
                  <span>{topNCost}</span>
                </div>
              </div>
              <Plot data={topOtsCostData} layout={{ ...plotlyLayout, title: '', xaxis: { title: 'Costo ($)' }, yaxis: { title: 'OT' } }} config={plotlyConfig} style={{ width: '100%', height: '300px' }} />
            </div>
            <div className="chart-container">
              <div className="chart-header">
                <h3>Top {topNHours} OTs con más Horas</h3>
                <div className="slider-control">
                  <input type="range" min="5" max="20" value={topNHours} onChange={e => setTopNHours(+e.target.value)} />
                  <span>{topNHours}</span>
                </div>
              </div>
              <Plot data={topOtsHoursData} layout={{ ...plotlyLayout, title: '', xaxis: { title: 'Horas' }, yaxis: { title: 'OT' } }} config={plotlyConfig} style={{ width: '100%', height: '300px' }} />
            </div>
            <div className="chart-container">
              <h3>Distribución de Horas por Registro</h3>
              <Plot data={hoursDistData} layout={{ ...plotlyLayout, title: '', xaxis: { title: 'Horas' }, yaxis: { title: 'Frecuencia' } }} config={plotlyConfig} style={{ width: '100%', height: '300px' }} />
            </div>
            <div className="chart-container">
              <h3>Relación Costo vs Horas por OT</h3>
              <Plot data={scatterCostHoursData} layout={{ ...plotlyLayout, title: '', xaxis: { title: 'Horas' }, yaxis: { title: 'Costo ($)' }, showlegend: true, legend: { x: 1, y: 1 } }} config={plotlyConfig} style={{ width: '100%', height: '300px' }} />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="charts-grid">
            <div className="chart-container">
              <h3>Costo de MO por Ticket (Top 15)</h3>
              <Plot data={ticketCostData} layout={{ ...plotlyLayout, title: '', xaxis: { title: 'Ticket' }, yaxis: { title: 'Costo ($)' } }} config={plotlyConfig} style={{ width: '100%', height: '300px' }} />
            </div>
            <div className="chart-container">
              <h3>Horas por Ticket (Top 15)</h3>
              <Plot data={ticketHoursData} layout={{ ...plotlyLayout, title: '', xaxis: { title: 'Ticket' }, yaxis: { title: 'Horas' } }} config={plotlyConfig} style={{ width: '100%', height: '300px' }} />
            </div>
            <div className="chart-container">
              <h3>Cant. OTs por Ticket (Top 15)</h3>
              <Plot data={ticketOtsData} layout={{ ...plotlyLayout, title: '', xaxis: { title: 'Ticket' }, yaxis: { title: 'Cant. OTs' } }} config={plotlyConfig} style={{ width: '100%', height: '300px' }} />
            </div>
            <div className="chart-container">
              <h3>Costo Promedio por OT por Ticket</h3>
              <Plot data={avgCostPerOtData} layout={{ ...plotlyLayout, title: '', xaxis: { title: 'Ticket' }, yaxis: { title: 'Costo Promedio ($)' } }} config={plotlyConfig} style={{ width: '100%', height: '300px' }} />
            </div>
            <div className="chart-container">
              <h3>Costo Total por Subject (Top 10)</h3>
              <Plot data={subjectCostData} layout={{ ...plotlyLayout, title: '', xaxis: { title: 'Costo ($)' }, yaxis: { title: 'Subject' } }} config={plotlyConfig} style={{ width: '100%', height: '300px' }} />
            </div>
            <div className="chart-container">
              <h3>Pareto: Concentración de Costos y Horas por Ticket</h3>
              <Plot data={paretoData} layout={{ ...plotlyLayout, title: '', xaxis: { title: 'Ticket' }, yaxis: { title: 'Costo ($)' }, yaxis2: { title: '% Acumulado', overlaying: 'y', side: 'right', range: [0, 105] } }} config={plotlyConfig} style={{ width: '100%', height: '300px' }} />
            </div>
            <div className="chart-container">
              <h3>Cant. Tickets por Subject (Top 10)</h3>
              <Plot data={subjectTicketsData} layout={{ ...plotlyLayout, title: '', xaxis: { title: 'Cant. Tickets' }, yaxis: { title: 'Subject' } }} config={plotlyConfig} style={{ width: '100%', height: '300px' }} />
            </div>
            <div className="chart-container">
              <h3>Cant. OTs por Subject (Top 10)</h3>
              <Plot data={subjectOtsData} layout={{ ...plotlyLayout, title: '', xaxis: { title: 'Cant. OTs' }, yaxis: { title: 'Subject' } }} config={plotlyConfig} style={{ width: '100%', height: '300px' }} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const KpiCard = ({ label, value }) => (
  <div className="kpi-card">
    <div className="kpi-label">{label}</div>
    <div className="kpi-value">{value}</div>
  </div>
);

export default Dashboard;