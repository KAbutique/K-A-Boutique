// ============================================
// MÓDULO DE CLIENTES - VERSIÓN CORREGIDA
// ============================================

// Variables para paginación
let customersCurrentPage = 1;
let customersItemsPerPage = 10;
let filteredCustomersCache = [];

// ============================================
// SISTEMA DE NOTIFICACIONES
// ============================================
function showAlert(message, type = 'info') {
    alert(message);
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// ============================================
// LISTAS DESPLEGABLES
// ============================================
const countriesList = [
    { code: 'EC', name: 'Ecuador' },
    { code: 'CO', name: 'Colombia' },
    { code: 'PE', name: 'Perú' },
    { code: 'AR', name: 'Argentina' },
    { code: 'CL', name: 'Chile' },
    { code: 'MX', name: 'México' },
    { code: 'ES', name: 'España' },
    { code: 'US', name: 'Estados Unidos' },
    { code: 'CA', name: 'Canadá' },
    { code: 'BR', name: 'Brasil' },
    { code: 'UY', name: 'Uruguay' },
    { code: 'PY', name: 'Paraguay' },
    { code: 'BO', name: 'Bolivia' },
    { code: 'VE', name: 'Venezuela' },
    { code: 'PA', name: 'Panamá' },
    { code: 'CR', name: 'Costa Rica' },
    { code: 'NI', name: 'Nicaragua' },
    { code: 'SV', name: 'El Salvador' },
    { code: 'GT', name: 'Guatemala' },
    { code: 'HN', name: 'Honduras' }
];

const provincesEcuador = [
    'Azuay', 'Bolívar', 'Cañar', 'Carchi', 'Chimborazo', 'Cotopaxi', 'El Oro',
    'Esmeraldas', 'Galápagos', 'Guayas', 'Imbabura', 'Loja', 'Los Ríos', 'Manabí',
    'Morona Santiago', 'Napo', 'Orellana', 'Pastaza', 'Pichincha', 'Santa Elena',
    'Santo Domingo de los Tsáchilas', 'Sucumbíos', 'Tungurahua', 'Zamora Chinchipe'
];

const citiesByProvince = {
    'Azuay': ['Cuenca', 'Gualaceo', 'Paute', 'Santa Isabel', 'Sigsig'],
    'Pichincha': ['Quito', 'Cayambe', 'Mejía', 'Pedro Moncayo', 'Pedro Vicente Maldonado', 'Puerto Quito', 'Rumiñahui', 'San Miguel de Los Bancos'],
    'Guayas': ['Guayaquil', 'Durán', 'Milagro', 'Quevedo', 'Samborondón', 'Daule', 'Santa Elena'],
    'Manabí': ['Portoviejo', 'Manta', 'Montecristi', 'Jipijapa', 'Chone', 'Bahía de Caráquez'],
    'El Oro': ['Machala', 'Santa Rosa', 'Pasaje', 'Huaquillas', 'Zaruma'],
    'Tungurahua': ['Ambato', 'Baños', 'Pelileo', 'Píllaro'],
    'Cotopaxi': ['Latacunga', 'Saquisilí', 'Pujilí', 'Salcedo'],
    'Chimborazo': ['Riobamba', 'Guano', 'Chambo', 'Alausí'],
    'Imbabura': ['Ibarra', 'Otavalo', 'Cotacachi', 'San Antonio de Ibarra'],
    'Loja': ['Loja', 'Catamayo', 'Macará', 'Zamora'],
    'Carchi': ['Tulcán', 'San Gabriel', 'Montúfar'],
    'Cañar': ['Azogues', 'Biblián', 'La Troncal'],
    'Morona Santiago': ['Macas', 'Gualaquiza', 'Sucúa'],
    'Napo': ['Tena', 'Archidona', 'El Chaco'],
    'Pastaza': ['Puyo', 'Mera', 'Santa Clara'],
    'Zamora Chinchipe': ['Zamora', 'Yantzaza', 'El Pangui'],
    'Bolívar': ['Guaranda', 'San Miguel', 'Chillanes'],
    'Esmeraldas': ['Esmeraldas', 'San Lorenzo', 'Muisne'],
    'Los Ríos': ['Babahoyo', 'Quevedo', 'Ventanas', 'Vinces'],
    'Sucumbíos': ['Nueva Loja', 'Shushufindi', 'Lago Agrio'],
    'Orellana': ['Coca', 'Loreto', 'La Joya de los Sachas'],
    'Santa Elena': ['Santa Elena', 'La Libertad', 'Salinas'],
    'Galápagos': ['Puerto Ayora', 'Puerto Baquerizo Moreno', 'Isabela'],
    'Santo Domingo de los Tsáchilas': ['Santo Domingo']
};

// ============================================
// CARGA DE CLIENTES CON PAGINACIÓN
// ============================================
function loadCustomers(page = 1) {
    try {
        customersCurrentPage = page;
        const tbody = document.getElementById('customersTableBody');
        if (!tbody) {
            console.warn('Tabla de clientes no encontrada');
            return;
        }

        if (typeof allCustomers === 'undefined' || !Array.isArray(allCustomers)) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center">Error: datos de clientes no disponibles</td></tr>';
            updateCustomersPagination(0);
            return;
        }

        if (allCustomers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center">No hay clientes registrados</td></tr>';
            updateCustomersPagination(0);
            return;
        }

        const sortedCustomers = [...allCustomers].sort((a, b) => (b.registrationDate || 0) - (a.registrationDate || 0));
        filteredCustomersCache = sortedCustomers;

        const startIndex = (page - 1) * customersItemsPerPage;
        const endIndex = Math.min(startIndex + customersItemsPerPage, sortedCustomers.length);
        const pageCustomers = sortedCustomers.slice(startIndex, endIndex);

        renderCustomersTable(pageCustomers);
        updateCustomersPagination(sortedCustomers.length);
    } catch (error) {
        console.error('Error en loadCustomers:', error);
        showAlert('Error al cargar los clientes', 'danger');
    }
}

