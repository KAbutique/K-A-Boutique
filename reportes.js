// ============================================
// MÓDULO DE REPORTES - VERSIÓN CORREGIDA
// ============================================

// Variables para gráficos
let reportSalesChart = null;
let reportStatusChart = null;
let reportTopChart = null;
let reportDataLoaded = false;

// ============================================
// CARGA DE DATOS DESDE FIREBASE
// ============================================
async function loadReportData() {
    if (!firebaseDatabase) {
        showAlert('Firebase no disponible', 'danger');
        return false;
    }

    showLoading('Cargando datos para reportes...');

    try {
        // Cargar pedidos
        const ordersSnapshot = await firebaseDatabase.ref('orders').once('value');
        const ordersData = ordersSnapshot.val();
        allOrders = [];
        if (ordersData) {
            Object.keys(ordersData).forEach(key => {
                allOrders.push({ id: key, ...ordersData[key] });
            });
        }

        // Cargar pagos
        const paymentsSnapshot = await firebaseDatabase.ref('payments').once('value');
        const paymentsData = paymentsSnapshot.val();
        allPayments = [];
        if (paymentsData) {
            Object.keys(paymentsData).forEach(key => {
                allPayments.push({ id: key, ...paymentsData[key] });
            });
        }

        // Cargar clientes (usuarios)
        const usersSnapshot = await firebaseDatabase.ref('users').once('value');
        const usersData = usersSnapshot.val();
        allCustomers = [];
        if (usersData) {
            Object.keys(usersData).forEach(key => {
                const user = usersData[key];
                allCustomers.push({
                    id: key,
                    name: user.displayName || user.name || 'Cliente',
                    email: user.email || key,
                    phone: user.phone || '',
                    company: user.company || '',
                    city: user.city || '',
                    orderCount: 0,
                    totalSpent: 0,
                    registrationDate: user.createdAt || Date.now()
                });
            });
        }

        // Calcular estadísticas de clientes desde pedidos
        allOrders.forEach(order => {
            if (order.userEmail) {
                const customer = allCustomers.find(c => c.email === order.userEmail);
                if (customer) {
                    customer.orderCount += 1;
                    customer.totalSpent += parseFloat(order.total) || 0;
                }
            }
        });

        // Cargar productos
        const productsSnapshot = await firebaseDatabase.ref('products').once('value');
        const productsData = productsSnapshot.val();
        allProducts = [];
        if (productsData) {
            Object.keys(productsData).forEach(key => {
                allProducts.push({ id: key, ...productsData[key] });
            });
        }

        reportDataLoaded = true;
        hideLoading();
        console.log(`Datos cargados: ${allOrders.length} pedidos, ${allPayments.length} pagos, ${allCustomers.length} clientes, ${allProducts.length} productos`);
        return true;

    } catch (error) {
        hideLoading();
        console.error('Error cargando datos para reportes:', error);
        showAlert('Error al cargar datos: ' + error.message, 'danger');
        return false;
    }
}

