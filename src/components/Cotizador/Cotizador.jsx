import React, { useState, useMemo, useRef } from 'react';
import { useData } from '../Shared/DataContext';
import './Cotizador.css';

const Cotizador = () => {
  const { db, loading, loadStatus, lastUpdate, refreshData } = useData();
  
  const [currentTicket, setCurrentTicket] = useState(null);
  const [quoteItems, setQuoteItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState('');

  const searchRef = useRef(null);

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
      const cleanOts = item.ots.filter(o => o.id !== otId);
      if (item.id === itemId) {
        const newOts = [...cleanOts, ot];
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

  const calculateItemTotal = (item) => {
    const base = item.ots.reduce((sum, ot) => sum + ot.labor_cost, 0);
    return base * item.factor;
  };

  const grandTotal = quoteItems.reduce((sum, item) => sum + calculateItemTotal(item), 0);

  const generatePreview = () => {
    if (!currentTicket) return;

    let txt = `COTIZACION DE MANO DE OBRA - ${currentTicket.id}\n`;
    txt += `ASUNTO: ${currentTicket.subject}\n`;
    txt += `FECHA: ${new Date().toLocaleString()}\n`;
    if (lastUpdate) {
      txt += `ÚLTIMA ACTUALIZACIÓN: ${lastUpdate.toLocaleTimeString()}\n`;
    }
    txt += `FUENTE: ${import.meta.env.VITE_API_TOKEN ? 'API ERP' : 'Datos locales'}\n`;
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
    let csv = "\uFEFF";
    csv += "Item;Nombre;Factor;OT;OT_Asunto;Subtotal\n";

    quoteItems.forEach((item, idx) => {
      const subtotal = calculateItemTotal(item).toFixed(2).replace('.', ',');
      item.ots.forEach(ot => {
        csv += `${idx + 1};"${item.name}";${item.factor};${ot.id};"${ot.subject}";${subtotal}\n`;
      });
    });
    downloadFile(csv, `cotizacion_${currentTicket.id}.csv`, 'text/csv');
  };

  const onDragStart = (e, otId) => {
    e.dataTransfer.setData('otId', otId);
  };

  const onDrop = (e, itemId) => {
    e.preventDefault();
    const otId = e.dataTransfer.getData('otId');
    assignOT(otId, itemId);
  };

  const onDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div className="cotizador-container">
      <div className="cotizador-header">
        <h2>📋 Generador de Cotizaciones</h2>
        <div className="header-controls">
          <div className={`status-indicator ${loadStatus.includes('✅') ? 'success' : loadStatus.includes('❌') ? 'error' : 'warning'}`}>
            {loadStatus}
            {lastUpdate && (
              <span className="update-time">
                {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
          <button
            className="refresh-btn"
            onClick={refreshData}
            disabled={loading}
          >
            {loading ? '🔄 Actualizando...' : '🔄 Actualizar Datos'}
          </button>
        </div>
      </div>

      <section className="glass-panel search-section">
        <div className="search-wrapper">
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
          />
          {showSearchResults && filteredTickets.length > 0 && (
            <div className="search-results-dropdown">
              {filteredTickets.map(ticket => (
                <div
                  key={ticket.id}
                  className="search-result-item"
                  onMouseDown={() => handleSelectTicket(ticket)}
                >
                  <div className="result-header">
                    <span className="result-id">{ticket.id}</span>
                    <span className="result-date">{ticket.date}</span>
                  </div>
                  <div className="result-subject">{ticket.subject}</div>
                  <div className="result-sector">{ticket.sector}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="main-grid">
        <section className="glass-panel">
          <div className="section-title">
            <span>Órdenes de Trabajo Disponibles</span>
            {currentTicket && (
              <span className="ot-sector">{currentTicket.sector}</span>
            )}
          </div>
          <div className="ot-list" onDragOver={onDragOver}>
            {!currentTicket ? (
              <div className="empty-state">
                Seleccione un ticket para ver sus OTs
              </div>
            ) : availableOTs.length === 0 ? (
              <div className="empty-state success">
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

        <section className="glass-panel">
          <div className="section-title">
            <span>Ítems de Cotización</span>
            <button className="btn btn-primary" onClick={addQuoteItem}>
              + Nuevo Ítem
            </button>
          </div>
          <div className="quote-container">
            {quoteItems.length === 0 ? (
              <div className="empty-state">
                Cree un ítem y arrastre las OTs aquí
              </div>
            ) : (
              quoteItems.map(item => (
                <div
                  key={item.id}
                  className="quote-item glass-panel"
                  onDragOver={onDragOver}
                  onDrop={(e) => onDrop(e, item.id)}
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
                      className="btn btn-danger"
                      onClick={() => deleteItem(item.id)}
                    >
                      ×
                    </button>
                  </div>
                  <div className="item-ots">
                    {item.ots.length === 0 ? (
                      <div className="drop-zone">Arrastra OTs aquí</div>
                    ) : (
                      item.ots.map(ot => (
                        <div key={ot.id} className="assigned-ot">
                          <span>{ot.id} - {ot.subject.substring(0, 40)}...</span>
                          <span
                            className="remove-ot"
                            onClick={() => removeOT(item.id, ot.id)}
                          >
                            ×
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="item-total">
                    $ {calculateItemTotal(item).toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {currentTicket && (
        <div className="summary-bar">
          <div className="total-info">
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
            <div className="modal-header">
              <h2>Vista Previa</h2>
              <button className="btn btn-danger" onClick={() => setIsPreviewOpen(false)}>Cerrar</button>
            </div>
            <textarea
              readOnly
              value={previewText}
              className="preview-textarea"
            />
            <div className="modal-actions">
              <button
                className="btn btn-primary"
                onClick={() => {
                  navigator.clipboard.writeText(previewText);
                  alert('¡Copiado!');
                }}
              >
                📋 Copiar Texto
              </button>
              <button className="btn btn-success" onClick={handleDownloadTxt}>
                💾 Descargar .TXT
              </button>
              <button className="btn btn-warning" onClick={handleDownloadCsv}>
                📊 Descargar CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cotizador;