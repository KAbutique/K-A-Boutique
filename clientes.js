// ============================================
// MÓDULO DE CLIENTES
// ============================================

function loadCustomers() {
    updateCustomersTable();
}

function searchCustomers() {
    const searchTerm = document.getElementById('customerSearch').value.toLowerCase();
    const dateFrom = document.getElementById('customerDateFrom').value;
    let filteredCustomers = [...allCustomers];
    if (searchTerm) {
        filteredCustomers = filteredCustomers.filter(c =>
            c.name.toLowerCase().includes(searchTerm) ||
            c.email.toLowerCase().includes(searchTerm) ||
            c.phone.toLowerCase().includes(searchTerm) ||
            c.company.toLowerCase().includes(searchTerm)
        );
    }
    if (dateFrom) {
        const fromDate = new Date(dateFrom).getTime();
        filteredCustomers = filteredCustomers.filter(c => c.registrationDate >= fromDate);
    }
    updateCustomersTable(filteredCustomers);
}

function updateCustomersTable(customers) {
    if (!customers) customers = allCustomers;
    const tbody = document.getElementById('customersTableBody');
    if (!tbody) return;
    if (customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">No hay clientes registrados</td></tr>';
        return;
    }
    let html = '';
    customers.forEach(customer => {
        const regDate = customer.registrationDate ? new Date(customer.registrationDate).toLocaleDateString(
            'es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Sin fecha';
        html += `
            <tr>
                <td>${customer.id.substring(0, 8)}...</td>
                <td>${customer.name}</td>
                <td>${customer.email}</td>
                <td>${customer.phone || 'N/A'}</td>
                <td>${customer.company || 'N/A'}</td>
                <td>${regDate}</td>
                <td class="text-center">${customer.orderCount}</td>
                <td>$${customer.totalSpent.toFixed(2)}</td>
                <td>
                    <button class="btn-action btn-view me-1" onclick="viewCustomerDetails('${customer.id}')"><i class="fas fa-eye"></i></button>
                    <button class="btn-action btn-edit me-1" onclick="editCustomer('${customer.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-action btn-delete" onclick="deleteCustomer('${customer.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

function showAddCustomerModal() {
    document.getElementById('customerModalTitle').textContent = 'Nuevo Cliente';
    document.getElementById('customerForm').reset();
    document.getElementById('customerModal').dataset.customerId = '';
    new bootstrap.Modal(document.getElementById('customerModal')).show();
}

function saveCustomer() {
    const name = document.getElementById('custName').value;
    const email = document.getElementById('custEmail').value;
    const phone = document.getElementById('custPhone').value;
    const company = document.getElementById('custCompany').value;
    const gender = document.getElementById('custGender').value;
    const birthdate = document.getElementById('custBirthdate').value;
    const shippingAddress = document.getElementById('custShippingAddress').value;
    const billingAddress = document.getElementById('custBillingAddress').value;
    const country = document.getElementById('custCountry').value;
    const state = document.getElementById('custState').value;
    const city = document.getElementById('custCity').value;
    const notes = document.getElementById('custNotes').value;
    const newsletter = document.getElementById('custNewsletter').checked;

    if (!name || !email) {
        showAlert('Nombre y email son requeridos', 'warning');
        return;
    }
    const modalElement = document.getElementById('customerModal');
    const editId = modalElement.dataset.customerId;

    if (editId) {
        const index = allCustomers.findIndex(c => c.id === editId);
        if (index !== -1) {
            const customer = allCustomers[index];
            customer.name = name;
            customer.email = email;
            customer.phone = phone;
            customer.company = company;
            customer.gender = gender;
            customer.birthdate = birthdate;
            customer.shippingAddress = shippingAddress;
            customer.billingAddress = billingAddress;
            customer.country = country;
            customer.state = state;
            customer.city = city;
            customer.notes = notes;
            customer.newsletter = newsletter;
            if (firebaseDatabase) {
                firebaseDatabase.ref('users/' + editId).update({
                    name, email, phone, company, gender, birthdate,
                    shippingAddress, billingAddress, country, state, city, notes, newsletter
                }).catch(console.error);
            }
            showAlert('Cliente actualizado', 'success');
        }
    } else {
        const newCustomer = {
            id: 'customer-' + Date.now(),
            name,
            email,
            phone,
            company,
            gender,
            birthdate,
            shippingAddress,
            billingAddress,
            country,
            state,
            city,
            notes,
            newsletter,
            registrationDate: Date.now(),
            orderCount: 0,
            totalSpent: 0
        };
        allCustomers.push(newCustomer);
        if (firebaseDatabase) {
            firebaseDatabase.ref('users/' + newCustomer.id).set({
                name, email, phone, company, gender, birthdate,
                shippingAddress, billingAddress, country, state, city, notes, newsletter,
                createdAt: Date.now()
            }).catch(console.error);
        }
        showAlert('Cliente guardado exitosamente', 'success');
    }
    updateCustomersTable();
    bootstrap.Modal.getInstance(document.getElementById('customerModal')).hide();
}

function viewCustomerDetails(customerId) {
    const customer = allCustomers.find(c => c.id === customerId);
    if (!customer) {
        showAlert('Cliente no encontrado', 'danger');
        return;
    }
    const regDate = customer.registrationDate ? new Date(customer.registrationDate).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }) : 'Sin fecha';
    const customerOrders = allOrders.filter(order => order.userEmail === customer.email);
    let ordersHtml = '';
    if (customerOrders.length > 0) {
        customerOrders.slice(0, 5).forEach(order => {
            const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }) : 'Sin fecha';
            ordersHtml += `
                <tr>
                    <td>${order.orderNumber}</td>
                    <td>${orderDate}</td>
                    <td>$${(parseFloat(order.total) || 0).toFixed(2)}</td>
                    <td><span class="badge ${getStatusBadgeClass(order.status)}">${order.status || 'pendiente'}</span></td>
                </tr>
            `;
        });
    }
    const content = `
        <div class="row">
            <div class="col-md-6">
                <div class="card mb-3"><div class="card-header bg-light"><h6 class="mb-0">Información del Cliente</h6></div><div class="card-body">
                    <p><strong>Nombre:</strong> ${customer.name}</p>
                    <p><strong>Email:</strong> ${customer.email}</p>
                    <p><strong>Teléfono:</strong> ${customer.phone || 'N/A'}</p>
                    <p><strong>Empresa:</strong> ${customer.company || 'N/A'}</p>
                    <p><strong>Género:</strong> ${customer.gender || 'N/A'}</p>
                    <p><strong>Fecha de Nacimiento:</strong> ${customer.birthdate || 'N/A'}</p>
                    <p><strong>País:</strong> ${customer.country || 'N/A'}</p>
                    <p><strong>Estado:</strong> ${customer.state || 'N/A'}</p>
                    <p><strong>Ciudad:</strong> ${customer.city || 'N/A'}</p>
                    <p><strong>Fecha de Registro:</strong> ${regDate}</p>
                    <p><strong>Newsletter:</strong> ${customer.newsletter ? 'Sí' : 'No'}</p>
                </div></div>
            </div>
            <div class="col-md-6">
                <div class="card mb-3"><div class="card-header bg-light"><h6 class="mb-0">Direcciones</h6></div><div class="card-body">
                    <p><strong>Dirección de Envío:</strong><br>${customer.shippingAddress || 'N/A'}</p>
                    <p><strong>Dirección de Facturación:</strong><br>${customer.billingAddress || 'N/A'}</p>
                </div></div>
                <div class="card mb-3"><div class="card-header bg-light"><h6 class="mb-0">Estadísticas</h6></div><div class="card-body">
                    <div class="row text-center">
                        <div class="col-6"><h3>${customer.orderCount}</h3><p class="text-muted">Pedidos</p></div>
                        <div class="col-6"><h3>$${customer.totalSpent.toFixed(2)}</h3><p class="text-muted">Total Gastado</p></div>
                    </div>
                </div></div>
                ${customer.notes ? `<div class="card"><div class="card-header bg-light"><h6 class="mb-0">Notas</h6></div><div class="card-body"><p>${customer.notes}</p></div></div>` : ''}
            </div>
        </div>
        ${customerOrders.length > 0 ? `
        <div class="card"><div class="card-header bg-light"><h6 class="mb-0">Pedidos Recientes (${customerOrders.length} total)</h6></div><div class="card-body">
            <div class="table-responsive">
                <table class="table table-sm">
                    <thead><tr><th>Pedido #</th><th>Fecha</th><th>Total</th><th>Estado</th></tr></thead>
                    <tbody>${ordersHtml}</tbody>
                </table>
            </div>
            ${customerOrders.length > 5 ? `<p class="text-center mt-2"><a href="#" onclick="showCustomerOrders('${customer.email}')">Ver todos los pedidos</a></p>` : ''}
        </div></div>` : '<p class="text-muted">Este cliente no ha realizado pedidos aún.</p>'}
    `;
    document.getElementById('customerDetailsContent').innerHTML = content;
    new bootstrap.Modal(document.getElementById('customerDetailsModal')).show();
}

function showCustomerOrders(customerEmail) {
    document.getElementById('orderCustomerFilter').value = customerEmail;
    showOrders();
    applyOrderFilters();
}

function editCustomer(customerId) {
    const customer = allCustomers.find(c => c.id === customerId);
    if (!customer) {
        showAlert('Cliente no encontrado', 'danger');
        return;
    }
    document.getElementById('customerModalTitle').textContent = 'Editar Cliente';
    document.getElementById('custName').value = customer.name;
    document.getElementById('custEmail').value = customer.email;
    document.getElementById('custPhone').value = customer.phone || '';
    document.getElementById('custCompany').value = customer.company || '';
    document.getElementById('custGender').value = customer.gender || '';
    document.getElementById('custBirthdate').value = customer.birthdate || '';
    document.getElementById('custShippingAddress').value = customer.shippingAddress || '';
    document.getElementById('custBillingAddress').value = customer.billingAddress || '';
    document.getElementById('custCountry').value = customer.country || '';
    document.getElementById('custState').value = customer.state || '';
    document.getElementById('custCity').value = customer.city || '';
    document.getElementById('custNotes').value = customer.notes || '';
    document.getElementById('custNewsletter').checked = customer.newsletter || false;
    document.getElementById('customerModal').dataset.customerId = customerId;
    new bootstrap.Modal(document.getElementById('customerModal')).show();
}

function deleteCustomer(customerId) {
    if (!confirm('¿Estás seguro de eliminar este cliente?')) return;
    const index = allCustomers.findIndex(c => c.id === customerId);
    if (index !== -1) {
        allCustomers.splice(index, 1);
        if (firebaseDatabase) {
            firebaseDatabase.ref('users/' + customerId).remove().catch(console.error);
        }
        updateCustomersTable();
        showAlert('Cliente eliminado', 'success');
    }
}

function exportCustomers() {
    let csv = 'ID,Nombre,Email,Teléfono,Empresa,Género,Nacimiento,País,Estado,Ciudad,Newsletter,Fecha Registro,Pedidos,Total Gastado\n';
    allCustomers.forEach(customer => {
        const regDate = customer.registrationDate ? new Date(customer.registrationDate).toLocaleDateString() : '';
        csv +=
            `"${customer.id || ''}","${customer.name || ''}","${customer.email || ''}","${customer.phone || ''}","${customer.company || ''}","${customer.gender || ''}","${customer.birthdate || ''}","${customer.country || ''}","${customer.state || ''}","${customer.city || ''}","${customer.newsletter ? 'Sí' : 'No'}","${regDate}",${customer.orderCount},${customer.totalSpent.toFixed(2)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientes_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showAlert(`Exportados ${allCustomers.length} clientes`, 'success');
}

function refreshCustomers() {
    updateCustomersTable();
}