function renderCustomersTable(customers) {
    const tbody = document.getElementById('customersTableBody');
    if (!tbody) return;

    if (!customers || customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center">No hay clientes para mostrar</td></tr>';
        return;
    }

    let html = '';
    customers.forEach(customer => {
        const regDate = customer.registrationDate ? new Date(customer.registrationDate).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }) : 'Sin fecha';

        const daysAgo = customer.registrationDate ? Math.floor((Date.now() - customer.registrationDate) / (1000 * 60 * 60 * 24)) : null;
        const typeLabel = customer.customerType ? getCustomerTypeLabel(customer.customerType) : 'N/A';
        
        // Mostrar nombre completo combinado
        const fullName = customer.firstName && customer.lastName 
            ? `${customer.firstName} ${customer.lastName}` 
            : customer.fullName || customer.name || 'N/A';

        html += `
            <tr class="customer-row" data-customer-id="${customer.id}">
                <td>
                    <span class="badge bg-secondary">${customer.id ? customer.id.substring(0, 10) : 'N/A'}</span>
                    ${daysAgo !== null && daysAgo < 1 ? '<span class="badge bg-danger ms-1">Nuevo</span>' : ''}
                </td>
                <td>
                    <div><i class="fas fa-user me-1"></i> ${fullName}</div>
                    <small class="text-muted">${customer.identificationType || 'N/A'}: ${customer.identification || 'N/A'}</small>
                </td>
                <td><i class="fas fa-envelope me-1"></i> ${customer.email || 'N/A'}</td>
                <td>${customer.phone || 'N/A'}</td>
                <td>
                    <span class="badge ${getCustomerTypeBadge(customer.customerType)}">${typeLabel}</span>
                    ${customer.company ? `<br><small class="text-muted"><i class="fas fa-building me-1"></i>${customer.company}</small>` : ''}
                </td>
                <td>${regDate}</td>
                <td class="text-center"><span class="badge bg-primary">${customer.orderCount || 0}</span></td>
                <td class="fw-bold">${formatCurrencyCustomer(customer.totalSpent || 0)}</td>
                <td>
                    <div class="btn-group-vertical btn-group-sm" style="width:100%;">
                        <button class="btn-action btn-view w-100" onclick="viewCustomerDetails('${customer.id}')" title="Ver detalles">
                            <i class="fas fa-eye"></i> Ver
                        </button>
                        <button class="btn-action btn-edit w-100 mt-1" onclick="editCustomer('${customer.id}')" title="Editar cliente">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        <button class="btn-action btn-delete w-100 mt-1" onclick="deleteCustomer('${customer.id}')" title="Eliminar cliente">
                            <i class="fas fa-trash"></i> Eliminar
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function updateCustomersPagination(totalItems) {
    try {
        const paginationContainer = document.getElementById('customersPagination');
        if (!paginationContainer) {
            const card = document.querySelector('#customersContent .data-card');
            if (card) {
                const paginationDiv = document.createElement('div');
                paginationDiv.id = 'customersPagination';
                paginationDiv.className = 'mt-3';
                card.appendChild(paginationDiv);
            }
        }

        const paginationEl = document.getElementById('customersPagination');
        if (!paginationEl) return;

        const totalPages = Math.ceil(totalItems / customersItemsPerPage);

        if (totalPages <= 1) {
            paginationEl.innerHTML = '';
            return;
        }

        let html = `
            <nav aria-label="Navegación de clientes">
                <ul class="pagination justify-content-center pagination-sm">
                    <li class="page-item ${customersCurrentPage <= 1 ? 'disabled' : ''}">
                        <a class="page-link" href="#" onclick="changeCustomersPage(${customersCurrentPage - 1})" tabindex="-1">Anterior</a>
                    </li>
        `;

        const maxVisible = 5;
        let startPage = Math.max(1, customersCurrentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);

        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        if (startPage > 1) {
            html += `<li class="page-item"><a class="page-link" href="#" onclick="changeCustomersPage(1)">1</a></li>`;
            if (startPage > 2) html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }

        for (let i = startPage; i <= endPage; i++) {
            html += `<li class="page-item ${i === customersCurrentPage ? 'active' : ''}">
                        <a class="page-link" href="#" onclick="changeCustomersPage(${i})">${i}</a>
                    </li>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            html += `<li class="page-item"><a class="page-link" href="#" onclick="changeCustomersPage(${totalPages})">${totalPages}</a></li>`;
        }

        html += `
                    <li class="page-item ${customersCurrentPage >= totalPages ? 'disabled' : ''}">
                        <a class="page-link" href="#" onclick="changeCustomersPage(${customersCurrentPage + 1})">Siguiente</a>
                    </li>
                </ul>
                <div class="text-center text-muted small">
                    Mostrando ${Math.min((customersCurrentPage - 1) * customersItemsPerPage + 1, totalItems)} - ${Math.min(customersCurrentPage * customersItemsPerPage, totalItems)} de ${totalItems} clientes
                    &nbsp;|&nbsp; 
                    <select class="form-select form-select-sm d-inline-block" style="width:auto;" onchange="changeCustomersItemsPerPage(this.value)">
                        <option value="5" ${customersItemsPerPage === 5 ? 'selected' : ''}>5</option>
                        <option value="10" ${customersItemsPerPage === 10 ? 'selected' : ''}>10</option>
                        <option value="25" ${customersItemsPerPage === 25 ? 'selected' : ''}>25</option>
                        <option value="50" ${customersItemsPerPage === 50 ? 'selected' : ''}>50</option>
                    </select>
                    por página
                </div>
            </nav>
        `;

        paginationEl.innerHTML = html;
    } catch (error) {
        console.error('Error en updateCustomersPagination:', error);
    }
}

