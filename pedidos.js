// ============================================
// MÓDULO DE PEDIDOS - VERSIÓN PROFESIONAL
// ============================================

// Variables para paginación
let currentPage = 1;
let itemsPerPage = 10;
let filteredOrdersCache = [];
let orderStatusHistory = {};

// ============================================
// CARGA DE PEDIDOS CON PAGINACIÓN
// ============================================
function loadOrders(page = 1) {
    currentPage = page;
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;
    
    if (allOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">No hay pedidos registrados</td></tr>';
        updatePagination(0);
        return;
    }
    
    const sortedOrders = [...allOrders].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    filteredOrdersCache = sortedOrders;
    
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, sortedOrders.length);
    const pageOrders = sortedOrders.slice(startIndex, endIndex);
    
    renderOrdersTable(pageOrders);
    updatePagination(sortedOrders.length);
}

function renderOrdersTable(orders) {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;
    
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">No hay pedidos para mostrar</td></tr>';
        return;
    }
    
    let html = '';
    orders.forEach(order => {
        const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) : 'Sin fecha';
        
        const productCount = order.items ? order.items.length : 0;
        const totalItems = order.items ? order.items.reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0) : 0;
        const daysAgo = order.createdAt ? Math.floor((Date.now() - order.createdAt) / (1000 * 60 * 60 * 24)) : null;
        
        let statusBadge = getStatusBadgeClass(order.status);
        let statusIcon = getStatusIcon(order.status);
        
        html += `
            <tr class="order-row" data-order-id="${order.id || order.orderNumber}">
                <td>
                    <input type="checkbox" class="order-checkbox" value="${order.id || order.orderNumber}" 
                           onchange="toggleOrderSelection(this)">
                </td>
                <td>
                    <strong>${order.orderNumber || 'N/A'}</strong>
                    ${daysAgo !== null && daysAgo < 1 ? '<span class="badge bg-danger ms-1">Nuevo</span>' : ''}
                    ${daysAgo !== null && daysAgo > 30 ? '<span class="badge bg-secondary ms-1">Antiguo</span>' : ''}
                </td>
                <td>
                    <div><i class="fas fa-user me-1"></i> ${order.userName || 'Cliente'}</div>
                    <small class="text-muted"><i class="fas fa-envelope me-1"></i> ${order.userEmail || 'Sin email'}</small>
                    ${order.userPhone ? `<div><small class="text-muted"><i class="fas fa-phone me-1"></i> ${order.userPhone}</small></div>` : ''}
                </td>
                <td>
                    <div>${date}</div>
                    <small class="text-muted">${daysAgo !== null ? `Hace ${daysAgo} día${daysAgo !== 1 ? 's' : ''}` : ''}</small>
                </td>
                <td>
                    <div>${productCount} producto${productCount !== 1 ? 's' : ''}</div>
                    <small class="text-muted">${totalItems} unidades totales</small>
                </td>
                <td class="fw-bold">${formatCurrency(parseFloat(order.total) || 0)}</td>
                <td>
                    <span class="badge ${statusBadge}">
                        <i class="${statusIcon} me-1"></i> ${order.status || 'pendiente'}
                    </span>
                    <br>
                    <small class="text-muted">
                        ${order.updatedAt ? 'Actualizado: ' + new Date(order.updatedAt).toLocaleDateString() : ''}
                    </small>
                </td>
                <td>
                    ${order.receiptUrl ? 
                        `<span class="badge bg-success"><i class="fas fa-check-circle me-1"></i> Comprobante</span>` : 
                        '<span class="badge bg-secondary"><i class="fas fa-times-circle me-1"></i> Sin comprobante</span>'
                    }
                </td>
                <td>
                    <div class="btn-group-vertical btn-group-sm" style="width:100%;">
                        <button class="btn-action btn-view w-100" onclick="viewOrderDetails('${order.id || order.orderNumber}')" title="Ver detalles">
                            <i class="fas fa-eye"></i> Ver
                        </button>
                        <button class="btn-action btn-edit w-100 mt-1" onclick="editOrderStatus('${order.id || order.orderNumber}')" title="Editar estado">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        ${order.status === 'pendiente' ? 
                            `<button class="btn-action btn-process w-100 mt-1" onclick="confirmOrderWithInventory('${order.id || order.orderNumber}')" title="Confirmar y descontar stock">
                                <i class="fas fa-check-circle"></i> Confirmar
                            </button>` : ''
                        }
                        ${order.status === 'confirmado' || order.status === 'enviado' ?
                            `<button class="btn-action btn-delete w-100 mt-1" onclick="cancelOrderWithInventory('${order.id || order.orderNumber}')" title="Cancelar y restaurar stock">
                                <i class="fas fa-ban"></i> Cancelar
                            </button>` : ''
                        }
                    </div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function updatePagination(totalItems) {
    const paginationContainer = document.getElementById('ordersPagination');
    if (!paginationContainer) {
        // Crear contenedor de paginación si no existe
        const card = document.querySelector('#ordersContent .data-card');
        if (card) {
            const paginationDiv = document.createElement('div');
            paginationDiv.id = 'ordersPagination';
            paginationDiv.className = 'mt-3';
            card.appendChild(paginationDiv);
        }
    }
    
    const paginationEl = document.getElementById('ordersPagination');
    if (!paginationEl) return;
    
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    if (totalPages <= 1) {
        paginationEl.innerHTML = '';
        return;
    }
    
    let html = `
        <nav aria-label="Navegación de pedidos">
            <ul class="pagination justify-content-center pagination-sm">
                <li class="page-item ${currentPage <= 1 ? 'disabled' : ''}">
                    <a class="page-link" href="#" onclick="changeOrdersPage(${currentPage - 1})" tabindex="-1">Anterior</a>
                </li>
    `;
    
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    if (startPage > 1) {
        html += `<li class="page-item"><a class="page-link" href="#" onclick="changeOrdersPage(1)">1</a></li>`;
        if (startPage > 2) html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="changeOrdersPage(${i})">${i}</a>
                </li>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        html += `<li class="page-item"><a class="page-link" href="#" onclick="changeOrdersPage(${totalPages})">${totalPages}</a></li>`;
    }
    
    html += `
                <li class="page-item ${currentPage >= totalPages ? 'disabled' : ''}">
                    <a class="page-link" href="#" onclick="changeOrdersPage(${currentPage + 1})">Siguiente</a>
                </li>
            </ul>
            <div class="text-center text-muted small">
                Mostrando ${Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} - ${Math.min(currentPage * itemsPerPage, totalItems)} de ${totalItems} pedidos
                &nbsp;|&nbsp; 
                <select class="form-select form-select-sm d-inline-block" style="width:auto;" onchange="changeItemsPerPage(this.value)">
                    <option value="5" ${itemsPerPage === 5 ? 'selected' : ''}>5</option>
                    <option value="10" ${itemsPerPage === 10 ? 'selected' : ''}>10</option>
                    <option value="25" ${itemsPerPage === 25 ? 'selected' : ''}>25</option>
                    <option value="50" ${itemsPerPage === 50 ? 'selected' : ''}>50</option>
                </select>
                por página
            </div>
        </nav>
    `;
    
    paginationEl.innerHTML = html;
}

function changeOrdersPage(page) {
    const totalPages = Math.ceil(filteredOrdersCache.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    loadOrders(page);
}

function changeItemsPerPage(value) {
    itemsPerPage = parseInt(value);
    currentPage = 1;
    loadOrders(currentPage);
}

// ============================================
// FILTROS AVANZADOS
// ============================================
function applyOrderFilters() {
    const status = document.getElementById('orderStatusFilter').value;
    const dateFrom = document.getElementById('orderDateFrom').value;
    const dateTo = document.getElementById('orderDateTo').value;
    const customerFilter = document.getElementById('orderCustomerFilter').value.toLowerCase();
    const minAmount = parseFloat(document.getElementById('orderMinAmount')?.value) || 0;
    const maxAmount = parseFloat(document.getElementById('orderMaxAmount')?.value) || Infinity;
    const hasReceipt = document.getElementById('orderHasReceipt')?.checked || false;
    
    let filteredOrders = [...allOrders];
    
    if (status) filteredOrders = filteredOrders.filter(order => order.status === status);
    if (dateFrom) {
        const fromDate = new Date(dateFrom).getTime();
        filteredOrders = filteredOrders.filter(order => order.createdAt >= fromDate);
    }
    if (dateTo) {
        const toDate = new Date(dateTo + 'T23:59:59').getTime();
        filteredOrders = filteredOrders.filter(order => order.createdAt <= toDate);
    }
    if (customerFilter) {
        filteredOrders = filteredOrders.filter(order =>
            (order.userName && order.userName.toLowerCase().includes(customerFilter)) ||
            (order.userEmail && order.userEmail.toLowerCase().includes(customerFilter)) ||
            (order.orderNumber && order.orderNumber.toLowerCase().includes(customerFilter))
        );
    }
    if (minAmount > 0) {
        filteredOrders = filteredOrders.filter(order => (parseFloat(order.total) || 0) >= minAmount);
    }
    if (maxAmount < Infinity) {
        filteredOrders = filteredOrders.filter(order => (parseFloat(order.total) || 0) <= maxAmount);
    }
    if (hasReceipt) {
        filteredOrders = filteredOrders.filter(order => order.receiptUrl);
    }
    
    filteredOrdersCache = filteredOrders;
    currentPage = 1;
    renderOrdersTable(filteredOrders.slice(0, itemsPerPage));
    updatePagination(filteredOrders.length);
    updateFilterStats(filteredOrders);
}

function resetOrderFilters() {
    document.getElementById('orderStatusFilter').value = '';
    document.getElementById('orderDateFrom').value = '';
    document.getElementById('orderDateTo').value = '';
    document.getElementById('orderCustomerFilter').value = '';
    if (document.getElementById('orderMinAmount')) document.getElementById('orderMinAmount').value = '';
    if (document.getElementById('orderMaxAmount')) document.getElementById('orderMaxAmount').value = '';
    if (document.getElementById('orderHasReceipt')) document.getElementById('orderHasReceipt').checked = false;
    loadOrders(1);
}

function updateFilterStats(orders) {
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
    const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const pending = orders.filter(o => o.status === 'pendiente').length;
    
    let statsContainer = document.getElementById('filterStats');
    if (!statsContainer) {
        const filterBar = document.querySelector('#ordersContent .filter-bar');
        if (filterBar) {
            statsContainer = document.createElement('div');
            statsContainer.id = 'filterStats';
            statsContainer.className = 'w-100 mt-2 p-2 bg-light rounded';
            filterBar.appendChild(statsContainer);
        }
    }
    
    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="d-flex flex-wrap gap-3 justify-content-center">
                <span><strong>${totalOrders}</strong> pedidos</span>
                <span><strong>${formatCurrency(totalRevenue)}</strong> ingresos</span>
                <span><strong>${formatCurrency(avgOrder)}</strong> promedio</span>
                <span><strong>${pending}</strong> pendientes</span>
                <span class="text-muted">${orders.length === allOrders.length ? '(Sin filtros)' : `(${((orders.length / allOrders.length) * 100).toFixed(1)}% del total)`}</span>
            </div>
        `;
    }
}

