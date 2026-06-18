/**
 * ============================================================
 * ventas.js - Módulo de Gestión de Ventas (Online y Físico)
 * Versión 3.1 - CORREGIDO
 * ============================================================
 * 
 * Características:
 * - CRUD completo de ventas (online y físico)
 * - Sincronización en tiempo real con Firebase
 * - Búsqueda de clientes desde Firebase (users)
 * - Búsqueda de productos desde Firebase (products)
 * - Caché local (localStorage) para modo offline
 * - Búsqueda y filtros avanzados
 * - Ordenamiento y paginación
 * - Integración automática con Kardex y Contabilidad
 * ============================================================
 */

(function() {
    'use strict';

    // ============================================================
    // 1. CONFIGURACIÓN Y CONSTANTES
    // ============================================================
    const CONFIG = {
        STORAGE_KEY: 'kaboutique_sales_cache',
        STORAGE_KEY_METADATA: 'kaboutique_sales_metadata',
        PAGE_SIZE: 20,
        PAGE_SIZES: [10, 20, 50, 100],
        DEBOUNCE_DELAY: 300,
        STATUS: {
            PENDING: 'pendiente',
            COMPLETED: 'completado',
            CANCELLED: 'anulado',
            REFUNDED: 'devuelto'
        },
        PAYMENT_METHODS: ['efectivo', 'tarjeta', 'transferencia', 'paypal', 'credito'],
        SALE_TYPES: ['ONLINE', 'FISICO']
    };

    // ============================================================
    // 2. ESTADO INTERNO
    // ============================================================
    let state = {
        sales: [],
        products: [],
        customers: [],
        metadata: {
            lastSync: null,
            syncStatus: 'idle',
            version: 1
        },
        filters: {
            search: '',
            type: '',
            paymentMethod: '',
            status: '',
            dateFrom: '',
            dateTo: '',
            minTotal: '',
            maxTotal: '',
            customer: ''
        },
        sort: {
            field: 'date',
            direction: 'desc'
        },
        pagination: {
            page: 1,
            pageSize: CONFIG.PAGE_SIZE,
            total: 0
        },
        container: null,
        firebaseDb: null,
        unsubscribeSales: null,
        unsubscribeProducts: null,
        unsubscribeUsers: null,
        isInitialized: false,
        searchTimeout: null
    };

    // ============================================================
    // 3. ESTILOS CSS
    // ============================================================
    const CSS_STYLES = `
        :root {
            --ventas-primary: #0f3460;
            --ventas-primary-dark: #0a2647;
            --ventas-primary-light: #1a4a7a;
            --ventas-secondary: #e94560;
            --ventas-success: #059669;
            --ventas-success-light: #d1fae5;
            --ventas-danger: #dc2626;
            --ventas-danger-light: #fee2e2;
            --ventas-warning: #d97706;
            --ventas-warning-light: #fef3c7;
            --ventas-gray-50: #f8fafc;
            --ventas-gray-100: #f1f5f9;
            --ventas-gray-200: #e2e8f0;
            --ventas-gray-300: #cbd5e1;
            --ventas-gray-400: #94a3b8;
            --ventas-gray-500: #64748b;
            --ventas-gray-600: #475569;
            --ventas-gray-700: #334155;
            --ventas-gray-800: #1e293b;
            --ventas-shadow: 0 1px 3px rgba(0,0,0,0.1);
            --ventas-shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1);
            --ventas-shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1);
            --ventas-radius: 8px;
            --ventas-radius-lg: 12px;
        }

        .ventas-container {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            color: var(--ventas-gray-800);
            background: var(--ventas-gray-50);
            padding: 20px;
            border-radius: var(--ventas-radius-lg);
            max-width: 100%;
        }

        .ventas-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 2px solid var(--ventas-gray-200);
        }
        .ventas-header-title {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 20px;
            font-weight: 700;
            color: var(--ventas-primary);
        }
        .ventas-header-title i {
            font-size: 24px;
            color: var(--ventas-secondary);
        }
        .ventas-header-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        .ventas-toolbar {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 16px;
            align-items: center;
            background: white;
            padding: 12px 16px;
            border-radius: var(--ventas-radius);
            box-shadow: var(--ventas-shadow);
        }
        .ventas-toolbar .ventas-search {
            flex: 1;
            min-width: 200px;
            position: relative;
        }
        .ventas-toolbar .ventas-search input {
            width: 100%;
            padding: 8px 12px 8px 36px;
            border: 1px solid var(--ventas-gray-300);
            border-radius: var(--ventas-radius);
            font-size: 14px;
            transition: border-color 0.3s;
        }
        .ventas-toolbar .ventas-search input:focus {
            outline: none;
            border-color: var(--ventas-primary);
            box-shadow: 0 0 0 3px rgba(15,52,96,0.1);
        }
        .ventas-toolbar .ventas-search i {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--ventas-gray-400);
        }

        .ventas-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            border: none;
            border-radius: var(--ventas-radius);
            font-weight: 600;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.3s;
        }
        .ventas-btn:hover {
            transform: translateY(-1px);
            box-shadow: var(--ventas-shadow);
        }
        .ventas-btn-primary { background: var(--ventas-primary); color: white; }
        .ventas-btn-primary:hover { background: var(--ventas-primary-light); }
        .ventas-btn-success { background: var(--ventas-success); color: white; }
        .ventas-btn-success:hover { background: #047857; }
        .ventas-btn-danger { background: var(--ventas-danger); color: white; }
        .ventas-btn-danger:hover { background: #b91c1c; }
        .ventas-btn-warning { background: var(--ventas-warning); color: white; }
        .ventas-btn-warning:hover { background: #b45309; }
        .ventas-btn-outline { background: transparent; color: var(--ventas-primary); border: 2px solid var(--ventas-primary); }
        .ventas-btn-outline:hover { background: var(--ventas-primary); color: white; }
        .ventas-btn-sm { padding: 4px 12px; font-size: 12px; }
        .ventas-btn-xs { padding: 2px 8px; font-size: 11px; }

        .ventas-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 12px;
            margin-bottom: 16px;
        }
        .ventas-summary-item {
            background: white;
            padding: 12px 16px;
            border-radius: var(--ventas-radius);
            box-shadow: var(--ventas-shadow);
            text-align: center;
        }
        .ventas-summary-item .value {
            font-size: 20px;
            font-weight: 700;
            color: var(--ventas-primary);
        }
        .ventas-summary-item .label {
            font-size: 12px;
            color: var(--ventas-gray-500);
            margin-top: 2px;
        }
        .ventas-summary-item .value.success { color: var(--ventas-success); }
        .ventas-summary-item .value.danger { color: var(--ventas-danger); }
        .ventas-summary-item .value.warning { color: var(--ventas-warning); }

        .ventas-table-wrapper {
            overflow-x: auto;
            background: white;
            border-radius: var(--ventas-radius);
            box-shadow: var(--ventas-shadow);
        }
        .ventas-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }
        .ventas-table th {
            background: var(--ventas-primary);
            color: white;
            padding: 10px 14px;
            text-align: left;
            font-weight: 600;
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
            position: sticky;
            top: 0;
            z-index: 10;
        }
        .ventas-table th:hover { background: var(--ventas-primary-light); }
        .ventas-table th .sort-icon { margin-left: 4px; opacity: 0.5; }
        .ventas-table th.active .sort-icon { opacity: 1; }
        .ventas-table td {
            padding: 8px 14px;
            border-bottom: 1px solid var(--ventas-gray-200);
            vertical-align: middle;
        }
        .ventas-table tbody tr:hover { background: var(--ventas-gray-50); }
        .ventas-table .empty-row td {
            text-align: center;
            color: var(--ventas-gray-400);
            padding: 40px 20px;
            font-style: italic;
        }

        .ventas-badge {
            display: inline-block;
            padding: 2px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
        }
        .ventas-badge-success { background: var(--ventas-success-light); color: #065f46; }
        .ventas-badge-danger { background: var(--ventas-danger-light); color: #991b1b; }
        .ventas-badge-warning { background: var(--ventas-warning-light); color: #92400e; }
        .ventas-badge-info { background: #dbeafe; color: #1e40af; }

        .ventas-pagination {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
            padding: 12px 16px;
            background: white;
            border-radius: 0 0 var(--ventas-radius) var(--ventas-radius);
            border-top: 1px solid var(--ventas-gray-200);
        }
        .ventas-pagination .info {
            font-size: 13px;
            color: var(--ventas-gray-500);
        }
        .ventas-pagination .controls {
            display: flex;
            gap: 6px;
            align-items: center;
        }
        .ventas-pagination .controls select {
            padding: 4px 8px;
            border: 1px solid var(--ventas-gray-300);
            border-radius: var(--ventas-radius);
            font-size: 12px;
        }
        .ventas-pagination .controls button {
            padding: 4px 12px;
            border: 1px solid var(--ventas-gray-300);
            border-radius: var(--ventas-radius);
            background: white;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.3s;
        }
        .ventas-pagination .controls button:hover:not(:disabled) {
            background: var(--ventas-primary);
            color: white;
            border-color: var(--ventas-primary);
        }
        .ventas-pagination .controls button:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }

        .ventas-sync-status {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: var(--ventas-gray-500);
            padding: 4px 12px;
            background: white;
            border-radius: 20px;
            box-shadow: var(--ventas-shadow);
        }
        .ventas-sync-status .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            display: inline-block;
        }
        .ventas-sync-status .dot.online { background: var(--ventas-success); }
        .ventas-sync-status .dot.offline { background: var(--ventas-danger); }
        .ventas-sync-status .dot.syncing { 
            background: var(--ventas-warning);
            animation: ventas-pulse 0.8s ease-in-out infinite;
        }
        @keyframes ventas-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        /* Modal */
        .ventas-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 999999;
            display: flex;
            justify-content: center;
            align-items: center;
            backdrop-filter: blur(4px);
            padding: 20px;
        }
        .ventas-modal {
            background: white;
            border-radius: var(--ventas-radius-lg);
            padding: 30px;
            width: 100%;
            max-width: 800px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: var(--ventas-shadow-xl);
            animation: ventas-modal-in 0.3s ease;
        }
        @keyframes ventas-modal-in {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
        .ventas-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 2px solid var(--ventas-gray-200);
        }
        .ventas-modal-header h3 {
            margin: 0;
            color: var(--ventas-primary);
            font-size: 18px;
        }
        .ventas-modal-header .close-btn {
            background: none;
            border: none;
            font-size: 24px;
            color: var(--ventas-gray-400);
            cursor: pointer;
            padding: 0 4px;
            transition: color 0.3s;
        }
        .ventas-modal-header .close-btn:hover {
            color: var(--ventas-danger);
        }
        .ventas-modal .form-group {
            margin-bottom: 14px;
        }
        .ventas-modal .form-group label {
            display: block;
            font-weight: 600;
            font-size: 13px;
            color: var(--ventas-gray-700);
            margin-bottom: 4px;
        }
        .ventas-modal .form-group .required {
            color: var(--ventas-danger);
        }
        .ventas-modal .form-control {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--ventas-gray-300);
            border-radius: var(--ventas-radius);
            font-size: 14px;
            transition: border-color 0.3s;
            box-sizing: border-box;
        }
        .ventas-modal .form-control:focus {
            outline: none;
            border-color: var(--ventas-primary);
            box-shadow: 0 0 0 3px rgba(15,52,96,0.1);
        }
        .ventas-modal .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
        }
        .ventas-modal .form-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 20px;
            padding-top: 16px;
            border-top: 1px solid var(--ventas-gray-200);
        }

        /* Búsqueda de clientes */
        .ventas-customer-search {
            position: relative;
        }
        .ventas-customer-search .search-results {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid var(--ventas-gray-300);
            border-top: none;
            border-radius: 0 0 var(--ventas-radius) var(--ventas-radius);
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            box-shadow: var(--ventas-shadow-lg);
            display: none;
        }
        .ventas-customer-search .search-results.show { display: block; }
        .ventas-customer-search .search-results .result-item {
            padding: 8px 12px;
            cursor: pointer;
            border-bottom: 1px solid var(--ventas-gray-100);
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background 0.2s;
        }
        .ventas-customer-search .search-results .result-item:hover {
            background: var(--ventas-gray-50);
        }
        .ventas-customer-search .search-results .result-item .name { font-weight: 500; }
        .ventas-customer-search .search-results .result-item .email { font-size: 12px; color: var(--ventas-gray-500); }
        .ventas-customer-search .search-results .no-results {
            padding: 12px;
            text-align: center;
            color: var(--ventas-gray-400);
        }

        /* Búsqueda de productos */
        .ventas-product-search {
            position: relative;
        }
        .ventas-product-search .product-results {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid var(--ventas-gray-300);
            border-top: none;
            border-radius: 0 0 var(--ventas-radius) var(--ventas-radius);
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            box-shadow: var(--ventas-shadow-lg);
            display: none;
        }
        .ventas-product-search .product-results.show { display: block; }
        .ventas-product-search .product-results .result-item {
            padding: 8px 12px;
            cursor: pointer;
            border-bottom: 1px solid var(--ventas-gray-100);
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background 0.2s;
        }
        .ventas-product-search .product-results .result-item:hover {
            background: var(--ventas-gray-50);
        }
        .ventas-product-search .product-results .result-item .name { font-weight: 500; }
        .ventas-product-search .product-results .result-item .price { font-weight: 600; color: var(--ventas-success); }
        .ventas-product-search .product-results .result-item .stock {
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 12px;
            background: var(--ventas-gray-200);
            color: var(--ventas-gray-600);
        }
        .ventas-product-search .product-results .result-item .stock.low {
            background: var(--ventas-danger-light);
            color: var(--ventas-danger);
        }
        .ventas-product-search .product-results .no-results {
            padding: 12px;
            text-align: center;
            color: var(--ventas-gray-400);
        }

        /* Productos en modal */
        .ventas-products-container {
            border: 1px solid var(--ventas-gray-200);
            border-radius: var(--ventas-radius);
            padding: 12px;
            margin-bottom: 12px;
            max-height: 300px;
            overflow-y: auto;
            background: white;
        }
        .ventas-product-item {
            display: grid;
            grid-template-columns: 2fr 1fr 1fr 1fr auto;
            gap: 8px;
            align-items: center;
            padding: 8px 12px;
            background: var(--ventas-gray-50);
            border-radius: var(--ventas-radius);
            margin-bottom: 4px;
        }
        .ventas-product-item .product-info {
            display: flex;
            flex-direction: column;
        }
        .ventas-product-item .product-info .name { font-weight: 500; font-size: 13px; }
        .ventas-product-item .product-info .code { font-size: 11px; color: var(--ventas-gray-500); }
        .ventas-product-item input {
            padding: 4px 8px;
            border: 1px solid var(--ventas-gray-300);
            border-radius: var(--ventas-radius);
            font-size: 13px;
            width: 70px;
            text-align: center;
        }
        .ventas-product-item input:focus {
            outline: none;
            border-color: var(--ventas-primary);
        }
        .ventas-product-item .product-total {
            font-weight: 600;
            font-size: 14px;
            text-align: right;
        }
        .ventas-product-item .remove-product {
            color: var(--ventas-danger);
            cursor: pointer;
            background: none;
            border: none;
            font-size: 16px;
            padding: 4px;
            transition: color 0.2s;
        }
        .ventas-product-item .remove-product:hover { color: #b91c1c; }

        .ventas-toast-container {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999999;
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-width: 400px;
        }
        .ventas-toast {
            padding: 12px 20px;
            border-radius: var(--ventas-radius);
            color: white;
            font-weight: 500;
            font-size: 14px;
            box-shadow: var(--ventas-shadow-lg);
            animation: ventas-toast-in 0.3s ease;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .ventas-toast.success { background: var(--ventas-success); }
        .ventas-toast.error { background: var(--ventas-danger); }
        .ventas-toast.warning { background: var(--ventas-warning); }
        .ventas-toast.info { background: var(--ventas-primary); }
        .ventas-toast .close-toast {
            background: none;
            border: none;
            color: rgba(255,255,255,0.7);
            font-size: 18px;
            cursor: pointer;
            padding: 0 4px;
            margin-left: 12px;
        }
        .ventas-toast .close-toast:hover { color: white; }
        @keyframes ventas-toast-in {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        .ventas-type-online { color: var(--ventas-primary); }
        .ventas-type-fisico { color: var(--ventas-warning); }

        @media (max-width: 768px) {
            .ventas-container { padding: 12px; }
            .ventas-header { flex-direction: column; align-items: stretch; }
            .ventas-header-actions { justify-content: stretch; }
            .ventas-header-actions .ventas-btn { flex: 1; justify-content: center; }
            .ventas-toolbar { flex-direction: column; }
            .ventas-toolbar .ventas-search { min-width: unset; }
            .ventas-modal { padding: 20px; margin: 10px; }
            .ventas-modal .form-row { grid-template-columns: 1fr; }
            .ventas-summary { grid-template-columns: repeat(2, 1fr); }
            .ventas-pagination { flex-direction: column; align-items: stretch; text-align: center; }
            .ventas-pagination .controls { justify-content: center; flex-wrap: wrap; }
            .ventas-table th,
            .ventas-table td { padding: 6px 10px; font-size: 12px; }
            .ventas-product-item { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 480px) {
            .ventas-summary { grid-template-columns: 1fr 1fr; }
            .ventas-summary-item { padding: 8px 12px; }
            .ventas-summary-item .value { font-size: 16px; }
        }
    `;

    // ============================================================
    // 4. INYECCIÓN DE ESTILOS
    // ============================================================
    function injectStyles() {
        const styleId = 'ventas-module-styles';
        if (document.getElementById(styleId)) return;
        const styleEl = document.createElement('style');
        styleEl.id = styleId;
        styleEl.textContent = CSS_STYLES;
        document.head.appendChild(styleEl);
    }

    // ============================================================
    // 5. UTILITY FUNCTIONS
    // ============================================================
    function generateId() {
        return Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
    }

    function generateOrderNumber() {
        const date = new Date();
        const prefix = 'ORD';
        const year = date.getFullYear().toString().slice(-2);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.random().toString(36).substr(2, 4).toUpperCase();
        return `${prefix}-${year}${month}${day}-${random}`;
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

    function debounce(fn, delay) {
        let timer = null;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    function getStatusBadgeClass(status) {
        const map = {
            'pendiente': 'ventas-badge-warning',
            'completado': 'ventas-badge-success',
            'anulado': 'ventas-badge-danger',
            'devuelto': 'ventas-badge-info'
        };
        return map[status] || 'ventas-badge-gray';
    }

    function getStatusLabel(status) {
        const map = {
            'pendiente': 'Pendiente',
            'completado': 'Completado',
            'anulado': 'Anulado',
            'devuelto': 'Devuelto'
        };
        return map[status] || status;
    }

    function getTypeLabel(type) {
        return type === 'ONLINE' ? '🖥️ Online' : '🏪 Físico';
    }

    function getPaymentMethodLabel(method) {
        const map = {
            'efectivo': 'Efectivo',
            'tarjeta': 'Tarjeta',
            'transferencia': 'Transferencia',
            'paypal': 'PayPal',
            'credito': 'Crédito'
        };
        return map[method] || method;
    }

    // ============================================================
    // 6. TOAST NOTIFICATIONS (FUNCIÓN GLOBAL)
    // ============================================================
    function showToast(message, type = 'info') {
        let container = document.querySelector('.ventas-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'ventas-toast-container';
            document.body.appendChild(container);
        }

        const colors = {
            success: '#059669',
            warning: '#d97706',
            error: '#dc2626',
            info: '#0f3460'
        };

        const toast = document.createElement('div');
        toast.className = `ventas-toast ${type}`;
        toast.style.cssText = `
            background: ${colors[type] || colors.info};
            color: white;
            padding: 10px 16px;
            border-radius: 8px;
            font-weight: 500;
            font-size: 13px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.15);
            animation: ventas-toast-in 0.3s ease;
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
    // 7. FIRESTEADB / PERSISTENCIA
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
            const salesData = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (salesData) {
                state.sales = JSON.parse(salesData);
            }
            const metadataData = localStorage.getItem(CONFIG.STORAGE_KEY_METADATA);
            if (metadataData) {
                state.metadata = JSON.parse(metadataData);
            }
            return true;
        } catch (e) {
            console.warn('Error cargando caché:', e);
            return false;
        }
    }

    function saveToCache() {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.sales));
            localStorage.setItem(CONFIG.STORAGE_KEY_METADATA, JSON.stringify(state.metadata));
            return true;
        } catch (e) {
            console.warn('Error guardando caché:', e);
            return false;
        }
    }

    function setupFirebaseListeners() {
        const db = getFirebaseDb();
        if (!db) return;

        // Ventas
        if (state.unsubscribeSales) {
            state.unsubscribeSales();
            state.unsubscribeSales = null;
        }
        state.unsubscribeSales = db.ref('sales').on('value', function(snapshot) {
            try {
                const data = snapshot.val();
                if (data) {
                    state.sales = Object.keys(data).map(key => ({
                        id: key,
                        ...data[key]
                    }));
                } else {
                    state.sales = [];
                }
                state.metadata.lastSync = Date.now();
                state.metadata.syncStatus = 'online';
                saveToCache();
                if (state.container) {
                    renderUI();
                }
                updateSyncStatus();
            } catch (e) {
                console.error('Error procesando ventas:', e);
            }
        }, function(error) {
            console.error('Error en ventas:', error);
            state.metadata.syncStatus = 'offline';
            updateSyncStatus();
            showToast('Error al sincronizar ventas: ' + error.message, 'error');
        });

        // Productos
        if (state.unsubscribeProducts) {
            state.unsubscribeProducts();
            state.unsubscribeProducts = null;
        }
        state.unsubscribeProducts = db.ref('products').on('value', function(snapshot) {
            try {
                const data = snapshot.val();
                if (data) {
                    state.products = Object.keys(data).map(key => ({
                        id: key,
                        ...data[key]
                    }));
                } else {
                    state.products = [];
                }
                saveToCache();
            } catch (e) {
                console.error('Error procesando productos:', e);
            }
        }, function(error) {
            console.error('Error en productos:', error);
        });

        // Usuarios/Clientes
        if (state.unsubscribeUsers) {
            state.unsubscribeUsers();
            state.unsubscribeUsers = null;
        }
        state.unsubscribeUsers = db.ref('users').on('value', function(snapshot) {
            try {
                const data = snapshot.val();
                if (data) {
                    state.customers = Object.keys(data).map(key => ({
                        id: key,
                        ...data[key]
                    }));
                } else {
                    state.customers = [];
                }
                saveToCache();
            } catch (e) {
                console.error('Error procesando usuarios:', e);
            }
        }, function(error) {
            console.error('Error en usuarios:', error);
        });

        state.metadata.syncStatus = 'syncing';
        updateSyncStatus();
    }

    function syncNow() {
        const db = getFirebaseDb();
        if (!db) {
            showToast('Firebase no disponible. Usando datos locales.', 'warning');
            return;
        }
        state.metadata.syncStatus = 'syncing';
        updateSyncStatus();
        showToast('Sincronizando...', 'info');
        setupFirebaseListeners();
    }

    function updateSyncStatus() {
        const statusEl = document.getElementById('ventas-sync-status');
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

        const status = statusMap[state.metadata.syncStatus] || statusMap.offline;
        dot.className = 'dot ' + status.dot;
        text.textContent = status.text;
        if (state.metadata.lastSync) {
            time.textContent = 'Última: ' + formatDate(state.metadata.lastSync);
        }
    }

    // ============================================================
    // 8. BÚSQUEDA DE CLIENTES Y PRODUCTOS
    // ============================================================
    function searchCustomers(query) {
        if (!query || query.length < 1) return [];
        const q = query.toLowerCase().trim();
        return state.customers.filter(c => {
            const name = (c.displayName || c.name || c.fullName || '').toLowerCase();
            const email = (c.email || '').toLowerCase();
            const phone = (c.phone || '').toLowerCase();
            return name.includes(q) || email.includes(q) || phone.includes(q);
        }).slice(0, 15);
    }

    function searchProducts(query) {
        if (!query || query.length < 1) return [];
        const q = query.toLowerCase().trim();
        return state.products.filter(p => {
            const name = (p.name || '').toLowerCase();
            const code = (p.code || '').toLowerCase();
            const category = (p.category || '').toLowerCase();
            return name.includes(q) || code.includes(q) || category.includes(q);
        }).slice(0, 20);
    }

    function getProductStock(productId) {
        if (typeof window.KardexModule !== 'undefined' && window.KardexModule.getProductStock) {
            return window.KardexModule.getProductStock(productId) || 0;
        }
        const product = state.products.find(p => p.id === productId);
        return product?.stock || 0;
    }

    // ============================================================
    // 9. INTEGRACIÓN CON KARDEX Y CONTABILIDAD
    // ============================================================
    function updateKardex(sale, action) {
        try {
            if (typeof window.KardexModule === 'undefined') {
                console.warn('KardexModule no disponible');
                return;
            }

            sale.items.forEach(item => {
                const product = state.products.find(p => p.id === item.id);
                const cost = product?.cost || product?.costPrice || 0;

                if (action === 'create' || action === 'update') {
                    const movement = {
                        productId: item.id,
                        productName: item.name || product?.name || 'Producto',
                        type: 'SALIDA',
                        quantity: item.quantity,
                        cost: cost,
                        price: item.price || 0,
                        date: sale.date || Date.now(),
                        orderRef: sale.orderNumber,
                        notes: `Venta ${sale.orderNumber} - ${sale.customer?.name || 'Cliente'}`,
                        status: sale.status === CONFIG.STATUS.COMPLETED ? 'CONFIRMADO' : 'REGISTRADO'
                    };

                    if (typeof window.KardexModule.createMovement === 'function') {
                        window.KardexModule.createMovement(movement);
                    }
                } else if (action === 'delete' || action === 'revert') {
                    const movement = {
                        productId: item.id,
                        productName: item.name || product?.name || 'Producto',
                        type: 'ENTRADA',
                        quantity: item.quantity,
                        cost: cost,
                        price: item.price || 0,
                        date: Date.now(),
                        orderRef: `REV-${sale.orderNumber}`,
                        notes: `Reversión de venta ${sale.orderNumber}`,
                        status: 'CONFIRMADO'
                    };

                    if (typeof window.KardexModule.createMovement === 'function') {
                        window.KardexModule.createMovement(movement);
                    }
                }
            });

            if (typeof window.KardexModule.refresh === 'function') {
                window.KardexModule.refresh();
            }
        } catch (e) {
            console.warn('Error actualizando Kardex:', e);
        }
    }

    function updateContabilidad(sale, action) {
        try {
            if (typeof window.ContabilidadModule === 'undefined') {
                console.warn('ContabilidadModule no disponible');
                return;
            }

            if (action === 'create' || action === 'update') {
                const isOnline = sale.type === 'ONLINE';
                const salesAccount = isOnline ? '4-01-003' : '4-01-002';
                const cashAccount = sale.paymentMethod === 'efectivo' ? '1-01-001' : '1-01-002';
                const subtotal = sale.subtotal || 0;
                const shipping = sale.shipping || 0;
                const total = sale.total || 0;

                const lines = [
                    { accountCode: cashAccount, amount: total, side: 'DEBE', description: 'Pago recibido' },
                    { accountCode: salesAccount, amount: subtotal, side: 'HABER', description: 'Venta' }
                ];

                if (shipping > 0) {
                    lines.push({ accountCode: '4-02-001', amount: shipping, side: 'HABER', description: 'Envío' });
                }

                let totalCosto = 0;
                (sale.items || []).forEach(item => {
                    const product = state.products.find(p => p.id === item.id);
                    const cost = product?.cost || product?.costPrice || 0;
                    totalCosto += cost * (item.quantity || 1);
                });

                if (totalCosto > 0) {
                    lines.push({ accountCode: '5-01-002', amount: totalCosto, side: 'DEBE', description: 'Costo de ventas' });
                    lines.push({ accountCode: '1-03-002', amount: totalCosto, side: 'HABER', description: 'Salida inventario' });
                }

                const totalDebe = lines.filter(l => l.side === 'DEBE').reduce((s, l) => s + l.amount, 0);
                const totalHaber = lines.filter(l => l.side === 'HABER').reduce((s, l) => s + l.amount, 0);
                const diff = Math.abs(totalDebe - totalHaber);

                if (diff > 0.01) {
                    lines.push({
                        accountCode: '3-03-001',
                        amount: diff,
                        side: totalDebe > totalHaber ? 'HABER' : 'DEBE',
                        description: 'Ajuste'
                    });
                }

                const entry = {
                    id: 'entry_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    date: new Date(sale.date || Date.now()).toISOString().split('T')[0],
                    description: `${isOnline ? 'Venta Online' : 'Venta Física'} ${sale.orderNumber} - ${sale.customer?.name || 'Cliente'}`,
                    lines: lines,
                    type: 'VENTA',
                    orderRef: sale.orderNumber,
                    createdAt: Date.now(),
                    status: 'REGISTRADO'
                };

                const entries = window.ContabilidadModule.getEntries ? window.ContabilidadModule.getEntries() : [];
                if (entries) entries.unshift(entry);
            }
        } catch (e) {
            console.warn('Error actualizando Contabilidad:', e);
        }
    }

    // ============================================================
    // 10. CRUD - VENTAS
    // ============================================================
    function createSale(data) {
        const db = getFirebaseDb();
        
        if (!data.items || data.items.length === 0) {
            showToast('Debe agregar al menos un producto', 'error');
            return false;
        }

        // Verificar stock
        if (typeof window.KardexModule !== 'undefined' && window.KardexModule.getProductStock) {
            for (const item of data.items) {
                const stock = window.KardexModule.getProductStock(item.id);
                if (stock < item.quantity) {
                    showToast(`Stock insuficiente para "${item.name}". Disponible: ${stock}`, 'error');
                    return false;
                }
            }
        }

        const sale = {
            orderNumber: generateOrderNumber(),
            customer: {
                id: data.customer?.id || '',
                name: data.customer?.name?.trim() || 'Cliente',
                email: data.customer?.email?.trim() || '',
                phone: data.customer?.phone?.trim() || ''
            },
            type: data.type || 'FISICO',
            paymentMethod: data.paymentMethod || 'efectivo',
            items: data.items.map(item => ({
                id: item.id,
                name: item.name || 'Producto',
                quantity: parseInt(item.quantity) || 1,
                price: parseFloat(item.price) || 0
            })),
            subtotal: 0,
            shipping: parseFloat(data.shipping) || 0,
            total: 0,
            notes: data.notes?.trim() || '',
            status: CONFIG.STATUS.PENDING,
            source: data.type === 'ONLINE' ? 'online' : 'fisico',
            date: data.date ? new Date(data.date).getTime() : Date.now(),
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        sale.subtotal = sale.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        sale.total = sale.subtotal + sale.shipping;

        if (db) {
            const ref = db.ref('sales').push();
            sale.id = ref.key;
            ref.set(sale).then(() => {
                showToast(`Venta ${sale.orderNumber} registrada`, 'success');
                updateKardex(sale, 'create');
                updateContabilidad(sale, 'create');
                return true;
            }).catch(err => {
                showToast('Error al registrar venta: ' + err.message, 'error');
                return false;
            });
        } else {
            sale.id = generateId();
            state.sales.push(sale);
            saveToCache();
            renderUI();
            showToast(`Venta ${sale.orderNumber} registrada (modo offline)`, 'success');
            updateKardex(sale, 'create');
            updateContabilidad(sale, 'create');
            return true;
        }
        return true;
    }

    function updateSale(id, data) {
        const db = getFirebaseDb();
        const sale = state.sales.find(s => s.id === id);
        if (!sale) {
            showToast('Venta no encontrada', 'error');
            return false;
        }

        const oldSale = JSON.parse(JSON.stringify(sale));

        if (data.customer) {
            sale.customer = {
                id: data.customer.id || sale.customer.id || '',
                name: data.customer.name?.trim() || sale.customer.name,
                email: data.customer.email?.trim() || sale.customer.email,
                phone: data.customer.phone?.trim() || sale.customer.phone
            };
        }
        if (data.paymentMethod) sale.paymentMethod = data.paymentMethod;
        if (data.shipping !== undefined) sale.shipping = parseFloat(data.shipping) || 0;
        if (data.notes !== undefined) sale.notes = data.notes.trim() || '';
        if (data.status) sale.status = data.status;
        
        if (data.items && data.items.length > 0) {
            sale.items = data.items.map(item => ({
                id: item.id,
                name: item.name || 'Producto',
                quantity: parseInt(item.quantity) || 1,
                price: parseFloat(item.price) || 0
            }));
        }

        sale.subtotal = sale.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        sale.total = sale.subtotal + sale.shipping;
        sale.updatedAt = Date.now();

        if (db) {
            db.ref('sales/' + id).update(sale).then(() => {
                showToast(`Venta ${sale.orderNumber} actualizada`, 'success');
                updateKardex(oldSale, 'revert');
                updateContabilidad(oldSale, 'revert');
                updateKardex(sale, 'update');
                updateContabilidad(sale, 'update');
                return true;
            }).catch(err => {
                showToast('Error al actualizar: ' + err.message, 'error');
                return false;
            });
        } else {
            saveToCache();
            renderUI();
            showToast(`Venta ${sale.orderNumber} actualizada (modo offline)`, 'success');
            return true;
        }
        return true;
    }

    function deleteSale(id) {
        if (!confirm('¿Eliminar esta venta? Esto revertirá el inventario y anulará el asiento contable.')) return false;

        const db = getFirebaseDb();
        const sale = state.sales.find(s => s.id === id);
        if (!sale) {
            showToast('Venta no encontrada', 'error');
            return false;
        }

        if (db) {
            db.ref('sales/' + id).remove().then(() => {
                showToast(`Venta ${sale.orderNumber} eliminada`, 'success');
                updateKardex(sale, 'delete');
                updateContabilidad(sale, 'delete');
                return true;
            }).catch(err => {
                showToast('Error al eliminar: ' + err.message, 'error');
                return false;
            });
        } else {
            state.sales = state.sales.filter(s => s.id !== id);
            saveToCache();
            renderUI();
            showToast(`Venta ${sale.orderNumber} eliminada (modo offline)`, 'success');
            return true;
        }
        return true;
    }

    function changeSaleStatus(id, status) {
        const sale = state.sales.find(s => s.id === id);
        if (!sale) {
            showToast('Venta no encontrada', 'error');
            return;
        }

        const statusLabels = {
            'completado': 'Completar',
            'anulado': 'Anular',
            'devuelto': 'Devolver'
        };

        if (!confirm(`¿${statusLabels[status] || 'Cambiar estado'} la venta ${sale.orderNumber}?`)) return;

        if (status === CONFIG.STATUS.COMPLETED && sale.status !== CONFIG.STATUS.COMPLETED) {
            if (typeof window.KardexModule !== 'undefined' && window.KardexModule.getProductStock) {
                for (const item of sale.items) {
                    const stock = window.KardexModule.getProductStock(item.id);
                    if (stock < item.quantity) {
                        showToast(`Stock insuficiente para "${item.name}". Disponible: ${stock}`, 'error');
                        return;
                    }
                }
            }
        }

        const oldStatus = sale.status;
        sale.status = status;
        sale.updatedAt = Date.now();

        const db = getFirebaseDb();
        if (db) {
            db.ref('sales/' + id + '/status').set(status);
            db.ref('sales/' + id + '/updatedAt').set(Date.now()).then(() => {
                showToast(`Venta ${sale.orderNumber} ${statusLabels[status] || 'actualizada'}`, 'success');
                if (status === CONFIG.STATUS.COMPLETED && oldStatus !== CONFIG.STATUS.COMPLETED) {
                    updateKardex(sale, 'create');
                    updateContabilidad(sale, 'create');
                }
                if ((status === CONFIG.STATUS.CANCELLED || status === CONFIG.STATUS.REFUNDED) && 
                    (oldStatus === CONFIG.STATUS.COMPLETED || oldStatus === CONFIG.STATUS.PENDING)) {
                    updateKardex(sale, 'revert');
                    updateContabilidad(sale, 'revert');
                }
                renderUI();
            }).catch(err => {
                showToast('Error al cambiar estado: ' + err.message, 'error');
            });
        } else {
            saveToCache();
            renderUI();
            showToast(`Venta ${sale.orderNumber} actualizada (modo offline)`, 'success');
        }
    }

    // ============================================================
    // 11. FILTROS Y BÚSQUEDA
    // ============================================================
    function getFilteredSales() {
        let result = [...state.sales];

        if (state.filters.search) {
            const search = state.filters.search.toLowerCase();
            result = result.filter(s => 
                s.orderNumber?.toLowerCase().includes(search) ||
                s.customer?.name?.toLowerCase().includes(search) ||
                s.customer?.email?.toLowerCase().includes(search) ||
                s.customer?.phone?.toLowerCase().includes(search) ||
                s.items?.some(item => item.name?.toLowerCase().includes(search))
            );
        }

        if (state.filters.type) {
            result = result.filter(s => s.type === state.filters.type);
        }
        if (state.filters.paymentMethod) {
            result = result.filter(s => s.paymentMethod === state.filters.paymentMethod);
        }
        if (state.filters.status) {
            result = result.filter(s => s.status === state.filters.status);
        }
        if (state.filters.dateFrom) {
            const from = new Date(state.filters.dateFrom).getTime();
            result = result.filter(s => s.date >= from);
        }
        if (state.filters.dateTo) {
            const to = new Date(state.filters.dateTo).getTime() + 86400000;
            result = result.filter(s => s.date <= to);
        }
        if (state.filters.minTotal !== '') {
            const min = parseFloat(state.filters.minTotal) || 0;
            result = result.filter(s => s.total >= min);
        }
        if (state.filters.maxTotal !== '') {
            const max = parseFloat(state.filters.maxTotal) || 0;
            result = result.filter(s => s.total <= max);
        }
        if (state.filters.customer) {
            const customer = state.filters.customer.toLowerCase();
            result = result.filter(s => 
                s.customer?.name?.toLowerCase().includes(customer) ||
                s.customer?.email?.toLowerCase().includes(customer)
            );
        }

        const sortField = state.sort.field;
        const sortDir = state.sort.direction === 'asc' ? 1 : -1;
        result.sort((a, b) => {
            let valA = a[sortField] || '';
            let valB = b[sortField] || '';
            if (sortField === 'customer') {
                valA = a.customer?.name || '';
                valB = b.customer?.name || '';
            }
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            if (valA < valB) return -sortDir;
            if (valA > valB) return sortDir;
            return 0;
        });

        return result;
    }

    // ============================================================
    // 12. UI RENDERIZADO
    // ============================================================
    function renderUI() {
        if (!state.container) return;

        const container = state.container;
        const totalSales = state.sales.length;
        const totalRevenue = state.sales.reduce((sum, s) => sum + (s.total || 0), 0);
        const onlineSales = state.sales.filter(s => s.type === 'ONLINE');
        const fisicoSales = state.sales.filter(s => s.type === 'FISICO');
        const pendingSales = state.sales.filter(s => s.status === CONFIG.STATUS.PENDING);
        const avgOrder = totalSales > 0 ? totalRevenue / totalSales : 0;

        const filteredSales = getFilteredSales();
        const totalFiltered = filteredSales.length;
        const pageSize = state.pagination.pageSize;
        const totalPages = Math.ceil(totalFiltered / pageSize) || 1;
        const page = Math.min(state.pagination.page, totalPages);
        const start = (page - 1) * pageSize;
        const end = Math.min(start + pageSize, totalFiltered);
        const pageItems = filteredSales.slice(start, end);
        state.pagination.total = totalFiltered;

        container.innerHTML = `
            <div class="ventas-container">
                <div class="ventas-header">
                    <div class="ventas-header-title">
                        <i class="fas fa-shopping-cart"></i>
                        <span>Ventas</span>
                        <span id="ventas-sync-status" class="ventas-sync-status">
                            <span class="dot offline"></span>
                            <span class="text">Cargando...</span>
                            <span class="time"></span>
                        </span>
                    </div>
                    <div class="ventas-header-actions">
                        <button class="ventas-btn ventas-btn-success" onclick="window.VentasModule.showSaleForm('FISICO')">
                            <i class="fas fa-store"></i> Venta Física
                        </button>
                        <button class="ventas-btn ventas-btn-primary" onclick="window.VentasModule.showSaleForm('ONLINE')">
                            <i class="fas fa-globe"></i> Venta Online
                        </button>
                        <button class="ventas-btn ventas-btn-outline" onclick="window.VentasModule.syncNow()">
                            <i class="fas fa-sync-alt"></i> Sincronizar
                        </button>
                        <button class="ventas-btn ventas-btn-outline" onclick="window.VentasModule.exportCSV()">
                            <i class="fas fa-download"></i> Exportar
                        </button>
                    </div>
                </div>

                <div class="ventas-summary">
                    <div class="ventas-summary-item">
                        <div class="value">${totalSales}</div>
                        <div class="label">Total Ventas</div>
                    </div>
                    <div class="ventas-summary-item">
                        <div class="value success">${formatCurrency(totalRevenue)}</div>
                        <div class="label">Ingresos Totales</div>
                    </div>
                    <div class="ventas-summary-item">
                        <div class="value info">${onlineSales.length}</div>
                        <div class="label">🖥️ Online</div>
                    </div>
                    <div class="ventas-summary-item">
                        <div class="value warning">${fisicoSales.length}</div>
                        <div class="label">🏪 Físico</div>
                    </div>
                    <div class="ventas-summary-item">
                        <div class="value ${pendingSales.length > 0 ? 'warning' : ''}">${pendingSales.length}</div>
                        <div class="label">⏳ Pendientes</div>
                    </div>
                    <div class="ventas-summary-item">
                        <div class="value">${formatCurrency(avgOrder)}</div>
                        <div class="label">Promedio por Venta</div>
                    </div>
                </div>

                <div class="ventas-toolbar">
                    <div class="ventas-search">
                        <i class="fas fa-search"></i>
                        <input type="text" id="ventas-search" placeholder="Buscar por pedido, cliente, producto..." 
                               value="${state.filters.search}" oninput="window.VentasModule.handleSearch(this.value)">
                    </div>
                    <div class="ventas-filters">
                        <select id="ventas-filter-type" onchange="window.VentasModule.handleFilter('type', this.value)">
                            <option value="">Todos los tipos</option>
                            ${CONFIG.SALE_TYPES.map(t => 
                                `<option value="${t}" ${state.filters.type === t ? 'selected' : ''}>${t === 'ONLINE' ? '🖥️ Online' : '🏪 Físico'}</option>`
                            ).join('')}
                        </select>
                        <select id="ventas-filter-status" onchange="window.VentasModule.handleFilter('status', this.value)">
                            <option value="">Todos los estados</option>
                            ${Object.values(CONFIG.STATUS).map(s => 
                                `<option value="${s}" ${state.filters.status === s ? 'selected' : ''}>${getStatusLabel(s)}</option>`
                            ).join('')}
                        </select>
                        <select id="ventas-filter-payment" onchange="window.VentasModule.handleFilter('paymentMethod', this.value)">
                            <option value="">Todos los pagos</option>
                            ${CONFIG.PAYMENT_METHODS.map(m => 
                                `<option value="${m}" ${state.filters.paymentMethod === m ? 'selected' : ''}>${getPaymentMethodLabel(m)}</option>`
                            ).join('')}
                        </select>
                        <input type="date" id="ventas-filter-date-from" value="${state.filters.dateFrom}" 
                               onchange="window.VentasModule.handleFilter('dateFrom', this.value)">
                        <input type="date" id="ventas-filter-date-to" value="${state.filters.dateTo}" 
                               onchange="window.VentasModule.handleFilter('dateTo', this.value)">
                        <input type="number" id="ventas-filter-min-total" value="${state.filters.minTotal}" 
                               onchange="window.VentasModule.handleFilter('minTotal', this.value)" placeholder="Mín $">
                        <input type="number" id="ventas-filter-max-total" value="${state.filters.maxTotal}" 
                               onchange="window.VentasModule.handleFilter('maxTotal', this.value)" placeholder="Máx $">
                        <button class="ventas-btn ventas-btn-sm ventas-btn-outline" onclick="window.VentasModule.clearFilters()">
                            <i class="fas fa-times"></i> Limpiar
                        </button>
                    </div>
                </div>

                <div class="ventas-table-wrapper">
                    <table class="ventas-table">
                        <thead>
                            <tr>
                                <th class="${state.sort.field === 'orderNumber' ? 'active' : ''}" 
                                    onclick="window.VentasModule.handleSort('orderNumber')">
                                    Pedido <span class="sort-icon">${state.sort.field === 'orderNumber' ? (state.sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
                                </th>
                                <th class="${state.sort.field === 'customer' ? 'active' : ''}" 
                                    onclick="window.VentasModule.handleSort('customer')">
                                    Cliente <span class="sort-icon">${state.sort.field === 'customer' ? (state.sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
                                </th>
                                <th class="${state.sort.field === 'date' ? 'active' : ''}" 
                                    onclick="window.VentasModule.handleSort('date')">
                                    Fecha <span class="sort-icon">${state.sort.field === 'date' ? (state.sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
                                </th>
                                <th>Productos</th>
                                <th class="${state.sort.field === 'total' ? 'active' : ''}" 
                                    onclick="window.VentasModule.handleSort('total')">
                                    Total <span class="sort-icon">${state.sort.field === 'total' ? (state.sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
                                </th>
                                <th>Tipo</th>
                                <th>Pago</th>
                                <th class="${state.sort.field === 'status' ? 'active' : ''}" 
                                    onclick="window.VentasModule.handleSort('status')">
                                    Estado <span class="sort-icon">${state.sort.field === 'status' ? (state.sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
                                </th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pageItems.length === 0 ? `
                                <tr class="empty-row">
                                    <td colspan="9">No hay ventas para mostrar</td>
                                </tr>
                            ` : pageItems.map(sale => `
                                <tr>
                                    <td><strong>${sale.orderNumber || 'N/A'}</strong></td>
                                    <td>
                                        <strong>${sale.customer?.name || 'Cliente'}</strong>
                                        ${sale.customer?.email ? `<br><small style="color:#94a3b8;">${sale.customer.email}</small>` : ''}
                                    </td>
                                    <td>${formatDate(sale.date)}</td>
                                    <td>${sale.items?.length || 0} productos</td>
                                    <td><strong>${formatCurrency(sale.total)}</strong></td>
                                    <td><span class="${sale.type === 'ONLINE' ? 'ventas-type-online' : 'ventas-type-fisico'}">${getTypeLabel(sale.type)}</span></td>
                                    <td>${getPaymentMethodLabel(sale.paymentMethod)}</td>
                                    <td>
                                        <span class="ventas-badge ${getStatusBadgeClass(sale.status)}">
                                            ${getStatusLabel(sale.status)}
                                        </span>
                                    </td>
                                    <td>
                                        <div class="actions">
                                            <button class="ventas-btn ventas-btn-primary ventas-btn-xs" 
                                                    onclick="window.VentasModule.viewSale('${sale.id}')">
                                                <i class="fas fa-eye"></i>
                                            </button>
                                            <button class="ventas-btn ventas-btn-warning ventas-btn-xs" 
                                                    onclick="window.VentasModule.editSale('${sale.id}')">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button class="ventas-btn ventas-btn-danger ventas-btn-xs" 
                                                    onclick="window.VentasModule.deleteSale('${sale.id}')">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                            <button class="ventas-btn ventas-btn-success ventas-btn-xs" 
                                                    onclick="window.VentasModule.changeSaleStatus('${sale.id}', 'completado')">
                                                <i class="fas fa-check"></i>
                                            </button>
                                            <button class="ventas-btn ventas-btn-outline ventas-btn-xs" 
                                                    onclick="window.VentasModule.printInvoice('${sale.id}')">
                                                <i class="fas fa-print"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <div class="ventas-pagination">
                    <div class="info">
                        Mostrando ${totalFiltered > 0 ? start + 1 : 0} - ${end} de ${totalFiltered} ventas
                    </div>
                    <div class="controls">
                        <select onchange="window.VentasModule.setPageSize(this.value)">
                            ${CONFIG.PAGE_SIZES.map(size => 
                                `<option value="${size}" ${pageSize === size ? 'selected' : ''}>${size}</option>`
                            ).join('')}
                        </select>
                        <button onclick="window.VentasModule.goToPage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <span class="page-info">${page} / ${totalPages}</span>
                        <button onclick="window.VentasModule.goToPage(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        updateSyncStatus();
    }

    // ============================================================
    // 13. MODAL CON BÚSQUEDA DE CLIENTES Y PRODUCTOS
    // ============================================================
    function showSaleForm(type, saleId) {
        const isEdit = !!saleId;
        const sale = isEdit ? state.sales.find(s => s.id === saleId) : null;

        const modal = document.createElement('div');
        modal.className = 'ventas-modal-overlay';
        modal.id = 'ventas-modal';
        modal.innerHTML = `
            <div class="ventas-modal">
                <div class="ventas-modal-header">
                    <h3>${isEdit ? 'Editar Venta' : `${type === 'ONLINE' ? '🖥️ Venta Online' : '🏪 Venta Física'}`}</h3>
                    <button class="close-btn" onclick="window.VentasModule.closeModal()">&times;</button>
                </div>
                <form id="ventas-form">
                    <!-- CLIENTE CON BÚSQUEDA -->
                    <div class="form-group">
                        <label>Cliente <span class="required">*</span></label>
                        <div class="ventas-customer-search">
                            <input type="text" class="form-control" id="venta-cliente-search" 
                                   placeholder="Buscar cliente por nombre, email o teléfono..."
                                   value="${sale?.customer?.name || ''}"
                                   autocomplete="off">
                            <div class="search-results" id="customer-results"></div>
                        </div>
                        <input type="hidden" id="venta-cliente-id" value="${sale?.customer?.id || ''}">
                        <input type="hidden" id="venta-cliente-email" value="${sale?.customer?.email || ''}">
                        <input type="hidden" id="venta-cliente-phone" value="${sale?.customer?.phone || ''}">
                        <div id="venta-cliente-selected" style="margin-top:6px;font-size:13px;color:var(--ventas-gray-500);">
                            ${sale?.customer?.name ? `✅ ${sale.customer.name} ${sale.customer.email ? `(${sale.customer.email})` : ''}` : 'No hay cliente seleccionado'}
                        </div>
                    </div>

                    <!-- PRODUCTOS CON BÚSQUEDA -->
                    <div class="form-group">
                        <label>Agregar Producto</label>
                        <div class="ventas-product-search">
                            <input type="text" class="form-control" id="venta-product-search" 
                                   placeholder="Buscar producto por nombre o código..."
                                   autocomplete="off">
                            <div class="product-results" id="product-results"></div>
                        </div>
                    </div>

                    <!-- LISTA DE PRODUCTOS SELECCIONADOS -->
                    <div class="form-group">
                        <label>Productos Seleccionados <span class="required">*</span></label>
                        <div class="ventas-products-container" id="venta-productos-container">
                            ${(sale?.items || []).map((item, index) => `
                                <div class="ventas-product-item" data-index="${index}">
                                    <div class="product-info">
                                        <span class="name">${item.name || 'Producto'}</span>
                                        <span class="code">ID: ${item.id || ''}</span>
                                    </div>
                                    <input type="number" class="product-quantity" value="${item.quantity || 1}" min="1" step="1">
                                    <input type="number" class="product-price" value="${item.price || 0}" min="0" step="0.01" placeholder="Precio">
                                    <span class="product-total">${formatCurrency((item.price || 0) * (item.quantity || 1))}</span>
                                    <button type="button" class="remove-product" ${sale?.items?.length <= 1 && index === 0 ? 'style="display:none;"' : ''}>
                                        <i class="fas fa-times"></i>
                                    </button>
                                    <input type="hidden" class="product-id" value="${item.id || ''}">
                                </div>
                            `).join('')}
                        </div>
                        ${(!sale?.items || sale.items.length === 0) ? `
                            <div style="text-align:center;padding:20px;color:var(--ventas-gray-400);font-size:13px;">
                                <i class="fas fa-box"></i> Busca y agrega productos arriba
                            </div>
                        ` : ''}
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label>Método de Pago</label>
                            <select class="form-control" id="venta-pago">
                                ${CONFIG.PAYMENT_METHODS.map(m => `
                                    <option value="${m}" ${sale?.paymentMethod === m ? 'selected' : ''}>
                                        ${getPaymentMethodLabel(m)}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Envío</label>
                            <input type="number" step="0.01" class="form-control" id="venta-envio" 
                                   value="${sale?.shipping || 0}" placeholder="0.00">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label>Subtotal</label>
                            <input type="text" class="form-control" id="venta-subtotal" 
                                   value="${formatCurrency(sale?.subtotal || 0)}" readonly style="background:#f1f5f9;">
                        </div>
                        <div class="form-group">
                            <label>Total</label>
                            <input type="text" class="form-control" id="venta-total" 
                                   value="${formatCurrency(sale?.total || 0)}" readonly style="background:#f1f5f9;font-weight:bold;">
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Notas</label>
                        <textarea class="form-control" id="venta-notas" rows="2">${sale?.notes || ''}</textarea>
                    </div>

                    ${isEdit ? `
                        <div class="form-group">
                            <label>Estado</label>
                            <select class="form-control" id="venta-estado">
                                ${Object.values(CONFIG.STATUS).map(s => `
                                    <option value="${s}" ${sale?.status === s ? 'selected' : ''}>
                                        ${getStatusLabel(s)}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                    ` : ''}

                    <div class="form-actions">
                        <button type="button" class="ventas-btn ventas-btn-outline" onclick="window.VentasModule.closeModal()">Cancelar</button>
                        <button type="submit" class="ventas-btn ventas-btn-success">
                            <i class="fas fa-save"></i> ${isEdit ? 'Actualizar' : 'Guardar Venta'}
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        // ============================================================
        // CONFIGURAR BÚSQUEDA DE CLIENTES
        // ============================================================
        const customerSearch = document.getElementById('venta-cliente-search');
        const customerResults = document.getElementById('customer-results');
        const customerSelected = document.getElementById('venta-cliente-selected');
        const customerIdInput = document.getElementById('venta-cliente-id');
        const customerEmailInput = document.getElementById('venta-cliente-email');
        const customerPhoneInput = document.getElementById('venta-cliente-phone');

        let selectedCustomer = null;
        if (sale?.customer) {
            selectedCustomer = sale.customer;
            customerSelected.textContent = `✅ ${sale.customer.name} ${sale.customer.email ? `(${sale.customer.email})` : ''}`;
            customerIdInput.value = sale.customer.id || '';
            customerEmailInput.value = sale.customer.email || '';
            customerPhoneInput.value = sale.customer.phone || '';
        }

        const debouncedCustomerSearch = debounce(function(query) {
            const results = searchCustomers(query);
            if (results.length === 0) {
                customerResults.innerHTML = `<div class="no-results">No se encontraron clientes</div>`;
                customerResults.classList.add('show');
                return;
            }
            customerResults.innerHTML = results.map(c => `
                <div class="result-item" data-id="${c.id}" data-name="${c.displayName || c.name || c.fullName || 'Cliente'}" 
                     data-email="${c.email || ''}" data-phone="${c.phone || ''}">
                    <div>
                        <div class="name">${c.displayName || c.name || c.fullName || 'Cliente'}</div>
                        <div class="email">${c.email || ''} ${c.phone ? `📱 ${c.phone}` : ''}</div>
                    </div>
                    <span class="badge">${c.role || 'cliente'}</span>
                </div>
            `).join('');
            customerResults.classList.add('show');
        }, CONFIG.DEBOUNCE_DELAY);

        customerSearch.addEventListener('input', function() {
            const query = this.value.trim();
            if (query.length < 1) {
                customerResults.classList.remove('show');
                return;
            }
            debouncedCustomerSearch(query);
        });

        customerSearch.addEventListener('focus', function() {
            if (this.value.trim().length > 0) {
                debouncedCustomerSearch(this.value.trim());
            }
        });

        customerResults.addEventListener('click', function(e) {
            const item = e.target.closest('.result-item');
            if (!item) return;
            const id = item.dataset.id;
            const name = item.dataset.name;
            const email = item.dataset.email;
            const phone = item.dataset.phone;
            
            selectedCustomer = { id, name, email, phone };
            customerSearch.value = name;
            customerSelected.textContent = `✅ ${name} ${email ? `(${email})` : ''}`;
            customerIdInput.value = id;
            customerEmailInput.value = email;
            customerPhoneInput.value = phone;
            customerResults.classList.remove('show');
        });

        document.addEventListener('click', function(e) {
            if (!e.target.closest('.ventas-customer-search')) {
                customerResults.classList.remove('show');
            }
        });

        // ============================================================
        // CONFIGURAR BÚSQUEDA DE PRODUCTOS
        // ============================================================
        const productSearch = document.getElementById('venta-product-search');
        const productResults = document.getElementById('product-results');
        const productsContainer = document.getElementById('venta-productos-container');

        const debouncedProductSearch = debounce(function(query) {
            const results = searchProducts(query);
            if (results.length === 0) {
                productResults.innerHTML = `<div class="no-results">No se encontraron productos</div>`;
                productResults.classList.add('show');
                return;
            }
            productResults.innerHTML = results.map(p => {
                const stock = getProductStock(p.id);
                const stockClass = stock <= (p.minStock || 5) ? 'low' : '';
                return `
                    <div class="result-item" data-id="${p.id}" data-name="${p.name}" 
                         data-price="${p.price || 0}" data-code="${p.code || ''}" data-stock="${stock}">
                        <div>
                            <div class="name">${p.name}</div>
                            <div class="code">${p.code || ''} ${p.category ? `· ${p.category}` : ''}</div>
                        </div>
                        <div style="text-align:right;">
                            <div class="price">${formatCurrency(p.price || 0)}</div>
                            <span class="stock ${stockClass}">Stock: ${stock}</span>
                        </div>
                    </div>
                `;
            }).join('');
            productResults.classList.add('show');
        }, CONFIG.DEBOUNCE_DELAY);

        productSearch.addEventListener('input', function() {
            const query = this.value.trim();
            if (query.length < 1) {
                productResults.classList.remove('show');
                return;
            }
            debouncedProductSearch(query);
        });

        productSearch.addEventListener('focus', function() {
            if (this.value.trim().length > 0) {
                debouncedProductSearch(this.value.trim());
            }
        });

        productResults.addEventListener('click', function(e) {
            const item = e.target.closest('.result-item');
            if (!item) return;
            const id = item.dataset.id;
            const name = item.dataset.name;
            const price = parseFloat(item.dataset.price) || 0;
            const stock = parseInt(item.dataset.stock) || 0;

            if (stock <= 0) {
                showToast('Producto sin stock disponible', 'warning');
                return;
            }

            const existing = productsContainer.querySelector(`.ventas-product-item .product-id[value="${id}"]`);
            if (existing) {
                showToast('Producto ya agregado', 'warning');
                productResults.classList.remove('show');
                productSearch.value = '';
                return;
            }

            addProductRow(id, name, price);
            productSearch.value = '';
            productResults.classList.remove('show');
            calculateTotals();
        });

        document.addEventListener('click', function(e) {
            if (!e.target.closest('.ventas-product-search')) {
                productResults.classList.remove('show');
            }
        });

        // ============================================================
        // FUNCIONES DEL MODAL
        // ============================================================
        function addProductRow(id, name, price) {
            const container = document.getElementById('venta-productos-container');
            const emptyMsg = container.querySelector('div[style*="text-align:center"]');
            if (emptyMsg) emptyMsg.remove();

            const template = document.createElement('div');
            template.className = 'ventas-product-item';
            template.innerHTML = `
                <div class="product-info">
                    <span class="name">${name}</span>
                    <span class="code">ID: ${id}</span>
                </div>
                <input type="number" class="product-quantity" value="1" min="1" step="1">
                <input type="number" class="product-price" value="${price}" min="0" step="0.01">
                <span class="product-total">${formatCurrency(price)}</span>
                <button type="button" class="remove-product"><i class="fas fa-times"></i></button>
                <input type="hidden" class="product-id" value="${id}">
            `;
            container.appendChild(template);

            const qty = template.querySelector('.product-quantity');
            const priceInput = template.querySelector('.product-price');
            const remove = template.querySelector('.remove-product');
            const total = template.querySelector('.product-total');

            qty.addEventListener('input', calculateTotals);
            priceInput.addEventListener('input', calculateTotals);
            remove.addEventListener('click', function() {
                if (container.querySelectorAll('.ventas-product-item').length > 1) {
                    this.closest('.ventas-product-item').remove();
                    calculateTotals();
                } else {
                    showToast('Debe tener al menos un producto', 'warning');
                }
            });

            calculateTotals();
        }

        function calculateTotals() {
            let subtotal = 0;
            document.querySelectorAll('.ventas-product-item').forEach(item => {
                const qty = parseFloat(item.querySelector('.product-quantity').value) || 0;
                const price = parseFloat(item.querySelector('.product-price').value) || 0;
                const total = qty * price;
                subtotal += total;
                const totalSpan = item.querySelector('.product-total');
                if (totalSpan) totalSpan.textContent = formatCurrency(total);
            });

            const shipping = parseFloat(document.getElementById('venta-envio').value) || 0;
            const total = subtotal + shipping;

            document.getElementById('venta-subtotal').value = formatCurrency(subtotal);
            document.getElementById('venta-total').value = formatCurrency(total);
        }

        document.getElementById('venta-envio').addEventListener('input', calculateTotals);
        setTimeout(calculateTotals, 100);

        // ============================================================
        // SUBMIT DEL FORMULARIO
        // ============================================================
        document.getElementById('ventas-form').addEventListener('submit', function(e) {
            e.preventDefault();

            const items = [];
            document.querySelectorAll('.ventas-product-item').forEach(item => {
                const id = item.querySelector('.product-id').value;
                const name = item.querySelector('.product-info .name').textContent;
                const qty = parseFloat(item.querySelector('.product-quantity').value) || 0;
                const price = parseFloat(item.querySelector('.product-price').value) || 0;
                if (id && qty > 0 && price > 0) {
                    items.push({ id, name, quantity: qty, price });
                }
            });

            if (items.length === 0) {
                showToast('Agregue al menos un producto', 'error');
                return;
            }

            const customerName = document.getElementById('venta-cliente-search').value.trim();
            if (!customerName) {
                showToast('Ingrese un cliente', 'error');
                return;
            }

            const data = {
                customer: {
                    id: document.getElementById('venta-cliente-id').value || '',
                    name: customerName,
                    email: document.getElementById('venta-cliente-email').value || '',
                    phone: document.getElementById('venta-cliente-phone').value || ''
                },
                paymentMethod: document.getElementById('venta-pago').value,
                items: items,
                shipping: parseFloat(document.getElementById('venta-envio').value) || 0,
                notes: document.getElementById('venta-notas').value || '',
                status: document.getElementById('venta-estado')?.value || CONFIG.STATUS.PENDING
            };

            if (!data.customer.id && data.customer.name) {
                const existing = state.customers.find(c => 
                    (c.displayName || c.name || '').toLowerCase() === data.customer.name.toLowerCase()
                );
                if (existing) {
                    data.customer.id = existing.id;
                    data.customer.email = data.customer.email || existing.email || '';
                    data.customer.phone = data.customer.phone || existing.phone || '';
                }
            }

            if (isEdit) {
                updateSale(saleId, data);
            } else {
                data.type = type;
                createSale(data);
            }
            closeModal();
        });
    }

    // ============================================================
    // 14. VER VENTA
    // ============================================================
    function viewSale(id) {
        const sale = state.sales.find(s => s.id === id);
        if (!sale) {
            showToast('Venta no encontrada', 'warning');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'ventas-modal-overlay';
        modal.id = 'ventas-modal';
        modal.innerHTML = `
            <div class="ventas-modal">
                <div class="ventas-modal-header">
                    <h3>Detalle de Venta</h3>
                    <button class="close-btn" onclick="window.VentasModule.closeModal()">&times;</button>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div><strong>Pedido:</strong> ${sale.orderNumber}</div>
                    <div><strong>Fecha:</strong> ${formatDate(sale.date)}</div>
                    <div><strong>Cliente:</strong> ${sale.customer?.name || 'Cliente'}</div>
                    <div><strong>Email:</strong> ${sale.customer?.email || 'N/A'}</div>
                    <div><strong>Teléfono:</strong> ${sale.customer?.phone || 'N/A'}</div>
                    <div><strong>Método Pago:</strong> ${getPaymentMethodLabel(sale.paymentMethod)}</div>
                    <div><strong>Tipo:</strong> ${getTypeLabel(sale.type)}</div>
                    <div><strong>Estado:</strong> <span class="ventas-badge ${getStatusBadgeClass(sale.status)}">${getStatusLabel(sale.status)}</span></div>
                </div>
                <hr>
                <h6>Productos</h6>
                <table class="ventas-table" style="font-size:13px;">
                    <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Total</th></tr></thead>
                    <tbody>
                        ${(sale.items || []).map(item => `
                            <tr>
                                <td>${item.name || 'Producto'}</td>
                                <td>${item.quantity}</td>
                                <td>${formatCurrency(item.price)}</td>
                                <td>${formatCurrency(item.price * item.quantity)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr><td colspan="3" style="text-align:right;"><strong>Subtotal:</strong></td><td>${formatCurrency(sale.subtotal)}</td></tr>
                        <tr><td colspan="3" style="text-align:right;"><strong>Envío:</strong></td><td>${formatCurrency(sale.shipping)}</td></tr>
                        <tr class="total-row"><td colspan="3" style="text-align:right;"><strong>TOTAL:</strong></td><td><strong>${formatCurrency(sale.total)}</strong></td></tr>
                    </tfoot>
                </table>
                ${sale.notes ? `<p><strong>Notas:</strong> ${sale.notes}</p>` : ''}
                <div class="form-actions">
                    <button class="ventas-btn ventas-btn-primary" onclick="window.VentasModule.editSale('${sale.id}'); window.VentasModule.closeModal();">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="ventas-btn ventas-btn-outline" onclick="window.VentasModule.printInvoice('${sale.id}')">
                        <i class="fas fa-print"></i> Factura
                    </button>
                    <button class="ventas-btn ventas-btn-outline" onclick="window.VentasModule.closeModal()">Cerrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    function editSale(id) {
        const sale = state.sales.find(s => s.id === id);
        if (!sale) {
            showToast('Venta no encontrada', 'warning');
            return;
        }
        showSaleForm(sale.type, id);
    }

    function closeModal() {
        const modal = document.getElementById('ventas-modal');
        if (modal) modal.remove();
    }

    // ============================================================
    // 15. FACTURA / IMPRESIÓN
    // ============================================================
    function printInvoice(id) {
        const sale = state.sales.find(s => s.id === id);
        if (!sale) {
            showToast('Venta no encontrada', 'warning');
            return;
        }

        const printWindow = window.open('', '_blank', 'width=600,height=800');
        if (!printWindow) {
            showToast('Por favor, permite ventanas emergentes', 'warning');
            return;
        }

        const itemsHtml = (sale.items || []).map(item => `
            <tr>
                <td>${item.name || 'Producto'}</td>
                <td style="text-align:center;">${item.quantity}</td>
                <td style="text-align:right;">${formatCurrency(item.price)}</td>
                <td style="text-align:right;">${formatCurrency(item.price * item.quantity)}</td>
            </tr>
        `).join('');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Factura ${sale.orderNumber}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: auto; }
                    h1 { color: #0f3460; text-align: center; border-bottom: 2px solid #0f3460; padding-bottom: 10px; }
                    .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
                    .header div { font-size: 14px; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th { background: #0f3460; color: white; padding: 8px; text-align: left; }
                    td { padding: 8px; border-bottom: 1px solid #ddd; }
                    .total-row { font-weight: bold; background: #f1f5f9; }
                    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #64748b; border-top: 1px solid #ddd; padding-top: 20px; }
                </style>
            </head>
            <body>
                <h1>🧾 FACTURA</h1>
                <div class="header">
                    <div>
                        <strong>${sale.orderNumber}</strong><br>
                        ${formatDate(sale.date)}
                    </div>
                    <div style="text-align:right;">
                        <strong>${sale.customer?.name || 'Cliente'}</strong><br>
                        ${sale.customer?.email || ''}<br>
                        ${sale.customer?.phone || ''}
                    </div>
                </div>
                <table>
                    <thead><tr><th>Producto</th><th style="text-align:center;">Cant.</th><th style="text-align:right;">Precio</th><th style="text-align:right;">Total</th></tr></thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                    <tfoot>
                        <tr><td colspan="3" style="text-align:right;"><strong>Subtotal:</strong></td><td style="text-align:right;">${formatCurrency(sale.subtotal)}</td></tr>
                        <tr><td colspan="3" style="text-align:right;"><strong>Envío:</strong></td><td style="text-align:right;">${formatCurrency(sale.shipping)}</td></tr>
                        <tr class="total-row"><td colspan="3" style="text-align:right;"><strong>TOTAL:</strong></td><td style="text-align:right;">${formatCurrency(sale.total)}</td></tr>
                    </tfoot>
                </table>
                ${sale.notes ? `<p><strong>Notas:</strong> ${sale.notes}</p>` : ''}
                <div class="footer">
                    <p>¡Gracias por tu compra!</p>
                    <p>K'A Boutique - ${new Date().getFullYear()}</p>
                </div>
                <script>
                    window.onload = function() { window.print(); }
                <\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    // ============================================================
    // 16. EXPORTAR CSV
    // ============================================================
    function exportCSV() {
        const items = getFilteredSales();
        
        if (items.length === 0) {
            showToast('No hay datos para exportar', 'warning');
            return;
        }

        const headers = ['Pedido', 'Cliente', 'Email', 'Teléfono', 'Fecha', 'Tipo', 'Método Pago', 'Subtotal', 'Envío', 'Total', 'Estado', 'Productos'];
        const rows = items.map(s => [
            s.orderNumber || '',
            s.customer?.name || '',
            s.customer?.email || '',
            s.customer?.phone || '',
            formatDate(s.date),
            s.type || '',
            getPaymentMethodLabel(s.paymentMethod),
            (s.subtotal || 0).toFixed(2),
            (s.shipping || 0).toFixed(2),
            (s.total || 0).toFixed(2),
            getStatusLabel(s.status),
            (s.items || []).map(i => `${i.name} x${i.quantity}`).join('; ')
        ]);

        let csv = headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `ventas_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast(`Exportados ${items.length} registros`, 'success');
    }

    // ============================================================
    // 17. FUNCIONES PÚBLICAS
    // ============================================================
    function render(containerElement) {
        if (!containerElement) {
            console.error('Ventas: container no proporcionado');
            return;
        }

        state.container = containerElement;
        injectStyles();
        loadFromCache();

        const db = getFirebaseDb();
        if (db) {
            setupFirebaseListeners();
        } else {
            state.metadata.syncStatus = 'offline';
            updateSyncStatus();
            showToast('Modo offline - datos locales', 'warning');
        }

        renderUI();
        updateSyncStatus();
        showToast('Módulo Ventas cargado', 'info');
    }

    function refresh() {
        loadFromCache();
        const db = getFirebaseDb();
        if (db) {
            setupFirebaseListeners();
        }
        renderUI();
        showToast('Datos actualizados', 'success');
    }

    function getSales() {
        return [...state.sales];
    }

    function destroy() {
        if (state.unsubscribeSales) {
            state.unsubscribeSales();
            state.unsubscribeSales = null;
        }
        if (state.unsubscribeProducts) {
            state.unsubscribeProducts();
            state.unsubscribeProducts = null;
        }
        if (state.unsubscribeUsers) {
            state.unsubscribeUsers();
            state.unsubscribeUsers = null;
        }
        if (state.container) {
            state.container.innerHTML = '';
        }
        state.sales = [];
        state.container = null;
        showToast('Módulo Ventas destruido', 'info');
    }

    // ============================================================
    // 18. EXPOSICIÓN DEL MÓDULO
    // ============================================================
    window.VentasModule = {
        render: render,
        refresh: refresh,
        showSaleForm: showSaleForm,
        editSale: editSale,
        viewSale: viewSale,
        changeSaleStatus: changeSaleStatus,
        deleteSale: deleteSale,
        getSales: getSales,
        syncNow: syncNow,
        destroy: destroy,
        exportCSV: exportCSV,
        printInvoice: printInvoice,
        
        handleSearch: function(value) {
            state.filters.search = value;
            state.pagination.page = 1;
            renderUI();
        },
        handleFilter: function(field, value) {
            state.filters[field] = value;
            state.pagination.page = 1;
            renderUI();
        },
        clearFilters: function() {
            state.filters = {
                search: '',
                type: '',
                paymentMethod: '',
                status: '',
                dateFrom: '',
                dateTo: '',
                minTotal: '',
                maxTotal: '',
                customer: ''
            };
            state.pagination.page = 1;
            renderUI();
            showToast('Filtros limpiados', 'info');
        },
        handleSort: function(field) {
            if (state.sort.field === field) {
                state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                state.sort.field = field;
                state.sort.direction = 'asc';
            }
            renderUI();
        },
        goToPage: function(page) {
            const totalPages = Math.ceil(state.pagination.total / state.pagination.pageSize) || 1;
            if (page < 1 || page > totalPages) return;
            state.pagination.page = page;
            renderUI();
        },
        setPageSize: function(size) {
            state.pagination.pageSize = parseInt(size);
            state.pagination.page = 1;
            renderUI();
        },
        closeModal: closeModal,
        
        getState: function() { return { ...state }; }
    };

    console.log('✅ Módulo Ventas v3.1 cargado correctamente');
    console.log(`📋 ${state.sales.length} ventas, ${state.customers.length} clientes, ${state.products.length} productos`);

})();