function changeCustomersPage(page) {
    const totalPages = Math.ceil(filteredCustomersCache.length / customersItemsPerPage);
    if (page < 1 || page > totalPages) return;
    loadCustomers(page);
}

function changeCustomersItemsPerPage(value) {
    customersItemsPerPage = parseInt(value);
    customersCurrentPage = 1;
    loadCustomers(customersCurrentPage);
}

// ============================================
// FUNCIONES DE BÚSQUEDA Y FILTROS
// ============================================
function searchCustomers() {
    try {
        const searchTerm = document.getElementById('customerSearch').value.toLowerCase().trim();
        const dateFrom = document.getElementById('customerDateFrom').value;
        const customerType = document.getElementById('customerTypeFilter')?.value || '';
        const countryFilter = document.getElementById('customerCountryFilter')?.value || '';

        if (typeof allCustomers === 'undefined' || !Array.isArray(allCustomers)) {
            showAlert('Datos de clientes no disponibles', 'danger');
            return;
        }

        let filteredCustomers = [...allCustomers];

        if (searchTerm) {
            filteredCustomers = filteredCustomers.filter(c => {
                const fullName = c.firstName && c.lastName 
                    ? `${c.firstName} ${c.lastName}` 
                    : c.fullName || c.name || '';
                return fullName.toLowerCase().includes(searchTerm) ||
                    (c.email || '').toLowerCase().includes(searchTerm) ||
                    (c.phone || '').toLowerCase().includes(searchTerm) ||
                    (c.company || '').toLowerCase().includes(searchTerm) ||
                    (c.identification || '').toLowerCase().includes(searchTerm);
            });
        }
        if (dateFrom) {
            const fromDate = new Date(dateFrom).getTime();
            filteredCustomers = filteredCustomers.filter(c => (c.registrationDate || 0) >= fromDate);
        }
        if (customerType) {
            filteredCustomers = filteredCustomers.filter(c => c.customerType === customerType);
        }
        if (countryFilter) {
            filteredCustomers = filteredCustomers.filter(c => c.country === countryFilter);
        }

        filteredCustomersCache = filteredCustomers;
        customersCurrentPage = 1;
        renderCustomersTable(filteredCustomers.slice(0, customersItemsPerPage));
        updateCustomersPagination(filteredCustomers.length);
        updateCustomerFilterStats(filteredCustomers);
    } catch (error) {
        console.error('Error en searchCustomers:', error);
        showAlert('Error al buscar clientes', 'danger');
    }
}

function resetCustomerSearch() {
    document.getElementById('customerSearch').value = '';
    document.getElementById('customerDateFrom').value = '';
    if (document.getElementById('customerTypeFilter')) document.getElementById('customerTypeFilter').value = '';
    if (document.getElementById('customerCountryFilter')) document.getElementById('customerCountryFilter').value = '';
    loadCustomers(1);
}

