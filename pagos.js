// ============================================
// MÓDULO DE PAGOS - VERSIÓN PROFESIONAL
// ============================================

// Variables para paginación
let paymentsCurrentPage = 1;
let paymentsItemsPerPage = 10;
let filteredPaymentsCache = [];
let paymentStats = {};

// ============================================
// CARGA DE PAGOS CON PAGINACIÓN
// ============================================
function loadPayments(page = 1) {
    paymentsCurrentPage = page;
    const tbody = document.getElementById('paymentsTableBody');
    if (!tbody) return;
    
    if (allPayments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center">No hay pagos registrados</td></tr>';
        updatePaymentsPagination(0);
        return;
    }
    
    const sortedPayments = [...allPayments].sort((a, b) => (b.date || b.createdAt || 0) - (a.date || a.createdAt || 0));
    filteredPaymentsCache = sortedPayments;
    
    const startIndex = (page - 1) * paymentsItemsPerPage;
    const endIndex = Math.min(startIndex + paymentsItemsPerPage, sortedPayments.length);
    const pagePayments = sortedPayments.slice(startIndex, endIndex);
    
    renderPaymentsTable(pagePayments);
    updatePaymentsPagination(sortedPayments.length);
    updatePaymentStats(sortedPayments);
}

function renderPaymentsTable(payments) {
    const tbody = document.getElementById('paymentsTableBody');
    if (!tbody) return;
    
    if (payments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center">No hay pagos para mostrar</td></tr>';
        return;
    }
    
    let html = '';
    payments.forEach(payment => {
        const date = payment.date ? new Date(payment.date).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) : (payment.createdAt ? new Date(payment.createdAt).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }) : 'Sin fecha');
        
        const amount = parseFloat(payment.amount) || 0;
        const status = payment.status || 'pendiente';
        const method = payment.method || 'transferencia';
        const daysAgo = payment.date ? Math.floor((Date.now() - payment.date) / (1000 * 60 * 60 * 24)) : null;
        
        html += `
            <tr class="payment-row" data-payment-id="${payment.id}">
                <td>
                    <span class="badge bg-secondary">${payment.id ? payment.id.substring(0, 8) : 'N/A'}</span>
                    ${daysAgo !== null && daysAgo < 1 ? '<span class="badge bg-danger ms-1">Nuevo</span>' : ''}
                </td>
                <td><strong>${payment.orderNumber || 'N/A'}</strong></td>
                <td>
                    <div><i class="fas fa-user me-1"></i> ${payment.customerName || 'Cliente'}</div>
                    ${payment.customerEmail ? `<small class="text-muted"><i class="fas fa-envelope me-1"></i> ${payment.customerEmail}</small>` : ''}
                </td>
                <td class="fw-bold">${formatCurrencyPayment(amount)}</td>
                <td>
                    <span class="badge ${getMethodBadgeClass(method)}">
                        <i class="${getMethodIcon(method)} me-1"></i> ${getMethodLabel(method)}
                    </span>
                </td>
                <td>
                    <div>${date}</div>
                    ${daysAgo !== null ? `<small class="text-muted">Hace ${daysAgo} día${daysAgo !== 1 ? 's' : ''}</small>` : ''}
                </td>
                <td>
                    <span class="badge ${getPaymentStatusBadge(status)}">
                        <i class="${getPaymentStatusIcon(status)} me-1"></i> ${getPaymentStatusLabel(status)}
                    </span>
                </td>
                <td class="text-center">
                    ${payment.receiptUrl ? 
                        `<a href="${payment.receiptUrl}" target="_blank" class="btn btn-sm btn-outline-primary" title="Ver comprobante">
                            <i class="fas fa-file-invoice"></i>
                        </a>` : 
                        '<span class="text-muted">N/A</span>'
                    }
                </td>
                <td>
                    <div class="btn-group-vertical btn-group-sm" style="width:100%;">
                        <button class="btn-action btn-view w-100" onclick="viewPaymentDetails('${payment.id}')" title="Ver detalles">
                            <i class="fas fa-eye"></i> Ver
                        </button>
                        <button class="btn-action btn-edit w-100 mt-1" onclick="editPaymentStatus('${payment.id}')" title="Editar estado">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        ${status === 'pendiente' ? 
                            `<button class="btn-action btn-process w-100 mt-1" onclick="confirmPayment('${payment.id}')" title="Confirmar pago">
                                <i class="fas fa-check-circle"></i> Confirmar
                            </button>` : ''
                        }
                        ${status === 'confirmado' ? 
                            `<button class="btn-action btn-refund w-100 mt-1" onclick="rejectPayment('${payment.id}')" title="Rechazar pago">
                                <i class="fas fa-times-circle"></i> Rechazar
                            </button>` : ''
                        }
                    </div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function updatePaymentsPagination(totalItems) {
    const paginationContainer = document.getElementById('paymentsPagination');
    if (!paginationContainer) {
        const card = document.querySelector('#paymentsContent .data-card');
        if (card) {
            const paginationDiv = document.createElement('div');
            paginationDiv.id = 'paymentsPagination';
            paginationDiv.className = 'mt-3';
            card.appendChild(paginationDiv);
        }
    }
    
    const paginationEl = document.getElementById('paymentsPagination');
    if (!paginationEl) return;
    
    const totalPages = Math.ceil(totalItems / paymentsItemsPerPage);
    
    if (totalPages <= 1) {
        paginationEl.innerHTML = '';
        return;
    }
    
    let html = `
        <nav aria-label="Navegación de pagos">
            <ul class="pagination justify-content-center pagination-sm">
                <li class="page-item ${paymentsCurrentPage <= 1 ? 'disabled' : ''}">
                    <a class="page-link" href="#" onclick="changePaymentsPage(${paymentsCurrentPage - 1})" tabindex="-1">Anterior</a>
                </li>
    `;
    
    const maxVisible = 5;
    let startPage = Math.max(1, paymentsCurrentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    if (startPage > 1) {
        html += `<li class="page-item"><a class="page-link" href="#" onclick="changePaymentsPage(1)">1</a></li>`;
        if (startPage > 2) html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<li class="page-item ${i === paymentsCurrentPage ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="changePaymentsPage(${i})">${i}</a>
                </li>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        html += `<li class="page-item"><a class="page-link" href="#" onclick="changePaymentsPage(${totalPages})">${totalPages}</a></li>`;
    }
    
    html += `
                <li class="page-item ${paymentsCurrentPage >= totalPages ? 'disabled' : ''}">
                    <a class="page-link" href="#" onclick="changePaymentsPage(${paymentsCurrentPage + 1})">Siguiente</a>
                </li>
            </ul>
            <div class="text-center text-muted small">
                Mostrando ${Math.min((paymentsCurrentPage - 1) * paymentsItemsPerPage + 1, totalItems)} - ${Math.min(paymentsCurrentPage * paymentsItemsPerPage, totalItems)} de ${totalItems} pagos
                &nbsp;|&nbsp; 
                <select class="form-select form-select-sm d-inline-block" style="width:auto;" onchange="changePaymentsItemsPerPage(this.value)">
                    <option value="5" ${paymentsItemsPerPage === 5 ? 'selected' : ''}>5</option>
                    <option value="10" ${paymentsItemsPerPage === 10 ? 'selected' : ''}>10</option>
                    <option value="25" ${paymentsItemsPerPage === 25 ? 'selected' : ''}>25</option>
                    <option value="50" ${paymentsItemsPerPage === 50 ? 'selected' : ''}>50</option>
                </select>
                por página
            </div>
        </nav>
    `;
    
    paginationEl.innerHTML = html;
}

function changePaymentsPage(page) {
    const totalPages = Math.ceil(filteredPaymentsCache.length / paymentsItemsPerPage);
    if (page < 1 || page > totalPages) return;
    loadPayments(page);
}

function changePaymentsItemsPerPage(value) {
    paymentsItemsPerPage = parseInt(value);
    paymentsCurrentPage = 1;
    loadPayments(paymentsCurrentPage);
}

// ============================================
// ESTADÍSTICAS DE PAGOS
// ============================================
function updatePaymentStats(payments) {
    const totalPayments = payments.length;
    const totalAmount = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const confirmed = payments.filter(p => p.status === 'confirmado' || p.status === 'completado').length;
    const pending = payments.filter(p => p.status === 'pendiente').length;
    const rejected = payments.filter(p => p.status === 'rechazado').length;
    const avgPayment = totalPayments > 0 ? totalAmount / totalPayments : 0;
    
    // Actualizar estadísticas en la cabecera
    const statsContainer = document.querySelector('#paymentsContent .data-card .card-header');
    if (statsContainer) {
        const existingStats = statsContainer.querySelector('.payment-stats');
        if (!existingStats) {
            const statsDiv = document.createElement('div');
            statsDiv.className = 'payment-stats d-flex flex-wrap gap-2';
            statsDiv.innerHTML = `
                <span class="badge bg-primary">Total: ${totalPayments}</span>
                <span class="badge bg-success">Confirmados: ${confirmed}</span>
                <span class="badge bg-warning text-dark">Pendientes: ${pending}</span>
                <span class="badge bg-danger">Rechazados: ${rejected}</span>
                <span class="badge bg-info">Promedio: ${formatCurrencyPayment(avgPayment)}</span>
                <span class="badge bg-secondary">Monto: ${formatCurrencyPayment(totalAmount)}</span>
            `;
            statsContainer.appendChild(statsDiv);
        } else {
            existingStats.innerHTML = `
                <span class="badge bg-primary">Total: ${totalPayments}</span>
                <span class="badge bg-success">Confirmados: ${confirmed}</span>
                <span class="badge bg-warning text-dark">Pendientes: ${pending}</span>
                <span class="badge bg-danger">Rechazados: ${rejected}</span>
                <span class="badge bg-info">Promedio: ${formatCurrencyPayment(avgPayment)}</span>
                <span class="badge bg-secondary">Monto: ${formatCurrencyPayment(totalAmount)}</span>
            `;
        }
    }
    
    paymentStats = { totalPayments, totalAmount, confirmed, pending, rejected, avgPayment };
}

// ============================================
// FILTROS AVANZADOS
// ============================================
function applyPaymentFilters() {
    const status = document.getElementById('paymentStatusFilter').value;
    const method = document.getElementById('paymentMethodFilter').value;
    const dateFrom = document.getElementById('paymentDateFrom')?.value || '';
    const dateTo = document.getElementById('paymentDateTo')?.value || '';
    const minAmount = parseFloat(document.getElementById('paymentMinAmount')?.value) || 0;
    const maxAmount = parseFloat(document.getElementById('paymentMaxAmount')?.value) || Infinity;
    const hasReceipt = document.getElementById('paymentHasReceipt')?.checked || false;
    
    let filteredPayments = [...allPayments];
    
    if (status) filteredPayments = filteredPayments.filter(p => p.status === status);
    if (method) filteredPayments = filteredPayments.filter(p => p.method === method);
    if (dateFrom) {
        const fromDate = new Date(dateFrom).getTime();
        filteredPayments = filteredPayments.filter(p => (p.date || p.createdAt || 0) >= fromDate);
    }
    if (dateTo) {
        const toDate = new Date(dateTo + 'T23:59:59').getTime();
        filteredPayments = filteredPayments.filter(p => (p.date || p.createdAt || 0) <= toDate);
    }
    if (minAmount > 0) {
        filteredPayments = filteredPayments.filter(p => (parseFloat(p.amount) || 0) >= minAmount);
    }
    if (maxAmount < Infinity) {
        filteredPayments = filteredPayments.filter(p => (parseFloat(p.amount) || 0) <= maxAmount);
    }
    if (hasReceipt) {
        filteredPayments = filteredPayments.filter(p => p.receiptUrl);
    }
    
    filteredPaymentsCache = filteredPayments;
    paymentsCurrentPage = 1;
    renderPaymentsTable(filteredPayments.slice(0, paymentsItemsPerPage));
    updatePaymentsPagination(filteredPayments.length);
    updatePaymentStats(filteredPayments);
    updatePaymentFilterStats(filteredPayments);
}

function resetPaymentFilters() {
    document.getElementById('paymentStatusFilter').value = '';
    document.getElementById('paymentMethodFilter').value = '';
    if (document.getElementById('paymentDateFrom')) document.getElementById('paymentDateFrom').value = '';
    if (document.getElementById('paymentDateTo')) document.getElementById('paymentDateTo').value = '';
    if (document.getElementById('paymentMinAmount')) document.getElementById('paymentMinAmount').value = '';
    if (document.getElementById('paymentMaxAmount')) document.getElementById('paymentMaxAmount').value = '';
    if (document.getElementById('paymentHasReceipt')) document.getElementById('paymentHasReceipt').checked = false;
    loadPayments(1);
}

function updatePaymentFilterStats(payments) {
    const totalPayments = payments.length;
    const totalAmount = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const pending = payments.filter(p => p.status === 'pendiente').length;
    const confirmed = payments.filter(p => p.status === 'confirmado').length;
    
    let statsContainer = document.getElementById('paymentFilterStats');
    if (!statsContainer) {
        const filterBar = document.querySelector('#paymentsContent .filter-bar');
        if (filterBar) {
            statsContainer = document.createElement('div');
            statsContainer.id = 'paymentFilterStats';
            statsContainer.className = 'w-100 mt-2 p-2 bg-light rounded';
            filterBar.appendChild(statsContainer);
        }
    }
    
    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="d-flex flex-wrap gap-3 justify-content-center">
                <span><strong>${totalPayments}</strong> pagos</span>
                <span><strong>${formatCurrencyPayment(totalAmount)}</strong> total</span>
                <span><strong>${confirmed}</strong> confirmados</span>
                <span><strong>${pending}</strong> pendientes</span>
                <span class="text-muted">${payments.length === allPayments.length ? '(Sin filtros)' : `(${((payments.length / allPayments.length) * 100).toFixed(1)}% del total)`}</span>
            </div>
        `;
    }
}

