/**
 * ============================================================
 * reportes_conta.js - Módulo de Reportes Financieros Avanzados
 * Versión 2.0 - Profesional y Autónomo
 * ============================================================
 * 
 * Características:
 * - Estado de Resultados (NIIF)
 * - Balance General (NIIF)
 * - Flujo de Efectivo (Directo/Indirecto)
 * - Estado de Cambios en el Patrimonio Neto
 * - Reporte de Kardex (Inventario)
 * - Resumen de Ventas
 * - Antigüedad de Cuentas por Cobrar/Pagar
 * - Ratios Financieros (Liquidez, Endeudamiento, Rentabilidad, Rotación)
 * - Filtros temporales y comparativos
 * - Exportación a CSV, Excel, PDF, Imprimir
 * - Sincronización en tiempo real con Firebase
 * - Sin gráficos ni dashboards - solo tablas profesionales
 * ============================================================
 */

(function() {
    'use strict';

    // ============================================================
    // 1. CONFIGURACIÓN Y CONSTANTES
    // ============================================================
    const CONFIG = {
        STORAGE_KEY: 'kaboutique_reports_cache',
        STORAGE_KEY_METADATA: 'kaboutique_reports_metadata',
        DATE_PRESETS: {
            today: { label: 'Hoy', days: 0 },
            week: { label: 'Esta semana', days: 7 },
            month: { label: 'Este mes', days: 30 },
            lastMonth: { label: 'Último mes', days: 60 },
            quarter: { label: 'Este trimestre', days: 90 },
            year: { label: 'Este año', days: 365 },
            lastYear: { label: 'Año anterior', days: 730 }
        },
        RATIO_THRESHOLDS: {
            liquidity: { healthy: 2, warning: 1.5, danger: 1 },
            debtEquity: { healthy: 0.5, warning: 1, danger: 2 },
            margin: { healthy: 30, warning: 15, danger: 5 }
        }
    };

    // ============================================================
    // 2. ESTADO INTERNO
    // ============================================================
    let state = {
        // Datos
        entries: [],
        accounts: {},
        products: [],
        sales: [],
        movements: [],
        settings: {},
        
        // UI State
        currentReport: 'income',
        filters: {
            dateFrom: '',
            dateTo: '',
            compareFrom: '',
            compareTo: '',
            accounts: [],
            source: '',
            customer: '',
            product: '',
            currency: 'USD'
        },
        compareMode: false,
        comparePeriod: 'previous',
        
        // Referencias
        container: null,
        firebaseDb: null,
        unsubscribe: [],
        isInitialized: false
    };

    // ============================================================
    // 3. ESTILOS CSS (Inyectados dinámicamente)
    // ============================================================
    const CSS_STYLES = `
        /* ============================================================
           REPORTES CONTA MODULE STYLES
           ============================================================ */
        
        :root {
            --report-primary: #0f3460;
            --report-primary-light: #1a4a7a;
            --report-secondary: #e94560;
            --report-success: #059669;
            --report-success-light: #d1fae5;
            --report-danger: #dc2626;
            --report-danger-light: #fee2e2;
            --report-warning: #d97706;
            --report-warning-light: #fef3c7;
            --report-gray-50: #f8fafc;
            --report-gray-100: #f1f5f9;
            --report-gray-200: #e2e8f0;
            --report-gray-300: #cbd5e1;
            --report-gray-400: #94a3b8;
            --report-gray-500: #64748b;
            --report-gray-600: #475569;
            --report-gray-700: #334155;
            --report-gray-800: #1e293b;
            --report-shadow: 0 1px 3px rgba(0,0,0,0.1);
            --report-shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1);
            --report-radius: 8px;
            --report-radius-lg: 12px;
        }

        .report-container {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            color: var(--report-gray-800);
            background: var(--report-gray-50);
            padding: 20px;
            border-radius: var(--report-radius-lg);
            max-width: 100%;
        }

        /* Header */
        .report-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 2px solid var(--report-gray-200);
        }
        .report-header-title {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 20px;
            font-weight: 700;
            color: var(--report-primary);
        }
        .report-header-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        /* Botones */
        .report-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            border: none;
            border-radius: var(--report-radius);
            font-weight: 600;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.3s;
        }
        .report-btn:hover { transform: translateY(-1px); box-shadow: var(--report-shadow); }
        .report-btn-primary { background: var(--report-primary); color: white; }
        .report-btn-primary:hover { background: var(--report-primary-light); }
        .report-btn-success { background: var(--report-success); color: white; }
        .report-btn-success:hover { background: #047857; }
        .report-btn-danger { background: var(--report-danger); color: white; }
        .report-btn-danger:hover { background: #b91c1c; }
        .report-btn-warning { background: var(--report-warning); color: white; }
        .report-btn-warning:hover { background: #b45309; }
        .report-btn-outline { background: transparent; color: var(--report-primary); border: 2px solid var(--report-primary); }
        .report-btn-outline:hover { background: var(--report-primary); color: white; }
        .report-btn-sm { padding: 4px 12px; font-size: 12px; }
        .report-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }

        /* Tabs */
        .report-tabs {
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
            margin-bottom: 16px;
            border-bottom: 2px solid var(--report-gray-200);
            padding-bottom: 4px;
        }
        .report-tab {
            padding: 8px 16px;
            border: none;
            background: transparent;
            font-weight: 600;
            font-size: 13px;
            color: var(--report-gray-500);
            cursor: pointer;
            border-bottom: 3px solid transparent;
            transition: all 0.3s;
            border-radius: 4px 4px 0 0;
        }
        .report-tab:hover {
            color: var(--report-primary);
            background: var(--report-gray-50);
        }
        .report-tab.active {
            color: var(--report-primary);
            border-bottom-color: var(--report-secondary);
            background: var(--report-gray-50);
        }

        /* Filtros */
        .report-filters {
            background: white;
            padding: 16px;
            border-radius: var(--report-radius);
            box-shadow: var(--report-shadow);
            margin-bottom: 16px;
        }
        .report-filters-toggle {
            cursor: pointer;
            user-select: none;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 600;
            color: var(--report-primary);
        }
        .report-filters-toggle:hover { color: var(--report-primary-light); }
        .report-filters-body {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 12px;
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid var(--report-gray-200);
        }
        .report-filters-body .filter-group {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .report-filters-body .filter-group label {
            font-size: 12px;
            font-weight: 600;
            color: var(--report-gray-600);
        }
        .report-filters-body .filter-group input,
        .report-filters-body .filter-group select {
            padding: 6px 10px;
            border: 1px solid var(--report-gray-300);
            border-radius: var(--report-radius);
            font-size: 13px;
        }
        .report-filters-body .filter-group input:focus,
        .report-filters-body .filter-group select:focus {
            outline: none;
            border-color: var(--report-primary);
            box-shadow: 0 0 0 3px rgba(15,52,96,0.1);
        }
        .report-filters-body .filter-actions {
            display: flex;
            gap: 8px;
            align-items: end;
            padding-bottom: 2px;
        }

        /* KPIs */
        .report-kpis {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 12px;
            margin-bottom: 16px;
        }
        .report-kpi {
            background: white;
            padding: 12px 16px;
            border-radius: var(--report-radius);
            box-shadow: var(--report-shadow);
            text-align: center;
            border-left: 4px solid var(--report-primary);
        }
        .report-kpi .value {
            font-size: 22px;
            font-weight: 700;
            color: var(--report-primary);
        }
        .report-kpi .label {
            font-size: 12px;
            color: var(--report-gray-500);
            margin-top: 2px;
        }
        .report-kpi .value.success { color: var(--report-success); }
        .report-kpi .value.danger { color: var(--report-danger); }
        .report-kpi .value.warning { color: var(--report-warning); }

        /* Tablas de reportes */
        .report-table-wrapper {
            overflow-x: auto;
            background: white;
            border-radius: var(--report-radius);
            box-shadow: var(--report-shadow);
            margin-bottom: 16px;
        }
        .report-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }
        .report-table th {
            background: var(--report-primary);
            color: white;
            padding: 8px 12px;
            text-align: left;
            font-weight: 600;
            position: sticky;
            top: 0;
            z-index: 10;
        }
        .report-table td {
            padding: 6px 12px;
            border-bottom: 1px solid var(--report-gray-200);
            vertical-align: middle;
        }
        .report-table tbody tr:hover { background: var(--report-gray-50); }
        .report-table .total-row { background: var(--report-gray-100); font-weight: 700; }
        .report-table .subtotal-row { background: var(--report-gray-50); font-weight: 600; }
        .report-table .text-right { text-align: right; }
        .report-table .text-center { text-align: center; }
        .report-table .positive { color: var(--report-success); }
        .report-table .negative { color: var(--report-danger); }
        .report-table .indent-1 { padding-left: 24px; }
        .report-table .indent-2 { padding-left: 40px; }
        .report-table .indent-3 { padding-left: 56px; }
        .report-table .empty-row td {
            text-align: center;
            color: var(--report-gray-400);
            padding: 40px 20px;
            font-style: italic;
        }

        /* Export buttons */
        .report-export {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            padding: 8px 0;
        }

        /* Ratios */
        .report-ratios {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 12px;
            margin-top: 16px;
        }
        .report-ratio {
            background: white;
            padding: 12px 16px;
            border-radius: var(--report-radius);
            box-shadow: var(--report-shadow);
            border-left: 4px solid var(--report-gray-400);
        }
        .report-ratio .name { font-size: 12px; color: var(--report-gray-500); }
        .report-ratio .value { font-size: 18px; font-weight: 700; color: var(--report-primary); }
        .report-ratio .interpretation { font-size: 11px; margin-top: 4px; }
        .report-ratio .interpretation.healthy { color: var(--report-success); }
        .report-ratio .interpretation.warning { color: var(--report-warning); }
        .report-ratio .interpretation.danger { color: var(--report-danger); }

        /* Comparativo */
        .report-comparative {
            display: flex;
            gap: 8px;
            align-items: center;
            flex-wrap: wrap;
        }
        .report-comparative .vs {
            font-weight: 700;
            color: var(--report-gray-400);
            padding: 0 8px;
        }
        .report-variation {
            font-weight: 600;
            font-size: 12px;
        }
        .report-variation.positive { color: var(--report-success); }
        .report-variation.negative { color: var(--report-danger); }

        /* Toast */
        .report-toast-container {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999999;
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-width: 400px;
        }
        .report-toast {
            padding: 12px 20px;
            border-radius: var(--report-radius);
            color: white;
            font-weight: 500;
            font-size: 14px;
            box-shadow: var(--report-shadow-lg);
            animation: report-toast-in 0.3s ease;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .report-toast.success { background: var(--report-success); }
        .report-toast.error { background: var(--report-danger); }
        .report-toast.warning { background: var(--report-warning); }
        .report-toast.info { background: var(--report-primary); }
        .report-toast .close-toast {
            background: none;
            border: none;
            color: rgba(255,255,255,0.7);
            font-size: 18px;
            cursor: pointer;
            padding: 0 4px;
            margin-left: 12px;
        }
        .report-toast .close-toast:hover { color: white; }
        @keyframes report-toast-in {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        /* Sync status */
        .report-sync-status {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: var(--report-gray-500);
            padding: 4px 12px;
            background: white;
            border-radius: 20px;
            box-shadow: var(--report-shadow);
        }
        .report-sync-status .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            display: inline-block;
        }
        .report-sync-status .dot.online { background: var(--report-success); }
        .report-sync-status .dot.offline { background: var(--report-danger); }
        .report-sync-status .dot.syncing { 
            background: var(--report-warning);
            animation: report-pulse 0.8s ease-in-out infinite;
        }
        @keyframes report-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        /* Responsive */
        @media (max-width: 768px) {
            .report-container { padding: 12px; }
            .report-header { flex-direction: column; align-items: stretch; }
            .report-header-actions { justify-content: stretch; }
            .report-header-actions .report-btn { flex: 1; justify-content: center; }
            .report-filters-body { grid-template-columns: 1fr; }
            .report-kpis { grid-template-columns: repeat(2, 1fr); }
            .report-ratios { grid-template-columns: 1fr 1fr; }
            .report-tabs { overflow-x: auto; flex-wrap: nowrap; }
            .report-tab { padding: 6px 12px; font-size: 12px; white-space: nowrap; }
            .report-table th,
            .report-table td { padding: 4px 8px; font-size: 12px; }
        }
        @media (max-width: 480px) {
            .report-kpis { grid-template-columns: 1fr 1fr; }
            .report-ratios { grid-template-columns: 1fr; }
            .report-kpi .value { font-size: 18px; }
        }

        /* Print styles */
        @media print {
            .report-filters,
            .report-header-actions,
            .report-export,
            .report-sync-status { display: none !important; }
            .report-container { padding: 0; background: white; }
            .report-table th { background: #333 !important; color: white !important; }
            .report-table-wrapper { box-shadow: none !important; border: 1px solid #ddd; }
            .report-kpi { box-shadow: none !important; border: 1px solid #ddd; }
        }
    `;

    // ============================================================
    // 4. INYECCIÓN DE ESTILOS
    // ============================================================
    function injectStyles() {
        const styleId = 'reportes-conta-styles';
        if (document.getElementById(styleId)) return;
        const styleEl = document.createElement('style');
        styleEl.id = styleId;
        styleEl.textContent = CSS_STYLES;
        document.head.appendChild(styleEl);
    }

    // ============================================================
    // 5. UTILITY FUNCTIONS
    // ============================================================
    function formatCurrency(value, currency = 'USD') {
        return '$' + (value || 0).toFixed(2);
    }

    function formatDate(timestamp) {
        if (!timestamp) return 'N/A';
        const d = new Date(timestamp);
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function formatPercent(value) {
        return (value || 0).toFixed(1) + '%';
    }

    function generateId() {
        return Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
    }

    function getDatePresetRange(preset) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const end = today.getTime();
        let start;

        switch(preset) {
            case 'today':
                start = today.getTime();
                break;
            case 'week':
                start = new Date(today.getTime() - 7 * 86400000).getTime();
                break;
            case 'month':
                start = new Date(today.getTime() - 30 * 86400000).getTime();
                break;
            case 'lastMonth':
                start = new Date(today.getTime() - 60 * 86400000).getTime();
                break;
            case 'quarter':
                start = new Date(today.getTime() - 90 * 86400000).getTime();
                break;
            case 'year':
                start = new Date(today.getTime() - 365 * 86400000).getTime();
                break;
            case 'lastYear':
                start = new Date(today.getTime() - 730 * 86400000).getTime();
                break;
            default:
                start = new Date(today.getTime() - 30 * 86400000).getTime();
        }
        return { start, end };
    }

    function debounce(fn, delay) {
        let timer = null;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    // ============================================================
    // 6. FIRESTEADB / PERSISTENCIA
    // ============================================================
    function getFirebaseDb() {
        if (state.firebaseDb) return state.firebaseDb;
        try {
            if (typeof firebase !== 'undefined' && firebase.database) {
                state.firebaseDb = firebase.database();
                return state.firebaseDb;
            }
        } catch (e) {
            console.warn('Firebase no disponible:', e);
        }
        return null;
    }

    function loadFromCache() {
        try {
            const data = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                state.entries = parsed.entries || [];
                state.accounts = parsed.accounts || {};
                state.products = parsed.products || [];
                state.sales = parsed.sales || [];
                state.movements = parsed.movements || [];
                state.settings = parsed.settings || {};
                return true;
            }
        } catch (e) {
            console.warn('Error cargando caché:', e);
        }
        return false;
    }

    function saveToCache() {
        try {
            const data = {
                entries: state.entries,
                accounts: state.accounts,
                products: state.products,
                sales: state.sales,
                movements: state.movements,
                settings: state.settings,
                timestamp: Date.now()
            };
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (e) {
            console.warn('Error guardando caché:', e);
            return false;
        }
    }

    function setupFirebaseListeners() {
        const db = getFirebaseDb();
        if (!db) return;

        const paths = [
            { ref: 'accounting/entries', key: 'entries' },
            { ref: 'accounting/accounts', key: 'accounts' },
            { ref: 'products', key: 'products' },
            { ref: 'sales', key: 'sales' },
            { ref: 'movements', key: 'movements' },
            { ref: 'settings', key: 'settings' }
        ];

        paths.forEach(({ ref, key }) => {
            const unsubscribe = db.ref(ref).on('value', function(snapshot) {
                const data = snapshot.val();
                if (data) {
                    if (key === 'accounts') {
                        state.accounts = data;
                    } else if (key === 'entries') {
                        state.entries = Object.keys(data).map(k => ({ id: k, ...data[k] }));
                    } else if (key === 'products') {
                        state.products = Object.keys(data).map(k => ({ id: k, ...data[k] }));
                    } else if (key === 'sales') {
                        state.sales = Object.keys(data).map(k => ({ id: k, ...data[k] }));
                    } else if (key === 'movements') {
                        state.movements = Object.keys(data).map(k => ({ id: k, ...data[k] }));
                    } else if (key === 'settings') {
                        state.settings = data;
                    }
                }
                saveToCache();
                if (state.container && state.isInitialized) {
                    generateReport(state.currentReport);
                }
            }, function(error) {
                console.error(`Error en ${ref}:`, error);
                showToast(`Error sincronizando ${ref}`, 'error');
            });
            state.unsubscribe.push(unsubscribe);
        });

        console.log('✅ Firebase listeners configurados para reportes');
    }

    // ============================================================
    // 7. SINCORNIZACIÓN CON MÓDULOS EXTERNOS
    // ============================================================
    function syncWithModules() {
        try {
            // Contabilidad
            if (typeof window.ContabilidadModule !== 'undefined') {
                const entries = window.ContabilidadModule.getEntries ? window.ContabilidadModule.getEntries() : [];
                const accounts = window.ContabilidadModule.getAccounts ? window.ContabilidadModule.getAccounts() : {};
                if (entries.length > 0) state.entries = entries;
                if (Object.keys(accounts).length > 0) state.accounts = accounts;
            }

            // Kardex
            if (typeof window.KardexModule !== 'undefined') {
                const movements = window.KardexModule.getMovements ? window.KardexModule.getMovements() : [];
                const products = window.KardexModule.getProducts ? window.KardexModule.getProducts() : [];
                if (movements.length > 0) state.movements = movements;
                if (products.length > 0) state.products = products;
            }

            // Ventas
            if (typeof window.VentasModule !== 'undefined') {
                const sales = window.VentasModule.getSales ? window.VentasModule.getSales() : [];
                if (sales.length > 0) state.sales = sales;
            }

            saveToCache();
        } catch (e) {
            console.warn('Error sincronizando con módulos:', e);
        }
    }

    // ============================================================
    // 8. CÁLCULO DE SALDOS Y TOTALES
    // ============================================================
    function calculateAccountBalances(entries, dateFrom, dateTo) {
        const balances = {};
        const filtered = entries.filter(e => {
            const date = e.date || e.createdAt || 0;
            return date >= dateFrom && date <= dateTo;
        });

        filtered.forEach(entry => {
            entry.lines.forEach(line => {
                if (!balances[line.accountCode]) balances[line.accountCode] = 0;
                if (line.side === 'DEBE') {
                    balances[line.accountCode] += line.amount;
                } else {
                    balances[line.accountCode] -= line.amount;
                }
            });
        });

        return balances;
    }

    function getAccountName(code) {
        return state.accounts[code]?.name || code;
    }

    function getAccountType(code) {
        return state.accounts[code]?.type || '';
    }

    function getAccountCategory(code) {
        return state.accounts[code]?.category || '';
    }

    function calculateTotalsByType(balances, type) {
        let total = 0;
        Object.keys(balances).forEach(code => {
            if (getAccountType(code) === type) {
                total += balances[code];
            }
        });
        return total;
    }

    // ============================================================
    // 9. REPORTE: ESTADO DE RESULTADOS (NIIF)
    // ============================================================
    function generateIncomeStatement(filters) {
        const { dateFrom, dateTo, compareFrom, compareTo, accounts: filterAccounts } = filters;
        const balances = calculateAccountBalances(state.entries, dateFrom, dateTo);

        let html = `
            <div class="report-table-wrapper">
                <table class="report-table">
                    <thead>
                        <tr>
                            <th style="width:60%;">Cuenta</th>
                            <th style="text-align:right;width:20%;">Monto</th>
                            <th style="text-align:right;width:20%;">% Participación</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // Ingresos
        let totalIngresos = 0;
        const ingresos = Object.keys(balances).filter(c => getAccountType(c) === 'INGRESO');
        html += `<tr class="subtotal-row"><td colspan="3"><strong>INGRESOS OPERACIONALES</strong></td></tr>`;
        ingresos.forEach(code => {
            const balance = balances[code] || 0;
            if (balance !== 0 || true) {
                totalIngresos += balance;
                html += `<tr>
                    <td class="indent-1">${getAccountName(code)}</td>
                    <td class="text-right">${formatCurrency(balance)}</td>
                    <td class="text-right">-</td>
                </tr>`;
            }
        });
        html += `<tr class="total-row">
            <td>TOTAL INGRESOS</td>
            <td class="text-right">${formatCurrency(totalIngresos)}</td>
            <td class="text-right">100.0%</td>
        </tr>`;

        // Costos
        let totalCostos = 0;
        const costos = Object.keys(balances).filter(c => getAccountType(c) === 'COSTO');
        html += `<tr class="subtotal-row"><td colspan="3"><strong>COSTOS DE VENTAS</strong></td></tr>`;
        costos.forEach(code => {
            const balance = balances[code] || 0;
            if (balance !== 0 || true) {
                totalCostos += balance;
                html += `<tr>
                    <td class="indent-1">${getAccountName(code)}</td>
                    <td class="text-right">${formatCurrency(balance)}</td>
                    <td class="text-right">-</td>
                </tr>`;
            }
        });
        html += `<tr class="total-row">
            <td>TOTAL COSTOS</td>
            <td class="text-right">${formatCurrency(totalCostos)}</td>
            <td class="text-right">${totalIngresos > 0 ? formatPercent((totalCostos / totalIngresos) * 100) : '0%'}</td>
        </tr>`;

        // Utilidad Bruta
        const utilidadBruta = totalIngresos - totalCostos;
        html += `<tr style="background:var(--report-success-light);font-weight:700;">
            <td>UTILIDAD BRUTA</td>
            <td class="text-right ${utilidadBruta >= 0 ? 'positive' : 'negative'}">${formatCurrency(utilidadBruta)}</td>
            <td class="text-right">${totalIngresos > 0 ? formatPercent((utilidadBruta / totalIngresos) * 100) : '0%'}</td>
        </tr>`;

        // Gastos
        let totalGastos = 0;
        const gastos = Object.keys(balances).filter(c => getAccountType(c) === 'GASTO');
        html += `<tr class="subtotal-row"><td colspan="3"><strong>GASTOS OPERACIONALES</strong></td></tr>`;
        gastos.forEach(code => {
            const balance = balances[code] || 0;
            if (balance !== 0 || true) {
                totalGastos += balance;
                html += `<tr>
                    <td class="indent-1">${getAccountName(code)}</td>
                    <td class="text-right">${formatCurrency(balance)}</td>
                    <td class="text-right">-</td>
                </tr>`;
            }
        });
        html += `<tr class="total-row">
            <td>TOTAL GASTOS</td>
            <td class="text-right">${formatCurrency(totalGastos)}</td>
            <td class="text-right">${totalIngresos > 0 ? formatPercent((totalGastos / totalIngresos) * 100) : '0%'}</td>
        </tr>`;

        // Utilidad Neta
        const utilidadNeta = utilidadBruta - totalGastos;
        html += `<tr style="background:${utilidadNeta >= 0 ? 'var(--report-success-light)' : 'var(--report-danger-light)'};font-weight:700;font-size:16px;">
            <td>${utilidadNeta >= 0 ? 'UTILIDAD NETA DEL EJERCICIO' : 'PÉRDIDA NETA DEL EJERCICIO'}</td>
            <td class="text-right ${utilidadNeta >= 0 ? 'positive' : 'negative'}" style="font-size:18px;">${formatCurrency(utilidadNeta)}</td>
            <td class="text-right">${totalIngresos > 0 ? formatPercent((utilidadNeta / totalIngresos) * 100) : '0%'}</td>
        </tr>`;

        html += `</tbody></table></div>`;

        // KPIs
        const kpis = `
            <div class="report-kpis">
                <div class="report-kpi"><div class="value">${formatCurrency(totalIngresos)}</div><div class="label">Ingresos Totales</div></div>
                <div class="report-kpi"><div class="value ${utilidadBruta >= 0 ? 'success' : 'danger'}">${formatCurrency(utilidadBruta)}</div><div class="label">Utilidad Bruta</div></div>
                <div class="report-kpi"><div class="value ${utilidadNeta >= 0 ? 'success' : 'danger'}">${formatCurrency(utilidadNeta)}</div><div class="label">Utilidad Neta</div></div>
                <div class="report-kpi"><div class="value">${totalIngresos > 0 ? formatPercent((utilidadNeta / totalIngresos) * 100) : '0%'}</div><div class="label">Margen Neto</div></div>
            </div>
        `;

        return kpis + html;
    }

    // ============================================================
    // 10. REPORTE: BALANCE GENERAL (NIIF)
    // ============================================================
    function generateBalanceSheet(filters) {
        const { dateFrom, dateTo } = filters;
        const balances = calculateAccountBalances(state.entries, dateFrom, dateTo);

        let totalActivo = 0, totalActivoCorriente = 0, totalActivoNoCorriente = 0;
        let totalPasivo = 0, totalPasivoCorriente = 0, totalPasivoNoCorriente = 0;
        let totalPatrimonio = 0;

        let html = `
            <div class="report-table-wrapper">
                <table class="report-table">
                    <thead>
                        <tr><th style="width:60%;">Cuenta</th><th style="text-align:right;width:40%;">Monto</th></tr>
                    </thead>
                    <tbody>
        `;

        // ACTIVO CORRIENTE
        html += `<tr class="subtotal-row"><td colspan="2"><strong>ACTIVO CORRIENTE</strong></td></tr>`;
        const activoCorriente = Object.keys(balances).filter(c => 
            getAccountType(c) === 'ACTIVO' && getAccountCategory(c) === 'ACTIVO_CORRIENTE'
        );
        activoCorriente.forEach(code => {
            const balance = balances[code] || 0;
            if (balance !== 0) {
                totalActivoCorriente += balance;
                html += `<tr><td class="indent-1">${getAccountName(code)}</td><td class="text-right">${formatCurrency(balance)}</td></tr>`;
            }
        });
        html += `<tr class="total-row"><td>TOTAL ACTIVO CORRIENTE</td><td class="text-right">${formatCurrency(totalActivoCorriente)}</td></tr>`;

        // ACTIVO NO CORRIENTE
        html += `<tr class="subtotal-row"><td colspan="2"><strong>ACTIVO NO CORRIENTE</strong></td></tr>`;
        const activoNoCorriente = Object.keys(balances).filter(c => 
            getAccountType(c) === 'ACTIVO' && getAccountCategory(c) === 'ACTIVO_NO_CORRIENTE'
        );
        activoNoCorriente.forEach(code => {
            const balance = balances[code] || 0;
            if (balance !== 0) {
                totalActivoNoCorriente += balance;
                html += `<tr><td class="indent-1">${getAccountName(code)}</td><td class="text-right">${formatCurrency(balance)}</td></tr>`;
            }
        });
        html += `<tr class="total-row"><td>TOTAL ACTIVO NO CORRIENTE</td><td class="text-right">${formatCurrency(totalActivoNoCorriente)}</td></tr>`;

        totalActivo = totalActivoCorriente + totalActivoNoCorriente;
        html += `<tr style="background:var(--report-primary);color:white;font-weight:700;font-size:16px;">
            <td>TOTAL ACTIVO</td>
            <td class="text-right">${formatCurrency(totalActivo)}</td>
        </tr>`;

        // PASIVO CORRIENTE
        html += `<tr class="subtotal-row"><td colspan="2"><strong>PASIVO CORRIENTE</strong></td></tr>`;
        const pasivoCorriente = Object.keys(balances).filter(c => 
            getAccountType(c) === 'PASIVO' && getAccountCategory(c) === 'PASIVO_CORRIENTE'
        );
        pasivoCorriente.forEach(code => {
            const balance = balances[code] || 0;
            if (balance !== 0) {
                totalPasivoCorriente += balance;
                html += `<tr><td class="indent-1">${getAccountName(code)}</td><td class="text-right">${formatCurrency(balance)}</td></tr>`;
            }
        });
        html += `<tr class="total-row"><td>TOTAL PASIVO CORRIENTE</td><td class="text-right">${formatCurrency(totalPasivoCorriente)}</td></tr>`;

        // PASIVO NO CORRIENTE
        html += `<tr class="subtotal-row"><td colspan="2"><strong>PASIVO NO CORRIENTE</strong></td></tr>`;
        const pasivoNoCorriente = Object.keys(balances).filter(c => 
            getAccountType(c) === 'PASIVO' && getAccountCategory(c) === 'PASIVO_NO_CORRIENTE'
        );
        pasivoNoCorriente.forEach(code => {
            const balance = balances[code] || 0;
            if (balance !== 0) {
                totalPasivoNoCorriente += balance;
                html += `<tr><td class="indent-1">${getAccountName(code)}</td><td class="text-right">${formatCurrency(balance)}</td></tr>`;
            }
        });
        html += `<tr class="total-row"><td>TOTAL PASIVO NO CORRIENTE</td><td class="text-right">${formatCurrency(totalPasivoNoCorriente)}</td></tr>`;

        totalPasivo = totalPasivoCorriente + totalPasivoNoCorriente;
        html += `<tr style="background:var(--report-danger-light);font-weight:700;font-size:16px;">
            <td>TOTAL PASIVO</td>
            <td class="text-right">${formatCurrency(totalPasivo)}</td>
        </tr>`;

        // PATRIMONIO
        html += `<tr class="subtotal-row"><td colspan="2"><strong>PATRIMONIO</strong></td></tr>`;
        const patrimonio = Object.keys(balances).filter(c => getAccountType(c) === 'PATRIMONIO');
        patrimonio.forEach(code => {
            const balance = balances[code] || 0;
            if (balance !== 0) {
                totalPatrimonio += balance;
                html += `<tr><td class="indent-1">${getAccountName(code)}</td><td class="text-right">${formatCurrency(balance)}</td></tr>`;
            }
        });
        html += `<tr class="total-row"><td>TOTAL PATRIMONIO</td><td class="text-right">${formatCurrency(totalPatrimonio)}</td></tr>`;

        html += `<tr style="background:var(--report-success-light);font-weight:700;font-size:16px;">
            <td>TOTAL PASIVO + PATRIMONIO</td>
            <td class="text-right">${formatCurrency(totalPasivo + totalPatrimonio)}</td>
        </tr>`;

        html += `</tbody></table></div>`;

        // Verificación de la ecuación contable
        const diff = Math.abs(totalActivo - (totalPasivo + totalPatrimonio));
        const verification = diff <= 0.01 ? 
            '✅ ECUACIÓN CONTABLE VERIFICADA' : 
            `⚠️ DIFERENCIA: $${diff.toFixed(2)}`;

        const kpis = `
            <div class="report-kpis">
                <div class="report-kpi"><div class="value">${formatCurrency(totalActivo)}</div><div class="label">Total Activo</div></div>
                <div class="report-kpi"><div class="value">${formatCurrency(totalPasivo)}</div><div class="label">Total Pasivo</div></div>
                <div class="report-kpi"><div class="value">${formatCurrency(totalPatrimonio)}</div><div class="label">Total Patrimonio</div></div>
                <div class="report-kpi"><div class="value" style="font-size:14px;color:${diff <= 0.01 ? 'var(--report-success)' : 'var(--report-danger)'};">${verification}</div><div class="label">Verificación</div></div>
            </div>
        `;

        return kpis + html;
    }

    // ============================================================
    // 11. REPORTE: FLUJO DE EFECTIVO
    // ============================================================
    function generateCashFlow(filters) {
        const { dateFrom, dateTo } = filters;
        const entries = state.entries.filter(e => {
            const date = e.date || e.createdAt || 0;
            return date >= dateFrom && date <= dateTo;
        });

        const cashAccounts = ['1-01-001', '1-01-002', '1-01-003'];
        let actividadesOperativas = 0;
        let actividadesInversion = 0;
        let actividadesFinanciamiento = 0;

        entries.forEach(entry => {
            entry.lines.forEach(line => {
                if (cashAccounts.includes(line.accountCode)) {
                    const amount = line.side === 'DEBE' ? line.amount : -line.amount;
                    // Clasificación por tipo de cuenta (simplificada)
                    const otherLines = entry.lines.filter(l => l.accountCode !== line.accountCode);
                    if (otherLines.some(l => getAccountType(l.accountCode) === 'INGRESO' || getAccountType(l.accountCode) === 'GASTO')) {
                        actividadesOperativas += amount;
                    } else if (otherLines.some(l => getAccountType(l.accountCode) === 'ACTIVO' && 
                        getAccountCategory(l.accountCode) === 'ACTIVO_NO_CORRIENTE')) {
                        actividadesInversion += amount;
                    } else {
                        actividadesFinanciamiento += amount;
                    }
                }
            });
        });

        const flujoNeto = actividadesOperativas + actividadesInversion + actividadesFinanciamiento;

        let html = `
            <div class="report-table-wrapper">
                <table class="report-table">
                    <thead><tr><th>Actividad</th><th style="text-align:right;">Monto</th></tr></thead>
                    <tbody>
                        <tr><td><strong>Actividades Operativas</strong></td><td class="text-right ${actividadesOperativas >= 0 ? 'positive' : 'negative'}">${formatCurrency(actividadesOperativas)}</td></tr>
                        <tr><td><strong>Actividades de Inversión</strong></td><td class="text-right ${actividadesInversion >= 0 ? 'positive' : 'negative'}">${formatCurrency(actividadesInversion)}</td></tr>
                        <tr><td><strong>Actividades de Financiamiento</strong></td><td class="text-right ${actividadesFinanciamiento >= 0 ? 'positive' : 'negative'}">${formatCurrency(actividadesFinanciamiento)}</td></tr>
                        <tr class="total-row" style="font-size:16px;">
                            <td><strong>FLUJO NETO DE EFECTIVO</strong></td>
                            <td class="text-right ${flujoNeto >= 0 ? 'positive' : 'negative'}" style="font-size:18px;">${formatCurrency(flujoNeto)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;

        return html;
    }

    // ============================================================
    // 12. REPORTE: ESTADO DE CAMBIOS EN EL PATRIMONIO NETO
    // ============================================================
    function generateEquityChanges(filters) {
        const { dateFrom, dateTo } = filters;
        const balances = calculateAccountBalances(state.entries, dateFrom, dateTo);

        let html = `
            <div class="report-table-wrapper">
                <table class="report-table">
                    <thead>
                        <tr><th>Concepto</th><th style="text-align:right;">Monto</th></tr>
                    </thead>
                    <tbody>
        `;

        const patrimonio = Object.keys(balances).filter(c => getAccountType(c) === 'PATRIMONIO');
        let totalPatrimonio = 0;

        patrimonio.forEach(code => {
            const balance = balances[code] || 0;
            if (balance !== 0) {
                totalPatrimonio += balance;
                html += `<tr><td>${getAccountName(code)}</td><td class="text-right">${formatCurrency(balance)}</td></tr>`;
            }
        });

        html += `
                    <tr class="total-row" style="font-size:16px;">
                        <td><strong>TOTAL PATRIMONIO NETO</strong></td>
                        <td class="text-right" style="font-size:18px;">${formatCurrency(totalPatrimonio)}</td>
                    </tr>
                </tbody>
            </table></div>
        `;

        return html;
    }

    // ============================================================
    // 13. REPORTE: KARDEX
    // ============================================================
    function generateKardexReport(filters) {
        const { dateFrom, dateTo, product: filterProduct } = filters;
        let movements = state.movements.filter(m => {
            const date = m.date || m.createdAt || 0;
            return date >= dateFrom && date <= dateTo;
        });

        if (filterProduct) {
            movements = movements.filter(m => m.productId === filterProduct);
        }

        const products = {};
        movements.forEach(m => {
            if (!products[m.productId]) {
                const product = state.products.find(p => p.id === m.productId);
                products[m.productId] = {
                    name: product?.name || m.productName || 'Producto',
                    code: product?.code || '',
                    entries: [],
                    stockInicial: 0,
                    entradas: 0,
                    salidas: 0,
                    stockFinal: 0,
                    valorizacion: 0
                };
            }
            products[m.productId].entries.push(m);
        });

        let html = `
            <div class="report-table-wrapper">
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Código</th>
                            <th style="text-align:right;">Stock Inicial</th>
                            <th style="text-align:right;">Entradas</th>
                            <th style="text-align:right;">Salidas</th>
                            <th style="text-align:right;">Stock Final</th>
                            <th style="text-align:right;">Valorización</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        let totalEntradas = 0, totalSalidas = 0, totalValorizacion = 0;

        Object.keys(products).forEach(pid => {
            const p = products[pid];
            let entradas = 0, salidas = 0;
            p.entries.forEach(m => {
                if (m.type === 'ENTRADA') entradas += m.quantity || 0;
                else if (m.type === 'SALIDA') salidas += m.quantity || 0;
            });
            const stockFinal = p.stockInicial + entradas - salidas;
            const valorizacion = stockFinal * (p.entries[0]?.cost || 0);

            totalEntradas += entradas;
            totalSalidas += salidas;
            totalValorizacion += valorizacion;

            html += `
                <tr>
                    <td><strong>${p.name}</strong></td>
                    <td>${p.code || 'N/A'}</td>
                    <td class="text-right">${p.stockInicial}</td>
                    <td class="text-right">${entradas}</td>
                    <td class="text-right">${salidas}</td>
                    <td class="text-right"><strong>${stockFinal}</strong></td>
                    <td class="text-right">${formatCurrency(valorizacion)}</td>
                </tr>
            `;
        });

        html += `
                    <tr class="total-row">
                        <td colspan="2"><strong>TOTALES</strong></td>
                        <td class="text-right">-</td>
                        <td class="text-right">${totalEntradas}</td>
                        <td class="text-right">${totalSalidas}</td>
                        <td class="text-right">-</td>
                        <td class="text-right">${formatCurrency(totalValorizacion)}</td>
                    </tr>
                </tbody>
            </table></div>
        `;

        return html;
    }

    // ============================================================
    // 14. REPORTE: RESUMEN DE VENTAS
    // ============================================================
    function generateSalesSummary(filters) {
        const { dateFrom, dateTo } = filters;
        let sales = state.sales.filter(s => {
            const date = s.date || s.createdAt || 0;
            return date >= dateFrom && date <= dateTo;
        });

        const totalVentas = sales.length;
        const totalIngresos = sales.reduce((sum, s) => sum + (s.total || 0), 0);
        const onlineSales = sales.filter(s => s.type === 'ONLINE');
        const fisicoSales = sales.filter(s => s.type === 'FISICO');
        const avgOrder = totalVentas > 0 ? totalIngresos / totalVentas : 0;

        // Ventas por método de pago
        const byPayment = {};
        sales.forEach(s => {
            const method = s.paymentMethod || 'desconocido';
            if (!byPayment[method]) byPayment[method] = { count: 0, total: 0 };
            byPayment[method].count++;
            byPayment[method].total += s.total || 0;
        });

        let html = `
            <div class="report-kpis">
                <div class="report-kpi"><div class="value">${totalVentas}</div><div class="label">Total Ventas</div></div>
                <div class="report-kpi"><div class="value success">${formatCurrency(totalIngresos)}</div><div class="label">Ingresos Totales</div></div>
                <div class="report-kpi"><div class="value">${onlineSales.length}</div><div class="label">🖥️ Online</div></div>
                <div class="report-kpi"><div class="value">${fisicoSales.length}</div><div class="label">🏪 Físico</div></div>
                <div class="report-kpi"><div class="value">${formatCurrency(avgOrder)}</div><div class="label">Ticket Promedio</div></div>
            </div>

            <div class="report-table-wrapper">
                <table class="report-table">
                    <thead>
                        <tr><th>Método de Pago</th><th style="text-align:right;">Cantidad</th><th style="text-align:right;">Total</th><th style="text-align:right;">% Participación</th></tr>
                    </thead>
                    <tbody>
        `;

        Object.keys(byPayment).forEach(method => {
            const data = byPayment[method];
            const pct = totalIngresos > 0 ? (data.total / totalIngresos) * 100 : 0;
            html += `
                <tr>
                    <td>${method.charAt(0).toUpperCase() + method.slice(1)}</td>
                    <td class="text-right">${data.count}</td>
                    <td class="text-right">${formatCurrency(data.total)}</td>
                    <td class="text-right">${formatPercent(pct)}</td>
                </tr>
            `;
        });

        html += `
                    <tr class="total-row">
                        <td><strong>TOTALES</strong></td>
                        <td class="text-right">${totalVentas}</td>
                        <td class="text-right">${formatCurrency(totalIngresos)}</td>
                        <td class="text-right">100.0%</td>
                    </tr>
                </tbody>
            </table></div>
        `;

        // Ventas por cliente
        const byCustomer = {};
        sales.forEach(s => {
            const name = s.customer?.name || 'Cliente';
            if (!byCustomer[name]) byCustomer[name] = { count: 0, total: 0 };
            byCustomer[name].count++;
            byCustomer[name].total += s.total || 0;
        });

        const sortedCustomers = Object.keys(byCustomer).sort((a, b) => byCustomer[b].total - byCustomer[a].total);

        if (sortedCustomers.length > 0) {
            html += `
                <div class="report-table-wrapper" style="margin-top:16px;">
                    <table class="report-table">
                        <thead>
                            <tr><th>Cliente</th><th style="text-align:right;">Ventas</th><th style="text-align:right;">Total</th></tr>
                        </thead>
                        <tbody>
            `;
            sortedCustomers.slice(0, 10).forEach(name => {
                const data = byCustomer[name];
                html += `
                    <tr>
                        <td>${name}</td>
                        <td class="text-right">${data.count}</td>
                        <td class="text-right">${formatCurrency(data.total)}</td>
                    </tr>
                `;
            });
            html += `</tbody></table></div>`;
        }

        return html;
    }

    // ============================================================
    // 15. REPORTE: ANTIGÜEDAD DE CUENTAS POR COBRAR/PAGAR
    // ============================================================
    function generateAgingReport(filters) {
        const { dateFrom, dateTo } = filters;
        const now = Date.now();
        const ranges = [
            { label: '1-30 días', max: 30 },
            { label: '31-60 días', max: 60 },
            { label: '61-90 días', max: 90 },
            { label: '>90 días', max: Infinity }
        ];

        const aging = { cobrar: {}, pagar: {} };
        ranges.forEach(r => {
            aging.cobrar[r.label] = 0;
            aging.pagar[r.label] = 0;
        });

        state.entries.forEach(entry => {
            const date = entry.date || entry.createdAt || 0;
            if (date < dateFrom || date > dateTo) return;

            entry.lines.forEach(line => {
                const age = (now - date) / (86400000);
                let rangeLabel = '>90 días';
                for (const r of ranges) {
                    if (age <= r.max) {
                        rangeLabel = r.label;
                        break;
                    }
                }

                if (line.accountCode === '1-02-001' || line.accountCode === '1-02-002') {
                    const amount = line.side === 'DEBE' ? line.amount : -line.amount;
                    if (amount > 0) aging.cobrar[rangeLabel] += amount;
                }
                if (line.accountCode === '2-01-001' || line.accountCode === '2-01-002') {
                    const amount = line.side === 'HABER' ? line.amount : -line.amount;
                    if (amount > 0) aging.pagar[rangeLabel] += amount;
                }
            });
        });

        let html = `
            <div class="report-table-wrapper">
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Rango</th>
                            <th style="text-align:right;">Cuentas por Cobrar</th>
                            <th style="text-align:right;">%</th>
                            <th style="text-align:right;">Cuentas por Pagar</th>
                            <th style="text-align:right;">%</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        let totalCobrar = Object.values(aging.cobrar).reduce((s, v) => s + v, 0);
        let totalPagar = Object.values(aging.pagar).reduce((s, v) => s + v, 0);

        ranges.forEach(r => {
            const cobrar = aging.cobrar[r.label] || 0;
            const pagar = aging.pagar[r.label] || 0;
            html += `
                <tr>
                    <td><strong>${r.label}</strong></td>
                    <td class="text-right">${formatCurrency(cobrar)}</td>
                    <td class="text-right">${totalCobrar > 0 ? formatPercent((cobrar / totalCobrar) * 100) : '0%'}</td>
                    <td class="text-right">${formatCurrency(pagar)}</td>
                    <td class="text-right">${totalPagar > 0 ? formatPercent((pagar / totalPagar) * 100) : '0%'}</td>
                </tr>
            `;
        });

        html += `
                    <tr class="total-row">
                        <td><strong>TOTALES</strong></td>
                        <td class="text-right">${formatCurrency(totalCobrar)}</td>
                        <td class="text-right">100.0%</td>
                        <td class="text-right">${formatCurrency(totalPagar)}</td>
                        <td class="text-right">100.0%</td>
                    </tr>
                </tbody>
            </table></div>
        `;

        return html;
    }

    // ============================================================
    // 16. RATIOS FINANCIEROS
    // ============================================================
    function generateRatios(filters) {
        const { dateFrom, dateTo } = filters;
        const balances = calculateAccountBalances(state.entries, dateFrom, dateTo);

        // Obtener saldos
        const activoCorriente = Object.keys(balances)
            .filter(c => getAccountType(c) === 'ACTIVO' && getAccountCategory(c) === 'ACTIVO_CORRIENTE')
            .reduce((s, c) => s + balances[c], 0);
        const activoTotal = Object.keys(balances)
            .filter(c => getAccountType(c) === 'ACTIVO')
            .reduce((s, c) => s + balances[c], 0);
        const pasivoCorriente = Object.keys(balances)
            .filter(c => getAccountType(c) === 'PASIVO' && getAccountCategory(c) === 'PASIVO_CORRIENTE')
            .reduce((s, c) => s + balances[c], 0);
        const pasivoTotal = Object.keys(balances)
            .filter(c => getAccountType(c) === 'PASIVO')
            .reduce((s, c) => s + balances[c], 0);
        const patrimonio = Object.keys(balances)
            .filter(c => getAccountType(c) === 'PATRIMONIO')
            .reduce((s, c) => s + balances[c], 0);

        // Ingresos y utilidades
        const ingresos = Object.keys(balances)
            .filter(c => getAccountType(c) === 'INGRESO')
            .reduce((s, c) => s + balances[c], 0);
        const gastos = Object.keys(balances)
            .filter(c => getAccountType(c) === 'GASTO')
            .reduce((s, c) => s + balances[c], 0);
        const utilidadNeta = ingresos - gastos;

        // Calcular ratios
        const ratios = {
            liquidity: {
                value: pasivoCorriente > 0 ? activoCorriente / pasivoCorriente : 0,
                label: 'Liquidez Corriente',
                threshold: CONFIG.RATIO_THRESHOLDS.liquidity
            },
            acidTest: {
                value: pasivoCorriente > 0 ? (activoCorriente - (balances['1-03-001'] || 0)) / pasivoCorriente : 0,
                label: 'Prueba Ácida'
            },
            debtEquity: {
                value: patrimonio > 0 ? pasivoTotal / patrimonio : 0,
                label: 'Endeudamiento (Deuda/Patrimonio)',
                threshold: CONFIG.RATIO_THRESHOLDS.debtEquity
            },
            debtAssets: {
                value: activoTotal > 0 ? pasivoTotal / activoTotal : 0,
                label: 'Endeudamiento (Deuda/Activos)'
            },
            roe: {
                value: patrimonio > 0 ? utilidadNeta / patrimonio : 0,
                label: 'ROE (Return on Equity)'
            },
            roa: {
                value: activoTotal > 0 ? utilidadNeta / activoTotal : 0,
                label: 'ROA (Return on Assets)'
            },
            margin: {
                value: ingresos > 0 ? (utilidadNeta / ingresos) * 100 : 0,
                label: 'Margen Neto',
                threshold: CONFIG.RATIO_THRESHOLDS.margin
            },
            grossMargin: {
                value: ingresos > 0 ? ((ingresos - (balances['5-01-001'] || 0)) / ingresos) * 100 : 0,
                label: 'Margen Bruto'
            }
        };

        const getInterpretation = (ratio, value) => {
            if (!ratio.threshold) return { text: 'N/A', class: '' };
            const t = ratio.threshold;
            if (value >= t.healthy) return { text: '✅ Saludable', class: 'healthy' };
            if (value >= t.warning) return { text: '⚠️ Atención', class: 'warning' };
            return { text: '❌ Alto riesgo', class: 'danger' };
        };

        let html = `
            <div class="report-ratios">
        `;

        Object.keys(ratios).forEach(key => {
            const r = ratios[key];
            const value = r.value;
            const interpretation = getInterpretation(r, value);
            const formattedValue = key.includes('margin') ? formatPercent(value) : value.toFixed(2);
            
            html += `
                <div class="report-ratio">
                    <div class="name">${r.label}</div>
                    <div class="value">${formattedValue}</div>
                    <div class="interpretation ${interpretation.class}">${interpretation.text}</div>
                </div>
            `;
        });

        html += `</div>`;

        // Resumen ejecutivo
        html += `
            <div style="background:white;padding:16px;border-radius:var(--report-radius);box-shadow:var(--report-shadow);margin-top:16px;">
                <h5 style="margin:0 0 8px 0;color:var(--report-primary);">📊 Resumen Ejecutivo</h5>
                <p style="margin:4px 0;font-size:14px;">
                    <strong>Liquidez:</strong> ${ratios.liquidity.value >= 2 ? 'Saludable' : ratios.liquidity.value >= 1.5 ? 'Adecuada' : 'Preocupante'} 
                    (${ratios.liquidity.value.toFixed(2)}x)
                </p>
                <p style="margin:4px 0;font-size:14px;">
                    <strong>Endeudamiento:</strong> ${ratios.debtEquity.value <= 0.5 ? 'Bajo' : ratios.debtEquity.value <= 1 ? 'Moderado' : 'Alto'} 
                    (${ratios.debtEquity.value.toFixed(2)}x)
                </p>
                <p style="margin:4px 0;font-size:14px;">
                    <strong>Rentabilidad:</strong> ${ratios.margin.value >= 30 ? 'Excelente' : ratios.margin.value >= 15 ? 'Buena' : 'Baja'} 
                    (${ratios.margin.value.toFixed(1)}%)
                </p>
                <p style="margin:4px 0;font-size:14px;color:var(--report-gray-500);">
                    Período: ${formatDate(dateFrom)} - ${formatDate(dateTo)}
                </p>
            </div>
        `;

        return html;
    }

    // ============================================================
    // 17. GENERACIÓN DE REPORTES
    // ============================================================
    function generateReport(type) {
        state.currentReport = type;
        const container = document.getElementById('report-content');
        if (!container) return;

        const filters = state.filters;
        let html = '';

        // Aplicar filtros de fechas
        if (!filters.dateFrom || !filters.dateTo) {
            const preset = filters.preset || 'month';
            const range = getDatePresetRange(preset);
            filters.dateFrom = range.start;
            filters.dateTo = range.end;
        }

        // Generar reporte según tipo
        switch(type) {
            case 'income':
                html = generateIncomeStatement(filters);
                break;
            case 'balance':
                html = generateBalanceSheet(filters);
                break;
            case 'cashflow':
                html = generateCashFlow(filters);
                break;
            case 'equity':
                html = generateEquityChanges(filters);
                break;
            case 'kardex':
                html = generateKardexReport(filters);
                break;
            case 'ventas':
                html = generateSalesSummary(filters);
                break;
            case 'aging':
                html = generateAgingReport(filters);
                break;
            case 'ratios':
                html = generateRatios(filters);
                break;
            default:
                html = '<p>Reporte no disponible</p>';
        }

        container.innerHTML = html;

        // Disparar evento
        dispatchEvent('report:generated', { type, filters });
    }

    // ============================================================
    // 18. UI RENDERIZADO
    // ============================================================
    function renderUI() {
        if (!state.container) return;

        const container = state.container;
        const currentReport = state.currentReport;

        container.innerHTML = `
            <div class="report-container">
                <!-- Header -->
                <div class="report-header">
                    <div class="report-header-title">
                        <i class="fas fa-file-alt"></i>
                        <span>Reportes Financieros</span>
                        <span id="report-sync-status" class="report-sync-status">
                            <span class="dot offline"></span>
                            <span class="text">Cargando...</span>
                            <span class="time"></span>
                        </span>
                    </div>
                    <div class="report-header-actions">
                        <button class="report-btn report-btn-primary" onclick="window.ReportesContaModule.refresh()">
                            <i class="fas fa-sync-alt"></i> Actualizar
                        </button>
                        <div class="report-export">
                            <button class="report-btn report-btn-success report-btn-sm" onclick="window.ReportesContaModule.exportReport('csv')">
                                <i class="fas fa-file-csv"></i> CSV
                            </button>
                            <button class="report-btn report-btn-success report-btn-sm" onclick="window.ReportesContaModule.exportReport('excel')">
                                <i class="fas fa-file-excel"></i> Excel
                            </button>
                            <button class="report-btn report-btn-danger report-btn-sm" onclick="window.ReportesContaModule.exportReport('pdf')">
                                <i class="fas fa-file-pdf"></i> PDF
                            </button>
                            <button class="report-btn report-btn-outline report-btn-sm" onclick="window.ReportesContaModule.exportReport('print')">
                                <i class="fas fa-print"></i> Imprimir
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Tabs -->
                <div class="report-tabs">
                    ${[
                        { id: 'income', label: '📊 Estado de Resultados' },
                        { id: 'balance', label: '⚖️ Balance General' },
                        { id: 'cashflow', label: '💵 Flujo de Efectivo' },
                        { id: 'equity', label: '📈 Cambios Patrimonio' },
                        { id: 'kardex', label: '📦 Kardex' },
                        { id: 'ventas', label: '🛒 Ventas' },
                        { id: 'aging', label: '📋 Antigüedad' },
                        { id: 'ratios', label: '📊 Ratios Financieros' }
                    ].map(tab => `
                        <button class="report-tab ${currentReport === tab.id ? 'active' : ''}" 
                                onclick="window.ReportesContaModule.showReport('${tab.id}')">
                            ${tab.label}
                        </button>
                    `).join('')}
                </div>

                <!-- Filtros -->
                <div class="report-filters">
                    <div class="report-filters-toggle" onclick="window.ReportesContaModule.toggleFilters()">
                        <span><i class="fas fa-filter"></i> Filtros</span>
                        <span id="filter-toggle-icon"><i class="fas fa-chevron-down"></i></span>
                    </div>
                    <div class="report-filters-body" id="report-filters-body">
                        <div class="filter-group">
                            <label>Período</label>
                            <select id="filter-preset" onchange="window.ReportesContaModule.applyPreset(this.value)">
                                <option value="today">Hoy</option>
                                <option value="week">Esta semana</option>
                                <option value="month" selected>Este mes</option>
                                <option value="lastMonth">Último mes</option>
                                <option value="quarter">Este trimestre</option>
                                <option value="year">Este año</option>
                                <option value="lastYear">Año anterior</option>
                                <option value="custom">Personalizado</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label>Desde</label>
                            <input type="date" id="filter-date-from" value="${state.filters.dateFrom ? new Date(state.filters.dateFrom).toISOString().split('T')[0] : ''}" 
                                   onchange="window.ReportesContaModule.updateFilters()">
                        </div>
                        <div class="filter-group">
                            <label>Hasta</label>
                            <input type="date" id="filter-date-to" value="${state.filters.dateTo ? new Date(state.filters.dateTo).toISOString().split('T')[0] : ''}" 
                                   onchange="window.ReportesContaModule.updateFilters()">
                        </div>
                        <div class="filter-group">
                            <label>Comparar con</label>
                            <select id="filter-compare" onchange="window.ReportesContaModule.toggleCompare(this.value)">
                                <option value="">Sin comparar</option>
                                <option value="previous">Período anterior</option>
                                <option value="year">Año anterior</option>
                            </select>
                        </div>
                        <div class="filter-group" id="compare-filters" style="display:none;">
                            <label>Desde (comparativo)</label>
                            <input type="date" id="filter-compare-from" onchange="window.ReportesContaModule.updateFilters()">
                        </div>
                        <div class="filter-group" style="display:none;" id="compare-filters-to">
                            <label>Hasta (comparativo)</label>
                            <input type="date" id="filter-compare-to" onchange="window.ReportesContaModule.updateFilters()">
                        </div>
                        <div class="filter-group">
                            <label>Producto</label>
                            <select id="filter-product" onchange="window.ReportesContaModule.updateFilters()">
                                <option value="">Todos</option>
                                ${state.products.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="filter-group filter-actions">
                            <button class="report-btn report-btn-primary" onclick="window.ReportesContaModule.applyFilters()">
                                <i class="fas fa-check"></i> Aplicar
                            </button>
                            <button class="report-btn report-btn-outline" onclick="window.ReportesContaModule.clearFilters()">
                                <i class="fas fa-times"></i> Limpiar
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Content -->
                <div id="report-content">
                    <div style="text-align:center;padding:40px;color:var(--report-gray-400);">
                        <i class="fas fa-file-alt" style="font-size:48px;"></i>
                        <p>Cargando reporte...</p>
                    </div>
                </div>
            </div>
        `;

        // Generar reporte inicial
        generateReport(currentReport);
        updateSyncStatus();
        showToast('Módulo de Reportes cargado', 'info');
    }

    // ============================================================
    // 19. FILTROS
    // ============================================================
    function toggleFilters() {
        const body = document.getElementById('report-filters-body');
        const icon = document.getElementById('filter-toggle-icon');
        if (body) {
            const isHidden = body.style.display === 'none';
            body.style.display = isHidden ? 'grid' : 'none';
            if (icon) icon.innerHTML = isHidden ? '<i class="fas fa-chevron-up"></i>' : '<i class="fas fa-chevron-down"></i>';
        }
    }

    function applyPreset(value) {
        if (value === 'custom') return;
        const range = getDatePresetRange(value);
        state.filters.preset = value;
        state.filters.dateFrom = range.start;
        state.filters.dateTo = range.end;
        
        document.getElementById('filter-date-from').value = new Date(range.start).toISOString().split('T')[0];
        document.getElementById('filter-date-to').value = new Date(range.end).toISOString().split('T')[0];
        applyFilters();
    }

    function toggleCompare(value) {
        const compareFilters = document.getElementById('compare-filters');
        const compareFiltersTo = document.getElementById('compare-filters-to');
        if (value) {
            compareFilters.style.display = 'block';
            compareFiltersTo.style.display = 'block';
            state.compareMode = true;
            state.comparePeriod = value;
        } else {
            compareFilters.style.display = 'none';
            compareFiltersTo.style.display = 'none';
            state.compareMode = false;
        }
    }

    function updateFilters() {
        const dateFrom = document.getElementById('filter-date-from').value;
        const dateTo = document.getElementById('filter-date-to').value;
        const product = document.getElementById('filter-product').value;
        const compareFrom = document.getElementById('filter-compare-from')?.value || '';
        const compareTo = document.getElementById('filter-compare-to')?.value || '';

        state.filters.dateFrom = dateFrom ? new Date(dateFrom).getTime() : 0;
        state.filters.dateTo = dateTo ? new Date(dateTo).getTime() : Date.now();
        state.filters.product = product;
        state.filters.compareFrom = compareFrom ? new Date(compareFrom).getTime() : 0;
        state.filters.compareTo = compareTo ? new Date(compareTo).getTime() : 0;
    }

    function applyFilters() {
        updateFilters();
        generateReport(state.currentReport);
        showToast('Filtros aplicados', 'success');
    }

    function clearFilters() {
        state.filters = {
            dateFrom: 0,
            dateTo: Date.now(),
            compareFrom: 0,
            compareTo: 0,
            accounts: [],
            source: '',
            customer: '',
            product: '',
            currency: 'USD',
            preset: 'month'
        };
        state.compareMode = false;
        
        const range = getDatePresetRange('month');
        state.filters.dateFrom = range.start;
        state.filters.dateTo = range.end;
        
        document.getElementById('filter-preset').value = 'month';
        document.getElementById('filter-date-from').value = new Date(range.start).toISOString().split('T')[0];
        document.getElementById('filter-date-to').value = new Date(range.end).toISOString().split('T')[0];
        document.getElementById('filter-product').value = '';
        document.getElementById('filter-compare').value = '';
        document.getElementById('compare-filters').style.display = 'none';
        document.getElementById('compare-filters-to').style.display = 'none';
        
        generateReport(state.currentReport);
        showToast('Filtros limpiados', 'info');
    }

    // ============================================================
    // 20. EXPORTACIÓN
    // ============================================================
    function exportReport(format) {
        const content = document.getElementById('report-content');
        if (!content || !content.innerHTML.trim()) {
            showToast('No hay datos para exportar', 'warning');
            return;
        }

        const reportTitle = document.querySelector('.report-tab.active')?.textContent?.trim() || 'Reporte';
        const dateStr = new Date().toISOString().split('T')[0];

        switch(format) {
            case 'csv':
                exportCSV(content, reportTitle, dateStr);
                break;
            case 'excel':
                exportExcel(content, reportTitle, dateStr);
                break;
            case 'pdf':
                exportPDF(content, reportTitle, dateStr);
                break;
            case 'print':
                window.print();
                break;
            default:
                showToast('Formato no soportado', 'warning');
        }
    }

    function exportCSV(content, title, dateStr) {
        // Extraer datos de la tabla
        const tables = content.querySelectorAll('table');
        if (tables.length === 0) {
            showToast('No hay tabla para exportar', 'warning');
            return;
        }

        let csv = `"${title}","${new Date().toLocaleString()}"\n\n`;
        tables.forEach(table => {
            const rows = table.querySelectorAll('tr');
            rows.forEach(row => {
                const cells = row.querySelectorAll('th, td');
                const rowData = [];
                cells.forEach(cell => {
                    let text = cell.textContent.trim().replace(/"/g, '""');
                    // Limpiar símbolos de moneda para CSV
                    text = text.replace(/[$,]/g, '').trim();
                    rowData.push(`"${text}"`);
                });
                csv += rowData.join(',') + '\n';
            });
            csv += '\n';
        });

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        downloadFile(blob, `${title.replace(/\s+/g, '_')}_${dateStr}.csv`);
        showToast('CSV exportado correctamente', 'success');
    }

    function exportExcel(content, title, dateStr) {
        // Verificar si xlsx está disponible
        if (typeof XLSX === 'undefined') {
            showToast('Librería XLSX no cargada. Descargando...', 'warning');
            loadXLSX(() => exportExcel(content, title, dateStr));
            return;
        }

        try {
            // Construir datos para Excel
            const tables = content.querySelectorAll('table');
            if (tables.length === 0) {
                showToast('No hay tabla para exportar', 'warning');
                return;
            }

            const workbook = XLSX.utils.book_new();
            
            tables.forEach((table, idx) => {
                const wsData = [];
                const rows = table.querySelectorAll('tr');
                rows.forEach(row => {
                    const rowData = [];
                    const cells = row.querySelectorAll('th, td');
                    cells.forEach(cell => {
                        let text = cell.textContent.trim().replace(/[$,]/g, '').trim();
                        rowData.push(text);
                    });
                    wsData.push(rowData);
                });
                
                const ws = XLSX.utils.aoa_to_sheet(wsData);
                const sheetName = idx === 0 ? title.replace(/\s+/g, '_').slice(0, 31) : `Hoja${idx + 1}`;
                XLSX.utils.book_append_sheet(workbook, ws, sheetName);
            });

            const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/octet-stream' });
            downloadFile(blob, `${title.replace(/\s+/g, '_')}_${dateStr}.xlsx`);
            showToast('Excel exportado correctamente', 'success');
        } catch (e) {
            console.error('Error exportando Excel:', e);
            showToast('Error al exportar Excel: ' + e.message, 'error');
        }
    }

    function exportPDF(content, title, dateStr) {
        // Verificar si html2canvas y jsPDF están disponibles
        if (typeof html2canvas === 'undefined' || typeof jsPDF === 'undefined') {
            showToast('Librerías para PDF no cargadas. Descargando...', 'warning');
            loadPDFLibraries(() => exportPDF(content, title, dateStr));
            return;
        }

        showToast('Generando PDF...', 'info');

        html2canvas(content, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 210; // mm (A4)
            const pageHeight = 297; // mm (A4)
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            
            const doc = new jsPDF('p', 'mm', 'a4');
            let position = 0;

            // Agregar encabezado
            doc.setFontSize(16);
            doc.setTextColor(15, 52, 96);
            doc.text(title, 105, 20, { align: 'center' });
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139);
            doc.text(`Generado: ${new Date().toLocaleString()}`, 105, 27, { align: 'center' });

            // Agregar imagen
            doc.addImage(imgData, 'PNG', 0, 32, imgWidth, imgHeight);
            heightLeft -= (pageHeight - 32);

            // Pie de página
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text('K\'A Boutique - Reportes Financieros', 105, 290, { align: 'center' });

            doc.save(`${title.replace(/\s+/g, '_')}_${dateStr}.pdf`);
            showToast('PDF exportado correctamente', 'success');
        }).catch(err => {
            console.error('Error exportando PDF:', err);
            showToast('Error al exportar PDF: ' + err.message, 'error');
        });
    }

    function downloadFile(blob, filename) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    function loadXLSX(callback) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        script.onload = callback;
        script.onerror = () => showToast('Error cargando XLSX. Verifica tu conexión.', 'error');
        document.head.appendChild(script);
    }

    function loadPDFLibraries(callback) {
        let loaded = 0;
        const total = 2;

        const checkLoaded = () => {
            loaded++;
            if (loaded === total) callback();
        };

        const script1 = document.createElement('script');
        script1.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
        script1.onload = checkLoaded;
        script1.onerror = () => showToast('Error cargando html2canvas', 'error');
        document.head.appendChild(script1);

        const script2 = document.createElement('script');
        script2.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
        script2.onload = checkLoaded;
        script2.onerror = () => showToast('Error cargando jsPDF', 'error');
        document.head.appendChild(script2);
    }

    // ============================================================
    // 21. FUNCIONES PÚBLICAS
    // ============================================================
    function render(containerElement) {
        if (!containerElement) {
            console.error('Reportes: container no proporcionado');
            return;
        }

        state.container = containerElement;
        state.isInitialized = true;
        injectStyles();

        // Cargar datos desde caché
        loadFromCache();

        // Sincronizar con módulos
        syncWithModules();

        // Conectar Firebase
        const db = getFirebaseDb();
        if (db) {
            setupFirebaseListeners();
        } else {
            state.metadata.syncStatus = 'offline';
            showToast('Modo offline - datos locales', 'warning');
        }

        // Inicializar filtros con fecha por defecto
        const range = getDatePresetRange('month');
        state.filters.dateFrom = range.start;
        state.filters.dateTo = range.end;

        renderUI();
        updateSyncStatus();
    }

    function showReport(type) {
        state.currentReport = type;
        // Actualizar tabs
        document.querySelectorAll('.report-tab').forEach(tab => {
            tab.classList.toggle('active', tab.textContent.trim().toLowerCase().includes(type));
        });
        generateReport(type);
    }

    function setFilters(filters) {
        state.filters = { ...state.filters, ...filters };
        if (filters.dateFrom) document.getElementById('filter-date-from').value = new Date(filters.dateFrom).toISOString().split('T')[0];
        if (filters.dateTo) document.getElementById('filter-date-to').value = new Date(filters.dateTo).toISOString().split('T')[0];
        generateReport(state.currentReport);
    }

    function refresh() {
        loadFromCache();
        syncWithModules();
        generateReport(state.currentReport);
        updateSyncStatus();
        showToast('Datos actualizados', 'success');
    }

    function destroy() {
        state.unsubscribe.forEach(unsub => { try { unsub(); } catch(e) {} });
        state.unsubscribe = [];
        state.container = null;
        state.isInitialized = false;
        showToast('Módulo Reportes destruido', 'info');
    }

    function updateSyncStatus() {
        const statusEl = document.getElementById('report-sync-status');
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

        const status = statusMap[state.metadata?.syncStatus || 'idle'] || statusMap.offline;
        dot.className = 'dot ' + status.dot;
        text.textContent = status.text;
        if (state.metadata?.lastSync) {
            time.textContent = 'Última: ' + formatDate(state.metadata.lastSync);
        }
    }

    // ============================================================
    // 22. EVENTOS PERSONALIZADOS
    // ============================================================
    function dispatchEvent(eventName, detail) {
        const event = new CustomEvent('reportes:' + eventName, { detail });
        document.dispatchEvent(event);
        if (state.container) {
            state.container.dispatchEvent(event);
        }
    }

    // ============================================================
    // 23. TOAST NOTIFICATIONS
    // ============================================================
    function showToast(message, type = 'info') {
        let container = document.querySelector('.report-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'report-toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `report-toast ${type}`;
        toast.innerHTML = `
            <span>${message}</span>
            <button class="close-toast" onclick="this.parentElement.remove()">&times;</button>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 5000);
    }

    // ============================================================
    // 24. EXPOSICIÓN DEL MÓDULO
    // ============================================================
    window.ReportesContaModule = {
        // API Pública
        render: render,
        showReport: showReport,
        setFilters: setFilters,
        exportReport: exportReport,
        refresh: refresh,
        destroy: destroy,
        
        // UI Handlers
        toggleFilters: toggleFilters,
        applyPreset: applyPreset,
        toggleCompare: toggleCompare,
        updateFilters: updateFilters,
        applyFilters: applyFilters,
        clearFilters: clearFilters,
        
        // Estado
        getState: () => ({ ...state })
    };

    console.log('✅ Módulo Reportes Contables cargado y listo para usar');
    console.log(`📊 ${state.entries.length} asientos, ${state.products.length} productos, ${state.sales.length} ventas`);

})();