function updateCustomerFilterStats(customers) {
    try {
        let statsContainer = document.getElementById('customerFilterStats');
        if (!statsContainer) {
            const filterBar = document.querySelector('#customersContent .filter-bar');
            if (filterBar) {
                statsContainer = document.createElement('div');
                statsContainer.id = 'customerFilterStats';
                statsContainer.className = 'w-100 mt-2 p-2 bg-light rounded';
                filterBar.appendChild(statsContainer);
            }
        }

        if (statsContainer) {
            const totalSpent = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
            const withOrders = customers.filter(c => c.orderCount > 0).length;
            statsContainer.innerHTML = `
                <div class="d-flex flex-wrap gap-3 justify-content-center">
                    <span><strong>${customers.length}</strong> clientes</span>
                    <span><strong>${withOrders}</strong> con pedidos</span>
                    <span><strong>${formatCurrencyCustomer(totalSpent)}</strong> gastado</span>
                    <span class="text-muted">${customers.length === allCustomers.length ? '(Sin filtros)' : `(${((customers.length / allCustomers.length) * 100).toFixed(1)}% del total)`}</span>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error en updateCustomerFilterStats:', error);
    }
}

function addCustomerAdvancedFilters() {
    const filterBar = document.querySelector('#customersContent .filter-bar');
    if (!filterBar) return;

    if (document.getElementById('customerTypeFilter')) return;

    const advancedFilters = document.createElement('div');
    advancedFilters.className = 'd-flex flex-wrap gap-2 w-100 mt-2';

    const typeOptions = `
        <option value="">Todos</option>
        <option value="particular">Particular</option>
        <option value="empresa">Empresa</option>
        <option value="extranjero">Extranjero</option>
    `;

    const countryOptions = `
        <option value="">Todos los países</option>
        ${countriesList.map(c => `<option value="${c.code}">${c.name}</option>`).join('')}
    `;

    advancedFilters.innerHTML = `
        <div class="filter-group">
            <label>Tipo:</label>
            <select class="form-select form-select-sm" id="customerTypeFilter" style="width:130px;" onchange="searchCustomers()">
                ${typeOptions}
            </select>
        </div>
        <div class="filter-group">
            <label>País:</label>
            <select class="form-select form-select-sm" id="customerCountryFilter" style="width:150px;" onchange="searchCustomers()">
                ${countryOptions}
            </select>
        </div>
        <button class="btn btn-sm btn-outline-secondary" onclick="resetCustomerSearch()">
            <i class="fas fa-times me-1"></i> Limpiar filtros
        </button>
    `;
    filterBar.appendChild(advancedFilters);
}

// ============================================
// MOSTRAR MODAL DE CLIENTE
// ============================================
function showAddCustomerModal() {
    document.getElementById('customerModalTitle').textContent = 'Nuevo Cliente';
    document.getElementById('customerForm').reset();
    document.getElementById('customerModal').dataset.customerId = '';

    populateSelect('custCountry', countriesList, 'code', 'name', 'EC');
    populateSelect('custState', provincesEcuador, null, null, '');
    populateSelect('custCity', [], null, null, '');
    populateSelect('custIdentificationType', [
        { value: 'cedula', label: 'Cédula' },
        { value: 'ruc', label: 'RUC' },
        { value: 'pasaporte', label: 'Pasaporte' },
        { value: 'otro', label: 'Otro' }
    ], 'value', 'label', 'cedula');
    populateSelect('custCustomerType', [
        { value: 'particular', label: 'Particular' },
        { value: 'empresa', label: 'Empresa' },
        { value: 'extranjero', label: 'Extranjero' }
    ], 'value', 'label', 'particular');

    // Limpiar campos
    document.getElementById('custFirstName').value = '';
    document.getElementById('custLastName').value = '';
    document.getElementById('custIdentification').value = '';
    document.getElementById('custIdentification').placeholder = 'Número de identificación (Cédula, RUC, Pasaporte)';

    new bootstrap.Modal(document.getElementById('customerModal')).show();
}

function populateSelect(selectId, data, valueKey, labelKey, selectedValue) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = '<option value="">Seleccionar...</option>';

    if (!data || data.length === 0) {
        if (selectId === 'custCity') {
            select.innerHTML = '<option value="">Seleccionar provincia primero</option>';
        }
        return;
    }

    data.forEach(item => {
        const value = valueKey ? item[valueKey] : item;
        const label = labelKey ? item[labelKey] : item;
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        if (selectedValue && value === selectedValue) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

function updateCities() {
    const stateSelect = document.getElementById('custState');
    const citySelect = document.getElementById('custCity');
    const selectedState = stateSelect.value;

    citySelect.innerHTML = '<option value="">Seleccionar...</option>';

    if (selectedState && citiesByProvince[selectedState]) {
        citiesByProvince[selectedState].forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            citySelect.appendChild(option);
        });
    }
}

// ============================================
// GUARDAR CLIENTE (CORREGIDO - TODOS LOS CAMPOS SE GUARDAN)
// ============================================
function saveCustomer() {
    try {
        // Obtener valores del formulario
        const firstName = document.getElementById('custFirstName').value.trim();
        const lastName = document.getElementById('custLastName').value.trim();
        const email = document.getElementById('custEmail').value.trim();
        const phone = document.getElementById('custPhone').value.trim();
        const identification = document.getElementById('custIdentification').value.trim();
        const identificationType = document.getElementById('custIdentificationType').value;
        const customerType = document.getElementById('custCustomerType').value;
        const company = document.getElementById('custCompany').value.trim();
        const gender = document.getElementById('custGender').value;
        const birthdate = document.getElementById('custBirthdate').value;
        const shippingAddress = document.getElementById('custShippingAddress').value.trim();
        const billingAddress = document.getElementById('custBillingAddress').value.trim();
        const country = document.getElementById('custCountry').value;
        const state = document.getElementById('custState').value;
        const city = document.getElementById('custCity').value;
        const notes = document.getElementById('custNotes').value.trim();
        const newsletter = document.getElementById('custNewsletter').checked;

        // Validaciones
        if (!firstName) {
            showAlert('Nombre es requerido', 'warning');
            return;
        }
        if (!lastName) {
            showAlert('Apellido es requerido', 'warning');
            return;
        }
        if (!email) {
            showAlert('Email es requerido', 'warning');
            return;
        }
        if (!identification) {
            showAlert('Número de identificación es requerido', 'warning');
            return;
        }
        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            showAlert('Email inválido', 'warning');
            return;
        }

        const modalElement = document.getElementById('customerModal');
        const editId = modalElement.dataset.customerId;

        if (typeof allCustomers === 'undefined' || !Array.isArray(allCustomers)) {
            showAlert('Error: datos de clientes no disponibles', 'danger');
            return;
        }

        // Verificar ID único (solo para nuevos clientes)
        if (!editId) {
            const existing = allCustomers.find(c => c.identification === identification);
            if (existing) {
                showAlert('Este número de identificación ya está registrado', 'warning');
                return;
            }
        }

        // Construir objeto de datos completo
        const customerData = {
            firstName: firstName,
            lastName: lastName,
            fullName: `${firstName} ${lastName}`,
            name: `${firstName} ${lastName}`,
            email: email,
            phone: phone,
            identification: identification,
            identificationType: identificationType || 'cedula',
            customerType: customerType || 'particular',
            company: company || '',
            gender: gender || '',
            birthdate: birthdate || '',
            shippingAddress: shippingAddress || '',
            billingAddress: billingAddress || shippingAddress || '',
            country: country || 'EC',
            state: state || '',
            city: city || '',
            notes: notes || '',
            newsletter: newsletter || false,
            updatedAt: Date.now()
        };

        if (editId) {
            // Editar cliente existente
            const index = allCustomers.findIndex(c => c.id === editId);
            if (index !== -1) {
                const existingCustomer = allCustomers[index];
                allCustomers[index] = { 
                    ...existingCustomer,
                    ...customerData,
                    id: existingCustomer.id,
                    registrationDate: existingCustomer.registrationDate,
                    orderCount: existingCustomer.orderCount || 0,
                    totalSpent: existingCustomer.totalSpent || 0,
                    createdAt: existingCustomer.createdAt || existingCustomer.registrationDate
                };
                
                if (typeof firebaseDatabase !== 'undefined' && firebaseDatabase) {
                    firebaseDatabase.ref('users/' + editId).update(customerData)
                        .catch(err => console.error('Error al actualizar en Firebase:', err));
                }
                showAlert('Cliente actualizado correctamente', 'success');
            } else {
                showAlert('Cliente no encontrado', 'danger');
                return;
            }
        } else {
            // Nuevo cliente
            const id = 'CUS-' + identification.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15);
            const now = Date.now();
            const newCustomer = {
                id: id,
                ...customerData,
                registrationDate: now,
                orderCount: 0,
                totalSpent: 0,
                createdAt: now
            };
            allCustomers.push(newCustomer);
            
            if (typeof firebaseDatabase !== 'undefined' && firebaseDatabase) {
                firebaseDatabase.ref('users/' + id).set(newCustomer)
                    .catch(err => console.error('Error al guardar en Firebase:', err));
            }
            showAlert('Cliente guardado exitosamente', 'success');
        }

        // Cerrar modal y recargar
        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('customerModal'));
        if (modalInstance) modalInstance.hide();

        loadCustomers(customersCurrentPage);

    } catch (error) {
        console.error('Error en saveCustomer:', error);
        showAlert('Ocurrió un error al guardar el cliente', 'danger');
    }
}

// ============================================
// EDITAR CLIENTE (TODOS LOS DATOS SE CARGAN CORRECTAMENTE)
// ============================================
function editCustomer(customerId) {
    try {
        console.log('=== EDITANDO CLIENTE ===', customerId);

        if (!customerId) {
            showAlert('ID de cliente no válido', 'danger');
            return;
        }

        if (typeof allCustomers === 'undefined' || !Array.isArray(allCustomers)) {
            showAlert('Datos de clientes no disponibles', 'danger');
            return;
        }

        const customer = allCustomers.find(c => c.id === customerId);
        if (!customer) {
            showAlert('Cliente no encontrado', 'danger');
            return;
        }

        console.log('Datos del cliente a editar:', customer);

        // Cambiar título del modal
        document.getElementById('customerModalTitle').textContent = 'Editar Cliente';
        
        // === CARGAR TODOS LOS DATOS DEL CLIENTE EN EL FORMULARIO ===
        
        // Nombres
        document.getElementById('custFirstName').value = customer.firstName || '';
        document.getElementById('custLastName').value = customer.lastName || '';
        
        // Contacto
        document.getElementById('custEmail').value = customer.email || '';
        document.getElementById('custPhone').value = customer.phone || '';
        
        // Identificación - ESTE ES EL CAMPO QUE NO SE ESTABA GUARDANDO
        document.getElementById('custIdentification').value = customer.identification || '';
        populateSelect('custIdentificationType', [
            { value: 'cedula', label: 'Cédula' },
            { value: 'ruc', label: 'RUC' },
            { value: 'pasaporte', label: 'Pasaporte' },
            { value: 'otro', label: 'Otro' }
        ], 'value', 'label', customer.identificationType || 'cedula');

        // Tipo de cliente
        populateSelect('custCustomerType', [
            { value: 'particular', label: 'Particular' },
            { value: 'empresa', label: 'Empresa' },
            { value: 'extranjero', label: 'Extranjero' }
        ], 'value', 'label', customer.customerType || 'particular');

        // Empresa
        document.getElementById('custCompany').value = customer.company || '';
        
        // Datos personales
        document.getElementById('custGender').value = customer.gender || '';
        document.getElementById('custBirthdate').value = customer.birthdate || '';
        
        // Direcciones
        document.getElementById('custShippingAddress').value = customer.shippingAddress || '';
        document.getElementById('custBillingAddress').value = customer.billingAddress || '';

        // Ubicación
        populateSelect('custCountry', countriesList, 'code', 'name', customer.country || 'EC');
        populateSelect('custState', provincesEcuador, null, null, customer.state || '');

        // Cargar ciudades
        const stateSelect = document.getElementById('custState');
        const citySelect = document.getElementById('custCity');
        const selectedState = stateSelect ? stateSelect.value : '';

        citySelect.innerHTML = '<option value="">Seleccionar...</option>';

        if (selectedState && citiesByProvince[selectedState]) {
            citiesByProvince[selectedState].forEach(city => {
                const option = document.createElement('option');
                option.value = city;
                option.textContent = city;
                if (city === customer.city) {
                    option.selected = true;
                }
                citySelect.appendChild(option);
            });
        } else if (customer.city) {
            const option = document.createElement('option');
            option.value = customer.city;
            option.textContent = customer.city + ' (ciudad guardada)';
            option.selected = true;
            citySelect.appendChild(option);
        }

        // Notas y newsletter
        document.getElementById('custNotes').value = customer.notes || '';
        document.getElementById('custNewsletter').checked = customer.newsletter || false;
        
        // Guardar ID en el modal
        document.getElementById('customerModal').dataset.customerId = customerId;

        console.log('Formulario cargado correctamente');

        const modal = new bootstrap.Modal(document.getElementById('customerModal'));
        modal.show();

    } catch (error) {
        console.error('Error en editCustomer:', error);
        showAlert('Error al cargar los datos del cliente: ' + error.message, 'danger');
    }
}

// ============================================
// VER DETALLES DEL CLIENTE (SIN DUPLICACIÓN)
// ============================================
function viewCustomerDetails(customerId) {
    try {
        if (typeof allCustomers === 'undefined' || !Array.isArray(allCustomers)) {
            showAlert('Datos de clientes no disponibles', 'danger');
            return;
        }

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

        let customerOrders = [];
        if (typeof allOrders !== 'undefined' && Array.isArray(allOrders)) {
            customerOrders = allOrders.filter(order => order.userEmail === customer.email);
        }

        const typeLabel = customer.customerType ? getCustomerTypeLabel(customer.customerType) : 'N/A';
        const idTypeLabel = customer.identificationType ? getIdentificationTypeLabel(customer.identificationType) : 'N/A';

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
                        <td>${formatCurrencyCustomer(parseFloat(order.total) || 0)}</td>
                        <td><span class="badge ${getStatusBadgeClass(order.status)}">${order.status || 'pendiente'}</span></td>
                    </tr>
                `;
            });
        }

        const content = `
            <div class="row">
                <div class="col-md-6">
                    <div class="card mb-3">
                        <div class="card-header bg-light d-flex justify-content-between align-items-center">
                            <h6 class="mb-0"><i class="fas fa-user me-2"></i>Información del Cliente</h6>
                            <span class="badge ${getCustomerTypeBadge(customer.customerType)}">${typeLabel}</span>
                        </div>
                        <div class="card-body">
                            <p><strong>ID:</strong> <code>${customer.id || 'N/A'}</code></p>
                            <p><strong>Nombre:</strong> ${customer.firstName || 'N/A'}</p>
                            <p><strong>Apellido:</strong> ${customer.lastName || 'N/A'}</p>
                            <p><strong>Email:</strong> ${customer.email || 'N/A'}</p>
                            <p><strong>Teléfono:</strong> ${customer.phone || 'N/A'}</p>
                            <p><strong>${idTypeLabel}:</strong> ${customer.identification || 'N/A'}</p>
                            ${customer.company ? `<p><strong>Empresa:</strong> ${customer.company}</p>` : ''}
                            <p><strong>Género:</strong> ${customer.gender || 'N/A'}</p>
                            <p><strong>Fecha de Nacimiento:</strong> ${customer.birthdate || 'N/A'}</p>
                            <p><strong>País:</strong> ${customer.country ? getCountryName(customer.country) : 'N/A'}</p>
                            <p><strong>Estado/Provincia:</strong> ${customer.state || 'N/A'}</p>
                            <p><strong>Ciudad:</strong> ${customer.city || 'N/A'}</p>
                            <p><strong>Fecha de Registro:</strong> ${regDate}</p>
                            <p><strong>Newsletter:</strong> ${customer.newsletter ? '✅ Suscrito' : '❌ No suscrito'}</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card mb-3">
                        <div class="card-header bg-light">
                            <h6 class="mb-0"><i class="fas fa-address-book me-2"></i>Direcciones</h6>
                        </div>
                        <div class="card-body">
                            <p><strong>Dirección de Envío:</strong><br>${customer.shippingAddress || 'N/A'}</p>
                            <p><strong>Dirección de Facturación:</strong><br>${customer.billingAddress || 'N/A'}</p>
                        </div>
                    </div>
                    <div class="card mb-3">
                        <div class="card-header bg-light">
                            <h6 class="mb-0"><i class="fas fa-chart-bar me-2"></i>Estadísticas</h6>
                        </div>
                        <div class="card-body">
                            <div class="row text-center">
                                <div class="col-6">
                                    <h3>${customer.orderCount || 0}</h3>
                                    <p class="text-muted">Pedidos</p>
                                </div>
                                <div class="col-6">
                                    <h3>${formatCurrencyCustomer(customer.totalSpent || 0)}</h3>
                                    <p class="text-muted">Total Gastado</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    ${customer.notes ? `<div class="card"><div class="card-header bg-light"><h6 class="mb-0"><i class="fas fa-sticky-note me-2"></i>Notas</h6></div><div class="card-body"><p>${customer.notes}</p></div></div>` : ''}
                </div>
            </div>
            ${customerOrders.length > 0 ? `
            <div class="card mt-3">
                <div class="card-header bg-light">
                    <h6 class="mb-0"><i class="fas fa-shopping-cart me-2"></i>Pedidos Recientes (${customerOrders.length} total)</h6>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-sm table-hover">
                            <thead>
                                <tr><th>Pedido #</th><th>Fecha</th><th>Total</th><th>Estado</th></tr>
                            </thead>
                            <tbody>${ordersHtml}</tbody>
                        </table>
                    </div>
                    ${customerOrders.length > 5 ? `<p class="text-center mt-2"><a href="#" onclick="showCustomerOrders('${customer.email}')">Ver todos los pedidos (${customerOrders.length})</a></p>` : ''}
                </div>
            </div>` : '<p class="text-muted mt-3">Este cliente no ha realizado pedidos aún.</p>'}
        `;

        document.getElementById('customerDetailsContent').innerHTML = content;
        new bootstrap.Modal(document.getElementById('customerDetailsModal')).show();
    } catch (error) {
        console.error('Error en viewCustomerDetails:', error);
        showAlert('Error al mostrar los detalles del cliente', 'danger');
    }
}