function addPaymentAdvancedFilters() {
    const filterBar = document.querySelector('#paymentsContent .filter-bar');
    if (!filterBar) return;
    
    if (document.getElementById('paymentMinAmount')) return;
    
    const advancedFilters = document.createElement('div');
    advancedFilters.className = 'd-flex flex-wrap gap-2 w-100 mt-2';
    advancedFilters.innerHTML = `
        <div class="filter-group">
            <label>Desde:</label>
            <input type="date" class="form-control form-control-sm" id="paymentDateFrom" style="width:140px;">
        </div>
        <div class="filter-group">
            <label>Hasta:</label>
            <input type="date" class="form-control form-control-sm" id="paymentDateTo" style="width:140px;">
        </div>
        <div class="filter-group">
            <label>Monto Min:</label>
            <input type="number" class="form-control form-control-sm" id="paymentMinAmount" placeholder="0" style="width:100px;" step="0.01">
        </div>
        <div class="filter-group">
            <label>Monto Max:</label>
            <input type="number" class="form-control form-control-sm" id="paymentMaxAmount" placeholder="1000" style="width:100px;" step="0.01">
        </div>
        <div class="filter-group">
            <div class="form-check">
                <input class="form-check-input" type="checkbox" id="paymentHasReceipt">
                <label class="form-check-label" for="paymentHasReceipt">Con comprobante</label>
            </div>
        </div>
        <button class="btn btn-sm btn-outline-info" onclick="applyPaymentFilters()">
            <i class="fas fa-sliders-h me-1"></i> Aplicar Filtros
        </button>
        <button class="btn btn-sm btn-outline-secondary" onclick="resetPaymentFilters()">
            <i class="fas fa-times me-1"></i> Limpiar
        </button>
    `;
    filterBar.appendChild(advancedFilters);
}