// ============================================
// ESTADÍSTICAS DE PEDIDOS (Dashboard)
// ============================================
function loadOrderStats() {
    const totalOrders = allOrders.length;
    const totalRevenue = allOrders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
    const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const pending = allOrders.filter(o => o.status === 'pendiente').length;
    const completed = allOrders.filter(o => o.status === 'completado' || o.status === 'entregado').length;
    const cancelled = allOrders.filter(o => o.status === 'cancelado').length;
    
    // Actualizar estadísticas en el dashboard si existen
    const statsContainer = document.querySelector('#ordersContent .data-card .card-header');
    if (statsContainer) {
        const existingStats = statsContainer.querySelector('.order-stats');
        if (!existingStats) {
            const statsDiv = document.createElement('div');
            statsDiv.className = 'order-stats d-flex flex-wrap gap-3';
            statsDiv.innerHTML = `
                <span class="badge bg-primary">Total: ${totalOrders}</span>
                <span class="badge bg-success">Completados: ${completed}</span>
                <span class="badge bg-warning text-dark">Pendientes: ${pending}</span>
                <span class="badge bg-danger">Cancelados: ${cancelled}</span>
                <span class="badge bg-info">Promedio: ${formatCurrency(avgOrder)}</span>
            `;
            statsContainer.appendChild(statsDiv);
        } else {
            existingStats.innerHTML = `
                <span class="badge bg-primary">Total: ${totalOrders}</span>
                <span class="badge bg-success">Completados: ${completed}</span>
                <span class="badge bg-warning text-dark">Pendientes: ${pending}</span>
                <span class="badge bg-danger">Cancelados: ${cancelled}</span>
                <span class="badge bg-info">Promedio: ${formatCurrency(avgOrder)}</span>
            `;
        }
    }
}