function showCustomerOrders(customerEmail) {
    const orderFilter = document.getElementById('orderCustomerFilter');
    if (orderFilter) {
        orderFilter.value = customerEmail;
    }
    if (typeof showOrders === 'function') {
        showOrders();
    }
    if (typeof applyOrderFilters === 'function') {
        applyOrderFilters();
    }
}

// ============================================
// ELIMINAR CLIENTE
// ============================================
function deleteCustomer(customerId) {
    if (!confirm('¿Estás seguro de eliminar este cliente? Esta acción no se puede deshacer.')) return;

    try {
        if (typeof allCustomers === 'undefined' || !Array.isArray(allCustomers)) {
            showAlert('Datos de clientes no disponibles', 'danger');
            return;
        }

        const index = allCustomers.findIndex(c => c.id === customerId);
        if (index !== -1) {
            allCustomers.splice(index, 1);
            if (typeof firebaseDatabase !== 'undefined' && firebaseDatabase) {
                firebaseDatabase.ref('users/' + customerId).remove()
                    .catch(err => console.error('Error al eliminar en Firebase:', err));
            }
            loadCustomers(customersCurrentPage);
            showAlert('Cliente eliminado', 'success');
        } else {
            showAlert('Cliente no encontrado', 'danger');
        }
    } catch (error) {
        console.error('Error en deleteCustomer:', error);
        showAlert('Error al eliminar el cliente', 'danger');
    }
}

