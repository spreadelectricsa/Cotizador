import React, { createContext, useState, useContext, useCallback } from 'react';
import axios from 'axios';
import dbData from '../../data/db.json';

const DataContext = createContext();

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
};

export const DataProvider = ({ children }) => {
  const [db, setDb] = useState({ tickets: [], ots: [] });
  const [loading, setLoading] = useState(false);
  const [loadStatus, setLoadStatus] = useState('⏳ Cargando...');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || 'https://spread-erp.ddns.net/api/method';
  const API_TOKEN = import.meta.env.VITE_API_TOKEN || '';
  const API_ENDPOINT = 'spread_app.app_gestion_spread.report.costo_mano_de_obra.costo_mano_de_obra.get_labor_cost_no_quotation';

  const processRawData = (raw) => {
    try {
      const ticketsMap = new Map();
      const ots = [];

      raw.forEach(row => {
        const iss = row.iss || row.ticket || row.ID_ISS;
        if (!iss) return;

        if (!ticketsMap.has(iss)) {
          ticketsMap.set(iss, {
            id: iss,
            subject: row.subject_ticket || row.subject || row.asunto || 'Sin asunto',
            sector: row.sector || 'N/A',
            date: row.fecha_ejecucion || row.fecha_ticket || row.fecha || '0000-00-00',
            costo_total: 0
          });
        }

        const otId = row.ot || row.OT || row.nro_ot;
        if (otId) {
          let hours = 0;
          const duracion = row.duracion || row.duration || "00:00";
          if (typeof duracion === 'string' && duracion.includes(':')) {
            const parts = duracion.split(':').map(Number);
            hours = parts[0] + (parts[1] / 60);
          } else {
            hours = parseFloat(duracion) || 0;
          }

          const laborCost = parseFloat(row.costo_mo_total || row.costo_mo || 0);
          
          const ticket = ticketsMap.get(iss);
          ticket.costo_total = (ticket.costo_total || 0) + laborCost;

          ots.push({
            id: otId,
            ticket_id: iss,
            subject: row.subject_ot || row.subject || row.subject_ticket || 'Sin asunto',
            sector: row.sector || 'N/A',
            labor_hours: parseFloat(hours.toFixed(2)),
            labor_cost: laborCost,
            technicians_count: parseInt(row.nro_tec || row.tecnicos || 0),
            fecha_ejecucion: row.fecha_ejecucion || row.fecha || '0000-00-00'
          });
        }
      });

      const tickets = Array.from(ticketsMap.values()).sort((a, b) => b.date.localeCompare(a.date));
      return { tickets, ots };
    } catch (err) {
      console.error('Error processing data:', err);
      return { tickets: [], ots: [] };
    }
  };

  const loadLocalData = useCallback(() => {
    try {
      const raw = dbData.result || dbData.data || (Array.isArray(dbData) ? dbData : []);
      const processed = processRawData(raw);
      setDb(processed);
      setLoadStatus(`✅ ${processed.tickets.length} Tickets cargados (datos locales)`);
      setLastUpdate(new Date());
      return processed;
    } catch (err) {
      setLoadStatus('⚠️ Error cargando datos locales');
      setError(err.message);
      return { tickets: [], ots: [] };
    }
  }, []);

  const fetchDataFromAPI = useCallback(async () => {
    try {
      setLoading(true);
      setLoadStatus('🔄 Conectando con API...');

      if (!API_URL || !API_TOKEN) {
        throw new Error('Configuración de API no disponible');
      }

      const url = `${API_URL}/${API_ENDPOINT}`;
      const headers = {
        'Authorization': API_TOKEN,
        'Content-Type': 'application/json'
      };

      const response = await axios.post(url, {}, { 
        headers, 
        timeout: 120000 
      });

      if (response.data && response.data.message) {
        const message = response.data.message;

        if (message.success) {
          if (message.data && Array.isArray(message.data)) {
            const processed = processRawData(message.data);
            setDb(processed);
            setLoadStatus(`✅ ${processed.tickets.length} registros desde API`);
            setLastUpdate(new Date());
            setError(null);
            return processed;
          }
        }
      }

      throw new Error('Formato de respuesta no reconocido');

    } catch (error) {
      let errorMsg = 'Error de API';
      if (error.response) {
        if (error.response.data && error.response.data.message && error.response.data.message.data) {
          const processed = processRawData(error.response.data.message.data);
          setDb(processed);
          setLoadStatus(`⚠️ ${processed.tickets.length} registros (con advertencia)`);
          setLastUpdate(new Date());
          return processed;
        }
        errorMsg = `Error ${error.response.status}`;
      } else if (error.request) {
        errorMsg = 'Sin conexión al servidor';
      } else {
        errorMsg = error.message;
      }

      setLoadStatus(`❌ ${errorMsg} - Usando datos locales`);
      setError(errorMsg);
      
      setTimeout(() => {
        loadLocalData();
      }, 500);

      return loadLocalData();

    } finally {
      setLoading(false);
    }
  }, [API_URL, API_TOKEN, loadLocalData]);

  const refreshData = useCallback(() => {
    if (API_URL && API_TOKEN) {
      return fetchDataFromAPI();
    } else {
      loadLocalData();
      setLoadStatus('✅ Datos locales recargados');
      return Promise.resolve(db);
    }
  }, [API_URL, API_TOKEN, fetchDataFromAPI, loadLocalData, db]);

  React.useEffect(() => {
    loadLocalData();
    
    const timer = setTimeout(() => {
      if (API_URL && API_TOKEN) {
        fetchDataFromAPI();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <DataContext.Provider value={{
      db,
      loading,
      loadStatus,
      lastUpdate,
      error,
      refreshData,
      processRawData
    }}>
      {children}
    </DataContext.Provider>
  );
};