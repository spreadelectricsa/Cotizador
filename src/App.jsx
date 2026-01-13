import React, { useState, useEffect, useMemo, useRef } from 'react';
import dbData from './data/db.json';

const App = () => {
  // State
  const [db, setDb] = useState({ tickets: [], ots: [] });
  const [currentTicket, setCurrentTicket] = useState(null);
  const [quoteItems, setQuoteItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [loadStatus, setLoadStatus] = useState('⏳ Cargando...');

  const searchRef = useRef(null);

  // Initial Data Load
  useEffect(() => {
    try {
      const raw = dbData.result || dbData.data || (Array.isArray(dbData) ? dbData : []);

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
            date: row.fecha_ejecucion || row.fecha_ticket || row.fecha || '0000-00-00'
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

          ots.push({
            id: otId,
            ticket_id: iss,
            subject: row.subject_ot || row.subject || row.subject_ticket || 'Sin asunto',
            sector: row.sector || 'N/A',
            labor_hours: parseFloat(hours.toFixed(2)),
            labor_cost: parseFloat(row.costo_mo_total || row.costo_mo || 0),
            technicians_count: parseInt(row.nro_tec || row.tecnicos || 0)
          });
        }
      });

      const tickets = Array.from(ticketsMap.values()).sort((a, b) => b.date.localeCompare(a.date));
      setDb({ tickets, ots });
      setLoadStatus(`✅ ${tickets.length} Tickets Listos`);
    } catch (err) {
      console.error('Error processing data:', err);
      setLoadStatus('⚠️ Error en Datos');
    }
  }, []);

  // Search Logic
  const filteredTickets = useMemo(() => {
    if (!searchQuery) return [];
    return db.tickets.filter(t =>
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 15);
  }, [db.tickets, searchQuery]);

  const handleSelectTicket = (ticket) => {
    setCurrentTicket(ticket);
    setSearchQuery(ticket.id);
    setShowSearchResults(false);
    setQuoteItems([]);
  };

  const availableOTs = useMemo(() => {
    if (!currentTicket) return [];
    const assignedIds = quoteItems.flatMap(item => item.ots.map(ot => ot.id));
    return db.ots.filter(ot => ot.ticket_id === currentTicket.id && !assignedIds.includes(ot.id));
  }, [db.ots, currentTicket, quoteItems]);

  // Quote Management
  const addQuoteItem = () => {
    const newItem = {
      id: Date.now(),
      name: 'Nuevo Ítem de Cotización',
      factor: 1.5,
      ots: []
    };
    setQuoteItems([...quoteItems, newItem]);
  };

  const updateItemName = (id, name) => {
    setQuoteItems(quoteItems.map(i => i.id === id ? { ...i, name } : i));
  };

  const updateItemFactor = (id, factor) => {
    setQuoteItems(quoteItems.map(i => i.id === id ? { ...i, factor: parseFloat(factor) || 1 } : i));
  };

  const deleteItem = (id) => {
    setQuoteItems(quoteItems.filter(i => i.id !== id));
  };

  const assignOT = (otId, itemId) => {
    const ot = db.ots.find(o => o.id === otId);
    if (!ot) return;

    setQuoteItems(quoteItems.map(item => {
      // Remove OT from any other item first
      const cleanOts = item.ots.filter(o => o.id !== otId);

      if (item.id === itemId) {
        const newOts = [...cleanOts, ot];
        // Auto-name if it was default
        const name = (item.name === 'Nuevo Ítem de Cotización' && newOts.length === 1) ? ot.subject : item.name;
        return { ...item, ots: newOts, name };
      }
      return { ...item, ots: cleanOts };
    }));
  };

  const removeOT = (itemId, otId) => {
    setQuoteItems(quoteItems.map(item => {
      if (item.id === itemId) {
        return { ...item, ots: item.ots.filter(o => o.id !== otId) };
      }
      return item;
    }));
  };

  // Calculations
  const calculateItemTotal = (item) => {
    const base = item.ots.reduce((sum, ot) => sum + ot.labor_cost, 0);
    return base * item.factor;
  };

  const grandTotal = quoteItems.reduce((sum, item) => sum + calculateItemTotal(item), 0);

  // Export Logic
  const generatePreview = () => {
    if (!currentTicket) return;

    let txt = `COTIZACION DE MANO DE OBRA - ${currentTicket.id}\n`;
    txt += `ASUNTO: ${currentTicket.subject}\n`;
    txt += `FECHA: ${new Date().toLocaleString()}\n`;
    txt += `------------------------------------------\n`;

    quoteItems.forEach((item, idx) => {
      txt += `\nITEM ${idx + 1}: ${item.name.toUpperCase()}\n`;
      txt += `FACTOR: ${item.factor}\n`;
      item.ots.forEach(ot => {
        txt += `- OT: ${ot.id} | ${ot.subject}\n`;
      });
      txt += `SUBTOTAL: $${calculateItemTotal(item).toFixed(2)}\n`;
    });

    txt += `\n------------------------------------------\n`;
    txt += `TOTAL GENERAL: $ ${grandTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}\n`;

    setPreviewText(txt);
    setIsPreviewOpen(true);
  };

  const downloadFile = (content, fileName, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadTxt = () => {
    downloadFile(previewText, `cotizacion_${currentTicket.id}.txt`, 'text/plain');
  };

  const handleDownloadCsv = () => {
    let csv = "\uFEFF"; // BOM for Excel
    csv += "Item;Nombre;Factor;OT;OT_Asunto;Subtotal\n";

    quoteItems.forEach((item, idx) => {
      const subtotal = calculateItemTotal(item).toFixed(2).replace('.', ',');
      item.ots.forEach(ot => {
        csv += `${idx + 1};"${item.name}";${item.factor};${ot.id};"${ot.subject}";${subtotal}\n`;
      });
    });
    downloadFile(csv, `cotizacion_${currentTicket.id}.csv`, 'text/csv');
  };

  // Drag and Drop
  const onDragStart = (e, otId) => {
    e.dataTransfer.setData('otId', otId);
  };

  const onDrop = (e, itemId) => {
    e.preventDefault();
    const otId = e.dataTransfer.getData('otId');
    assignOT(otId, itemId);
  };

  return (
    <div className="container">
      <header>
        <h1>Generador de Cotizaciones</h1>
        <p className="subtitle">
          Mano de Obra - React Version
          <span style={{ background: '#10b981', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, marginLeft: 10 }}>
            V2.0
          </span>
        </p>
      </header>

      <section className="glass-panel" style={{ marginBottom: '2rem', position: 'relative', zIndex: 1000 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className={`load-status-badge ${loadStatus.includes('✅') ? 'success' : ''}`}>
              {loadStatus}
            </div>
          </div>
          <div style={{ position: 'relative' }} ref={searchRef}>
            <input
              type="text"
              className="search-input"
              placeholder="Buscar por ISS o Asunto..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              style={{ fontSize: '1.2rem', padding: '1rem' }}
            />
            {showSearchResults && filteredTickets.length > 0 && (
              <div className="search-results-dropdown">
                {filteredTickets.map(ticket => (
                  <div
                    key={ticket.id}
                    className="search-result-item"
                    onMouseDown={() => handleSelectTicket(ticket)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="result-id">{ticket.id}</span>
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{ticket.date}</span>
                    </div>
                    <div className="result-subject">{ticket.subject}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <main className="main-grid">
        {/* Left: OTs */}
        <section className="glass-panel">
          <div className="section-title">
            <span>Órdenes de Trabajo Disponible</span>
            {currentTicket && (
              <span className="ot-sector">{currentTicket.sector}</span>
            )}
          </div>
          <div className="ot-list">
            {!currentTicket ? (
              <div style={{ textAlign: 'center', color: '#64748b' }}>
                Seleccione un ticket para ver sus OTs
              </div>
            ) : availableOTs.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#10b981' }}>
                Todas las OTs asignadas ✅
              </div>
            ) : (
              availableOTs.map(ot => (
                <div
                  key={ot.id}
                  className="ot-card"
                  draggable
                  onDragStart={(e) => onDragStart(e, ot.id)}
                >
                  <div className="ot-header">
                    <span className="ot-id">{ot.id}</span>
                    <span className="ot-sector">{ot.sector}</span>
                  </div>
                  <div className="ot-subject">{ot.subject}</div>
                  <div className="ot-info">
                    <span>🕒 {ot.labor_hours}h</span>
                    <span>💰 ${ot.labor_cost.toFixed(2)}</span>
                    <span>👥 {ot.technicians_count}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Right: Quote Items */}
        <section className="glass-panel">
          <div className="section-title">
            <span>Ítems de Cotización</span>
            <button className="btn btn-primary" onClick={addQuoteItem} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
              + Nuevo Ítem
            </button>
          </div>
          <div className="quote-container">
            {quoteItems.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#64748b' }}>
                Cree un ítem y arrastre las OTs aquí
              </div>
            ) : (
              quoteItems.map(item => (
                <div
                  key={item.id}
                  className="quote-item glass-panel"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onDrop(e, item.id)}
                  style={{ background: 'rgba(255,255,255,0.4)' }}
                >
                  <div className="quote-item-header">
                    <input
                      type="text"
                      className="item-name-input"
                      value={item.name}
                      onChange={(e) => updateItemName(item.id, e.target.value)}
                    />
                    <div className="factor-container">
                      F: <input
                        type="number"
                        step="0.1"
                        className="factor-input"
                        value={item.factor}
                        onChange={(e) => updateItemFactor(item.id, e.target.value)}
                      />
                    </div>
                    <button
                      className="btn"
                      onClick={() => deleteItem(item.id)}
                      style={{ color: '#ef4444', background: 'none' }}
                    >
                      ×
                    </button>
                  </div>
                  <div className="item-ots" style={{ minHeight: '50px', border: '1px dashed #cbd5e1', padding: '0.5rem', borderRadius: '0.5rem' }}>
                    {item.ots.length === 0 ? (
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center' }}>Arrastra aquí</div>
                    ) : (
                      item.ots.map(ot => (
                        <div key={ot.id} className="assigned-ot">
                          <span>{ot.id} - {ot.subject.substring(0, 40)}...</span>
                          <span
                            onClick={() => removeOT(item.id, ot.id)}
                            style={{ color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            ×
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 'bold', marginTop: '0.5rem', color: '#4f46e5' }}>
                    $ {calculateItemTotal(item).toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {currentTicket && (
        <div className="summary-bar">
          <div>
            <div className="total-label">Total Cotizado (Mano de Obra)</div>
            <div className="total-value">$ {grandTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="actions">
            <button className="btn btn-primary" onClick={generatePreview}>
              Generar Cotización
            </button>
          </div>
        </div>
      )}

      {isPreviewOpen && (
        <div className="modal-overlay" onClick={() => setIsPreviewOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Vista Previa</h2>
              <button className="btn btn-danger" onClick={() => setIsPreviewOpen(false)}>Cerrar</button>
            </div>
            <textarea
              readOnly
              value={previewText}
              style={{
                width: '100%',
                height: '350px',
                fontFamily: 'monospace',
                padding: '1rem',
                borderRadius: '0.5rem',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                whiteSpace: 'pre'
              }}
            />
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => {
                  navigator.clipboard.writeText(previewText);
                  alert('¡Copiado!');
                }}
              >
                📋 Copiar Texto
              </button>
              <button className="btn btn-success" style={{ flex: 1 }} onClick={handleDownloadTxt}>
                💾 Descargar .TXT
              </button>
              <button className="btn" style={{ flex: 1, background: '#ea580c', color: 'white' }} onClick={handleDownloadCsv}>
                📊 Descargar CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