// ============================================
// DETALLES DE PAGO (MEJORADO)
// ============================================
function viewPaymentDetails(paymentId) {
    const payment = allPayments.find(p => p.id === paymentId);
    if (!payment) { showAlert('Pago no encontrado', 'danger'); return; }
    
    const date = payment.date ? new Date(payment.date).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }) : (payment.createdAt ? new Date(payment.createdAt).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }) : 'Sin fecha');
    
    const amount = parseFloat(payment.amount) || 0;
    const status = payment.status || 'pendiente';
    const method = payment.method || 'transferencia';
    
    // Buscar el pedido relacionado
    const relatedOrder = allOrders.find(o => o.orderNumber === payment.orderNumber);
    const orderStatus = relatedOrder ? relatedOrder.status : 'No encontrado';
    
    const content = `
        <div class="row">
            <div class="col-md-6">
                <div class="card mb-3">
                    <div class="card-header bg-light d-flex justify-content-between align-items-center">
                        <h6 class="mb-0"><i class="fas fa-credit-card me-2"></i>Información del Pago</h6>
                        <span class="badge ${getPaymentStatusBadge(status)}">${getPaymentStatusLabel(status)}</span>
                    </div>
                    <div class="card-body">
                        <p><strong>ID de Pago:</strong> <code>${payment.id || 'N/A'}</code></p>
                        <p><strong>Pedido #:</strong> <strong>${payment.orderNumber || 'N/A'}</strong></p>
                        <p><strong>Cliente:</strong> ${payment.customerName || 'Cliente'}</p>
                        ${payment.customerEmail ? `<p><strong>Email:</strong> ${payment.customerEmail}</p>` : ''}
                        <p><strong>Fecha:</strong> ${date}</p>
                        <p><strong>Método:</strong> <span class="badge ${getMethodBadgeClass(method)}">${getMethodLabel(method)}</span></p>
                        <p><strong>Monto:</strong> <span class="fw-bold fs-5">${formatCurrencyPayment(amount)}</span></p>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card mb-3">
                    <div class="card-header bg-light">
                        <h6 class="mb-0"><i class="fas fa-shopping-cart me-2"></i>Información del Pedido</h6>
                    </div>
                    <div class="card-body">
                        <p><strong>Estado del Pedido:</strong> 
                            <span class="badge ${getStatusBadgeClass(orderStatus)}">${orderStatus || 'No encontrado'}</span>
                        </p>
                        ${relatedOrder ? `
                            <p><strong>Total del Pedido:</strong> ${formatCurrencyPayment(parseFloat(relatedOrder.total) || 0)}</p>
                            <p><strong>Productos:</strong> ${relatedOrder.items ? relatedOrder.items.length : 0} items</p>
                            <button class="btn btn-sm btn-outline-primary mt-2" onclick="viewOrderDetails('${relatedOrder.id || relatedOrder.orderNumber}')">
                                <i class="fas fa-eye me-1"></i> Ver Pedido Completo
                            </button>
                        ` : '<p class="text-muted">No se encontró el pedido relacionado</p>'}
                    </div>
                </div>
                ${payment.receiptUrl ? `
                    <div class="card">
                        <div class="card-header bg-light">
                            <h6 class="mb-0"><i class="fas fa-file-invoice me-2"></i>Comprobante de Pago</h6>
                        </div>
                        <div class="card-body text-center">
                            <a href="${payment.receiptUrl}" target="_blank" class="btn btn-primary">
                                <i class="fas fa-download me-2"></i> Ver Comprobante
                            </a>
                            <p class="text-muted small mt-2">Haz clic para abrir el comprobante en una nueva pestaña</p>
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
        ${payment.notes ? `
            <div class="card mt-3">
                <div class="card-header bg-light">
                    <h6 class="mb-0"><i class="fas fa-sticky-note me-2"></i>Notas</h6>
                </div>
                <div class="card-body">
                    <p>${payment.notes}</p>
                </div>
            </div>
        ` : ''}
    `;
    
    document.getElementById('paymentDetailsContent').innerHTML = content;
    new bootstrap.Modal(document.getElementById('paymentDetailsModal')).show();
}

// ============================================
// EDITAR ESTADO DE PAGO (MEJORADO)
// ============================================
function editPaymentStatus(paymentId) {
    const payment = allPayments.find(p => p.id === paymentId);
    if (!payment) { showAlert('Pago no encontrado', 'danger'); return; }
    
    const currentStatus = payment.status || 'pendiente';
    const statusOptions = [
        { value: 'pendiente', label: 'Pendiente' },
        { value: 'confirmado', label: 'Confirmado' },
        { value: 'rechazado', label: 'Rechazado' },
        { value: 'completado', label: 'Completado' }
    ];
    
    const optionsHtml = statusOptions.map(s => 
        `<option value="${s.value}" ${s.value === currentStatus ? 'selected' : ''}>${s.label}</option>`
    ).join('');
    
    const modalHtml = `
        <div class="modal fade" id="editPaymentStatusModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-sm">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Editar Estado de Pago</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p><strong>ID de Pago:</strong> ${payment.id}</p>
                        <p><strong>Pedido:</strong> ${payment.orderNumber}</p>
                        <div class="mb-3">
                            <label class="form-label">Nuevo Estado</label>
                            <select class="form-select" id="editPaymentStatusSelect">${optionsHtml}</select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Nota (opcional)</label>
                            <input type="text" class="form-control" id="editPaymentNote" placeholder="Agregar nota...">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="updatePaymentStatusFromModal('${payment.id}')">
                            <i class="fas fa-save me-1"></i> Guardar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const container = document.createElement('div');
    container.innerHTML = modalHtml;
    document.body.appendChild(container);
    const modal = new bootstrap.Modal(document.getElementById('editPaymentStatusModal'));
    modal.show();
    document.getElementById('editPaymentStatusModal').addEventListener('hidden.bs.modal', () => container.remove());
}

