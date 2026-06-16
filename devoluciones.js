// ============================================
// MÓDULO DE DEVOLUCIONES
// ============================================

function updateRefundsTable(refunds) {
    if (!refunds) refunds = allRefunds;
    const tbody = document.getElementById('refundsTableBody');
    if (!tbody) return;
    if (refunds.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No hay devoluciones registradas</td></tr>';
        return;
    }
    let html = '';
    refunds.forEach(refund => {
        const date = refund.date ? new Date(refund.date).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }) : 'Sin fecha';
        html += `
            <tr>
                <td>${refund.id || 'N/A'}</td>
                <td><strong>${refund.orderNumber || 'N/A'}</strong></td>
                <td>${refund.customerName || 'Cliente'}</td>
                <td>${refund.reason || 'Sin motivo'}</td>
                <td>$${(parseFloat(refund.amount) || 0).toFixed(2)}</td>
                <td>${date}</td>
                <td><span class="badge ${getRefundStatusClass(refund.status)}">${refund.status || 'pendiente'}</span></td>
                <td>
                    <button class="btn-action btn-view me-1" onclick="viewRefundDetails('${refund.id}')"><i class="fas fa-eye"></i></button>
                    <button class="btn-action btn-process me-1" onclick="processRefund('${refund.id}')"><i class="fas fa-forward"></i></button>
                    <button class="btn-action btn-delete" onclick="deleteRefund('${refund.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

function applyRefundFilters() {
    const status = document.getElementById('refundStatusFilter').value;
    let filteredRefunds = [...allRefunds];
    if (status) filteredRefunds = filteredRefunds.filter(r => r.status === status);
    updateRefundsTable(filteredRefunds);
}

function showAddRefundModal() {
    const orderOptions = allOrders.map(order =>
        `<option value="${order.orderNumber}">${order.orderNumber} - ${order.userName} - $${(parseFloat(order.total) || 0).toFixed(2)}</option>`
    ).join('');
    const modalHtml = `
        <div class="modal fade" id="addRefundModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header"><h5 class="modal-title">Nueva Devolución</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                    <div class="modal-body">
                        <form id="refundForm">
                            <div class="mb-3"><label class="form-label">Pedido</label><select class="form-select" id="refundOrder" required><option value="">Seleccionar pedido...</option>${orderOptions}</select></div>
                            <div class="mb-3"><label class="form-label">Motivo</label><select class="form-select" id="refundReason" required><option value="">Seleccionar motivo...</option><option value="producto_danado">Producto dañado</option><option value="producto_incorrecto">Producto incorrecto</option><option value="talla_incorrecta">Talla incorrecta</option><option value="arrepentimiento">Arrepentimiento de compra</option><option value="calidad">Problema de calidad</option><option value="otro">Otro</option></select></div>
                            <div class="mb-3"><label class="form-label">Monto a Reembolsar ($)</label><input type="number" class="form-control" id="refundAmount" step="0.01" required></div>
                            <div class="mb-3"><label class="form-label">Notas Adicionales</label><textarea class="form-control" id="refundNotes" rows="3"></textarea></div>
                        </form>
                    </div>
                    <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button><button type="button" class="btn btn-primary" onclick="saveRefund()">Guardar Devolución</button></div>
                </div>
            </div>
        </div>
    `;
    const container = document.createElement('div');
    container.innerHTML = modalHtml;
    document.body.appendChild(container);
    const modal = new bootstrap.Modal(document.getElementById('addRefundModal'));
    modal.show();
    document.getElementById('refundOrder').addEventListener('change', function() {
        const order = allOrders.find(o => o.orderNumber === this.value);
        const refundAmount = document.getElementById('refundAmount');
        if (order && order.total && refundAmount) refundAmount.value = parseFloat(order.total).toFixed(2);
    });
    document.getElementById('addRefundModal').addEventListener('hidden.bs.modal', function() {
        document.body.removeChild(container);
    });
}

function saveRefund() {
    const orderNumber = document.getElementById('refundOrder').value;
    const reason = document.getElementById('refundReason').value;
    const amount = parseFloat(document.getElementById('refundAmount').value);
    const notes = document.getElementById('refundNotes').value;
    if (!orderNumber || !reason || isNaN(amount)) {
        showAlert('Complete todos los campos requeridos', 'warning');
        return;
    }
    const order = allOrders.find(o => o.orderNumber === orderNumber);
    if (!order) { showAlert('Pedido no encontrado', 'danger'); return; }
    const newRefund = {
        id: 'refund-' + Date.now(),
        orderNumber,
        customerName: order.userName,
        customerEmail: order.userEmail,
        reason,
        amount,
        notes,
        date: Date.now(),
        status: 'pendiente'
    };
    allRefunds.push(newRefund);
    if (firebaseDatabase) {
        firebaseDatabase.ref('refunds/' + newRefund.id).set(newRefund).catch(console.error);
    }
    try { localStorage.setItem('adminRefunds', JSON.stringify(allRefunds)); } catch (e) {}
    updateRefundsTable();
    updatePendingRefundsCount();
    bootstrap.Modal.getInstance(document.getElementById('addRefundModal')).hide();
    showAlert('Devolución registrada exitosamente', 'success');
}

function viewRefundDetails(refundId) {
    const refund = allRefunds.find(r => r.id === refundId);
    if (!refund) { showAlert('Devolución no encontrada', 'danger'); return; }
    const date = refund.date ? new Date(refund.date).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }) : 'Sin fecha';
    alert(`
        Detalles de la Devolución:
        ID: ${refund.id}
        Pedido: ${refund.orderNumber}
        Cliente: ${refund.customerName}
        Motivo: ${refund.reason}
        Monto: $${(parseFloat(refund.amount) || 0).toFixed(2)}
        Fecha: ${date}
        Estado: ${refund.status}
        Notas: ${refund.notes || 'Sin notas adicionales'}
    `);
}

function processRefund(refundId) {
    const refund = allRefunds.find(r => r.id === refundId);
    if (!refund) { showAlert('Devolución no encontrada', 'danger'); return; }
    let nextStatus = 'procesando';
    switch (refund.status) {
        case 'pendiente':
            nextStatus = 'procesando';
            break;
        case 'procesando':
            nextStatus = 'completado';
            break;
        default:
            nextStatus = 'completado';
    }
    if (confirm(`¿Cambiar estado de la devolución de "${refund.status}" a "${nextStatus}"?`)) {
        refund.status = nextStatus;
        if (firebaseDatabase && refund.id && !refund.id.startsWith('refund-')) {
            firebaseDatabase.ref('refunds/' + refund.id).update({ status: nextStatus }).catch(console.error);
        }
        try { localStorage.setItem('adminRefunds', JSON.stringify(allRefunds)); } catch (e) {}
        updateRefundsTable();
        updatePendingRefundsCount();
        showAlert(`Devolución marcada como "${nextStatus}"`, 'success');
    }
}

function deleteRefund(refundId) {
    if (!confirm('¿Estás seguro de eliminar esta devolución?')) return;
    const index = allRefunds.findIndex(r => r.id === refundId);
    if (index !== -1) {
        allRefunds.splice(index, 1);
        if (firebaseDatabase && refundId && !refundId.startsWith('refund-')) {
            firebaseDatabase.ref('refunds/' + refundId).remove().catch(console.error);
        }
        try { localStorage.setItem('adminRefunds', JSON.stringify(allRefunds)); } catch (e) {}
        updateRefundsTable();
        updatePendingRefundsCount();
        showAlert('Devolución eliminada', 'success');
    }
}

function updatePendingRefundsCount() {
    const pendingRefunds = allRefunds.filter(r => r.status === 'pendiente');
    const badge = document.getElementById('pendingRefundsBadge');
    if (badge) badge.textContent = pendingRefunds.length;
}

function exportRefunds() {
    let csv = 'ID,Pedido #,Cliente,Motivo,Monto,Fecha,Estado,Notas\n';
    allRefunds.forEach(refund => {
        const date = refund.date ? new Date(refund.date).toLocaleDateString() : '';
        csv +=
            `"${refund.id || ''}","${refund.orderNumber || ''}","${refund.customerName || ''}","${refund.reason || ''}",${parseFloat(refund.amount) || 0},"${date}","${refund.status || ''}","${refund.notes || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devoluciones_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showAlert(`Exportadas ${allRefunds.length} devoluciones`, 'success');
}

function refreshRefunds() { updateRefundsTable(); }