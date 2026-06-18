/**
 * ============================================================
 * contab.js - Núcleo del Sistema Contable Profesional
 * Versión 3.0 - Sincronización completa con Firebase
 * ============================================================
 * 
 * Características:
 * - Plan de cuentas NIIF completo (17 cuentas principales)
 * - Sincronización en tiempo real con Firebase Realtime Database
 * - CRUD completo de asientos contables
 * - Generación automática de asientos desde pedidos
 * - Libro Diario con filtros y ordenamiento
 * - Dashboard con indicadores clave
 * - Persistencia local y en la nube
 * - Manejo de errores profesional
 * - Integración con módulos Kardex y Ventas
 * ============================================================
 */

(function() {
    'use strict';

    // ============================================================
    // 1. CONFIGURACIÓN
    // ============================================================
    const CONFIG = {
        STORAGE_KEY_ENTRIES: 'kaboutique_accounting_entries',
        STORAGE_KEY_STORE: 'kaboutique_storeData',
        STORAGE_KEY_PROCESSED: 'kaboutique_processed_orders',
        FIREBASE_PATHS: {
            ENTRIES: 'accounting/entries',
            ORDERS: 'orders',
            PRODUCTS: 'products',
            USERS: 'users',
            SETTINGS: 'settings'
        }
    };

    // ============================================================
    // 2. PLAN DE CUENTAS (NIIF)
    // ============================================================
    const CHART_OF_ACCOUNTS = {
        // ACTIVO CORRIENTE
        '1-01-001': { code: '1-01-001', name: 'Caja', type: 'ACTIVO', category: 'ACTIVO_CORRIENTE', normal: 'DEBE' },
        '1-01-002': { code: '1-01-002', name: 'Bancos', type: 'ACTIVO', category: 'ACTIVO_CORRIENTE', normal: 'DEBE' },
        '1-02-001': { code: '1-02-001', name: 'Cuentas por Cobrar', type: 'ACTIVO', category: 'ACTIVO_CORRIENTE', normal: 'DEBE' },
        '1-03-001': { code: '1-03-001', name: 'Inventarios', type: 'ACTIVO', category: 'ACTIVO_CORRIENTE', normal: 'DEBE' },
        '1-03-002': { code: '1-03-002', name: 'Inventario de Mercaderías', type: 'ACTIVO', category: 'ACTIVO_CORRIENTE', normal: 'DEBE' },
        
        // PASIVO CORRIENTE
        '2-01-001': { code: '2-01-001', name: 'Cuentas por Pagar', type: 'PASIVO', category: 'PASIVO_CORRIENTE', normal: 'HABER' },
        '2-03-001': { code: '2-03-001', name: 'IVA por Pagar', type: 'PASIVO', category: 'PASIVO_CORRIENTE', normal: 'HABER' },
        
        // PATRIMONIO
        '3-01-001': { code: '3-01-001', name: 'Capital Social', type: 'PATRIMONIO', category: 'PATRIMONIO', normal: 'HABER' },
        '3-03-001': { code: '3-03-001', name: 'Resultados Acumulados', type: 'PATRIMONIO', category: 'PATRIMONIO', normal: 'HABER' },
        '3-03-002': { code: '3-03-002', name: 'Resultado del Ejercicio', type: 'PATRIMONIO', category: 'PATRIMONIO', normal: 'HABER' },
        
        // INGRESOS
        '4-01-001': { code: '4-01-001', name: 'Ventas', type: 'INGRESO', category: 'INGRESO', normal: 'HABER' },
        '4-01-002': { code: '4-01-002', name: 'Ventas Físicas', type: 'INGRESO', category: 'INGRESO', normal: 'HABER' },
        '4-01-003': { code: '4-01-003', name: 'Ventas Online', type: 'INGRESO', category: 'INGRESO', normal: 'HABER' },
        '4-02-001': { code: '4-02-001', name: 'Ingresos por Envíos', type: 'INGRESO', category: 'INGRESO', normal: 'HABER' },
        
        // COSTOS
        '5-01-001': { code: '5-01-001', name: 'Costo de Ventas', type: 'COSTO', category: 'COSTO_VENTA', normal: 'DEBE' },
        '5-01-002': { code: '5-01-002', name: 'Costo de Mercaderías', type: 'COSTO', category: 'COSTO_VENTA', normal: 'DEBE' },
        
        // GASTOS
        '6-01-001': { code: '6-01-001', name: 'Gastos Operativos', type: 'GASTO', category: 'GASTO_OPERACIONAL', normal: 'DEBE' },
        '6-01-002': { code: '6-01-002', name: 'Gastos de Envío', type: 'GASTO', category: 'GASTO_OPERACIONAL', normal: 'DEBE' }
    };

    // ============================================================
    // 3. ESTADO GLOBAL
    // ============================================================
    let state = {
        entries: [],
        storeData: {
            orders: [],
            products: [],
            users: [],
            settings: {}
        },
        container: null,
        firebaseDb: null,
        isFirebaseConnected: false,
        syncStatus: 'idle', // idle, syncing, online, offline, error
        listeners: {
            orders: null,
            products: null,
            users: null,
            settings: null,
            entries: null
        },
        processedOrders: [],
        currentTab: 'dashboard'
    };

    // ============================================================
    // 4. UTILITY FUNCTIONS
    // ============================================================
    function generateId() {
        return Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
    }

    function formatDate(timestamp) {
        if (!timestamp) return 'N/A';
        const d = new Date(timestamp);
        return d.toLocaleDateString('es-ES', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatCurrency(value) {
        return '$' + (value || 0).toFixed(2);
    }

    function getAccountName(code) {
        return CHART_OF_ACCOUNTS[code]?.name || code;
    }

    function getAccountType(code) {
        return CHART_OF_ACCOUNTS[code]?.type || '';
    }

    // ============================================================
    // 5. TOAST NOTIFICATIONS
    // ============================================================
    function showToast(message, type = 'info') {
        let container = document.querySelector('.contab-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'contab-toast-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999999;
                display: flex;
                flex-direction: column;
                gap: 8px;
                max-width: 400px;
            `;
            document.body.appendChild(container);
        }

        const colors = {
            success: '#059669',
            warning: '#d97706',
            error: '#dc2626',
            info: '#0f3460'
        };

        const toast = document.createElement('div');
        toast.style.cssText = `
            background: ${colors[type] || colors.info};
            color: white;
            padding: 10px 16px;
            border-radius: 8px;
            font-weight: 500;
            font-size: 13px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        toast.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" style="background:none;border:none;color:rgba(255,255,255,0.7);font-size:18px;cursor:pointer;padding:0 4px;">&times;</button>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 4000);
    }

    // ============================================================
    // 6. FIREBASE CONNECTION
    // ============================================================
    function getFirebaseDb() {
        if (state.firebaseDb) return state.firebaseDb;
        
        try {
            if (typeof firebase !== 'undefined' && firebase.database) {
                state.firebaseDb = firebase.database();
                state.isFirebaseConnected = true;
                console.log('✅ Firebase Database conectado');
                return state.firebaseDb;
            }
        } catch (e) {
            console.warn('Firebase no disponible:', e);
            state.isFirebaseConnected = false;
            showToast('Firebase no disponible. Modo offline.', 'warning');
        }
        return null;
    }

    // ============================================================
    // 7. PERSISTENCIA LOCAL
    // ============================================================
    function loadFromLocalStorage() {
        try {
            // Cargar asientos
            const entriesData = localStorage.getItem(CONFIG.STORAGE_KEY_ENTRIES);
            if (entriesData) {
                state.entries = JSON.parse(entriesData);
            } else {
                state.entries = [];
            }

            // Cargar datos de la tienda
            const storeData = localStorage.getItem(CONFIG.STORAGE_KEY_STORE);
            if (storeData) {
                state.storeData = JSON.parse(storeData);
            }

            // Cargar pedidos procesados
            const processed = localStorage.getItem(CONFIG.STORAGE_KEY_PROCESSED);
            if (processed) {
                state.processedOrders = JSON.parse(processed);
            } else {
                state.processedOrders = [];
            }

            return true;
        } catch (e) {
            console.warn('Error cargando datos locales:', e);
            return false;
        }
    }

    function saveToLocalStorage() {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEY_ENTRIES, JSON.stringify(state.entries));
            localStorage.setItem(CONFIG.STORAGE_KEY_STORE, JSON.stringify(state.storeData));
            localStorage.setItem(CONFIG.STORAGE_KEY_PROCESSED, JSON.stringify(state.processedOrders));
            return true;
        } catch (e) {
            console.warn('Error guardando datos locales:', e);
            return false;
        }
    }

    // ============================================================
    // 8. SINCORNIZACIÓN CON FIREBASE
    // ============================================================
    function setupFirebaseListeners() {
        const db = getFirebaseDb();
        if (!db) {
            state.syncStatus = 'offline';
            updateSyncStatus();
            return;
        }

        state.syncStatus = 'syncing';
        updateSyncStatus();

        // === LISTENER: ORDENES ===
        if (state.listeners.orders) {
            state.listeners.orders();
            state.listeners.orders = null;
        }
        state.listeners.orders = db.ref(CONFIG.FIREBASE_PATHS.ORDERS).on('value', function(snapshot) {
            try {
                const data = snapshot.val();
                state.storeData.orders = [];
                if (data) {
                    Object.keys(data).forEach(key => {
                        state.storeData.orders.push({ id: key, ...data[key] });
                    });
                }
                saveToLocalStorage();
                state.syncStatus = 'online';
                updateSyncStatus();
                
                // Generar asientos automáticos
                generateEntriesFromOrders();
                
                // Actualizar UI
                if (document.getElementById('entries-list')) {
                    renderEntriesList();
                }
                updateDashboard();
                notifyModules('orders', state.storeData.orders);
            } catch (e) {
                console.error('Error procesando órdenes:', e);
                state.syncStatus = 'error';
                updateSyncStatus();
            }
        }, function(error) {
            console.error('Error en listener de órdenes:', error);
            state.syncStatus = 'offline';
            updateSyncStatus();
            showToast('Error sincronizando órdenes: ' + error.message, 'error');
        });

        // === LISTENER: PRODUCTOS ===
        if (state.listeners.products) {
            state.listeners.products();
            state.listeners.products = null;
        }
        state.listeners.products = db.ref(CONFIG.FIREBASE_PATHS.PRODUCTS).on('value', function(snapshot) {
            try {
                const data = snapshot.val();
                state.storeData.products = [];
                if (data) {
                    Object.keys(data).forEach(key => {
                        state.storeData.products.push({ id: key, ...data[key] });
                    });
                }
                saveToLocalStorage();
                notifyModules('products', state.storeData.products);
            } catch (e) {
                console.error('Error procesando productos:', e);
            }
        }, function(error) {
            console.error('Error en listener de productos:', error);
        });

        // === LISTENER: USUARIOS ===
        if (state.listeners.users) {
            state.listeners.users();
            state.listeners.users = null;
        }
        state.listeners.users = db.ref(CONFIG.FIREBASE_PATHS.USERS).on('value', function(snapshot) {
            try {
                const data = snapshot.val();
                state.storeData.users = [];
                if (data) {
                    Object.keys(data).forEach(key => {
                        state.storeData.users.push({ id: key, ...data[key] });
                    });
                }
                saveToLocalStorage();
            } catch (e) {
                console.error('Error procesando usuarios:', e);
            }
        }, function(error) {
            console.error('Error en listener de usuarios:', error);
        });

        // === LISTENER: CONFIGURACIÓN ===
        if (state.listeners.settings) {
            state.listeners.settings();
            state.listeners.settings = null;
        }
        state.listeners.settings = db.ref(CONFIG.FIREBASE_PATHS.SETTINGS).on('value', function(snapshot) {
            try {
                state.storeData.settings = snapshot.val() || {};
                saveToLocalStorage();
            } catch (e) {
                console.error('Error procesando configuración:', e);
            }
        }, function(error) {
            console.error('Error en listener de configuración:', error);
        });

        // === LISTENER: ASIENTOS CONTABLES ===
        if (state.listeners.entries) {
            state.listeners.entries();
            state.listeners.entries = null;
        }
        state.listeners.entries = db.ref(CONFIG.FIREBASE_PATHS.ENTRIES).on('value', function(snapshot) {
            try {
                const data = snapshot.val();
                if (data) {
                    state.entries = Object.keys(data).map(key => ({
                        id: key,
                        ...data[key]
                    }));
                } else {
                    state.entries = [];
                }
                saveToLocalStorage();
                state.syncStatus = 'online';
                updateSyncStatus();
                
                if (document.getElementById('entries-list')) {
                    renderEntriesList();
                }
                updateDashboard();
                updateBadge();
            } catch (e) {
                console.error('Error procesando asientos:', e);
                state.syncStatus = 'error';
                updateSyncStatus();
            }
        }, function(error) {
            console.error('Error en listener de asientos:', error);
            state.syncStatus = 'offline';
            updateSyncStatus();
            showToast('Error sincronizando asientos: ' + error.message, 'error');
        });

        console.log('✅ Listeners de Firebase configurados');
    }

    function saveEntriesToFirebase() {
        const db = getFirebaseDb();
        if (!db) {
            saveToLocalStorage();
            return;
        }

        try {
            const entriesMap = {};
            state.entries.forEach(entry => {
                entriesMap[entry.id] = entry;
            });
            db.ref(CONFIG.FIREBASE_PATHS.ENTRIES).set(entriesMap)
                .then(() => {
                    state.syncStatus = 'online';
                    updateSyncStatus();
                })
                .catch((error) => {
                    console.error('Error guardando asientos en Firebase:', error);
                    state.syncStatus = 'offline';
                    updateSyncStatus();
                    showToast('Error guardando asientos: ' + error.message, 'error');
                });
        } catch (e) {
            console.error('Error en saveEntriesToFirebase:', e);
        }
    }

    function updateSyncStatus() {
        const statusEl = document.getElementById('contab-sync-status');
        if (!statusEl) return;

        const dot = statusEl.querySelector('.dot');
        const text = statusEl.querySelector('.text');
        const time = statusEl.querySelector('.time');

        const statusMap = {
            'idle': { dot: 'offline', text: 'Sin conexión' },
            'syncing': { dot: 'syncing', text: 'Sincronizando...' },
            'online': { dot: 'online', text: 'En línea' },
            'offline': { dot: 'offline', text: 'Offline' },
            'error': { dot: 'offline', text: 'Error' }
        };

        const status = statusMap[state.syncStatus] || statusMap.offline;
        dot.className = 'dot ' + status.dot;
        text.textContent = status.text;
        if (state.storeData.settings?.lastSync) {
            time.textContent = 'Última: ' + formatDate(state.storeData.settings.lastSync);
        }
    }

    // ============================================================
    // 9. NOTIFICACIÓN A MÓDULOS
    // ============================================================
    function notifyModules(type, data) {
        try {
            if (type === 'products' && typeof window.KardexModule !== 'undefined') {
                if (typeof window.KardexModule.updateProducts === 'function') {
                    window.KardexModule.updateProducts(data);
                }
            }
            if (type === 'orders' && typeof window.VentasModule !== 'undefined') {
                if (typeof window.VentasModule.updateOrders === 'function') {
                    window.VentasModule.updateOrders(data);
                }
            }
        } catch (e) {
            console.warn('Error notificando módulos:', e);
        }
    }

    // ============================================================
    // 10. GENERACIÓN DE ASIENTOS
    // ============================================================
    function generateEntriesFromOrders() {
        const orders = state.storeData.orders || [];
        if (orders.length === 0) return;

        let newCount = 0;

        orders.forEach(order => {
            const ref = order.orderNumber || order.id;
            if (state.processedOrders.includes(ref)) return;
            if (!order.items || order.items.length === 0) return;

            const entry = createSalesEntry(order);
            if (entry) {
                state.entries.unshift(entry);
                state.processedOrders.push(ref);
                newCount++;
            }
        });

        if (newCount > 0) {
            saveEntries();
            if (newCount > 0) {
                showToast(`${newCount} asientos generados automáticamente`, 'success');
            }
        }
    }

    function createSalesEntry(order) {
        const date = new Date(order.createdAt || Date.now()).toISOString().split('T')[0];
        const ref = order.orderNumber || order.id;
        const customer = order.userName || order.userEmail || 'Cliente';
        const lines = [];
        const subtotal = parseFloat(order.subtotal) || 0;
        const shipping = parseFloat(order.shipping) || 0;
        const total = parseFloat(order.total) || 0;

        // Determinar tipo de venta
        const isOnline = order.source === 'online' || order.paymentMethod === 'paypal' || order.paymentMethod === 'tarjeta';
        const salesAccount = isOnline ? '4-01-003' : '4-01-002';

        // DEBE: Banco o Caja
        const cashAccount = order.paymentMethod === 'efectivo' ? '1-01-001' : '1-01-002';
        lines.push({ accountCode: cashAccount, amount: total, side: 'DEBE', description: 'Pago recibido' });

        // HABER: Ventas
        if (subtotal > 0) {
            lines.push({ accountCode: salesAccount, amount: subtotal, side: 'HABER', description: 'Venta' });
        }

        // HABER: Ingresos por Envíos
        if (shipping > 0) {
            lines.push({ accountCode: '4-02-001', amount: shipping, side: 'HABER', description: 'Envío' });
        }

        // Costo de Ventas (desde productos)
        const totalCosto = order.items.reduce((sum, item) => {
            const product = state.storeData.products?.find(p => p.id === item.id || p.code === item.code);
            const costo = product?.cost || product?.costPrice || product?.price * 0.6 || 0;
            return sum + (costo * (item.quantity || 1));
        }, 0);

        if (totalCosto > 0) {
            lines.push({ accountCode: '5-01-002', amount: totalCosto, side: 'DEBE', description: 'Costo de ventas' });
            lines.push({ accountCode: '1-03-002', amount: totalCosto, side: 'HABER', description: 'Salida inventario' });
        }

        // Balancear
        const totalDebe = lines.filter(l => l.side === 'DEBE').reduce((s, l) => s + l.amount, 0);
        const totalHaber = lines.filter(l => l.side === 'HABER').reduce((s, l) => s + l.amount, 0);
        const diff = Math.abs(totalDebe - totalHaber);

        if (diff > 0.01) {
            lines.push({
                accountCode: '3-03-001',
                amount: diff,
                side: totalDebe > totalHaber ? 'HABER' : 'DEBE',
                description: 'Ajuste por diferencia'
            });
        }

        return {
            id: 'entry_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            date: date,
            description: `${isOnline ? 'Venta Online' : 'Venta Física'} ${ref} - ${customer}`,
            lines: lines,
            type: 'VENTA',
            orderRef: ref,
            source: isOnline ? 'online' : 'fisico',
            createdAt: Date.now(),
            status: 'REGISTRADO'
        };
    }

    function saveEntries() {
        saveToLocalStorage();
        saveEntriesToFirebase();
        updateBadge();
    }

    function updateBadge() {
        const badge = document.querySelector('.contab-nav-btn[data-tab="entries"] .badge');
        if (badge) {
            badge.textContent = state.entries.length;
        }
    }

    // ============================================================
    // 11. RENDERIZADO UI
    // ============================================================
    function renderUI() {
        if (!state.container) return;

        state.container.innerHTML = `
            <style>
                .contab-nav {
                    display: flex;
                    gap: 4px;
                    background: #ffffff;
                    padding: 8px 8px 0 8px;
                    border-radius: 12px 12px 0 0;
                    border-bottom: 3px solid #0f3460;
                    flex-wrap: wrap;
                }
                .contab-nav-btn {
                    padding: 10px 18px;
                    border: none;
                    background: #e8ecf1;
                    color: #4a5568;
                    font-weight: 600;
                    font-size: 13px;
                    border-radius: 8px 8px 0 0;
                    cursor: pointer;
                    transition: all 0.3s;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    border-bottom: 3px solid transparent;
                }
                .contab-nav-btn:hover { background: #d5dce4; color: #1a202c; }
                .contab-nav-btn.active {
                    background: #0f3460;
                    color: #ffffff;
                    border-bottom-color: #e94560;
                    box-shadow: 0 -2px 10px rgba(15,52,96,0.2);
                }
                .contab-nav-btn .badge {
                    background: #e94560;
                    color: white;
                    padding: 1px 8px;
                    border-radius: 12px;
                    font-size: 10px;
                }
                .contab-content {
                    background: #ffffff;
                    padding: 20px;
                    border-radius: 0 0 12px 12px;
                    min-height: 400px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                }
                .contab-pane { display: none; animation: fadeIn 0.3s ease; }
                .contab-pane.active { display: block; }
                @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
                
                .contab-card {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    padding: 20px;
                    margin-bottom: 20px;
                }
                .contab-card h5 {
                    color: #0f3460;
                    margin-top: 0;
                    margin-bottom: 15px;
                    border-bottom: 2px solid #e2e8f0;
                    padding-bottom: 10px;
                }
                .contab-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 13px;
                }
                .contab-table th {
                    background: #0f3460;
                    color: white;
                    padding: 8px 12px;
                    text-align: left;
                }
                .contab-table td {
                    padding: 6px 12px;
                    border-bottom: 1px solid #e2e8f0;
                }
                .contab-table tr:hover td { background: #f1f5f9; }
                .contab-table .total-row { background: #e8ecf1; font-weight: 700; }
                
                .contab-btn {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 6px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s;
                    font-size: 13px;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }
                .contab-btn-primary { background: #0f3460; color: white; }
                .contab-btn-primary:hover { background: #1a4a7a; transform: translateY(-1px); }
                .contab-btn-success { background: #059669; color: white; }
                .contab-btn-success:hover { background: #047857; transform: translateY(-1px); }
                .contab-btn-danger { background: #dc2626; color: white; }
                .contab-btn-danger:hover { background: #b91c1c; transform: translateY(-1px); }
                .contab-btn-warning { background: #d97706; color: white; }
                .contab-btn-warning:hover { background: #b45309; transform: translateY(-1px); }
                .contab-btn-outline { background: transparent; color: #0f3460; border: 2px solid #0f3460; }
                .contab-btn-outline:hover { background: #0f3460; color: white; }
                .contab-btn-sm { padding: 4px 12px; font-size: 12px; }
                
                .contab-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
                    gap: 15px;
                    margin-bottom: 20px;
                }
                .contab-stat {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    padding: 15px;
                    text-align: center;
                    transition: all 0.3s;
                }
                .contab-stat:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); transform: translateY(-2px); }
                .contab-stat .icon { font-size: 24px; margin-bottom: 6px; }
                .contab-stat .value { font-size: 22px; font-weight: 700; color: #0f3460; }
                .contab-stat .label { font-size: 11px; color: #64748b; margin-top: 4px; }
                
                .contab-badge {
                    display: inline-block;
                    padding: 2px 10px;
                    border-radius: 20px;
                    font-size: 11px;
                    font-weight: 600;
                }
                .contab-badge-debe { background: #dbeafe; color: #1e40af; }
                .contab-badge-haber { background: #fce4ec; color: #b71c1c; }
                .contab-badge-success { background: #d1fae5; color: #065f46; }
                .contab-badge-warning { background: #fef3c7; color: #92400e; }
                .contab-badge-danger { background: #fee2e2; color: #991b1b; }
                
                .contab-input, .contab-select {
                    padding: 8px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    width: 100%;
                    font-size: 14px;
                }
                .contab-input:focus, .contab-select:focus {
                    border-color: #0f3460;
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(15,52,96,0.1);
                }
                .contab-label { font-weight: 600; color: #1e293b; margin-bottom: 4px; display: block; font-size: 13px; }
                
                .contab-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                @media (max-width: 768px) { .contab-grid-2 { grid-template-columns: 1fr; } }

                .contab-sync-status {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 11px;
                    color: #64748b;
                    background: white;
                    padding: 4px 12px;
                    border-radius: 20px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                .contab-sync-status .dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    display: inline-block;
                }
                .contab-sync-status .dot.online { background: #059669; }
                .contab-sync-status .dot.offline { background: #dc2626; }
                .contab-sync-status .dot.syncing { 
                    background: #d97706;
                    animation: pulse 0.8s ease-in-out infinite;
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
            </style>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div class="contab-nav">
                    <button class="contab-nav-btn active" data-tab="dashboard">
                        <i class="fas fa-tachometer-alt"></i> Dashboard
                    </button>
                    <button class="contab-nav-btn" data-tab="entries">
                        <i class="fas fa-book"></i> Libro Diario 
                        <span class="badge">${state.entries.length}</span>
                    </button>
                    <button class="contab-nav-btn" data-tab="kardex">
                        <i class="fas fa-boxes"></i> Kardex
                    </button>
                    <button class="contab-nav-btn" data-tab="ventas">
                        <i class="fas fa-shopping-cart"></i> Ventas
                    </button>
                    <button class="contab-nav-btn" data-tab="reports">
                        <i class="fas fa-chart-pie"></i> Reportes
                    </button>
                    <button class="contab-nav-btn" data-tab="settings">
                        <i class="fas fa-cog"></i> Config
                    </button>
                </div>
                <div class="contab-sync-status" id="contab-sync-status">
                    <span class="dot offline"></span>
                    <span class="text">Cargando...</span>
                    <span class="time"></span>
                </div>
            </div>

            <div class="contab-content">
                <div id="pane-dashboard" class="contab-pane active">${renderDashboard()}</div>
                <div id="pane-entries" class="contab-pane">${renderEntriesTab()}</div>
                <div id="pane-kardex" class="contab-pane">
                    <div id="kardex-content"><p>Cargando módulo de Kardex...</p></div>
                </div>
                <div id="pane-ventas" class="contab-pane">
                    <div id="ventas-content"><p>Cargando módulo de Ventas...</p></div>
                </div>
                <div id="pane-reports" class="contab-pane">
                    <div id="reports-content"><p>Cargando reportes...</p></div>
                </div>
                <div id="pane-settings" class="contab-pane">${renderSettingsTab()}</div>
            </div>
        `;

        // Eventos de pestañas
        document.querySelectorAll('.contab-nav-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const tab = this.dataset.tab;
                switchTab(tab);
            });
        });

        // Cargar módulos
        loadModuleTab('kardex', 'KardexModule');
        loadModuleTab('ventas', 'VentasModule');
        loadModuleTab('reports', 'ReportesContaModule');

        renderEntriesList();
        updateDashboard();
        updateSyncStatus();
    }

    function loadModuleTab(tabId, moduleName) {
        const contentId = tabId + '-content';
        const content = document.getElementById(contentId);
        if (!content) return;

        if (typeof window[moduleName] !== 'undefined') {
            if (typeof window[moduleName].render === 'function') {
                window[moduleName].render(content);
            }
            return;
        }

        const fileMap = {
            'kardex': 'kardex.js',
            'ventas': 'ventas.js',
            'reports': 'reportes_conta.js'
        };

        const script = document.createElement('script');
        script.src = fileMap[tabId];
        script.onload = function() {
            if (typeof window[moduleName] !== 'undefined' && typeof window[moduleName].render === 'function') {
                window[moduleName].render(content);
            } else {
                content.innerHTML = `<div class="contab-card" style="text-align:center; padding:40px; color:#94a3b8;">
                    <i class="fas fa-exclamation-triangle" style="font-size:36px;"></i>
                    <p>Módulo ${tabId} no disponible</p>
                </div>`;
            }
        };
        script.onerror = function() {
            content.innerHTML = `<div class="contab-card" style="text-align:center; padding:40px; color:#94a3b8;">
                <i class="fas fa-exclamation-triangle" style="font-size:36px;"></i>
                <p>Error cargando módulo ${tabId}</p>
            </div>`;
        };
        document.head.appendChild(script);
    }

    function switchTab(tabId) {
        state.currentTab = tabId;
        
        document.querySelectorAll('.contab-nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        document.querySelectorAll('.contab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === 'pane-' + tabId);
        });

        if (tabId === 'entries') renderEntriesList();
        if (tabId === 'dashboard') updateDashboard();
    }

    // ============================================================
    // 12. DASHBOARD
    // ============================================================
    function renderDashboard() {
        const totalOrders = state.storeData.orders?.length || 0;
        const totalRevenue = state.storeData.orders?.reduce((s, o) => s + (parseFloat(o.total) || 0), 0) || 0;
        const totalEntries = state.entries.length;
        const pendingOrders = state.storeData.orders?.filter(o => o.status === 'pendiente').length || 0;
        const totalProducts = state.storeData.products?.length || 0;

        return `
            <div class="contab-stats">
                <div class="contab-stat">
                    <div class="icon" style="color:#0f3460;">📦</div>
                    <div class="value">${totalOrders}</div>
                    <div class="label">Total Pedidos</div>
                </div>
                <div class="contab-stat">
                    <div class="icon" style="color:#059669;">💰</div>
                    <div class="value">$${totalRevenue.toFixed(2)}</div>
                    <div class="label">Ingresos Totales</div>
                </div>
                <div class="contab-stat">
                    <div class="icon" style="color:#d97706;">📝</div>
                    <div class="value">${totalEntries}</div>
                    <div class="label">Asientos Contables</div>
                </div>
                <div class="contab-stat">
                    <div class="icon" style="color:#8b5cf6;">📦</div>
                    <div class="value">${totalProducts}</div>
                    <div class="label">Productos en Bodega</div>
                </div>
            </div>
            <div class="contab-grid-2">
                <div class="contab-card">
                    <h5><i class="fas fa-info-circle" style="color:#0f3460;"></i> Resumen</h5>
                    <p><strong>Último asiento:</strong> ${state.entries.length > 0 ? formatDate(state.entries[0].date) : 'Ninguno'}</p>
                    <p><strong>Pedidos pendientes:</strong> ${pendingOrders}</p>
                    <p><strong>Pedidos procesados:</strong> ${state.storeData.orders?.filter(o => o.status === 'completado' || o.status === 'confirmado').length || 0}</p>
                    <button class="contab-btn contab-btn-primary" onclick="window.ContabilidadModule.generateEntries()">
                        <i class="fas fa-sync-alt"></i> Generar Asientos
                    </button>
                    <button class="contab-btn contab-btn-success" onclick="window.ContabilidadModule.syncNow()">
                        <i class="fas fa-cloud-upload-alt"></i> Sincronizar
                    </button>
                </div>
                <div class="contab-card">
                    <h5><i class="fas fa-link" style="color:#0f3460;"></i> Módulos Activos</h5>
                    <p>✅ <strong>Kardex:</strong> ${totalProducts} productos con costos y precios</p>
                    <p>✅ <strong>Ventas:</strong> ${totalOrders} ventas (online + físico)</p>
                    <p>✅ <strong>Reportes:</strong> Listos para generar</p>
                    <p style="font-size:12px;color:#64748b;margin-top:8px;">
                        <strong>Estado:</strong> ${state.syncStatus === 'online' ? '🟢 En línea' : state.syncStatus === 'syncing' ? '🟡 Sincronizando...' : '🔴 Offline'}
                    </p>
                </div>
            </div>
        `;
    }

    function updateDashboard() {
        const pane = document.getElementById('pane-dashboard');
        if (pane && pane.classList.contains('active')) {
            pane.innerHTML = renderDashboard();
        }
    }

    // ============================================================
    // 13. LIBRO DIARIO
    // ============================================================
    function renderEntriesTab() {
        return `
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; flex-wrap:wrap; gap:10px;">
                <h5 style="margin:0; color:#0f3460;"><i class="fas fa-book"></i> Libro Diario</h5>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="contab-btn contab-btn-primary" onclick="window.ContabilidadModule.showEntryForm()">
                        <i class="fas fa-plus"></i> Nuevo Asiento
                    </button>
                    <button class="contab-btn contab-btn-success" onclick="window.ContabilidadModule.generateEntries()">
                        <i class="fas fa-sync-alt"></i> Generar Automático
                    </button>
                    <button class="contab-btn contab-btn-danger" onclick="window.ContabilidadModule.clearAllEntries()">
                        <i class="fas fa-trash"></i> Limpiar Todo
                    </button>
                </div>
            </div>
            <div id="entries-list"></div>
        `;
    }

    function renderEntriesList() {
        const listContainer = document.getElementById('entries-list');
        if (!listContainer) return;

        if (state.entries.length === 0) {
            listContainer.innerHTML = `
                <div class="contab-card" style="text-align:center; padding:50px; color:#94a3b8;">
                    <i class="fas fa-book" style="font-size:48px;"></i>
                    <p style="margin-top:10px;">No hay asientos registrados</p>
                    <button class="contab-btn contab-btn-primary" onclick="window.ContabilidadModule.generateEntries()">
                        <i class="fas fa-sync-alt"></i> Generar desde Pedidos
                    </button>
                </div>
            `;
            return;
        }

        const sorted = [...state.entries].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        let html = `<div style="overflow-x:auto;"><table class="contab-table"><thead><tr>
            <th>Fecha</th>
            <th>Descripción</th>
            <th>Cuentas</th>
            <th>Debe</th>
            <th>Haber</th>
            <th style="width:100px;">Acciones</th>
        </tr></thead><tbody>`;

        sorted.forEach((entry) => {
            const totalDebe = entry.lines.filter(l => l.side === 'DEBE').reduce((s, l) => s + l.amount, 0);
            const totalHaber = entry.lines.filter(l => l.side === 'HABER').reduce((s, l) => s + l.amount, 0);
            const date = entry.date ? new Date(entry.date).toLocaleDateString() : 'N/A';
            const idx = state.entries.indexOf(entry);

            const linesDisplay = entry.lines.slice(0, 3).map(l => {
                const accountName = getAccountName(l.accountCode);
                return `<span class="contab-badge ${l.side === 'DEBE' ? 'contab-badge-debe' : 'contab-badge-haber'}">${accountName}</span>`;
            }).join(' ');

            html += `
                <tr>
                    <td>${date}</td>
                    <td><strong>${entry.description}</strong></td>
                    <td>${linesDisplay}${entry.lines.length > 3 ? ` +${entry.lines.length - 3} más` : ''}</td>
                    <td><strong style="color:#0f3460;">$${totalDebe.toFixed(2)}</strong></td>
                    <td><strong style="color:#dc2626;">$${totalHaber.toFixed(2)}</strong></td>
                    <td>
                        <button class="contab-btn contab-btn-primary contab-btn-sm" onclick="window.ContabilidadModule.viewEntry(${idx})"><i class="fas fa-eye"></i></button>
                        <button class="contab-btn contab-btn-danger contab-btn-sm" onclick="window.ContabilidadModule.deleteEntry(${idx})"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });

        html += `
            </tbody>
            <tfoot><tr class="total-row">
                <td colspan="3" style="text-align:right;">TOTALES</td>
                <td>$${state.entries.reduce((s, e) => s + e.lines.filter(l => l.side === 'DEBE').reduce((s2, l) => s2 + l.amount, 0), 0).toFixed(2)}</td>
                <td>$${state.entries.reduce((s, e) => s + e.lines.filter(l => l.side === 'HABER').reduce((s2, l) => s2 + l.amount, 0), 0).toFixed(2)}</td>
                <td></td>
            </tr></tfoot>
        </table></div>`;

        listContainer.innerHTML = html;
    }

    // ============================================================
    // 14. CONFIGURACIÓN
    // ============================================================
    function renderSettingsTab() {
        return `
            <h5 style="color:#0f3460;"><i class="fas fa-cog"></i> Configuración</h5>
            <div class="contab-grid-2">
                <div class="contab-card">
                    <h6>Plan de Cuentas</h6>
                    <p>Total cuentas: ${Object.keys(CHART_OF_ACCOUNTS).length}</p>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; font-size:13px;">
                        <div><strong>Activo:</strong> ${Object.values(CHART_OF_ACCOUNTS).filter(a => a.type === 'ACTIVO').length}</div>
                        <div><strong>Pasivo:</strong> ${Object.values(CHART_OF_ACCOUNTS).filter(a => a.type === 'PASIVO').length}</div>
                        <div><strong>Patrimonio:</strong> ${Object.values(CHART_OF_ACCOUNTS).filter(a => a.type === 'PATRIMONIO').length}</div>
                        <div><strong>Ingresos:</strong> ${Object.values(CHART_OF_ACCOUNTS).filter(a => a.type === 'INGRESO').length}</div>
                        <div><strong>Costos:</strong> ${Object.values(CHART_OF_ACCOUNTS).filter(a => a.type === 'COSTO').length}</div>
                        <div><strong>Gastos:</strong> ${Object.values(CHART_OF_ACCOUNTS).filter(a => a.type === 'GASTO').length}</div>
                    </div>
                </div>
                <div class="contab-card">
                    <h6>Datos del Sistema</h6>
                    <p><strong>Pedidos:</strong> ${state.storeData.orders?.length || 0}</p>
                    <p><strong>Productos:</strong> ${state.storeData.products?.length || 0}</p>
                    <p><strong>Asientos:</strong> ${state.entries.length}</p>
                    <p><strong>Estado Firebase:</strong> ${state.isFirebaseConnected ? '🟢 Conectado' : '🔴 Desconectado'}</p>
                    <button class="contab-btn contab-btn-warning" onclick="window.ContabilidadModule.exportData()">
                        <i class="fas fa-download"></i> Exportar Datos
                    </button>
                    <button class="contab-btn contab-btn-primary" onclick="window.ContabilidadModule.syncNow()">
                        <i class="fas fa-cloud-upload-alt"></i> Sincronizar Ahora
                    </button>
                    <button class="contab-btn contab-btn-danger" onclick="window.ContabilidadModule.resetAll()">
                        <i class="fas fa-trash"></i> Reiniciar Sistema
                    </button>
                </div>
            </div>
        `;
    }

    // ============================================================
    // 15. CRUD DE ASIENTOS
    // ============================================================
    function showEntryForm(entryData) {
        const isEdit = !!entryData;
        const modal = document.createElement('div');
        modal.id = 'entry-form-modal';
        modal.style.cssText = `
            position:fixed; top:0; left:0; width:100%; height:100%;
            background:rgba(0,0,0,0.5); z-index:999999;
            display:flex; justify-content:center; align-items:center;
            backdrop-filter:blur(4px);
        `;

        const lines = entryData?.lines || [{ accountCode: '', side: 'DEBE', amount: '' }];

        modal.innerHTML = `
            <div style="background:white; border-radius:16px; padding:30px; width:90%; max-width:800px; max-height:90vh; overflow-y:auto;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h3 style="margin:0; color:#0f3460;">${isEdit ? 'Editar Asiento' : 'Nuevo Asiento'}</h3>
                    <button onclick="document.getElementById('entry-form-modal').remove()" style="background:none; border:none; font-size:24px; cursor:pointer; color:#94a3b8;">&times;</button>
                </div>
                <form id="entry-form">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:15px;">
                        <div>
                            <label class="contab-label">Fecha</label>
                            <input type="date" class="contab-input" id="entry-date" value="${entryData?.date || new Date().toISOString().split('T')[0]}" required>
                        </div>
                        <div>
                            <label class="contab-label">Tipo</label>
                            <select class="contab-select" id="entry-type">
                                <option value="VENTA" ${entryData?.type === 'VENTA' ? 'selected' : ''}>Venta</option>
                                <option value="COMPRA" ${entryData?.type === 'COMPRA' ? 'selected' : ''}>Compra</option>
                                <option value="GASTO" ${entryData?.type === 'GASTO' ? 'selected' : ''}>Gasto</option>
                                <option value="AJUSTE" ${entryData?.type === 'AJUSTE' ? 'selected' : ''}>Ajuste</option>
                                <option value="OTRO" ${!entryData?.type || entryData?.type === 'OTRO' ? 'selected' : ''}>Otro</option>
                            </select>
                        </div>
                    </div>
                    <div style="margin-bottom:15px;">
                        <label class="contab-label">Descripción</label>
                        <input type="text" class="contab-input" id="entry-description" value="${entryData?.description || ''}" required>
                    </div>
                    <div style="margin-bottom:15px;">
                        <label class="contab-label">Líneas del Asiento</label>
                        <div id="entry-lines">
                            ${lines.map((line, idx) => `
                                <div class="entry-line" style="display:grid; grid-template-columns:2fr 1fr 1fr auto; gap:8px; margin-bottom:8px; align-items:center;">
                                    <select class="account-select contab-select">
                                        ${Object.values(CHART_OF_ACCOUNTS).map(acc => 
                                            `<option value="${acc.code}" ${line.accountCode === acc.code ? 'selected' : ''}>${acc.code} - ${acc.name}</option>`
                                        ).join('')}
                                    </select>
                                    <select class="side-select contab-select">
                                        <option value="DEBE" ${line.side === 'DEBE' ? 'selected' : ''}>Debe</option>
                                        <option value="HABER" ${line.side === 'HABER' ? 'selected' : ''}>Haber</option>
                                    </select>
                                    <input type="number" step="0.01" class="amount-input contab-input" value="${line.amount || ''}" placeholder="0.00">
                                    <button type="button" class="remove-line-btn contab-btn contab-btn-danger contab-btn-sm" ${lines.length <= 1 ? 'style="display:none;"' : ''}>
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" class="contab-btn contab-btn-primary contab-btn-sm" id="add-line-btn" style="margin-top:10px;">
                            <i class="fas fa-plus"></i> Agregar Línea
                        </button>
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; border-top:1px solid #e2e8f0; padding-top:20px;">
                        <button type="button" class="contab-btn contab-btn-outline" onclick="document.getElementById('entry-form-modal').remove()">Cancelar</button>
                        <button type="submit" class="contab-btn contab-btn-success">${isEdit ? 'Actualizar' : 'Guardar'}</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('add-line-btn').addEventListener('click', function() {
            const container = document.getElementById('entry-lines');
            const template = container.querySelector('.entry-line');
            const newLine = template.cloneNode(true);
            newLine.querySelector('.account-select').selectedIndex = 0;
            newLine.querySelector('.side-select').selectedIndex = 0;
            newLine.querySelector('.amount-input').value = '';
            newLine.querySelector('.remove-line-btn').style.display = 'inline-block';
            container.appendChild(newLine);
            setupRemoveLineEvents();
        });

        setupRemoveLineEvents();

        document.getElementById('entry-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const date = document.getElementById('entry-date').value;
            const description = document.getElementById('entry-description').value;
            const type = document.getElementById('entry-type').value;
            const lineElements = document.querySelectorAll('.entry-line');
            const lines = [];
            let totalDebe = 0, totalHaber = 0;

            lineElements.forEach(el => {
                const accountCode = el.querySelector('.account-select').value;
                const side = el.querySelector('.side-select').value;
                const amount = parseFloat(el.querySelector('.amount-input').value);
                if (accountCode && amount > 0) {
                    lines.push({ accountCode, side, amount });
                    if (side === 'DEBE') totalDebe += amount;
                    else totalHaber += amount;
                }
            });

            if (lines.length < 2) {
                showToast('Debe agregar al menos 2 líneas.', 'warning');
                return;
            }

            if (Math.abs(totalDebe - totalHaber) > 0.01) {
                showToast(`Debe ($${totalDebe.toFixed(2)}) debe ser igual a Haber ($${totalHaber.toFixed(2)})`, 'danger');
                return;
            }

            const newEntry = {
                id: isEdit ? entryData.id : 'entry_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                date: date,
                description: description,
                lines: lines,
                type: type,
                createdAt: isEdit ? entryData.createdAt : Date.now(),
                status: 'REGISTRADO'
            };

            if (isEdit) {
                const idx = state.entries.indexOf(entryData);
                if (idx !== -1) state.entries[idx] = newEntry;
            } else {
                state.entries.unshift(newEntry);
            }

            saveEntries();
            modal.remove();
            renderEntriesList();
            updateDashboard();
            updateBadge();
            showToast(isEdit ? 'Asiento actualizado' : 'Asiento creado', 'success');
        });

        function setupRemoveLineEvents() {
            document.querySelectorAll('.remove-line-btn').forEach(btn => {
                btn.onclick = function() {
                    const container = document.getElementById('entry-lines');
                    if (container.querySelectorAll('.entry-line').length > 1) {
                        this.closest('.entry-line').remove();
                    }
                };
            });
        }
    }

    function viewEntry(index) {
        const entry = state.entries[index];
        if (!entry) return;

        const modal = document.createElement('div');
        modal.style.cssText = `
            position:fixed; top:0; left:0; width:100%; height:100%;
            background:rgba(0,0,0,0.5); z-index:999999;
            display:flex; justify-content:center; align-items:center;
            backdrop-filter:blur(4px);
        `;

        const totalDebe = entry.lines.filter(l => l.side === 'DEBE').reduce((s, l) => s + l.amount, 0);
        const totalHaber = entry.lines.filter(l => l.side === 'HABER').reduce((s, l) => s + l.amount, 0);

        modal.innerHTML = `
            <div style="background:white; border-radius:16px; padding:30px; width:90%; max-width:700px; max-height:90vh; overflow-y:auto;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h3 style="margin:0; color:#0f3460;">Detalle del Asiento</h3>
                    <button onclick="this.closest('div[style]').remove()" style="background:none; border:none; font-size:24px; cursor:pointer; color:#94a3b8;">&times;</button>
                </div>
                <p><strong>Fecha:</strong> ${formatDate(entry.date)}</p>
                <p><strong>Descripción:</strong> ${entry.description}</p>
                <p><strong>Tipo:</strong> ${entry.type}</p>
                <p><strong>ID:</strong> ${entry.id}</p>
                <hr>
                <table class="contab-table">
                    <thead><tr><th>Cuenta</th><th>Debe</th><th>Haber</th></tr></thead>
                    <tbody>
                        ${entry.lines.map(l => {
                            const name = `${l.accountCode} - ${getAccountName(l.accountCode)}`;
                            return `<tr><td>${name}</td>
                                <td>${l.side === 'DEBE' ? '$' + l.amount.toFixed(2) : '-'}</td>
                                <td>${l.side === 'HABER' ? '$' + l.amount.toFixed(2) : '-'}</td></tr>`;
                        }).join('')}
                    </tbody>
                    <tfoot><tr class="total-row"><td>TOTALES</td><td>$${totalDebe.toFixed(2)}</td><td>$${totalHaber.toFixed(2)}</td></tr></tfoot>
                </table>
                <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
                    <button class="contab-btn contab-btn-primary" onclick="window.ContabilidadModule.editEntry(${index}); this.closest('div[style]').remove();">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="contab-btn contab-btn-outline" onclick="this.closest('div[style]').remove()">Cerrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    function editEntry(index) {
        const entry = state.entries[index];
        if (entry) {
            document.querySelector('#entry-form-modal')?.remove();
            showEntryForm(entry);
        }
    }

    function deleteEntry(index) {
        if (confirm('¿Eliminar este asiento?')) {
            state.entries.splice(index, 1);
            saveEntries();
            renderEntriesList();
            updateDashboard();
            updateBadge();
            showToast('Asiento eliminado', 'warning');
        }
    }

    function clearAllEntries() {
        if (confirm('¿Eliminar TODOS los asientos?')) {
            state.entries = [];
            saveEntries();
            renderEntriesList();
            updateDashboard();
            updateBadge();
            showToast('Todos los asientos eliminados', 'danger');
        }
    }

    function generateEntries() {
        const orders = state.storeData.orders || [];
        if (orders.length === 0) {
            showToast('No hay pedidos para procesar', 'warning');
            return;
        }

        let newCount = 0;

        orders.forEach(order => {
            const ref = order.orderNumber || order.id;
            if (state.processedOrders.includes(ref)) return;
            if (!order.items || order.items.length === 0) return;

            const entry = createSalesEntry(order);
            if (entry) {
                state.entries.unshift(entry);
                state.processedOrders.push(ref);
                newCount++;
            }
        });

        if (newCount > 0) {
            localStorage.setItem(CONFIG.STORAGE_KEY_PROCESSED, JSON.stringify(state.processedOrders));
            saveEntries();
            renderEntriesList();
            updateDashboard();
            updateBadge();
            showToast(`${newCount} asientos generados`, 'success');
        } else {
            showToast('No hay pedidos nuevos para procesar', 'info');
        }
    }

    // ============================================================
    // 16. SINCORNIZACIÓN MANUAL
    // ============================================================
    function syncNow() {
        showToast('Sincronizando con Firebase...', 'info');
        state.syncStatus = 'syncing';
        updateSyncStatus();
        
        // Forzar re-conexión
        const db = getFirebaseDb();
        if (db) {
            // Guardar datos locales en Firebase
            saveEntriesToFirebase();
            
            // Guardar storeData
            try {
                db.ref(CONFIG.FIREBASE_PATHS.ORDERS).set(state.storeData.orders).catch(() => {});
                db.ref(CONFIG.FIREBASE_PATHS.PRODUCTS).set(state.storeData.products).catch(() => {});
                db.ref(CONFIG.FIREBASE_PATHS.USERS).set(state.storeData.users).catch(() => {});
                db.ref(CONFIG.FIREBASE_PATHS.SETTINGS).set(state.storeData.settings).catch(() => {});
            } catch (e) {
                console.warn('Error guardando storeData:', e);
            }
            
            setTimeout(() => {
                state.syncStatus = 'online';
                updateSyncStatus();
                showToast('Sincronización completada', 'success');
            }, 2000);
        } else {
            state.syncStatus = 'offline';
            updateSyncStatus();
            showToast('Firebase no disponible. Datos guardados localmente.', 'warning');
        }
    }

    // ============================================================
    // 17. EXPORTAR Y RESET
    // ============================================================
    function exportData() {
        const data = {
            entries: state.entries,
            accounts: CHART_OF_ACCOUNTS,
            storeData: state.storeData,
            processedOrders: state.processedOrders,
            exportedAt: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contabilidad_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Datos exportados', 'success');
    }

    function resetAll() {
        if (confirm('¿Reiniciar TODO el sistema contable? Esta acción no se puede deshacer.')) {
            state.entries = [];
            state.processedOrders = [];
            localStorage.removeItem(CONFIG.STORAGE_KEY_ENTRIES);
            localStorage.removeItem(CONFIG.STORAGE_KEY_PROCESSED);
            
            // Limpiar Firebase
            const db = getFirebaseDb();
            if (db) {
                db.ref(CONFIG.FIREBASE_PATHS.ENTRIES).set({}).catch(() => {});
            }
            
            renderEntriesList();
            updateDashboard();
            updateBadge();
            showToast('Sistema reiniciado', 'danger');
        }
    }

    // ============================================================
    // 18. INICIALIZACIÓN
    // ============================================================
    function init(containerElement) {
        if (!containerElement) {
            console.error('Contabilidad: container no proporcionado');
            return;
        }

        state.container = containerElement;
        
        // Cargar datos locales
        loadFromLocalStorage();
        
        // Conectar Firebase
        const db = getFirebaseDb();
        if (db) {
            setupFirebaseListeners();
            state.syncStatus = 'online';
        } else {
            state.syncStatus = 'offline';
            showToast('Firebase no disponible. Modo offline.', 'warning');
        }
        
        // Renderizar UI
        renderUI();
        updateSyncStatus();
        
        console.log('✅ Sistema Contable inicializado');
        console.log(`📊 ${Object.keys(CHART_OF_ACCOUNTS).length} cuentas disponibles`);
        console.log(`📝 ${state.entries.length} asientos cargados`);
        console.log(`📦 ${state.storeData.orders?.length || 0} pedidos en sistema`);
    }

    // ============================================================
    // 19. EXPORTAR MÓDULO
    // ============================================================
    window.ContabilidadModule = {
        init: init,
        switchTab: switchTab,
        showEntryForm: showEntryForm,
        viewEntry: viewEntry,
        editEntry: editEntry,
        deleteEntry: deleteEntry,
        clearAllEntries: clearAllEntries,
        generateEntries: generateEntries,
        exportData: exportData,
        resetAll: resetAll,
        syncNow: syncNow,
        renderEntriesList: renderEntriesList,
        updateDashboard: updateDashboard,
        getEntries: () => state.entries,
        getAccounts: () => CHART_OF_ACCOUNTS,
        getStoreData: () => state.storeData,
        showToast: showToast,
        notifyModules: notifyModules
    };

    console.log('✅ Núcleo Contable cargado correctamente');

})();