function updatePaymentStatusFromModal(paymentId) {
    const newStatus = document.getElementById('editPaymentStatusSelect').value;
    const note = document.getElementById('editPaymentNote').value;
    
    const payment = allPayments.find(p => p.id === paymentId);
    if (!payment) { showAlert('Pago no encontrado', 'danger'); return; }
    
    if (newStatus !== payment.status) {
        updatePaymentStatus(paymentId, newStatus, note);
    }
    
    bootstrap.Modal.getInstance(document.getElementById('editPaymentStatusModal')).hide();
    showAlert('Estado del pago actualizado', 'success');
}

function updatePaymentStatus(paymentId, newStatus, note = '') {
    const payment = allPayments.find(p => p.id === paymentId);
    if (!payment) return;
    
    const oldStatus = payment.status || 'pendiente';
    payment.status = newStatus;
    payment.updatedAt = Date.now();
    payment.notes = note || payment.notes || '';
    
    // Actualizar el pedido relacionado
    const orderIndex = allOrders.findIndex(o => o.orderNumber === payment.orderNumber);
    if (orderIndex !== -1) {
        if (newStatus === 'confirmado' || newStatus === 'completado') {
            allOrders[orderIndex].status = 'confirmado';
        } else if (newStatus === 'rechazado') {
            allOrders[orderIndex].status = 'cancelado';
        }
        allOrders[orderIndex].updatedAt = Date.now();
        
        if (firebaseDatabase && allOrders[orderIndex].id) {
            firebaseDatabase.ref('orders/' + allOrders[orderIndex].id).update({
                status: allOrders[orderIndex].status,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            }).catch(console.error);
        }
        updateLocalOrder(allOrders[orderIndex]);
    }
    
    // Guardar en Firebase
    if (firebaseDatabase && payment.id && !payment.id.startsWith('payment-')) {
        firebaseDatabase.ref('payments/' + payment.id).update({
            status: newStatus,
            updatedAt: firebase.database.ServerValue.TIMESTAMP,
            notes: payment.notes
        }).catch(console.error);
    }
    
    // Guardar en la lista de pagos de Firebase
    if (firebaseDatabase && payment.id && payment.id.startsWith('payment-')) {
        // Si es un pago generado desde pedido, actualizar también en payments
        const paymentRef = firebaseDatabase.ref('payments');
        const newPaymentRef = paymentRef.push();
        const paymentData = { ...payment };
        delete paymentData.id;
        newPaymentRef.set({
            ...paymentData,
            id: newPaymentRef.key
        }).catch(console.error);
    }
    
    loadPayments(paymentsCurrentPage);
    showAlert(`Estado del pago actualizado de "${oldStatus}" a "${newStatus}"`, 'success');
}

