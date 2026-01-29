import React, { useState } from 'react';
import { DataProvider } from './components/Shared/DataContext';
import Cotizador from './components/Cotizador/Cotizador';
import Dashboard from './components/Dashboard/Dashboard';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('cotizador');

  return (
    <DataProvider>
      <div className="app-container">
        <header className="app-header">
          <div className="header-content">
            <div className="logo-section">
              <h1>🛠️ Gestión Spread</h1>
              <p className="app-subtitle">Herramientas integradas de gestión de mano de obra</p>
            </div>
            <div className="api-status">
              <span className={`status-badge ${import.meta.env.VITE_API_TOKEN ? 'connected' : 'disconnected'}`}>
                {import.meta.env.VITE_API_TOKEN ? '🔗 API Conectada' : '🔌 API Desconectada'}
              </span>
              <span className="version">v4.0</span>
            </div>
          </div>
          
          <nav className="tabs-navigation">
            <button 
              className={`tab-button ${activeTab === 'cotizador' ? 'active' : ''}`}
              onClick={() => setActiveTab('cotizador')}
            >
              📋 Cotizador
            </button>
            <button 
              className={`tab-button ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              📊 Dashboard
            </button>
            <button 
              className={`tab-button ${activeTab === 'info' ? 'active' : ''}`}
              onClick={() => setActiveTab('info')}
            >
              ℹ️ Información
            </button>
          </nav>
        </header>

        <main className="app-main">
          {activeTab === 'cotizador' && <Cotizador />}
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'info' && (
            <div className="info-container glass-panel">
              <h2>📈 Sistema Integrado de Gestión</h2>
              <div className="info-grid">
                <div className="info-card">
                  <h3>🎯 Cotizador</h3>
                  <p>Genera cotizaciones de mano de obra basadas en OTs reales del ERP.</p>
                  <ul>
                    <li>Búsqueda inteligente de tickets</li>
                    <li>Arrastre y suelte de OTs</li>
                    <li>Cálculo automático con factores</li>
                    <li>Exportación a TXT y CSV</li>
                  </ul>
                </div>
                <div className="info-card">
                  <h3>📊 Dashboard</h3>
                  <p>Análisis avanzado de costos y horas de mano de obra.</p>
                  <ul>
                    <li>Gráficos interactivos en tiempo real</li>
                    <li>KPIs y métricas clave</li>
                    <li>Filtros dinámicos por sector/fecha</li>
                    <li>Análisis de Pareto</li>
                  </ul>
                </div>
                <div className="info-card">
                  <h3>🔄 Datos en Vivo</h3>
                  <p>Conectado al ERP Next de Spread.</p>
                  <ul>
                    <li>Sincronización automática</li>
                    <li>Fallback a datos locales</li>
                    <li>Histórico completo</li>
                    <li>Actualización periódica</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </main>

        <footer className="app-footer">
          <p>Sistema Integrado de Gestión Spread • {new Date().getFullYear()}</p>
          <p className="footer-note">
            Datos actualizados desde {import.meta.env.VITE_API_URL ? 'ERP Next' : 'archivos locales'}
          </p>
        </footer>
      </div>
    </DataProvider>
  );
}

export default App;