// ============================================
// CARGA INICIAL DE REPORTES
// ============================================
async function loadReports() {
    // Verificar si ya hay datos cargados
    if (!reportDataLoaded || allOrders.length === 0) {
        const loaded = await loadReportData();
        if (!loaded) {
            // Mostrar mensaje de error en las estadísticas
            document.getElementById('avgOrderValue').textContent = '$0.00';
            document.getElementById('conversionRate').textContent = '0%';
            document.getElementById('customerRetention').textContent = '0%';
            const tbody = document.getElementById('topProductsBody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Error al cargar datos</td></tr>';
            return;
        }
    }

    const period = document.getElementById('reportPeriod') ? document.getElementById('reportPeriod').value : 'today';
    const filteredData = filterDataByPeriod(allOrders, period);
    
    // Estadísticas avanzadas
    updateAdvancedStats(filteredData);
    
    // Productos más vendidos
    loadTopProducts(filteredData);
    
    // Inicializar gráficos
    setTimeout(() => {
        initReportCharts(filteredData);
    }, 300);
}

// ============================================
// FILTRADO POR PERÍODO
// ============================================
function filterDataByPeriod(data, period) {
    if (!data || data.length === 0) return [];
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let startDate;
    let endDate = new Date(today.getTime() + 86400000);
    
    switch(period) {
        case 'today':
            startDate = today;
            endDate = new Date(today.getTime() + 86400000);
            break;
        case 'yesterday':
            startDate = new Date(today.getTime() - 86400000);
            endDate = today;
            break;
        case 'week':
            startDate = new Date(today.getTime() - 7 * 86400000);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'quarter':
            const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
            startDate = new Date(now.getFullYear(), quarterMonth, 1);
            break;
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
        case 'custom':
            const from = document.getElementById('reportDateFrom');
            const to = document.getElementById('reportDateTo');
            if (from && from.value) {
                startDate = new Date(from.value);
            } else {
                startDate = new Date(today.getTime() - 30 * 86400000);
            }
            if (to && to.value) {
                endDate = new Date(new Date(to.value).getTime() + 86400000);
            }
            break;
        default:
            startDate = new Date(today.getTime() - 30 * 86400000);
    }
    
    const startTime = startDate.getTime();
    const endTime = endDate ? endDate.getTime() : Date.now();
    
    return data.filter(item => {
        const itemDate = item.createdAt || item.date || item.registrationDate || 0;
        if (!itemDate) return false;
        const time = typeof itemDate === 'number' ? itemDate : new Date(itemDate).getTime();
        return time >= startTime && time <= endTime;
    });
}

// ============================================
// ESTADÍSTICAS AVANZADAS
// ============================================
function updateAdvancedStats(orders) {
    const totalRevenue = orders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
    const avgOrder = orders.length > 0 ? totalRevenue / orders.length : 0;
    document.getElementById('avgOrderValue').textContent = formatCurrency(avgOrder);
    
    const completed = orders.filter(o => o.status === 'completado' || o.status === 'entregado' || o.status === 'delivered');
    const conversion = orders.length > 0 ? (completed.length / orders.length) * 100 : 0;
    document.getElementById('conversionRate').textContent = conversion.toFixed(1) + '%';
    
    const customerOrders = {};
    orders.forEach(o => {
        const email = o.userEmail || o.customerEmail;
        if (email) {
            if (!customerOrders[email]) customerOrders[email] = 0;
            customerOrders[email]++;
        }
    });
    const totalCustomers = Object.keys(customerOrders).length;
    const repeatCustomers = Object.values(customerOrders).filter(c => c > 1).length;
    const retention = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;
    document.getElementById('customerRetention').textContent = retention.toFixed(1) + '%';
    
    updateExtraStats(orders, totalRevenue);
}

function updateExtraStats(orders, totalRevenue) {
    const totalOrders = orders.length;
    const pending = orders.filter(o => o.status === 'pendiente').length;
    
    const productMap = {};
    orders.forEach(order => {
        if (order.items) {
            order.items.forEach(item => {
                const name = item.name || 'Producto';
                if (!productMap[name]) productMap[name] = 0;
                productMap[name] += parseInt(item.quantity) || 1;
            });
        }
    });
    const topProduct = Object.keys(productMap).length > 0 ? 
        Object.keys(productMap).sort((a, b) => productMap[b] - productMap[a])[0] : 'N/A';
    
    // Actualizar o crear elementos de estadísticas extra
    let extraStats = document.getElementById('reportExtraStats');
    if (!extraStats) {
        const statsContainer = document.querySelector('#reportsContent .col-md-9 .form-section:first-child .row');
        if (statsContainer) {
            const col = document.createElement('div');
            col.className = 'col-md-12 mt-3';
            col.id = 'reportExtraStats';
            col.innerHTML = `
                <div class="row">
                    <div class="col-md-3">
                        <div class="card bg-light"><div class="card-body text-center">
                            <h4 id="extraTotalOrders">0</h4>
                            <p class="text-muted">Total Pedidos</p>
                        </div></div>
                    </div>
                    <div class="col-md-3">
                        <div class="card bg-light"><div class="card-body text-center">
                            <h4 id="extraPendingOrders">0</h4>
                            <p class="text-muted">Pendientes</p>
                        </div></div>
                    </div>
                    <div class="col-md-3">
                        <div class="card bg-light"><div class="card-body text-center">
                            <h4 id="extraTopProduct">-</h4>
                            <p class="text-muted">Producto Más Vendido</p>
                        </div></div>
                    </div>
                    <div class="col-md-3">
                        <div class="card bg-light"><div class="card-body text-center">
                            <h4 id="extraTotalRevenue">$0.00</h4>
                            <p class="text-muted">Ingresos Totales</p>
                        </div></div>
                    </div>
                </div>
            `;
            statsContainer.appendChild(col);
            extraStats = document.getElementById('reportExtraStats');
        }
    }
    
    if (extraStats) {
        const totalEl = document.getElementById('extraTotalOrders');
        const pendingEl = document.getElementById('extraPendingOrders');
        const topEl = document.getElementById('extraTopProduct');
        const revenueEl = document.getElementById('extraTotalRevenue');
        if (totalEl) totalEl.textContent = totalOrders;
        if (pendingEl) pendingEl.textContent = pending;
        if (topEl) topEl.textContent = topProduct;
        if (revenueEl) revenueEl.textContent = formatCurrency(totalRevenue);
    }
}

// ============================================
// TOP PRODUCTOS
// ============================================
function loadTopProducts(orders) {
    const productSales = {};
    (orders || allOrders).forEach(order => {
        if (order.items) {
            order.items.forEach(item => {
                const name = item.name || 'Producto';
                if (!productSales[name]) {
                    productSales[name] = { quantity: 0, revenue: 0 };
                }
                productSales[name].quantity += parseInt(item.quantity) || 1;
                productSales[name].revenue += (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1);
            });
        }
    });
    
    const sorted = Object.keys(productSales).map(key => ({
        name: key,
        quantity: productSales[key].quantity,
        revenue: productSales[key].revenue
    })).sort((a, b) => b.quantity - a.quantity).slice(0, 10);

    const tbody = document.getElementById('topProductsBody');
    if (!tbody) return;
    
    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay datos de productos</td></tr>';
        return;
    }
    
    const totalSold = sorted.reduce((sum, p) => sum + p.quantity, 0);
    
    let html = '';
    sorted.forEach((product, index) => {
        const percentage = totalSold > 0 ? (product.quantity / totalSold * 100) : 0;
        const trend = index < 3 ? '↗️' : (index > 6 ? '↘️' : '➡️');
        const colorClass = index === 0 ? 'text-success' : (index < 3 ? 'text-primary' : '');
        html += `
            <tr class="${colorClass}">
                <td><strong>${product.name}</strong></td>
                <td class="text-center">${product.quantity}</td>
                <td class="text-end">${formatCurrency(product.revenue)}</td>
                <td class="text-center">
                    <span class="badge ${index === 0 ? 'bg-success' : (index < 3 ? 'bg-primary' : 'bg-secondary')}">
                        ${trend} ${percentage.toFixed(1)}%
                    </span>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ============================================
// GRÁFICOS DE REPORTES
// ============================================
function initReportCharts(orders) {
    destroyReportCharts();
    
    // Gráfico 1: Ventas por día (últimos 7 días)
    const salesCtx = document.getElementById('reportSalesChart');
    if (salesCtx) {
        const days = [];
        const sales = [];
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
            days.push(dateStr);
            
            const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
            const dayEnd = dayStart + 86400000;
            const daySales = orders.filter(o => {
                const t = o.createdAt || 0;
                return t >= dayStart && t < dayEnd;
            }).reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
            sales.push(daySales);
        }
        
        const canvas = document.createElement('canvas');
        salesCtx.innerHTML = '';
        salesCtx.appendChild(canvas);
        reportSalesChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: days,
                datasets: [{
                    label: 'Ventas ($)',
                    data: sales,
                    backgroundColor: 'rgba(67, 97, 238, 0.7)',
                    borderColor: '#4361ee',
                    borderWidth: 2,
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                return '$' + ctx.raw.toFixed(2);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) { return '$' + value.toFixed(0); }
                        }
                    }
                }
            }
        });
    }
    
    // Gráfico 2: Distribución por estado
    const statusCtx = document.getElementById('reportStatusChart');
    if (statusCtx) {
        const statusCounts = {
            'pendiente': 0,
            'confirmado': 0,
            'enviado': 0,
            'completado': 0,
            'cancelado': 0,
            'entregado': 0
        };
        orders.forEach(o => {
            const status = o.status || 'pendiente';
            if (statusCounts[status] !== undefined) statusCounts[status]++;
        });
        
        const labels = Object.keys(statusCounts);
        const values = Object.values(statusCounts);
        const colors = ['#ffc107', '#17a2b8', '#007bff', '#28a745', '#dc3545', '#20c997'];
        
        const canvas = document.createElement('canvas');
        statusCtx.innerHTML = '';
        statusCtx.appendChild(canvas);
        reportStatusChart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: labels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
                datasets: [{
                    data: values,
                    backgroundColor: colors.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = total > 0 ? (ctx.raw / total * 100).toFixed(1) : 0;
                                return ctx.label + ': ' + ctx.raw + ' (' + pct + '%)';
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Gráfico 3: Top productos
    const topCtx = document.getElementById('reportTopChart');
    if (topCtx) {
        const productMap = {};
        orders.forEach(order => {
            if (order.items) {
                order.items.forEach(item => {
                    const name = item.name || 'Producto';
                    if (!productMap[name]) productMap[name] = 0;
                    productMap[name] += parseInt(item.quantity) || 1;
                });
            }
        });
        
        const sorted = Object.keys(productMap)
            .map(key => ({ name: key, quantity: productMap[key] }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 8);
        
        const canvas = document.createElement('canvas');
        topCtx.innerHTML = '';
        topCtx.appendChild(canvas);
        reportTopChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: sorted.map(p => p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name),
                datasets: [{
                    label: 'Cantidad Vendida',
                    data: sorted.map(p => p.quantity),
                    backgroundColor: 'rgba(247, 37, 133, 0.7)',
                    borderColor: '#f72585',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'top' }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }
}

function destroyReportCharts() {
    if (reportSalesChart) { reportSalesChart.destroy();
        reportSalesChart = null; }
    if (reportStatusChart) { reportStatusChart.destroy();
        reportStatusChart = null; }
    if (reportTopChart) { reportTopChart.destroy();
        reportTopChart = null; }
}

// ============================================
// GENERAR REPORTE PROFESIONAL
// ============================================
async function generateReport() {
    const reportType = document.getElementById('reportType').value;
    const period = document.getElementById('reportPeriod').value;
    const format = document.getElementById('reportFormat').value;
    
    // Asegurar que los datos estén cargados
    if (!reportDataLoaded || allOrders.length === 0) {
        const loaded = await loadReportData();
        if (!loaded) {
            showAlert('No se pudieron cargar los datos. Intenta de nuevo.', 'danger');
            return;
        }
    }
    
    showLoading('Generando reporte profesional...');
    
    setTimeout(() => {
        hideLoading();
        
        let data = [];
        let title = '';
        let headers = [];
        let summary = {};
        let filteredData = [];
        
        switch(reportType) {
            case 'sales':
                title = 'Reporte de Ventas';
                filteredData = filterDataByPeriod(allOrders, period);
                data = filteredData;
                headers = ['Pedido #', 'Cliente', 'Fecha', 'Total', 'Estado', 'Método Pago', 'Productos'];
                summary = generateSalesSummary(filteredData);
                break;
            case 'payments':
                title = 'Reporte de Pagos';
                filteredData = filterDataByPeriod(allPayments, period);
                data = filteredData;
                headers = ['ID', 'Pedido #', 'Cliente', 'Monto', 'Método', 'Fecha', 'Estado'];
                summary = generatePaymentSummary(filteredData);
                break;
            case 'customers':
                title = 'Reporte de Clientes';
                filteredData = filterDataByPeriod(allCustomers, period);
                data = filteredData;
                headers = ['Nombre', 'Email', 'Teléfono', 'Empresa', 'Ciudad', 'Pedidos', 'Total Gastado'];
                summary = generateCustomerSummary(filteredData);
                break;
            case 'products':
                title = 'Reporte de Productos';
                filteredData = filterDataByPeriod(allOrders, period);
                const productMap = {};
                filteredData.forEach(order => {
                    if (order.items) {
                        order.items.forEach(item => {
                            const name = item.name || 'Producto';
                            if (!productMap[name]) {
                                productMap[name] = { quantity: 0, revenue: 0, orders: 0 };
                            }
                            productMap[name].quantity += parseInt(item.quantity) || 1;
                            productMap[name].revenue += (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1);
                            productMap[name].orders++;
                        });
                    }
                });
                data = Object.keys(productMap).map(key => ({
                    nombre: key,
                    cantidad: productMap[key].quantity,
                    ingresos: productMap[key].revenue,
                    pedidos: productMap[key].orders
                })).sort((a, b) => b.cantidad - a.cantidad);
                headers = ['Producto', 'Cantidad Vendida', 'Ingresos', 'Pedidos'];
                summary = generateProductSummary(data);
                break;
            default:
                data = [];
                title = 'Reporte';
        }
        
        if (format === 'print') {
            printProfessionalReport(title, data, headers, summary, period);
        } else {
            downloadProfessionalReport(title, data, headers, format, period);
        }
    }, 1500);
}

// ============================================
// RESUMENES PARA REPORTES
// ============================================
function generateSalesSummary(orders) {
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
    const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const completed = orders.filter(o => o.status === 'completado' || o.status === 'entregado' || o.status === 'delivered').length;
    const pending = orders.filter(o => o.status === 'pendiente').length;
    const cancelled = orders.filter(o => o.status === 'cancelado').length;
    
    return {
        'Total Pedidos': totalOrders,
        'Ingresos Totales': formatCurrency(totalRevenue),
        'Ticket Promedio': formatCurrency(avgOrder),
        'Completados': completed,
        'Pendientes': pending,
        'Cancelados': cancelled,
        'Tasa de Conversión': totalOrders > 0 ? ((completed / totalOrders) * 100).toFixed(1) + '%' : '0%'
    };
}

function generatePaymentSummary(payments) {
    const totalPayments = payments.length;
    const totalAmount = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const confirmed = payments.filter(p => p.status === 'confirmado' || p.status === 'completado').length;
    const pending = payments.filter(p => p.status === 'pendiente').length;
    
    return {
        'Total Pagos': totalPayments,
        'Monto Total': formatCurrency(totalAmount),
        'Confirmados': confirmed,
        'Pendientes': pending,
        'Tasa de Confirmación': totalPayments > 0 ? ((confirmed / totalPayments) * 100).toFixed(1) + '%' : '0%'
    };
}

function generateCustomerSummary(customers) {
    const total = customers.length;
    const withOrders = customers.filter(c => c.orderCount > 0).length;
    const totalSpent = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
    const avgSpent = total > 0 ? totalSpent / total : 0;
    
    return {
        'Total Clientes': total,
        'Clientes con Pedidos': withOrders,
        'Total Gastado': formatCurrency(totalSpent),
        'Gasto Promedio': formatCurrency(avgSpent),
        'Tasa de Compra': total > 0 ? ((withOrders / total) * 100).toFixed(1) + '%' : '0%'
    };
}

function generateProductSummary(products) {
    const totalProducts = products.length;
    const totalQuantity = products.reduce((sum, p) => sum + p.cantidad, 0);
    const totalRevenue = products.reduce((sum, p) => sum + p.ingresos, 0);
    const avgPerProduct = totalProducts > 0 ? totalRevenue / totalProducts : 0;
    
    return {
        'Total Productos': totalProducts,
        'Unidades Vendidas': totalQuantity,
        'Ingresos Totales': formatCurrency(totalRevenue),
        'Promedio por Producto': formatCurrency(avgPerProduct),
        'Producto Más Vendido': products.length > 0 ? products[0].nombre : 'N/A'
    };
}

// ============================================
// IMPRESIÓN PROFESIONAL
// ============================================
function printProfessionalReport(title, data, headers, summary, period) {
    const w = window.open('', '_blank');
    const date = new Date().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const periodLabels = {
        'today': 'Hoy',
        'yesterday': 'Ayer',
        'week': 'Esta semana',
        'month': 'Este mes',
        'quarter': 'Este trimestre',
        'year': 'Este año',
        'custom': 'Personalizado'
    };
    
    let summaryHtml = '';
    if (summary && Object.keys(summary).length > 0) {
        summaryHtml = `
            <div class="summary-section">
                <h3>📊 Resumen Ejecutivo</h3>
                <div class="summary-grid">
                    ${Object.keys(summary).map(key => `
                        <div class="summary-item">
                            <span class="summary-label">${key}</span>
                            <span class="summary-value">${summary[key]}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    let tableHtml = '';
    if (data && data.length > 0) {
        tableHtml = `
            <table>
                <thead>
                    <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${data.slice(0, 100).map(item => {
                        const row = headers.map(h => {
                            let val = item[h.toLowerCase()] || item[h] || '';
                            if (typeof val === 'number') val = val.toFixed(2);
                            if (typeof val === 'object') {
                                if (Array.isArray(val)) {
                                    val = val.map(v => v.name || v).join(', ');
                                } else {
                                    val = JSON.stringify(val).substring(0, 50);
                                }
                            }
                            return `<td>${val}</td>`;
                        }).join('');
                        return `<tr>${row}</tr>`;
                    }).join('')}
                </tbody>
            </table>
            ${data.length > 100 ? `<p class="text-muted">* Mostrando los primeros 100 registros de ${data.length} totales</p>` : ''}
        `;
    } else {
        tableHtml = '<p class="text-center text-muted">No hay datos para mostrar en este período.</p>';
    }
    
    w.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Segoe UI', Arial, sans-serif;
                    padding: 30px;
                    color: #333;
                    background: #fff;
                }
                .report-header {
                    text-align: center;
                    border-bottom: 3px solid #4361ee;
                    padding-bottom: 20px;
                    margin-bottom: 25px;
                }
                .report-header h1 {
                    color: #4361ee;
                    font-size: 28px;
                    font-weight: 700;
                    margin-bottom: 5px;
                }
                .report-header .subtitle {
                    color: #666;
                    font-size: 14px;
                }
                .report-meta {
                    display: flex;
                    justify-content: space-between;
                    background: #f8f9fa;
                    padding: 12px 20px;
                    border-radius: 8px;
                    margin-bottom: 25px;
                    font-size: 14px;
                    flex-wrap: wrap;
                    gap: 10px;
                }
                .report-meta span {
                    color: #555;
                }
                .report-meta strong {
                    color: #333;
                }
                .summary-section {
                    background: #f0f4ff;
                    border-left: 4px solid #4361ee;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 30px;
                }
                .summary-section h3 {
                    color: #4361ee;
                    font-size: 16px;
                    margin-bottom: 15px;
                    font-weight: 600;
                }
                .summary-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                    gap: 12px;
                }
                .summary-item {
                    background: white;
                    padding: 10px 15px;
                    border-radius: 6px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
                }
                .summary-label {
                    display: block;
                    font-size: 11px;
                    color: #888;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .summary-value {
                    display: block;
                    font-size: 18px;
                    font-weight: 700;
                    color: #1a1a2e;
                    margin-top: 2px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 13px;
                    margin-top: 20px;
                }
                th {
                    background: #4361ee;
                    color: white;
                    padding: 10px 12px;
                    text-align: left;
                    font-weight: 600;
                }
                td {
                    padding: 8px 12px;
                    border-bottom: 1px solid #e9ecef;
                }
                tr:nth-child(even) {
                    background: #f8f9fa;
                }
                tr:hover {
                    background: #eef3ff;
                }
                .text-muted {
                    color: #888;
                    font-size: 12px;
                    margin-top: 10px;
                }
                .text-center {
                    text-align: center;
                }
                .footer {
                    margin-top: 30px;
                    padding-top: 15px;
                    border-top: 1px solid #dee2e6;
                    text-align: center;
                    font-size: 12px;
                    color: #888;
                }
                @media print {
                    body { padding: 15px; }
                    .no-print { display: none; }
                }
                @media (max-width: 768px) {
                    .summary-grid { grid-template-columns: 1fr 1fr; }
                    table { font-size: 11px; }
                    th, td { padding: 6px 8px; }
                    .report-meta { flex-direction: column; align-items: center; }
                }
            </style>
        </head>
        <body>
            <div class="report-header">
                <h1>${title}</h1>
                <div class="subtitle">K'A Boutique - Sistema de Gestión</div>
            </div>
            
            <div class="report-meta">
                <span><strong>📅 Fecha de generación:</strong> ${date}</span>
                <span><strong>📆 Período:</strong> ${periodLabels[period] || period}</span>
                <span><strong>📋 Total de registros:</strong> ${data.length}</span>
            </div>
            
            ${summaryHtml}
            
            <h3 style="margin-bottom:10px;color:#1a1a2e;">📋 Detalle de Datos</h3>
            ${tableHtml}
            
            <div class="footer">
                Reporte generado automáticamente por K'A Boutique Admin Panel
            </div>
            
            <div class="no-print" style="text-align:center;margin-top:20px;">
                <button onclick="window.print()" style="padding:10px 30px;background:#4361ee;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;">
                    🖨️ Imprimir / Guardar PDF
                </button>
                <button onclick="window.close()" style="padding:10px 30px;background:#6c757d;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;margin-left:10px;">
                    ❌ Cerrar
                </button>
            </div>
        </body>
        </html>
    `);
    w.document.close();
}

// ============================================
// DESCARGA DE REPORTE
// ============================================
function downloadProfessionalReport(title, data, headers, format, period) {
    if (!data || data.length === 0) {
        showAlert('No hay datos para exportar en este período.', 'warning');
        return;
    }
    
    let csv = '\uFEFF';
    csv += headers.join(',') + '\n';
    
    data.forEach(item => {
        const row = headers.map(h => {
            let val = item[h.toLowerCase()] || item[h] || '';
            if (typeof val === 'number') val = val.toFixed(2);
            if (typeof val === 'object') {
                if (Array.isArray(val)) {
                    val = val.map(v => v.name || v).join('; ');
                } else {
                    val = JSON.stringify(val).substring(0, 100);
                }
            }
            val = String(val).replace(/"/g, '""');
            return `"${val}"`;
        }).join(',');
        csv += row + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const periodLabels = {
        'today': 'hoy',
        'yesterday': 'ayer',
        'week': 'semana',
        'month': 'mes',
        'quarter': 'trimestre',
        'year': 'anual',
        'custom': 'personalizado'
    };
    a.download = `${title.toLowerCase().replace(/ /g, '_')}_${periodLabels[period] || period}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showAlert(`Reporte "${title}" exportado exitosamente (${data.length} registros)`, 'success');
}

// ============================================
// UTILIDADES
// ============================================
function formatCurrency(value) {
    if (isNaN(value) || value === null || value === undefined) return '$0.00';
    return '$' + parseFloat(value).toFixed(2);
}

// ============================================
// RECARGAR DATOS DE REPORTES
// ============================================
async function refreshReportData() {
    reportDataLoaded = false;
    await loadReportData();
    loadReports();
    showAlert('Datos de reportes actualizados', 'success');
}

// ============================================
// INICIALIZAR CONTENEDORES DE GRÁFICOS
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        const reportsContent = document.getElementById('reportsContent');
        if (reportsContent) {
            const statsSection = reportsContent.querySelector('.col-md-9 .form-section:first-child');
            if (statsSection) {
                let chartRow = statsSection.querySelector('.row:last-child');
                if (!chartRow || !chartRow.querySelector('#reportSalesChart')) {
                    const chartHtml = `
                        <div class="row mt-4">
                            <div class="col-md-4">
                                <div class="card bg-light">
                                    <div class="card-body" style="height:220px;">
                                        <h6 class="text-center text-muted">📊 Ventas Diarias</h6>
                                        <div id="reportSalesChart" style="height:170px;"></div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card bg-light">
                                    <div class="card-body" style="height:220px;">
                                        <h6 class="text-center text-muted">📈 Distribución por Estado</h6>
                                        <div id="reportStatusChart" style="height:170px;"></div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card bg-light">
                                    <div class="card-body" style="height:220px;">
                                        <h6 class="text-center text-muted">🏆 Top Productos</h6>
                                        <div id="reportTopChart" style="height:170px;"></div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-12 text-center mt-2">
                                <button class="btn btn-sm btn-outline-primary" onclick="refreshReportData()">
                                    <i class="fas fa-sync-alt"></i> Recargar Datos
                                </button>
                            </div>
                        </div>
                    `;
                    statsSection.insertAdjacentHTML('beforeend', chartHtml);
                }
            }
        }
    }, 500);
});