// ============================================
// EXPORTAR CLIENTES
// ============================================
function exportCustomers() {
    try {
        if (typeof allCustomers === 'undefined' || !Array.isArray(allCustomers) || allCustomers.length === 0) {
            showAlert('No hay clientes para exportar', 'warning');
            return;
        }

        let csv = 'ID,Nombre,Apellido,Email,Teléfono,Tipo Cliente,ID Tipo,ID Número,Empresa,Género,Nacimiento,País,Estado,Ciudad,Dirección Envío,Dirección Facturación,Newsletter,Fecha Registro,Pedidos,Total Gastado,Notas\n';

        allCustomers.forEach(customer => {
            const regDate = customer.registrationDate ? new Date(customer.registrationDate).toLocaleDateString() : '';
            const countryName = customer.country ? getCountryName(customer.country) : '';
            const typeLabel = customer.customerType ? getCustomerTypeLabel(customer.customerType) : '';
            const idTypeLabel = customer.identificationType ? getIdentificationTypeLabel(customer.identificationType) : '';

            csv += `"${customer.id || ''}","${customer.firstName || ''}","${customer.lastName || ''}","${customer.email || ''}","${customer.phone || ''}","${typeLabel}","${idTypeLabel}","${customer.identification || ''}","${customer.company || ''}","${customer.gender || ''}","${customer.birthdate || ''}","${countryName}","${customer.state || ''}","${customer.city || ''}","${customer.shippingAddress || ''}","${customer.billingAddress || ''}","${customer.newsletter ? 'Sí' : 'No'}","${regDate}",${customer.orderCount || 0},${(customer.totalSpent || 0).toFixed(2)},"${customer.notes || ''}"\n`;
        });

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clientes_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showAlert(`Exportados ${allCustomers.length} clientes`, 'success');
    } catch (error) {
        console.error('Error en exportCustomers:', error);
        showAlert('Error al exportar clientes', 'danger');
    }
}

