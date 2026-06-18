/**
 * ============================================================
 * kardex.js - Módulo de Gestión de Inventario (Kardex)
 * Versión 2.0 - Profesional y Autónomo
 * ============================================================
 * 
 * Características:
 * - CRUD completo de productos y movimientos
 * - Sincronización en tiempo real con Firebase
 * - Caché local (localStorage) para modo offline
 * - Búsqueda y filtros avanzados
 * - Ordenamiento y paginación
 * - Interfaz moderna basada en tablas
 * - Sin dependencias externas (solo Firebase SDK)
 * - Auto-contenido en un solo archivo
 * ============================================================
 */

(function() {
    'use strict';

    // ============================================================
    // 1. CONFIGURACIÓN Y CONSTANTES
    // ============================================================
    const CONFIG = {
        STORAGE_KEY_PRODUCTS: 'kardex_products',
        STORAGE_KEY_MOVEMENTS: 'kardex_movements',
        STORAGE_KEY_METADATA: 'kardex_metadata',
        PAGE_SIZE: 20,
        PAGE_SIZES: [10, 20, 50, 100],
        DEBOUNCE_DELAY: 300,
        STATUS: {
            REGISTERED: 'REGISTRADO',
            CONFIRMED: 'CONFIRMADO',
            CANCELLED: 'ANULADO'
        },
        MOVEMENT_TYPES: ['ENTRADA', 'SALIDA', 'AJUSTE', 'DEVOLUCIÓN']
    };

    // ============================================================
    // 2. ESTADO INTERNO
    // ============================================================
    let state = {
        // Datos
        products: [],
        movements: [],
        metadata: {
            lastSync: null,
            syncStatus: 'idle', // idle, syncing, online, offline, error
            version: 1
        },
        
        // UI State
        currentTab: 'movements',
        filters: {
            search: '',
            movementType: '',
            productId: '',
            dateFrom: '',
            dateTo: '',
            minStock: '',
            maxStock: ''
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
        
        // Referencias
        container: null,
        firebaseDb: null,
        productsRef: null,
        movementsRef: null,
        unsubscribeProducts: null,
        unsubscribeMovements: null,
        syncTimer: null,
        isSyncing: false
    };

    // ============================================================
    // 3. ESTILOS CSS (Inyectados dinámicamente)
    // ============================================================
    const CSS_STYLES = `
        /* ============================================================
           KARDEX MODULE STYLES
           ============================================================ */
        
        /* Variables de color */
        :root {
            --kardex-primary: #0f3460;
            --kardex-primary-dark: #0a2647;
            --kardex-primary-light: #1a4a7a;
            --kardex-secondary: #e94560;
            --kardex-success: #059669;
            --kardex-success-light: #d1fae5;
            --kardex-danger: #dc2626;
            --kardex-danger-light: #fee2e2;
            --kardex-warning: #d97706;
            --kardex-warning-light: #fef3c7;
            --kardex-gray-50: #f8fafc;
            --kardex-gray-100: #f1f5f9;
            --kardex-gray-200: #e2e8f0;
            --kardex-gray-300: #cbd5e1;
            --kardex-gray-400: #94a3b8;
            --kardex-gray-500: #64748b;
            --kardex-gray-600: #475569;
            --kardex-gray-700: #334155;
            --kardex-gray-800: #1e293b;
            --kardex-gray-900: #0f172a;
            --kardex-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
            --kardex-shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
            --kardex-shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
            --kardex-radius: 8px;
            --kardex-radius-lg: 12px;
        }

        /* Contenedor principal */
        .kardex-container {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            color: var(--kardex-gray-800);
            background: var(--kardex-gray-50);
            padding: 20px;
            border-radius: var(--kardex-radius-lg);
            max-width: 100%;
        }

        /* Header */
        .kardex-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 2px solid var(--kardex-gray-200);
        }
        .kardex-header-title {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 20px;
            font-weight: 700;
            color: var(--kardex-primary);
        }
        .kardex-header-title i {
            font-size: 24px;
            color: var(--kardex-secondary);
        }
        .kardex-header-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        /* Barra de herramientas */
        .kardex-toolbar {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 16px;
            align-items: center;
            background: white;
            padding: 12px 16px;
            border-radius: var(--kardex-radius);
            box-shadow: var(--kardex-shadow);
        }
        .kardex-toolbar .kardex-search {
            flex: 1;
            min-width: 200px;
            position: relative;
        }
        .kardex-toolbar .kardex-search input {
            width: 100%;
            padding: 8px 12px 8px 36px;
            border: 1px solid var(--kardex-gray-300);
            border-radius: var(--kardex-radius);
            font-size: 14px;
            transition: border-color 0.3s;
        }
        .kardex-toolbar .kardex-search input:focus {
            outline: none;
            border-color: var(--kardex-primary);
            box-shadow: 0 0 0 3px rgba(15, 52, 96, 0.1);
        }
        .kardex-toolbar .kardex-search i {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--kardex-gray-400);
        }
        .kardex-toolbar .kardex-filters {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            align-items: center;
        }
        .kardex-toolbar .kardex-filters select,
        .kardex-toolbar .kardex-filters input[type="date"] {
            padding: 8px 12px;
            border: 1px solid var(--kardex-gray-300);
            border-radius: var(--kardex-radius);
            font-size: 13px;
            background: white;
            min-width: 130px;
        }
        .kardex-toolbar .kardex-filters select:focus,
        .kardex-toolbar .kardex-filters input:focus {
            outline: none;
            border-color: var(--kardex-primary);
        }

        /* Botones */
        .kardex-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            border: none;
            border-radius: var(--kardex-radius);
            font-weight: 600;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.3s;
            text-decoration: none;
        }
        .kardex-btn:hover {
            transform: translateY(-1px);
            box-shadow: var(--kardex-shadow);
        }
        .kardex-btn-primary {
            background: var(--kardex-primary);
            color: white;
        }
        .kardex-btn-primary:hover {
            background: var(--kardex-primary-light);
        }
        .kardex-btn-success {
            background: var(--kardex-success);
            color: white;
        }
        .kardex-btn-success:hover {
            background: #047857;
        }
        .kardex-btn-danger {
            background: var(--kardex-danger);
            color: white;
        }
        .kardex-btn-danger:hover {
            background: #b91c1c;
        }
        .kardex-btn-warning {
            background: var(--kardex-warning);
            color: white;
        }
        .kardex-btn-warning:hover {
            background: #b45309;
        }
        .kardex-btn-outline {
            background: transparent;
            color: var(--kardex-primary);
            border: 2px solid var(--kardex-primary);
        }
        .kardex-btn-outline:hover {
            background: var(--kardex-primary);
            color: white;
        }
        .kardex-btn-sm {
            padding: 4px 10px;
            font-size: 12px;
        }
        .kardex-btn-xs {
            padding: 2px 8px;
            font-size: 11px;
        }
        .kardex-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none !important;
        }

        /* Resumen */
        .kardex-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 12px;
            margin-bottom: 16px;
        }
        .kardex-summary-item {
            background: white;
            padding: 12px 16px;
            border-radius: var(--kardex-radius);
            box-shadow: var(--kardex-shadow);
            text-align: center;
        }
        .kardex-summary-item .value {
            font-size: 20px;
            font-weight: 700;
            color: var(--kardex-primary);
        }
        .kardex-summary-item .label {
            font-size: 12px;
            color: var(--kardex-gray-500);
            margin-top: 2px;
        }
        .kardex-summary-item .value.success {
            color: var(--kardex-success);
        }
        .kardex-summary-item .value.danger {
            color: var(--kardex-danger);
        }
        .kardex-summary-item .value.warning {
            color: var(--kardex-warning);
        }

        /* Tabs */
        .kardex-tabs {
            display: flex;
            gap: 4px;
            border-bottom: 2px solid var(--kardex-gray-200);
            margin-bottom: 16px;
        }
        .kardex-tab {
            padding: 10px 20px;
            border: none;
            background: transparent;
            font-weight: 600;
            font-size: 14px;
            color: var(--kardex-gray-500);
            cursor: pointer;
            border-bottom: 3px solid transparent;
            transition: all 0.3s;
        }
        .kardex-tab:hover {
            color: var(--kardex-primary);
            background: var(--kardex-gray-50);
        }
        .kardex-tab.active {
            color: var(--kardex-primary);
            border-bottom-color: var(--kardex-secondary);
        }
        .kardex-tab .badge {
            background: var(--kardex-gray-200);
            color: var(--kardex-gray-600);
            padding: 1px 8px;
            border-radius: 12px;
            font-size: 11px;
            margin-left: 6px;
        }
        .kardex-tab.active .badge {
            background: var(--kardex-primary);
            color: white;
        }

        /* Tabla */
        .kardex-table-wrapper {
            overflow-x: auto;
            background: white;
            border-radius: var(--kardex-radius);
            box-shadow: var(--kardex-shadow);
        }
        .kardex-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }
        .kardex-table th {
            background: var(--kardex-primary);
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
        .kardex-table th:hover {
            background: var(--kardex-primary-light);
        }
        .kardex-table th .sort-icon {
            margin-left: 4px;
            opacity: 0.5;
        }
        .kardex-table th.active .sort-icon {
            opacity: 1;
        }
        .kardex-table td {
            padding: 8px 14px;
            border-bottom: 1px solid var(--kardex-gray-200);
            vertical-align: middle;
        }
        .kardex-table tbody tr:hover {
            background: var(--kardex-gray-50);
        }
        .kardex-table tbody tr:nth-child(even) {
            background: #fafbfc;
        }
        .kardex-table tbody tr:nth-child(even):hover {
            background: var(--kardex-gray-50);
        }
        .kardex-table .actions {
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
        }
        .kardex-table .empty-row td {
            text-align: center;
            color: var(--kardex-gray-400);
            padding: 40px 20px;
            font-style: italic;
        }

        /* Badges */
        .kardex-badge {
            display: inline-block;
            padding: 2px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
        }
        .kardex-badge-success {
            background: var(--kardex-success-light);
            color: #065f46;
        }
        .kardex-badge-danger {
            background: var(--kardex-danger-light);
            color: #991b1b;
        }
        .kardex-badge-warning {
            background: var(--kardex-warning-light);
            color: #92400e;
        }
        .kardex-badge-info {
            background: #dbeafe;
            color: #1e40af;
        }
        .kardex-badge-gray {
            background: var(--kardex-gray-200);
            color: var(--kardex-gray-600);
        }

        /* Stock bajo */
        .kardex-stock-low {
            color: var(--kardex-danger);
            font-weight: 700;
        }
        .kardex-stock-critical {
            color: var(--kardex-danger);
            font-weight: 700;
            animation: kardex-pulse 1.5s ease-in-out infinite;
        }
        @keyframes kardex-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        /* Paginación */
        .kardex-pagination {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
            padding: 12px 16px;
            background: white;
            border-radius: 0 0 var(--kardex-radius) var(--kardex-radius);
            border-top: 1px solid var(--kardex-gray-200);
        }
        .kardex-pagination .info {
            font-size: 13px;
            color: var(--kardex-gray-500);
        }
        .kardex-pagination .controls {
            display: flex;
            gap: 6px;
            align-items: center;
        }
        .kardex-pagination .controls select {
            padding: 4px 8px;
            border: 1px solid var(--kardex-gray-300);
            border-radius: var(--kardex-radius);
            font-size: 12px;
        }
        .kardex-pagination .controls button {
            padding: 4px 12px;
            border: 1px solid var(--kardex-gray-300);
            border-radius: var(--kardex-radius);
            background: white;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.3s;
        }
        .kardex-pagination .controls button:hover:not(:disabled) {
            background: var(--kardex-primary);
            color: white;
            border-color: var(--kardex-primary);
        }
        .kardex-pagination .controls button:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }
        .kardex-pagination .controls .page-info {
            padding: 0 8px;
            font-weight: 600;
            font-size: 14px;
        }

        /* Modal */
        .kardex-modal-overlay {
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
        .kardex-modal {
            background: white;
            border-radius: var(--kardex-radius-lg);
            padding: 30px;
            width: 100%;
            max-width: 650px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: var(--kardex-shadow-xl);
            animation: kardex-modal-in 0.3s ease;
        }
        @keyframes kardex-modal-in {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
        .kardex-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 2px solid var(--kardex-gray-200);
        }
        .kardex-modal-header h3 {
            margin: 0;
            color: var(--kardex-primary);
            font-size: 18px;
        }
        .kardex-modal-header .close-btn {
            background: none;
            border: none;
            font-size: 24px;
            color: var(--kardex-gray-400);
            cursor: pointer;
            padding: 0 4px;
            transition: color 0.3s;
        }
        .kardex-modal-header .close-btn:hover {
            color: var(--kardex-danger);
        }
        .kardex-modal .form-group {
            margin-bottom: 14px;
        }
        .kardex-modal .form-group label {
            display: block;
            font-weight: 600;
            font-size: 13px;
            color: var(--kardex-gray-700);
            margin-bottom: 4px;
        }
        .kardex-modal .form-group .required {
            color: var(--kardex-danger);
        }
        .kardex-modal .form-control {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--kardex-gray-300);
            border-radius: var(--kardex-radius);
            font-size: 14px;
            transition: border-color 0.3s;
            box-sizing: border-box;
        }
        .kardex-modal .form-control:focus {
            outline: none;
            border-color: var(--kardex-primary);
            box-shadow: 0 0 0 3px rgba(15, 52, 96, 0.1);
        }
        .kardex-modal .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
        }
        .kardex-modal .form-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 20px;
            padding-top: 16px;
            border-top: 1px solid var(--kardex-gray-200);
        }

        /* Toast Notifications */
        .kardex-toast-container {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999999;
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-width: 400px;
        }
        .kardex-toast {
            padding: 12px 20px;
            border-radius: var(--kardex-radius);
            color: white;
            font-weight: 500;
            font-size: 14px;
            box-shadow: var(--kardex-shadow-lg);
            animation: kardex-toast-in 0.3s ease;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .kardex-toast.success { background: var(--kardex-success); }
        .kardex-toast.error { background: var(--kardex-danger); }
        .kardex-toast.warning { background: var(--kardex-warning); }
        .kardex-toast.info { background: var(--kardex-primary); }
        .kardex-toast .close-toast {
            background: none;
            border: none;
            color: rgba(255,255,255,0.7);
            font-size: 18px;
            cursor: pointer;
            padding: 0 4px;
            margin-left: 12px;
        }
        .kardex-toast .close-toast:hover {
            color: white;
        }
        @keyframes kardex-toast-in {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        /* Estado de sincronización */
        .kardex-sync-status {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: var(--kardex-gray-500);
            padding: 4px 12px;
            background: white;
            border-radius: 20px;
            box-shadow: var(--kardex-shadow);
        }
        .kardex-sync-status .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            display: inline-block;
        }
        .kardex-sync-status .dot.online { background: var(--kardex-success); }
        .kardex-sync-status .dot.offline { background: var(--kardex-danger); }
        .kardex-sync-status .dot.syncing { 
            background: var(--kardex-warning);
            animation: kardex-pulse 0.8s ease-in-out infinite;
        }

        /* Responsive */
        @media (max-width: 768px) {
            .kardex-container { padding: 12px; }
            .kardex-header { flex-direction: column; align-items: stretch; }
            .kardex-header-actions { justify-content: stretch; }
            .kardex-header-actions .kardex-btn { flex: 1; justify-content: center; }
            .kardex-toolbar { flex-direction: column; }
            .kardex-toolbar .kardex-search { min-width: unset; }
            .kardex-toolbar .kardex-filters { flex-direction: column; }
            .kardex-toolbar .kardex-filters select,
            .kardex-toolbar .kardex-filters input { width: 100%; min-width: unset; }
            .kardex-modal { padding: 20px; margin: 10px; }
            .kardex-modal .form-row { grid-template-columns: 1fr; }
            .kardex-summary { grid-template-columns: repeat(2, 1fr); }
            .kardex-pagination { flex-direction: column; align-items: stretch; text-align: center; }
            .kardex-pagination .controls { justify-content: center; flex-wrap: wrap; }
            .kardex-table th,
            .kardex-table td { padding: 6px 10px; font-size: 12px; }
            .kardex-table .actions .kardex-btn { font-size: 11px; padding: 2px 6px; }
            .kardex-tabs { overflow-x: auto; flex-wrap: nowrap; }
            .kardex-tab { padding: 8px 14px; font-size: 13px; white-space: nowrap; }
        }
        @media (max-width: 480px) {
            .kardex-summary { grid-template-columns: 1fr 1fr; }
            .kardex-summary-item { padding: 8px 12px; }
            .kardex-summary-item .value { font-size: 16px; }
        }
    `;

    // ============================================================
    // 4. INYECCIÓN DE ESTILOS
    // ============================================================
    function injectStyles() {
        const styleId = 'kardex-module-styles';
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

    function getStock(productId) {
        const product = state.products.find(p => p.id === productId);
        if (!product) return 0;
        
        // Calcular stock desde movimientos
        let stock = 0;
        state.movements.forEach(m => {
            if (m.productId === productId && m.status !== CONFIG.STATUS.CANCELLED) {
                if (m.type === 'ENTRADA') stock += m.quantity;
                else if (m.type === 'SALIDA') stock -= m.quantity;
                else if (m.type === 'AJUSTE') {
                    // Ajuste: puede ser positivo o negativo
                    stock += m.quantity;
                }
            }
        });
        return Math.max(0, stock);
    }

    function calculateMovementTotals(movement) {
        const cost = movement.cost || 0;
        const price = movement.price || 0;
        const quantity = movement.quantity || 0;
        return {
            totalCost: cost * quantity,
            totalPrice: price * quantity,
            profit: (price - cost) * quantity,
            margin: price > 0 ? ((price - cost) / price) * 100 : 0
        };
    }

    function getProductName(productId) {
        const product = state.products.find(p => p.id === productId);
        return product ? product.name : 'Producto eliminado';
    }

    function getProductCode(productId) {
        const product = state.products.find(p => p.id === productId);
        return product ? product.code : '';
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
            const productsData = localStorage.getItem(CONFIG.STORAGE_KEY_PRODUCTS);
            if (productsData) {
                state.products = JSON.parse(productsData);
            }
            const movementsData = localStorage.getItem(CONFIG.STORAGE_KEY_MOVEMENTS);
            if (movementsData) {
                state.movements = JSON.parse(movementsData);
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
            localStorage.setItem(CONFIG.STORAGE_KEY_PRODUCTS, JSON.stringify(state.products));
            localStorage.setItem(CONFIG.STORAGE_KEY_MOVEMENTS, JSON.stringify(state.movements));
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

        // Limpiar listeners anteriores
        if (state.unsubscribeProducts) {
            state.unsubscribeProducts();
            state.unsubscribeProducts = null;
        }
        if (state.unsubscribeMovements) {
            state.unsubscribeMovements();
            state.unsubscribeMovements = null;
        }

        // Escuchar productos
        state.unsubscribeProducts = db.ref('products').on('value', function(snapshot) {
            const data = snapshot.val();
            if (data) {
                state.products = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
            } else {
                state.products = [];
            }
            state.metadata.lastSync = Date.now();
            state.metadata.syncStatus = 'online';
            saveToCache();
            if (state.container) {
                renderUI();
            }
            updateSyncStatus();
        }, function(error) {
            console.error('Error en productos:', error);
            state.metadata.syncStatus = 'error';
            updateSyncStatus();
            showToast('Error al sincronizar productos: ' + error.message, 'error');
        });

        // Escuchar movimientos
        state.unsubscribeMovements = db.ref('movements').on('value', function(snapshot) {
            const data = snapshot.val();
            if (data) {
                state.movements = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
            } else {
                state.movements = [];
            }
            state.metadata.lastSync = Date.now();
            state.metadata.syncStatus = 'online';
            saveToCache();
            if (state.container) {
                renderUI();
            }
            updateSyncStatus();
        }, function(error) {
            console.error('Error en movimientos:', error);
            state.metadata.syncStatus = 'error';
            updateSyncStatus();
            showToast('Error al sincronizar movimientos: ' + error.message, 'error');
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

        // Forzar re-sync
        setupFirebaseListeners();
    }

    function updateSyncStatus() {
        const statusEl = document.getElementById('kardex-sync-status');
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
    // 7. CRUD - PRODUCTOS
    // ============================================================
    function createProduct(data) {
        const db = getFirebaseDb();
        const product = {
            name: data.name.trim(),
            code: data.code ? data.code.trim() : '',
            cost: parseFloat(data.cost) || 0,
            price: parseFloat(data.price) || 0,
            minStock: parseInt(data.minStock) || 0,
            category: data.category ? data.category.trim() : '',
            description: data.description ? data.description.trim() : '',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        // Validar
        if (!product.name) {
            showToast('El nombre del producto es requerido', 'error');
            return false;
        }

        if (product.cost < 0 || product.price < 0) {
            showToast('Costos y precios no pueden ser negativos', 'error');
            return false;
        }

        // Guardar en Firebase
        if (db) {
            const ref = db.ref('products').push();
            product.id = ref.key;
            ref.set(product).then(() => {
                showToast('Producto creado correctamente', 'success');
                return true;
            }).catch(err => {
                showToast('Error al crear producto: ' + err.message, 'error');
                return false;
            });
        } else {
            // Modo offline
            product.id = generateId();
            state.products.push(product);
            saveToCache();
            renderUI();
            showToast('Producto creado (modo offline)', 'success');
            return true;
        }
        return true;
    }

    function updateProduct(id, data) {
        const db = getFirebaseDb();
        const product = state.products.find(p => p.id === id);
        if (!product) {
            showToast('Producto no encontrado', 'error');
            return false;
        }

        const updates = {
            name: data.name.trim(),
            code: data.code ? data.code.trim() : '',
            cost: parseFloat(data.cost) || 0,
            price: parseFloat(data.price) || 0,
            minStock: parseInt(data.minStock) || 0,
            category: data.category ? data.category.trim() : '',
            description: data.description ? data.description.trim() : '',
            updatedAt: Date.now()
        };

        if (!updates.name) {
            showToast('El nombre del producto es requerido', 'error');
            return false;
        }

        if (db) {
            db.ref('products/' + id).update(updates).then(() => {
                showToast('Producto actualizado', 'success');
                return true;
            }).catch(err => {
                showToast('Error al actualizar: ' + err.message, 'error');
                return false;
            });
        } else {
            Object.assign(product, updates);
            saveToCache();
            renderUI();
            showToast('Producto actualizado (modo offline)', 'success');
            return true;
        }
        return true;
    }

    function deleteProduct(id) {
        if (!confirm('¿Eliminar este producto y todos sus movimientos asociados?')) return false;

        const db = getFirebaseDb();
        const product = state.products.find(p => p.id === id);
        if (!product) {
            showToast('Producto no encontrado', 'error');
            return false;
        }

        // Verificar si tiene movimientos
        const hasMovements = state.movements.some(m => m.productId === id);
        if (hasMovements && !confirm('Este producto tiene movimientos. ¿Eliminar también los movimientos?')) {
            return false;
        }

        if (db) {
            // Eliminar producto y sus movimientos
            const updates = {};
            updates['products/' + id] = null;
            state.movements.filter(m => m.productId === id).forEach(m => {
                updates['movements/' + m.id] = null;
            });
            db.ref().update(updates).then(() => {
                showToast('Producto y movimientos eliminados', 'success');
                return true;
            }).catch(err => {
                showToast('Error al eliminar: ' + err.message, 'error');
                return false;
            });
        } else {
            // Modo offline
            state.products = state.products.filter(p => p.id !== id);
            state.movements = state.movements.filter(m => m.productId !== id);
            saveToCache();
            renderUI();
            showToast('Producto eliminado (modo offline)', 'success');
            return true;
        }
        return true;
    }

    // ============================================================
    // 8. CRUD - MOVIMIENTOS
    // ============================================================
    function createMovement(data) {
        const db = getFirebaseDb();
        const product = state.products.find(p => p.id === data.productId);
        if (!product) {
            showToast('Producto no encontrado', 'error');
            return false;
        }

        const quantity = parseInt(data.quantity) || 0;
        if (quantity <= 0) {
            showToast('La cantidad debe ser mayor a 0', 'error');
            return false;
        }

        const cost = parseFloat(data.cost) || product.cost || 0;
        const price = parseFloat(data.price) || product.price || 0;

        // Verificar stock para salidas
        if (data.type === 'SALIDA') {
            const currentStock = getStock(data.productId);
            if (currentStock < quantity) {
                showToast(`Stock insuficiente. Disponible: ${currentStock}`, 'error');
                return false;
            }
        }

        const movement = {
            productId: data.productId,
            productName: product.name,
            type: data.type,
            quantity: quantity,
            cost: cost,
            price: price,
            date: data.date ? new Date(data.date).getTime() : Date.now(),
            orderRef: data.orderRef ? data.orderRef.trim() : '',
            notes: data.notes ? data.notes.trim() : '',
            status: CONFIG.STATUS.REGISTERED,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        // Calcular totales
        const totals = calculateMovementTotals(movement);
        movement.totalCost = totals.totalCost;
        movement.totalPrice = totals.totalPrice;
        movement.profit = totals.profit;
        movement.margin = totals.margin;

        if (db) {
            const ref = db.ref('movements').push();
            movement.id = ref.key;
            ref.set(movement).then(() => {
                showToast('Movimiento registrado', 'success');
                return true;
            }).catch(err => {
                showToast('Error al registrar movimiento: ' + err.message, 'error');
                return false;
            });
        } else {
            movement.id = generateId();
            state.movements.push(movement);
            saveToCache();
            renderUI();
            showToast('Movimiento registrado (modo offline)', 'success');
            return true;
        }
        return true;
    }

    function updateMovement(id, data) {
        const db = getFirebaseDb();
        const movement = state.movements.find(m => m.id === id);
        if (!movement) {
            showToast('Movimiento no encontrado', 'error');
            return false;
        }

        const quantity = parseInt(data.quantity) || 0;
        if (quantity <= 0) {
            showToast('La cantidad debe ser mayor a 0', 'error');
            return false;
        }

        // Verificar stock para salidas (si cambia la cantidad o el tipo)
        if (data.type === 'SALIDA') {
            // Calcular stock actual sin este movimiento
            let stock = 0;
            state.movements.forEach(m => {
                if (m.id !== id && m.productId === data.productId && m.status !== CONFIG.STATUS.CANCELLED) {
                    if (m.type === 'ENTRADA') stock += m.quantity;
                    else if (m.type === 'SALIDA') stock -= m.quantity;
                }
            });
            if (stock < quantity) {
                showToast(`Stock insuficiente. Disponible: ${stock}`, 'error');
                return false;
            }
        }

        const product = state.products.find(p => p.id === data.productId);
        const cost = parseFloat(data.cost) || 0;
        const price = parseFloat(data.price) || 0;

        const updates = {
            productId: data.productId,
            productName: product ? product.name : 'Producto eliminado',
            type: data.type,
            quantity: quantity,
            cost: cost,
            price: price,
            date: data.date ? new Date(data.date).getTime() : Date.now(),
            orderRef: data.orderRef ? data.orderRef.trim() : '',
            notes: data.notes ? data.notes.trim() : '',
            updatedAt: Date.now()
        };

        // Recalcular totales
        const totals = calculateMovementTotals(updates);
        updates.totalCost = totals.totalCost;
        updates.totalPrice = totals.totalPrice;
        updates.profit = totals.profit;
        updates.margin = totals.margin;

        if (db) {
            db.ref('movements/' + id).update(updates).then(() => {
                showToast('Movimiento actualizado', 'success');
                return true;
            }).catch(err => {
                showToast('Error al actualizar: ' + err.message, 'error');
                return false;
            });
        } else {
            Object.assign(movement, updates);
            saveToCache();
            renderUI();
            showToast('Movimiento actualizado (modo offline)', 'success');
            return true;
        }
        return true;
    }

    function deleteMovement(id) {
        if (!confirm('¿Eliminar este movimiento? Esto revertirá su efecto en el stock.')) return false;

        const db = getFirebaseDb();
        const movement = state.movements.find(m => m.id === id);
        if (!movement) {
            showToast('Movimiento no encontrado', 'error');
            return false;
        }

        if (db) {
            db.ref('movements/' + id).remove().then(() => {
                showToast('Movimiento eliminado', 'success');
                return true;
            }).catch(err => {
                showToast('Error al eliminar: ' + err.message, 'error');
                return false;
            });
        } else {
            state.movements = state.movements.filter(m => m.id !== id);
            saveToCache();
            renderUI();
            showToast('Movimiento eliminado (modo offline)', 'success');
            return true;
        }
        return true;
    }

    function revertMovement(id) {
        const movement = state.movements.find(m => m.id === id);
        if (!movement) {
            showToast('Movimiento no encontrado', 'error');
            return;
        }

        if (!confirm(`¿Crear movimiento inverso para ${movement.type} de ${movement.productName}?`)) return;

        const inverseType = movement.type === 'ENTRADA' ? 'SALIDA' : 
                           movement.type === 'SALIDA' ? 'ENTRADA' : 'AJUSTE';

        const data = {
            productId: movement.productId,
            type: inverseType,
            quantity: movement.quantity,
            cost: movement.cost,
            price: movement.price,
            date: new Date().toISOString().split('T')[0],
            orderRef: 'REV-' + (movement.orderRef || ''),
            notes: `Reversión de movimiento ${movement.id}`
        };

        createMovement(data);
    }

    // ============================================================
    // 9. FILTROS Y BÚSQUEDA
    // ============================================================
    function getFilteredMovements() {
        let result = [...state.movements];

        // Búsqueda global
        if (state.filters.search) {
            const search = state.filters.search.toLowerCase();
            result = result.filter(m => 
                m.productName?.toLowerCase().includes(search) ||
                m.id?.toLowerCase().includes(search) ||
                m.orderRef?.toLowerCase().includes(search) ||
                m.notes?.toLowerCase().includes(search) ||
                getProductCode(m.productId)?.toLowerCase().includes(search)
            );
        }

        // Filtro por tipo
        if (state.filters.movementType) {
            result = result.filter(m => m.type === state.filters.movementType);
        }

        // Filtro por producto
        if (state.filters.productId) {
            result = result.filter(m => m.productId === state.filters.productId);
        }

        // Filtro por fecha
        if (state.filters.dateFrom) {
            const from = new Date(state.filters.dateFrom).getTime();
            result = result.filter(m => m.date >= from);
        }
        if (state.filters.dateTo) {
            const to = new Date(state.filters.dateTo).getTime() + 86400000; // +1 día
            result = result.filter(m => m.date <= to);
        }

        // Ordenamiento
        const sortField = state.sort.field;
        const sortDir = state.sort.direction === 'asc' ? 1 : -1;
        result.sort((a, b) => {
            let valA = a[sortField] || '';
            let valB = b[sortField] || '';
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            if (valA < valB) return -sortDir;
            if (valA > valB) return sortDir;
            return 0;
        });

        return result;
    }

    function getFilteredProducts() {
        let result = [...state.products];

        // Búsqueda global
        if (state.filters.search) {
            const search = state.filters.search.toLowerCase();
            result = result.filter(p => 
                p.name?.toLowerCase().includes(search) ||
                p.code?.toLowerCase().includes(search) ||
                p.id?.toLowerCase().includes(search) ||
                p.category?.toLowerCase().includes(search)
            );
        }

        // Filtro por stock
        if (state.filters.minStock !== '') {
            const min = parseInt(state.filters.minStock) || 0;
            result = result.filter(p => getStock(p.id) >= min);
        }
        if (state.filters.maxStock !== '') {
            const max = parseInt(state.filters.maxStock) || 0;
            result = result.filter(p => getStock(p.id) <= max);
        }

        // Ordenamiento
        const sortField = state.sort.field;
        const sortDir = state.sort.direction === 'asc' ? 1 : -1;
        result.sort((a, b) => {
            let valA = a[sortField] || '';
            let valB = b[sortField] || '';
            if (sortField === 'stock') {
                valA = getStock(a.id);
                valB = getStock(b.id);
            }
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            if (valA < valB) return -sortDir;
            if (valA > valB) return sortDir;
            return 0;
        });

        return result;
    }

    function applyFilters() {
        state.pagination.page = 1;
        renderUI();
    }

    // ============================================================
    // 10. UI RENDERIZADO
    // ============================================================
    function renderUI() {
        if (!state.container) return;

        const container = state.container;
        const tab = state.currentTab;

        // Calcular resúmenes
        const totalProducts = state.products.length;
        const totalMovements = state.movements.length;
        const totalStockValue = state.products.reduce((sum, p) => {
            return sum + (getStock(p.id) * (p.cost || 0));
        }, 0);
        const lowStockProducts = state.products.filter(p => getStock(p.id) <= (p.minStock || 5));

        // Filtrar datos según tab
        let items = [];
        let columns = [];
        let renderFn = null;

        if (tab === 'products') {
            items = getFilteredProducts();
            columns = [
                { field: 'name', label: 'Producto' },
                { field: 'code', label: 'Código' },
                { field: 'stock', label: 'Stock' },
                { field: 'cost', label: 'Costo' },
                { field: 'price', label: 'Precio' },
                { field: 'margin', label: 'Margen' },
                { field: 'value', label: 'Valor' },
                { field: 'actions', label: 'Acciones' }
            ];
            renderFn = renderProductRow;
        } else {
            items = getFilteredMovements();
            columns = [
                { field: 'date', label: 'Fecha' },
                { field: 'productName', label: 'Producto' },
                { field: 'type', label: 'Tipo' },
                { field: 'quantity', label: 'Cant.' },
                { field: 'cost', label: 'Costo' },
                { field: 'price', label: 'Precio' },
                { field: 'margin', label: 'Margen' },
                { field: 'orderRef', label: 'Referencia' },
                { field: 'actions', label: 'Acciones' }
            ];
            renderFn = renderMovementRow;
        }

        // Paginación
        const pageSize = state.pagination.pageSize;
        const totalItems = items.length;
        const totalPages = Math.ceil(totalItems / pageSize) || 1;
        const page = Math.min(state.pagination.page, totalPages);
        const start = (page - 1) * pageSize;
        const end = Math.min(start + pageSize, totalItems);
        const pageItems = items.slice(start, end);
        state.pagination.total = totalItems;

        // Obtener productos para filtros
        const productOptions = state.products.map(p => 
            `<option value="${p.id}">${p.name} (${p.code || 'sin código'})</option>`
        ).join('');

        // Construir HTML
        container.innerHTML = `
            <div class="kardex-container">
                <!-- Header -->
                <div class="kardex-header">
                    <div class="kardex-header-title">
                        <i class="fas fa-boxes"></i>
                        <span>Kardex - Bodega</span>
                        <span id="kardex-sync-status" class="kardex-sync-status">
                            <span class="dot offline"></span>
                            <span class="text">Cargando...</span>
                            <span class="time"></span>
                        </span>
                    </div>
                    <div class="kardex-header-actions">
                        <button class="kardex-btn kardex-btn-primary" onclick="window.KardexModule.showProductForm()">
                            <i class="fas fa-plus"></i> Nuevo Producto
                        </button>
                        <button class="kardex-btn kardex-btn-success" onclick="window.KardexModule.showEntryForm()">
                            <i class="fas fa-plus"></i> Nuevo Movimiento
                        </button>
                        <button class="kardex-btn kardex-btn-outline" onclick="window.KardexModule.syncNow()">
                            <i class="fas fa-sync-alt"></i> Sincronizar
                        </button>
                        <button class="kardex-btn kardex-btn-outline" onclick="window.KardexModule.exportCSV()">
                            <i class="fas fa-download"></i> Exportar
                        </button>
                    </div>
                </div>

                <!-- Resumen -->
                <div class="kardex-summary">
                    <div class="kardex-summary-item">
                        <div class="value">${totalProducts}</div>
                        <div class="label">Productos</div>
                    </div>
                    <div class="kardex-summary-item">
                        <div class="value">${totalMovements}</div>
                        <div class="label">Movimientos</div>
                    </div>
                    <div class="kardex-summary-item">
                        <div class="value success">${formatCurrency(totalStockValue)}</div>
                        <div class="label">Valor Inventario</div>
                    </div>
                    <div class="kardex-summary-item">
                        <div class="value ${lowStockProducts.length > 0 ? 'danger' : ''}">${lowStockProducts.length}</div>
                        <div class="label">Stock Bajo</div>
                    </div>
                </div>

                <!-- Toolbar -->
                <div class="kardex-toolbar">
                    <div class="kardex-search">
                        <i class="fas fa-search"></i>
                        <input type="text" id="kardex-search" placeholder="Buscar por nombre, código, referencia..." 
                               value="${state.filters.search}" oninput="window.KardexModule.handleSearch(this.value)">
                    </div>
                    <div class="kardex-filters">
                        <select id="kardex-filter-type" onchange="window.KardexModule.handleFilter('movementType', this.value)">
                            <option value="">Todos los tipos</option>
                            ${CONFIG.MOVEMENT_TYPES.map(t => 
                                `<option value="${t}" ${state.filters.movementType === t ? 'selected' : ''}>${t}</option>`
                            ).join('')}
                        </select>
                        <select id="kardex-filter-product" onchange="window.KardexModule.handleFilter('productId', this.value)">
                            <option value="">Todos los productos</option>
                            ${productOptions}
                        </select>
                        <input type="date" id="kardex-filter-date-from" value="${state.filters.dateFrom}" 
                               onchange="window.KardexModule.handleFilter('dateFrom', this.value)" placeholder="Desde">
                        <input type="date" id="kardex-filter-date-to" value="${state.filters.dateTo}" 
                               onchange="window.KardexModule.handleFilter('dateTo', this.value)" placeholder="Hasta">
                        <button class="kardex-btn kardex-btn-sm kardex-btn-outline" onclick="window.KardexModule.clearFilters()">
                            <i class="fas fa-times"></i> Limpiar
                        </button>
                    </div>
                </div>

                <!-- Tabs -->
                <div class="kardex-tabs">
                    <button class="kardex-tab ${tab === 'movements' ? 'active' : ''}" 
                            onclick="window.KardexModule.switchTab('movements')">
                        <i class="fas fa-list"></i> Movimientos
                        <span class="badge">${totalMovements}</span>
                    </button>
                    <button class="kardex-tab ${tab === 'products' ? 'active' : ''}" 
                            onclick="window.KardexModule.switchTab('products')">
                        <i class="fas fa-box"></i> Productos
                        <span class="badge">${totalProducts}</span>
                    </button>
                    <button class="kardex-tab" onclick="window.KardexModule.showLowStock()">
                        <i class="fas fa-exclamation-triangle"></i> Stock Bajo
                        ${lowStockProducts.length > 0 ? `<span class="badge" style="background:#dc2626;color:white;">${lowStockProducts.length}</span>` : ''}
                    </button>
                </div>

                <!-- Tabla -->
                <div class="kardex-table-wrapper">
                    <table class="kardex-table">
                        <thead>
                            <tr>
                                ${columns.map(col => `
                                    <th class="${state.sort.field === col.field ? 'active' : ''}" 
                                        onclick="window.KardexModule.handleSort('${col.field}')">
                                        ${col.label}
                                        <span class="sort-icon">
                                            ${state.sort.field === col.field ? (state.sort.direction === 'asc' ? '↑' : '↓') : '↕'}
                                        </span>
                                    </th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${pageItems.length === 0 ? `
                                <tr class="empty-row">
                                    <td colspan="${columns.length}">No hay datos para mostrar</td>
                                </tr>
                            ` : pageItems.map(item => renderFn(item)).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Paginación -->
                <div class="kardex-pagination">
                    <div class="info">
                        Mostrando ${start + 1} - ${end} de ${totalItems} registros
                    </div>
                    <div class="controls">
                        <select onchange="window.KardexModule.setPageSize(this.value)">
                            ${CONFIG.PAGE_SIZES.map(size => 
                                `<option value="${size}" ${pageSize === size ? 'selected' : ''}>${size}</option>`
                            ).join('')}
                        </select>
                        <button onclick="window.KardexModule.goToPage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <span class="page-info">${page} / ${totalPages}</span>
                        <button onclick="window.KardexModule.goToPage(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Actualizar estado de sincronización
        updateSyncStatus();

        // Alerta de stock bajo
        if (lowStockProducts.length > 0 && tab !== 'products') {
            const stockAlert = document.createElement('div');
            stockAlert.style.cssText = `
                background: #fee2e2;
                border: 1px solid #dc2626;
                border-radius: 8px;
                padding: 12px 16px;
                margin-bottom: 16px;
                color: #991b1b;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 8px;
            `;
            stockAlert.innerHTML = `
                <span>
                    <strong>⚠️ Alerta:</strong> ${lowStockProducts.length} productos con stock bajo
                    (${lowStockProducts.map(p => `${p.name}: ${getStock(p.id)}`).join(', ')})
                </span>
                <button class="kardex-btn kardex-btn-sm kardex-btn-danger" onclick="window.KardexModule.switchTab('products')">
                    Ver productos
                </button>
            `;
            const toolbar = container.querySelector('.kardex-toolbar');
            if (toolbar) {
                toolbar.parentNode.insertBefore(stockAlert, toolbar.nextSibling);
            }
        }
    }

    // ============================================================
    // 11. RENDERIZADO DE FILAS
    // ============================================================
    function renderProductRow(product) {
        const stock = getStock(product.id);
        const cost = product.cost || 0;
        const price = product.price || 0;
        const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
        const isLowStock = stock <= (product.minStock || 5);

        return `
            <tr>
                <td><strong>${product.name || 'Sin nombre'}</strong></td>
                <td>${product.code || 'N/A'}</td>
                <td>
                    <span class="kardex-badge ${isLowStock ? 'kardex-badge-danger' : 'kardex-badge-success'}">
                        ${stock}
                    </span>
                    ${isLowStock ? ' <span class="kardex-stock-critical">⚠️</span>' : ''}
                </td>
                <td>${formatCurrency(cost)}</td>
                <td>${formatCurrency(price)}</td>
                <td style="color:${margin >= 30 ? '#059669' : margin >= 15 ? '#d97706' : '#dc2626'}">
                    ${margin.toFixed(1)}%
                </td>
                <td>${formatCurrency(stock * cost)}</td>
                <td>
                    <div class="actions">
                        <button class="kardex-btn kardex-btn-primary kardex-btn-xs" 
                                onclick="window.KardexModule.showProductForm('${product.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="kardex-btn kardex-btn-danger kardex-btn-xs" 
                                onclick="window.KardexModule.deleteProduct('${product.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="kardex-btn kardex-btn-success kardex-btn-xs" 
                                onclick="window.KardexModule.showEntryForm('${product.id}')">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    function renderMovementRow(movement) {
        const totals = calculateMovementTotals(movement);
        const isIncome = movement.type === 'ENTRADA';
        const isCancelled = movement.status === CONFIG.STATUS.CANCELLED;

        return `
            <tr style="${isCancelled ? 'opacity:0.5;' : ''}">
                <td>${formatDate(movement.date)}</td>
                <td><strong>${movement.productName || 'N/A'}</strong></td>
                <td>
                    <span class="kardex-badge ${isIncome ? 'kardex-badge-success' : 'kardex-badge-danger'}">
                        ${movement.type}
                    </span>
                </td>
                <td>${movement.quantity}</td>
                <td>${formatCurrency(movement.cost)}</td>
                <td>${formatCurrency(movement.price)}</td>
                <td style="color:${totals.margin >= 30 ? '#059669' : totals.margin >= 15 ? '#d97706' : '#dc2626'}">
                    ${totals.margin.toFixed(1)}%
                </td>
                <td>${movement.orderRef || 'N/A'}</td>
                <td>
                    <div class="actions">
                        <button class="kardex-btn kardex-btn-primary kardex-btn-xs" 
                                onclick="window.KardexModule.showEntryForm('${movement.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="kardex-btn kardex-btn-warning kardex-btn-xs" 
                                onclick="window.KardexModule.revertMovement('${movement.id}')">
                            <i class="fas fa-undo"></i>
                        </button>
                        <button class="kardex-btn kardex-btn-danger kardex-btn-xs" 
                                onclick="window.KardexModule.deleteMovement('${movement.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    // ============================================================
    // 12. MODALES
    // ============================================================
    function showProductForm(productId) {
        const isEdit = !!productId;
        const product = isEdit ? state.products.find(p => p.id === productId) : null;

        const modal = document.createElement('div');
        modal.className = 'kardex-modal-overlay';
        modal.id = 'kardex-modal';
        modal.innerHTML = `
            <div class="kardex-modal">
                <div class="kardex-modal-header">
                    <h3>${isEdit ? 'Editar Producto' : 'Nuevo Producto'}</h3>
                    <button class="close-btn" onclick="window.KardexModule.closeModal()">&times;</button>
                </div>
                <form id="kardex-product-form">
                    <div class="form-group">
                        <label>Nombre <span class="required">*</span></label>
                        <input type="text" class="form-control" id="prod-name" 
                               value="${product?.name || ''}" required>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Código</label>
                            <input type="text" class="form-control" id="prod-code" 
                                   value="${product?.code || ''}">
                        </div>
                        <div class="form-group">
                            <label>Categoría</label>
                            <input type="text" class="form-control" id="prod-category" 
                                   value="${product?.category || ''}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Costo Unitario</label>
                            <input type="number" step="0.01" class="form-control" id="prod-cost" 
                                   value="${product?.cost || 0}">
                        </div>
                        <div class="form-group">
                            <label>Precio Venta</label>
                            <input type="number" step="0.01" class="form-control" id="prod-price" 
                                   value="${product?.price || 0}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Stock Mínimo</label>
                        <input type="number" class="form-control" id="prod-minstock" 
                               value="${product?.minStock || 5}">
                    </div>
                    <div class="form-group">
                        <label>Descripción</label>
                        <textarea class="form-control" id="prod-description" rows="2">${product?.description || ''}</textarea>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="kardex-btn kardex-btn-outline" onclick="window.KardexModule.closeModal()">Cancelar</button>
                        <button type="submit" class="kardex-btn kardex-btn-success">
                            <i class="fas fa-save"></i> ${isEdit ? 'Actualizar' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('kardex-product-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const data = {
                name: document.getElementById('prod-name').value,
                code: document.getElementById('prod-code').value,
                category: document.getElementById('prod-category').value,
                cost: document.getElementById('prod-cost').value,
                price: document.getElementById('prod-price').value,
                minStock: document.getElementById('prod-minstock').value,
                description: document.getElementById('prod-description').value
            };

            if (isEdit) {
                updateProduct(productId, data);
            } else {
                createProduct(data);
            }
            closeModal();
        });
    }

    function showEntryForm(movementId) {
        const isEdit = !!movementId;
        const movement = isEdit ? state.movements.find(m => m.id === movementId) : null;
        const productId = movement?.productId || '';

        const modal = document.createElement('div');
        modal.className = 'kardex-modal-overlay';
        modal.id = 'kardex-modal';
        modal.innerHTML = `
            <div class="kardex-modal">
                <div class="kardex-modal-header">
                    <h3>${isEdit ? 'Editar Movimiento' : 'Nuevo Movimiento'}</h3>
                    <button class="close-btn" onclick="window.KardexModule.closeModal()">&times;</button>
                </div>
                <form id="kardex-movement-form">
                    <div class="form-group">
                        <label>Producto <span class="required">*</span></label>
                        <select class="form-control" id="mov-product" required>
                            ${state.products.map(p => `
                                <option value="${p.id}" ${p.id === productId ? 'selected' : ''}>
                                    ${p.name} (${p.code || 'sin código'})
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Tipo <span class="required">*</span></label>
                            <select class="form-control" id="mov-type" required>
                                ${CONFIG.MOVEMENT_TYPES.map(t => `
                                    <option value="${t}" ${movement?.type === t ? 'selected' : ''}>${t}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Cantidad <span class="required">*</span></label>
                            <input type="number" class="form-control" id="mov-quantity" 
                                   value="${movement?.quantity || 1}" min="1" required>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Costo Unitario</label>
                            <input type="number" step="0.01" class="form-control" id="mov-cost" 
                                   value="${movement?.cost || 0}">
                        </div>
                        <div class="form-group">
                            <label>Precio Venta</label>
                            <input type="number" step="0.01" class="form-control" id="mov-price" 
                                   value="${movement?.price || 0}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Fecha</label>
                        <input type="date" class="form-control" id="mov-date" 
                               value="${movement?.date ? new Date(movement.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="form-group">
                        <label>Referencia (Pedido, Factura, etc.)</label>
                        <input type="text" class="form-control" id="mov-ref" 
                               value="${movement?.orderRef || ''}">
                    </div>
                    <div class="form-group">
                        <label>Notas</label>
                        <textarea class="form-control" id="mov-notes" rows="2">${movement?.notes || ''}</textarea>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="kardex-btn kardex-btn-outline" onclick="window.KardexModule.closeModal()">Cancelar</button>
                        <button type="submit" class="kardex-btn kardex-btn-success">
                            <i class="fas fa-save"></i> ${isEdit ? 'Actualizar' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        // Actualizar costo/precio al seleccionar producto
        document.getElementById('mov-product').addEventListener('change', function() {
            const product = state.products.find(p => p.id === this.value);
            if (product && !isEdit) {
                if (!document.getElementById('mov-cost').value) {
                    document.getElementById('mov-cost').value = product.cost || 0;
                }
                if (!document.getElementById('mov-price').value) {
                    document.getElementById('mov-price').value = product.price || 0;
                }
            }
        });

        document.getElementById('kardex-movement-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const data = {
                productId: document.getElementById('mov-product').value,
                type: document.getElementById('mov-type').value,
                quantity: document.getElementById('mov-quantity').value,
                cost: document.getElementById('mov-cost').value,
                price: document.getElementById('mov-price').value,
                date: document.getElementById('mov-date').value,
                orderRef: document.getElementById('mov-ref').value,
                notes: document.getElementById('mov-notes').value
            };

            if (isEdit) {
                updateMovement(movementId, data);
            } else {
                createMovement(data);
            }
            closeModal();
        });
    }

    function closeModal() {
        const modal = document.getElementById('kardex-modal');
        if (modal) modal.remove();
    }

    function showLowStock() {
        state.currentTab = 'products';
        state.filters.minStock = '1';
        state.filters.maxStock = '5';
        state.pagination.page = 1;
        renderUI();
        showToast('Mostrando productos con stock bajo', 'warning');
    }

    // ============================================================
    // 13. TOAST NOTIFICATIONS
    // ============================================================
    function showToast(message, type = 'info') {
        let container = document.querySelector('.kardex-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'kardex-toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `kardex-toast ${type}`;
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
    // 14. EXPORTAR CSV
    // ============================================================
    function exportCSV() {
        let items = state.currentTab === 'products' ? getFilteredProducts() : getFilteredMovements();
        
        if (items.length === 0) {
            showToast('No hay datos para exportar', 'warning');
            return;
        }

        let headers, rows;
        if (state.currentTab === 'products') {
            headers = ['Nombre', 'Código', 'Categoría', 'Stock', 'Costo', 'Precio', 'Margen', 'Valor'];
            rows = items.map(p => [
                p.name || '',
                p.code || '',
                p.category || '',
                getStock(p.id),
                p.cost || 0,
                p.price || 0,
                p.price > 0 ? ((p.price - (p.cost || 0)) / p.price * 100).toFixed(1) + '%' : '0%',
                (getStock(p.id) * (p.cost || 0)).toFixed(2)
            ]);
        } else {
            headers = ['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Costo', 'Precio', 'Total', 'Margen', 'Referencia'];
            rows = items.map(m => {
                const totals = calculateMovementTotals(m);
                return [
                    formatDate(m.date),
                    m.productName || '',
                    m.type || '',
                    m.quantity || 0,
                    (m.cost || 0).toFixed(2),
                    (m.price || 0).toFixed(2),
                    totals.totalPrice.toFixed(2),
                    totals.margin.toFixed(1) + '%',
                    m.orderRef || ''
                ];
            });
        }

        // Construir CSV
        let csv = headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n';
        });

        // Descargar
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `kardex_${state.currentTab}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast(`Exportados ${items.length} registros`, 'success');
    }

    // ============================================================
    // 15. FUNCIONES PÚBLICAS
    // ============================================================
    function render(containerElement) {
        if (!containerElement) {
            console.error('Kardex: container no proporcionado');
            return;
        }

        state.container = containerElement;
        injectStyles();

        // Cargar datos desde caché
        loadFromCache();

        // Intentar conectar Firebase
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

        // Intentar sincronizar desde la app principal
        syncWithMainApp();

        showToast('Módulo Kardex cargado', 'info');
    }

    function syncWithMainApp() {
        try {
            if (typeof window.ContabilidadModule !== 'undefined') {
                const data = window.ContabilidadModule.getStoreData();
                if (data && data.products) {
                    // Solo actualizar si hay cambios
                    const localIds = state.products.map(p => p.id);
                    const remoteIds = data.products.map(p => p.id);
                    if (localIds.length !== remoteIds.length || 
                        localIds.some(id => !remoteIds.includes(id))) {
                        state.products = data.products;
                        saveToCache();
                        renderUI();
                    }
                }
            }
        } catch (e) {
            console.warn('Error sincronizando con app principal:', e);
        }
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

    function switchTab(tab) {
        state.currentTab = tab;
        state.pagination.page = 1;
        renderUI();
    }

    function handleSearch(value) {
        state.filters.search = value;
        state.pagination.page = 1;
        renderUI();
    }

    function handleFilter(field, value) {
        state.filters[field] = value;
        state.pagination.page = 1;
        renderUI();
    }

    function clearFilters() {
        state.filters = {
            search: '',
            movementType: '',
            productId: '',
            dateFrom: '',
            dateTo: '',
            minStock: '',
            maxStock: ''
        };
        state.pagination.page = 1;
        renderUI();
        showToast('Filtros limpiados', 'info');
    }

    function handleSort(field) {
        if (state.sort.field === field) {
            state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            state.sort.field = field;
            state.sort.direction = 'asc';
        }
        renderUI();
    }

    function goToPage(page) {
        const totalPages = Math.ceil(state.pagination.total / state.pagination.pageSize) || 1;
        if (page < 1 || page > totalPages) return;
        state.pagination.page = page;
        renderUI();
    }

    function setPageSize(size) {
        state.pagination.pageSize = parseInt(size);
        state.pagination.page = 1;
        renderUI();
    }

    function destroy() {
        // Limpiar listeners de Firebase
        if (state.unsubscribeProducts) {
            state.unsubscribeProducts();
            state.unsubscribeProducts = null;
        }
        if (state.unsubscribeMovements) {
            state.unsubscribeMovements();
            state.unsubscribeMovements = null;
        }
        // Limpiar el contenedor
        if (state.container) {
            state.container.innerHTML = '';
        }
        // Limpiar estado
        state.products = [];
        state.movements = [];
        state.container = null;
        showToast('Módulo Kardex destruido', 'info');
    }

    // ============================================================
    // 16. EXPOSICIÓN DEL MÓDULO
    // ============================================================
    window.KardexModule = {
        // API Pública
        render: render,
        refresh: refresh,
        switchTab: switchTab,
        showEntryForm: showEntryForm,
        showProductForm: showProductForm,
        updateProducts: function(newProducts) {
            state.products = newProducts || [];
            saveToCache();
            if (state.container) renderUI();
        },
        getMovements: function() { return [...state.movements]; },
        getProductStock: getStock,
        syncNow: syncNow,
        destroy: destroy,
        
        // Exportar
        exportCSV: exportCSV,
        
        // UI Handlers (expuestos para onclick)
        handleSearch: handleSearch,
        handleFilter: handleFilter,
        clearFilters: clearFilters,
        handleSort: handleSort,
        goToPage: goToPage,
        setPageSize: setPageSize,
        closeModal: closeModal,
        showLowStock: showLowStock,
        revertMovement: revertMovement,
        deleteProduct: deleteProduct,
        deleteMovement: deleteMovement,
        
        // Estado (solo lectura)
        getState: function() { return { ...state }; }
    };

    console.log('✅ Módulo Kardex cargado y listo para usar');
    console.log(`📦 ${state.products.length} productos, ${state.movements.length} movimientos`);

})();