// ============================================
// ACCIONES RÁPIDAS
// ============================================
function confirmPayment(paymentId) {
    if (!confirm('¿Confirmar este pago? El pedido pasará a estado "confirmado".')) return;
    updatePaymentStatus(paymentId, 'confirmado', 'Pago confirmado por administrador');
}

function rejectPayment(paymentId) {
    const reason = prompt('Motivo del rechazo:', 'Pago no válido');
    if (reason === null) return;
    updatePaymentStatus(paymentId, 'rechazado', 'Pago rechazado: ' + reason);
}

// ============================================
// EXPORTAR PAGOS (MEJORADO)
// ============================================
function exportPayments() {
    const filteredPayments = getFilteredPaymentsForExport();
    if (filteredPayments.length === 0) {
        showAlert('No hay pagos para exportar', 'warning');
        return;
    }
    
    const totalAmount = filteredPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const statusCounts = {};
    filteredPayments.forEach(p => {
        const status = p.status || 'pendiente';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    let csv = 'ID,ID de Pago,Pedido #,Cliente,Email,Monto,Método,Fecha,Estado,Comprobante,Notas\n';
    filteredPayments.forEach(payment => {
        const date = payment.date ? new Date(payment.date).toLocaleDateString() : (payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : '');
        csv += `"${payment.id || ''}","${payment.id || ''}","${payment.orderNumber || ''}","${payment.customerName || ''}","${payment.customerEmail || ''}",${parseFloat(payment.amount) || 0},"${payment.method || ''}","${date}","${payment.status || ''}","${payment.receiptUrl ? 'Sí' : 'No'}","${payment.notes || ''}"\n`;
    });
    
    // Resumen al final del CSV
    csv += '\n\n"RESUMEN DEL REPORTE DE PAGOS"\n';
    csv += `"Total de pagos:",${filteredPayments.length}\n`;
    csv += `"Monto total:",${totalAmount.toFixed(2)}\n`;
    csv += `"Promedio por pago:",${(filteredPayments.length > 0 ? totalAmount / filteredPayments.length : 0).toFixed(2)}\n`;
    Object.keys(statusCounts).forEach(status => {
        csv += `"${status}:",${statusCounts[status]}\n`;
    });
    
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pagos_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showAlert(`Exportados ${filteredPayments.length} pagos con resumen`, 'success');
}

function getFilteredPaymentsForExport() {
    const status = document.getElementById('paymentStatusFilter')?.value || '';
    const method = document.getElementById('paymentMethodFilter')?.value || '';
    const dateFrom = document.getElementById('paymentDateFrom')?.value || '';
    const dateTo = document.getElementById('paymentDateTo')?.value || '';
    const minAmount = parseFloat(document.getElementById('paymentMinAmount')?.value) || 0;
    const maxAmount = parseFloat(document.getElementById('paymentMaxAmount')?.value) || Infinity;
    const hasReceipt = document.getElementById('paymentHasReceipt')?.checked || false;
    
    let filteredPayments = [...allPayments];
    if (status) filteredPayments = filteredPayments.filter(p => p.status === status);
    if (method) filteredPayments = filteredPayments.filter(p => p.method === method);
    if (dateFrom) {
        const fromDate = new Date(dateFrom).getTime();
        filteredPayments = filteredPayments.filter(p => (p.date || p.createdAt || 0) >= fromDate);
    }
    if (dateTo) {
        const toDate = new Date(dateTo + 'T23:59:59').getTime();
        filteredPayments = filteredPayments.filter(p => (p.date || p.createdAt || 0) <= toDate);
    }
    if (minAmount > 0) filteredPayments = filteredPayments.filter(p => (parseFloat(p.amount) || 0) >= minAmount);
    if (maxAmount < Infinity) filteredPayments = filteredPayments.filter(p => (parseFloat(p.amount) || 0) <= maxAmount);
    if (hasReceipt) filteredPayments = filteredPayments.filter(p => p.receiptUrl);
    return filteredPayments;
}

// ============================================
// SINCRONIZAR PAGOS CON PEDIDOS
// ============================================
function syncPaymentsFromOrders() {
    // Esta función se llama desde el script principal cuando se cargan los pedidos
    allOrders.forEach(order => {
        if (order.receiptUrl && !allPayments.some(p => p.orderNumber === order.orderNumber)) {
            allPayments.push({
                id: 'payment-' + order.orderNumber + '-' + Date.now(),
                orderNumber: order.orderNumber,
                customerName: order.userName || 'Cliente',
                customerEmail: order.userEmail || '',
                amount: order.total || 0,
                method: order.paymentMethod || 'transferencia',
                date: order.createdAt || Date.now(),
                createdAt: order.createdAt || Date.now(),
                status: order.status === 'pendiente' ? 'pendiente' : 'confirmado',
                receiptUrl: order.receiptUrl,
                notes: 'Sincronizado desde pedido',
                syncedFromOrder: true
            });
        }
    });
    
    // Guardar pagos sincronizados en Firebase
    if (firebaseDatabase) {
        const syncedPayments = allPayments.filter(p => p.syncedFromOrder);
        syncedPayments.forEach(payment => {
            const paymentData = { ...payment };
            delete paymentData.id;
            delete paymentData.syncedFromOrder;
            const newRef = firebaseDatabase.ref('payments').push();
            paymentData.id = newRef.key;
            newRef.set(paymentData).catch(console.error);
            // Actualizar el id en el objeto local
            const localPayment = allPayments.find(p => p.id === payment.id);
            if (localPayment) localPayment.id = newRef.key;
        });
    }
}

// ============================================
// UTILIDADES
// ============================================
function formatCurrencyPayment(value) {
    if (isNaN(value) || value === null || value === undefined) return '$0.00';
    return '$' + parseFloat(value).toFixed(2);
}

function getPaymentStatusBadge(status) {
    switch(status) {
        case 'pendiente': return 'badge-pending';
        case 'confirmado': return 'badge-delivered';
        case 'completado': return 'badge-delivered';
        case 'rechazado': return 'badge-cancelled';
        default: return 'badge-secondary';
    }
}

function getPaymentStatusLabel(status) {
    switch(status) {
        case 'pendiente': return 'Pendiente';
        case 'confirmado': return 'Confirmado';
        case 'completado': return 'Completado';
        case 'rechazado': return 'Rechazado';
        default: return status || 'Desconocido';
    }
}

function getPaymentStatusIcon(status) {
    switch(status) {
        case 'pendiente': return 'fas fa-clock';
        case 'confirmado': return 'fas fa-check-circle';
        case 'completado': return 'fas fa-check-double';
        case 'rechazado': return 'fas fa-times-circle';
        default: return 'fas fa-question-circle';
    }
}

function getMethodBadgeClass(method) {
    switch(method) {
        case 'transferencia': return 'bg-info';
        case 'tarjeta': return 'bg-primary';
        case 'efectivo': return 'bg-success';
        case 'paypal': return 'bg-warning text-dark';
        default: return 'bg-secondary';
    }
}

function getMethodIcon(method) {
    switch(method) {
        case 'transferencia': return 'fas fa-university';
        case 'tarjeta': return 'fas fa-credit-card';
        case 'efectivo': return 'fas fa-money-bill-wave';
        case 'paypal': return 'fab fa-paypal';
        default: return 'fas fa-question-circle';
    }
}

function getMethodLabel(method) {
    switch(method) {
        case 'transferencia': return 'Transferencia';
        case 'tarjeta': return 'Tarjeta';
        case 'efectivo': return 'Efectivo';
        case 'paypal': return 'PayPal';
        default: return method || 'Desconocido';
    }
}

function getStatusBadgeClass(status) {
    switch(status) {
        case 'pendiente': return 'badge-pending';
        case 'confirmado': return 'badge-confirmed';
        case 'enviado': return 'badge-shipped';
        case 'completado': return 'badge-delivered';
        case 'cancelado': return 'badge-cancelled';
        default: return 'badge-secondary';
    }
}

function updateLocalOrder(updatedOrder) {
    try {
        let localOrders = JSON.parse(localStorage.getItem('localOrders')) || [];
        const index = localOrders.findIndex(o => o.orderNumber === updatedOrder.orderNumber);
        if (index !== -1) localOrders[index] = updatedOrder;
        else localOrders.push(updatedOrder);
        localStorage.setItem('localOrders', JSON.stringify(localOrders));
    } catch (error) { console.error('Error actualizando pedido local:', error); }
}

// ============================================
// REFRESCAR PAGOS
// ============================================
function refreshPayments() { loadPayments(paymentsCurrentPage || 1); showAlert('Pagos actualizados', 'success'); }

// ============================================
// INICIALIZACIÓN DE FILTROS AVANZADOS
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(addPaymentAdvancedFilters, 500);
});

// ============================================
// SOBRESCRIBIR FUNCIÓN ORIGINAL PARA COMPATIBILIDAD
// ============================================
// La función updatePaymentsTable ahora es llamada desde loadPayments
// Esta función se mantiene para compatibilidad con otros módulos
function updatePaymentsTable(payments) {
    if (payments) {
        filteredPaymentsCache = payments;
        renderPaymentsTable(payments);
        updatePaymentsPagination(payments.length);
        updatePaymentStats(payments);
    } else {
        loadPayments(paymentsCurrentPage || 1);
    }
}