// ============================================
// REFRESCAR CLIENTES
// ============================================
function refreshCustomers() {
    loadCustomers(customersCurrentPage || 1);
    showAlert('Clientes actualizados', 'success');
}

// ============================================
// FUNCIONES UTILITARIAS
// ============================================
function formatCurrencyCustomer(value) {
    if (isNaN(value) || value === null || value === undefined) return '$0.00';
    return '$' + parseFloat(value).toFixed(2);
}

function getCustomerTypeLabel(type) {
    const labels = {
        'particular': 'Particular',
        'empresa': 'Empresa',
        'extranjero': 'Extranjero'
    };
    return labels[type] || type || 'N/A';
}

function getCustomerTypeBadge(type) {
    const badges = {
        'particular': 'bg-info',
        'empresa': 'bg-primary',
        'extranjero': 'bg-warning text-dark'
    };
    return badges[type] || 'bg-secondary';
}

function getIdentificationTypeLabel(type) {
    const labels = {
        'cedula': 'Cédula',
        'ruc': 'RUC',
        'pasaporte': 'Pasaporte',
        'otro': 'Otro'
    };
    return labels[type] || type || 'N/A';
}

function getCountryName(code) {
    const country = countriesList.find(c => c.code === code);
    return country ? country.name : code || 'N/A';
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

function updateCustomersTable(customers) {
    if (customers) {
        filteredCustomersCache = customers;
        renderCustomersTable(customers);
        updateCustomersPagination(customers.length);
    } else {
        loadCustomers(customersCurrentPage || 1);
    }
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(addCustomerAdvancedFilters, 500);
});