// ============================================
// OBTENER ICONO SEGÚN ESTADO
// ============================================
function getStatusIcon(status) {
    switch(status) {
        case 'pendiente': return 'fas fa-clock';
        case 'confirmado': return 'fas fa-check-circle';
        case 'enviado': return 'fas fa-truck';
        case 'completado': return 'fas fa-check-double';
        case 'entregado': return 'fas fa-home';
        case 'cancelado': return 'fas fa-times-circle';
        default: return 'fas fa-question-circle';
    }
}

// ============================================
// FORMATO DE MONEDA
// ============================================
function formatCurrency(value) {
    if (isNaN(value) || value === null || value === undefined) return '$0.00';
    return '$' + parseFloat(value).toFixed(2);
}

// ============================================
// VER DETALLES (MEJORADO)
// ============================================
function viewOrderDetails(orderId) {
    const order = allOrders.find(o => o.id === orderId || o.orderNumber === orderId);
    if (!order) { showAlert('Pedido no encontrado', 'danger'); return; }
    
    document.getElementById('modalOrderNumber').textContent = order.orderNumber;
    
    const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }) : 'Sin fecha';
    
    const updatedDate = order.updatedAt ? new Date(order.updatedAt).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }) : 'No actualizado';
    
    let itemsHtml = '';
    if (order.items && order.items.length > 0) {
        order.items.forEach((item, index) => {
            const total = (parseFloat(item.price) || 0) * (item.quantity || 1);
            itemsHtml += `
                <tr class="${index % 2 === 0 ? '' : 'bg-light'}">
                    <td>
                        ${item.image ? `<img src="${item.image}" class="rounded me-2" style="width:40px;height:40px;object-fit:cover;" alt="${item.name}">` : ''}
                        ${item.name || 'Producto'}
                    </td>
                    <td class="text-center">${item.quantity || 1}</td>
                    <td class="text-end">${formatCurrency(parseFloat(item.price) || 0)}</td>
                    <td class="text-end fw-bold">${formatCurrency(total)}</td>
                </tr>
            `;
        });
    } else {
        itemsHtml = '<tr><td colspan="4" class="text-center text-muted">No hay productos en este pedido</td></tr>';
    }
    
    const statusHistory = order.statusHistory && Array.isArray(order.statusHistory) ? order.statusHistory : [];
    let historyHtml = '';
    if (statusHistory.length > 0) {
        historyHtml = `
            <div class="mt-3">
                <h6>Historial de Estados</h6>
                <div class="timeline">
                    ${statusHistory.map((entry, index) => `
                        <div class="d-flex ${index < statusHistory.length - 1 ? 'border-bottom pb-2 mb-2' : ''}">
                            <span class="badge ${getStatusBadgeClass(entry.status)} me-2">${entry.status}</span>
                            <span class="text-muted small">${entry.date ? new Date(entry.date).toLocaleString() : 'Sin fecha'}</span>
                            ${entry.note ? `<span class="text-muted small ms-2">- ${entry.note}</span>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    const content = `
        <div class="row">
            <div class="col-md-6">
                <div class="card mb-3">
                    <div class="card-header bg-light d-flex justify-content-between align-items-center">
                        <h6 class="mb-0"><i class="fas fa-info-circle me-2"></i>Información del Pedido</h6>
                        <span class="badge ${getStatusBadgeClass(order.status)}">${order.status || 'pendiente'}</span>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-6">
                                <p><strong>Número:</strong> ${order.orderNumber || 'N/A'}</p>
                                <p><strong>Fecha:</strong> ${date}</p>
                                <p><strong>Última actualización:</strong> ${updatedDate}</p>
                            </div>
                            <div class="col-6">
                                <p><strong>Método de Pago:</strong> ${order.paymentMethod || 'Transferencia'}</p>
                                <p><strong>Total:</strong> <span class="fw-bold fs-5">${formatCurrency(parseFloat(order.total) || 0)}</span></p>
                                ${order.receiptUrl ? `<p><a href="${order.receiptUrl}" target="_blank" class="btn btn-sm btn-success"><i class="fas fa-file-invoice me-1"></i> Ver Comprobante</a></p>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header bg-light">
                        <h6 class="mb-0"><i class="fas fa-user me-2"></i>Información del Cliente</h6>
                    </div>
                    <div class="card-body">
                        <p><strong>Nombre:</strong> ${order.userName || 'No especificado'}</p>
                        <p><strong>Email:</strong> ${order.userEmail || 'No especificado'}</p>
                        ${order.userPhone ? `<p><strong>Teléfono:</strong> ${order.userPhone}</p>` : ''}
                        ${order.userAddress ? `<p><strong>Dirección:</strong> ${order.userAddress}</p>` : ''}
                    </div>
                </div>
            </div>
            
            <div class="col-md-6">
                <div class="card mb-3">
                    <div class="card-header bg-light">
                        <h6 class="mb-0"><i class="fas fa-shopping-bag me-2"></i>Resumen del Pedido</h6>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-sm mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th>Producto</th>
                                        <th class="text-center">Cant.</th>
                                        <th class="text-end">Precio</th>
                                        <th class="text-end">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsHtml}
                                </tbody>
                                <tfoot class="table-light">
                                    <tr>
                                        <td colspan="3" class="text-end"><strong>Subtotal:</strong></td>
                                        <td class="text-end">${formatCurrency(parseFloat(order.subtotal) || 0)}</td>
                                    </tr>
                                    <tr>
                                        <td colspan="3" class="text-end"><strong>Envío:</strong></td>
                                        <td class="text-end">${formatCurrency(parseFloat(order.shipping) || 0)}</td>
                                    </tr>
                                    <tr>
                                        <td colspan="3" class="text-end"><strong>Total:</strong></td>
                                        <td class="text-end"><strong>${formatCurrency(parseFloat(order.total) || 0)}</strong></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
                
                ${historyHtml}
            </div>
        </div>
    `;
    
    document.getElementById('orderDetailsContent').innerHTML = content;
    new bootstrap.Modal(document.getElementById('orderDetailsModal')).show();
}

// ============================================
// EDITAR ESTADO CON HISTORIAL
// ============================================
function editOrderStatus(orderId) {
    const order = allOrders.find(o => o.id === orderId || o.orderNumber === orderId);
    if (!order) { showAlert('Pedido no encontrado', 'danger'); return; }
    
    const statusOptions = ['pendiente', 'confirmado', 'enviado', 'completado', 'entregado', 'cancelado'];
    const currentStatus = order.status || 'pendiente';
    const optionsHtml = statusOptions.map(s => 
        `<option value="${s}" ${s === currentStatus ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
    ).join('');
    
    const note = prompt(
        `Nuevo estado del pedido ${order.orderNumber}:\n\nSelecciona un estado de la lista:`,
        currentStatus
    );
    
    if (note !== null && note !== currentStatus) {
        const statusMatch = statusOptions.find(s => s.toLowerCase() === note.toLowerCase());
        if (statusMatch) {
            updateOrderStatusWithHistory(orderId, statusMatch, 'Cambio manual desde admin');
        } else {
            showAlert('Estado inválido. Usa: ' + statusOptions.join(', '), 'warning');
        }
    }
}

function updateOrderStatusWithHistory(orderId, newStatus, note = '') {
    const orderIndex = allOrders.findIndex(o => o.id === orderId || o.orderNumber === orderId);
    if (orderIndex !== -1) {
        const oldStatus = allOrders[orderIndex].status;
        
        if (newStatus === 'cancelado' && ['confirmado', 'enviado'].includes(oldStatus)) {
            restoreInventoryFromOrder(orderId).catch(console.error);
        }
        
        // Guardar historial de estados
        if (!allOrders[orderIndex].statusHistory) {
            allOrders[orderIndex].statusHistory = [];
        }
        allOrders[orderIndex].statusHistory.push({
            status: oldStatus,
            date: Date.now(),
            note: note || `Cambiado de ${oldStatus} a ${newStatus}`
        });
        
        allOrders[orderIndex].status = newStatus;
        allOrders[orderIndex].updatedAt = Date.now();
        
        if (firebaseDatabase && allOrders[orderIndex].id) {
            firebaseDatabase.ref('orders/' + allOrders[orderIndex].id).update({
                status: newStatus,
                updatedAt: firebase.database.ServerValue.TIMESTAMP,
                statusHistory: allOrders[orderIndex].statusHistory
            }).catch(error => console.error('Error actualizando en Firebase:', error));
        }
        
        updateLocalOrder(allOrders[orderIndex]);
        loadOrders(currentPage);
        showDashboard();
        showAlert(`Estado del pedido actualizado de "${oldStatus}" a "${newStatus}"`, 'success');
    }
}

// Sobrescribir updateOrderStatus para usar el historial
function updateOrderStatus(orderId, newStatus) {
    updateOrderStatusWithHistory(orderId, newStatus, 'Cambio rápido desde acciones');
}

// ============================================
// FILTROS MEJORADOS (añadir campos al HTML)
// ============================================
function addAdvancedFilters() {
    const filterBar = document.querySelector('#ordersContent .filter-bar');
    if (!filterBar) return;
    
    // Verificar si ya existen los filtros avanzados
    if (document.getElementById('orderMinAmount')) return;
    
    const advancedFilters = document.createElement('div');
    advancedFilters.className = 'd-flex flex-wrap gap-2 w-100 mt-2';
    advancedFilters.innerHTML = `
        <div class="filter-group">
            <label>Monto Min:</label>
            <input type="number" class="form-control form-control-sm" id="orderMinAmount" placeholder="0" style="width:100px;" step="0.01">
        </div>
        <div class="filter-group">
            <label>Monto Max:</label>
            <input type="number" class="form-control form-control-sm" id="orderMaxAmount" placeholder="1000" style="width:100px;" step="0.01">
        </div>
        <div class="filter-group">
            <div class="form-check">
                <input class="form-check-input" type="checkbox" id="orderHasReceipt">
                <label class="form-check-label" for="orderHasReceipt">Con comprobante</label>
            </div>
        </div>
        <button class="btn btn-sm btn-outline-info" onclick="applyOrderFilters()">
            <i class="fas fa-sliders-h me-1"></i> Aplicar Filtros Avanzados
        </button>
    `;
    filterBar.appendChild(advancedFilters);
}

// ============================================
// EXPORTAR CON FORMATO PROFESIONAL
// ============================================
function exportOrders() {
    const filteredOrders = getFilteredOrdersForPrint();
    if (filteredOrders.length === 0) {
        showAlert('No hay pedidos para exportar', 'warning');
        return;
    }
    
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
    const statusCounts = {};
    filteredOrders.forEach(o => {
        const status = o.status || 'pendiente';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    let csv = 'Pedido #,Cliente,Email,Fecha,Total,Estado,Método Pago,Productos,Subtotal,Envío\n';
    filteredOrders.forEach(order => {
        const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '';
        const productNames = order.items ? order.items.map(i => i.name || 'Producto').join('; ') : '';
        csv += `"${order.orderNumber || ''}","${order.userName || ''}","${order.userEmail || ''}","${date}",${parseFloat(order.total) || 0},"${order.status || ''}","${order.paymentMethod || ''}","${productNames}",${parseFloat(order.subtotal) || 0},${parseFloat(order.shipping) || 0}\n`;
    });
    
    // Resumen al final del CSV
    csv += '\n\n"RESUMEN DEL REPORTE"\n';
    csv += `"Total de pedidos:",${filteredOrders.length}\n`;
    csv += `"Ingresos totales:",${totalRevenue.toFixed(2)}\n`;
    csv += `"Ticket promedio:",${(filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0).toFixed(2)}\n`;
    Object.keys(statusCounts).forEach(status => {
        csv += `"${status}:",${statusCounts[status]}\n`;
    });
    
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pedidos_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showAlert(`Exportados ${filteredOrders.length} pedidos con resumen incluido`, 'success');
}

// ============================================
// FUNCIONES ORIGINALES MODIFICADAS (compatibilidad)
// ============================================
function getFilteredOrdersForPrint() {
    const status = document.getElementById('orderStatusFilter')?.value || '';
    const dateFrom = document.getElementById('orderDateFrom')?.value || '';
    const dateTo = document.getElementById('orderDateTo')?.value || '';
    const customerFilter = document.getElementById('orderCustomerFilter')?.value?.toLowerCase() || '';
    const minAmount = parseFloat(document.getElementById('orderMinAmount')?.value) || 0;
    const maxAmount = parseFloat(document.getElementById('orderMaxAmount')?.value) || Infinity;
    const hasReceipt = document.getElementById('orderHasReceipt')?.checked || false;
    
    let filteredOrders = [...allOrders];
    if (status) filteredOrders = filteredOrders.filter(order => order.status === status);
    if (dateFrom) {
        const fromDate = new Date(dateFrom).getTime();
        filteredOrders = filteredOrders.filter(order => order.createdAt >= fromDate);
    }
    if (dateTo) {
        const toDate = new Date(dateTo + 'T23:59:59').getTime();
        filteredOrders = filteredOrders.filter(order => order.createdAt <= toDate);
    }
    if (customerFilter) {
        filteredOrders = filteredOrders.filter(order =>
            (order.userName && order.userName.toLowerCase().includes(customerFilter)) ||
            (order.userEmail && order.userEmail.toLowerCase().includes(customerFilter))
        );
    }
    if (minAmount > 0) {
        filteredOrders = filteredOrders.filter(order => (parseFloat(order.total) || 0) >= minAmount);
    }
    if (maxAmount < Infinity) {
        filteredOrders = filteredOrders.filter(order => (parseFloat(order.total) || 0) <= maxAmount);
    }
    if (hasReceipt) {
        filteredOrders = filteredOrders.filter(order => order.receiptUrl);
    }
    return filteredOrders;
}

function printOrdersList() {
    const filteredOrders = getFilteredOrdersForPrint();
    if (filteredOrders.length === 0) {
        showAlert('No hay pedidos para imprimir', 'warning');
        return;
    }
    
    let tableHtml = '';
    filteredOrders.forEach(order => {
        const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'Sin fecha';
        tableHtml += `
            <tr>
                <td>${order.orderNumber || 'N/A'}</td>
                <td>${order.userName || 'Cliente'}</td>
                <td>${date}</td>
                <td>${formatCurrency(parseFloat(order.total) || 0)}</td>
                <td><span class="badge ${getStatusBadgeClass(order.status)}">${order.status || 'pendiente'}</span></td>
            </tr>
        `;
    });
    
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
    const statusSummary = {};
    filteredOrders.forEach(o => {
        const status = o.status || 'pendiente';
        statusSummary[status] = (statusSummary[status] || 0) + 1;
    });
    const statusHtml = Object.keys(statusSummary).map(s => 
        `<span class="badge ${getStatusBadgeClass(s)} me-2">${s}: ${statusSummary[s]}</span>`
    ).join('');
    
    const w = window.open('', '_blank');
    w.document.write(`
        <!DOCTYPE html>
        <html><head><title>Lista de Pedidos</title>
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; }
            h1 { text-align: center; color: #4361ee; }
            .header { text-align: center; margin-bottom: 30px; }
            .summary { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; display: flex; justify-content: space-around; flex-wrap: wrap; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background-color: #4361ee; color: white; }
            tr:nth-child(even) { background-color: #f8f9fa; }
            .total { font-weight: bold; font-size: 1.2em; margin-top: 20px; text-align: right; }
            @media print { .no-print { display: none; } }
        </style>
        </head>
        <body>
            <h1>📋 Lista de Pedidos</h1>
            <div class="header">
                <p><strong>Fecha de impresión:</strong> ${new Date().toLocaleDateString()}</p>
                <p><strong>Total de pedidos:</strong> ${filteredOrders.length}</p>
            </div>
            <div class="summary">
                <span><strong>Ingresos totales:</strong> ${formatCurrency(totalRevenue)}</span>
                <span><strong>Ticket promedio:</strong> ${formatCurrency(filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0)}</span>
                <span>${statusHtml}</span>
            </div>
            <table>
                <thead><tr><th>Pedido #</th><th>Cliente</th><th>Fecha</th><th>Total</th><th>Estado</th></tr></thead>
                <tbody>${tableHtml}</tbody>
            </table>
            <div class="total">Total ingresos: ${formatCurrency(totalRevenue)}</div>
            <div class="no-print" style="text-align:center;margin-top:30px;">
                <button onclick="window.print()" style="padding:10px 30px;background:#4361ee;color:white;border:none;border-radius:6px;cursor:pointer;">🖨️ Imprimir</button>
                <button onclick="window.close()" style="padding:10px 30px;background:#6c757d;color:white;border:none;border-radius:6px;cursor:pointer;margin-left:10px;">Cerrar</button>
            </div>
        </body></html>
    `);
    w.document.close();
}

// ============================================
// INICIALIZACIÓN DE FILTROS AVANZADOS
// ============================================
// Agregar filtros avanzados cuando se carga el DOM
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(addAdvancedFilters, 500);
});

// ============================================
// REFRESCAR PEDIDOS
// ============================================
function refreshOrders() {
    loadOrders(currentPage || 1);
    showAlert('Pedidos actualizados', 'success');
}