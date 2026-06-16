// ============================================
// MÓDULO DE CONFIGURACIÓN
// ============================================

function loadAllSettingsIntoForms() {
    if (!firebaseDatabase) return;
    firebaseDatabase.ref('settings').once('value').then(snapshot => {
        const settings = snapshot.val() || {};
        populateSettingsForms(settings);
    }).catch(error => console.error('Error cargando configuraciones:', error));
}

function populateSettingsForms(settings) {
    const nameInput = document.getElementById('storeName');
    const emailInput = document.getElementById('storeEmail');
    const phoneInput = document.getElementById('storePhone');
    const addressInput = document.getElementById('storeAddress');
    const currencySelect = document.getElementById('storeCurrency');
    const timezoneSelect = document.getElementById('storeTimezone');
    const logoInput = document.getElementById('storeLogo');
    if (nameInput) nameInput.value = settings.general?.storeName || 'K\'A Boutique';
    if (emailInput) emailInput.value = settings.general?.storeEmail || 'quezadaa382@gmail.com';
    if (phoneInput) phoneInput.value = settings.general?.storePhone || '+593 99 429 8427';
    if (addressInput) addressInput.value = settings.general?.storeAddress || 'Av. Principal 123, Ciudad';
    if (currencySelect) currencySelect.value = settings.general?.storeCurrency || 'USD';
    if (timezoneSelect) timezoneSelect.value = settings.general?.timezone || 'America/Guayaquil';
    if (logoInput) logoInput.value = settings.general?.logo || '/images/logo.png';

    const payMethodTransfer = document.getElementById('payMethodTransfer');
    const payMethodCard = document.getElementById('payMethodCard');
    const payMethodCash = document.getElementById('payMethodCash');
    const payMethodPaypal = document.getElementById('payMethodPaypal');
    const bankInfo = document.getElementById('bankInfo');
    const paypalClientId = document.getElementById('paypalClientId');
    if (payMethodTransfer) payMethodTransfer.checked = settings.payment?.methods?.transferencia !== false;
    if (payMethodCard) payMethodCard.checked = settings.payment?.methods?.tarjeta === true;
    if (payMethodCash) payMethodCash.checked = settings.payment?.methods?.efectivo === true;
    if (payMethodPaypal) payMethodPaypal.checked = settings.payment?.methods?.paypal === true;
    if (bankInfo) bankInfo.value = settings.payment?.bankInfo || 'Banco: Banco Nacional\nCuenta: 123-456789-0\nTitular: K\'A Boutique S.A.\nCLABE: 012180012345678900';
    if (paypalClientId) paypalClientId.value = settings.payment?.paypalClientId || '';

    const shippingCost = document.getElementById('shippingCost');
    const freeShippingThreshold = document.getElementById('freeShippingThreshold');
    const shippingTime = document.getElementById('shippingTime');
    const shippingMethod = document.getElementById('shippingMethod');
    if (shippingCost) shippingCost.value = settings.shipping?.cost || 5.00;
    if (freeShippingThreshold) freeShippingThreshold.value = settings.shipping?.freeThreshold || 50.00;
    if (shippingTime) shippingTime.value = settings.shipping?.time || '3-5 días hábiles';
    if (shippingMethod) shippingMethod.value = settings.shipping?.method || 'estandar';

    const adminEmail = document.getElementById('adminNotificationEmail');
    const notifyNewOrder = document.getElementById('notifyNewOrder');
    const notifyPayment = document.getElementById('notifyPayment');
    const notifyStock = document.getElementById('notifyStock');
    const supportEmail = document.getElementById('supportEmail');
    if (adminEmail) adminEmail.value = settings.notifications?.adminEmail || 'quezadaa382@gmail.com';
    if (notifyNewOrder) notifyNewOrder.checked = settings.notifications?.notifyNewOrder !== false;
    if (notifyPayment) notifyPayment.checked = settings.notifications?.notifyPayment !== false;
    if (notifyStock) notifyStock.checked = settings.notifications?.notifyStock !== false;
    if (supportEmail) supportEmail.value = settings.notifications?.supportEmail || 'soporte@kaboutique.com';

    const defaultRole = document.getElementById('defaultUserRole');
    const allowRegistration = document.getElementById('allowRegistration');
    const requireEmailVerification = document.getElementById('requireEmailVerification');
    if (defaultRole) defaultRole.value = settings.users?.defaultRole || 'cliente';
    if (allowRegistration) allowRegistration.checked = settings.users?.allowRegistration !== false;
    if (requireEmailVerification) requireEmailVerification.checked = settings.users?.requireVerification === true;

    const apiCloudName = document.getElementById('apiCloudName');
    const apiCloudKey = document.getElementById('apiCloudKey');
    const apiUploadPreset = document.getElementById('apiUploadPreset');
    const apiCloudFolder = document.getElementById('apiCloudFolder');
    const googleMapsKey = document.getElementById('googleMapsKey');
    if (apiCloudName) apiCloudName.value = settings.api?.cloudinaryCloudName || 'djelnkrtm';
    if (apiCloudKey) apiCloudKey.value = settings.api?.cloudinaryApiKey || '';
    if (apiUploadPreset) apiUploadPreset.value = settings.api?.cloudinaryUploadPreset || 'Depositos';
    if (apiCloudFolder) apiCloudFolder.value = settings.api?.cloudinaryFolder || 'samples/depositos';
    if (googleMapsKey) googleMapsKey.value = settings.api?.googleMapsKey || '';

    const socialFacebook = document.getElementById('socialFacebook');
    const socialInstagram = document.getElementById('socialInstagram');
    const socialTiktok = document.getElementById('socialTiktok');
    const socialYoutube = document.getElementById('socialYoutube');
    if (socialFacebook) socialFacebook.value = settings.social?.facebook || 'https://facebook.com/kaboutique';
    if (socialInstagram) socialInstagram.value = settings.social?.instagram || 'https://instagram.com/kaboutique';
    if (socialTiktok) socialTiktok.value = settings.social?.tiktok || '';
    if (socialYoutube) socialYoutube.value = settings.social?.youtube || '';

    const seoTitle = document.getElementById('seoTitle');
    const seoDescription = document.getElementById('seoDescription');
    const seoKeywords = document.getElementById('seoKeywords');
    const seoFavicon = document.getElementById('seoFavicon');
    if (seoTitle) seoTitle.value = settings.seo?.title || 'K\'A Boutique - Moda y Estilo';
    if (seoDescription) seoDescription.value = settings.seo?.description || 'K\'A Boutique ofrece la mejor moda y estilo con productos de alta calidad.';
    if (seoKeywords) seoKeywords.value = settings.seo?.keywords || 'moda, estilo, boutique, ropa, accesorios';
    if (seoFavicon) seoFavicon.value = settings.seo?.favicon || '/favicon.ico';
}

function saveGeneralSettings() {
    const settings = {
        storeName: document.getElementById('storeName').value,
        storeEmail: document.getElementById('storeEmail').value,
        storePhone: document.getElementById('storePhone').value,
        storeAddress: document.getElementById('storeAddress').value,
        storeCurrency: document.getElementById('storeCurrency').value,
        timezone: document.getElementById('storeTimezone').value,
        logo: document.getElementById('storeLogo').value
    };
    saveToFirebase('settings/general', settings, 'Configuración general guardada');
}

function savePaymentSettings() {
    const settings = {
        methods: {
            transferencia: document.getElementById('payMethodTransfer').checked,
            tarjeta: document.getElementById('payMethodCard').checked,
            efectivo: document.getElementById('payMethodCash').checked,
            paypal: document.getElementById('payMethodPaypal').checked
        },
        bankInfo: document.getElementById('bankInfo').value,
        paypalClientId: document.getElementById('paypalClientId').value
    };
    saveToFirebase('settings/payment', settings, 'Configuración de pagos guardada');
}

function saveShippingSettings() {
    const settings = {
        cost: parseFloat(document.getElementById('shippingCost').value) || 5.00,
        freeThreshold: parseFloat(document.getElementById('freeShippingThreshold').value) || 50.00,
        time: document.getElementById('shippingTime').value,
        method: document.getElementById('shippingMethod').value
    };
    saveToFirebase('settings/shipping', settings, 'Configuración de envíos guardada');
}

function saveNotificationSettings() {
    const settings = {
        adminEmail: document.getElementById('adminNotificationEmail').value,
        notifyNewOrder: document.getElementById('notifyNewOrder').checked,
        notifyPayment: document.getElementById('notifyPayment').checked,
        notifyStock: document.getElementById('notifyStock').checked,
        supportEmail: document.getElementById('supportEmail').value
    };
    saveToFirebase('settings/notifications', settings, 'Configuración de notificaciones guardada');
}

function saveUsersSettings() {
    const settings = {
        defaultRole: document.getElementById('defaultUserRole').value,
        allowRegistration: document.getElementById('allowRegistration').checked,
        requireVerification: document.getElementById('requireEmailVerification').checked
    };
    saveToFirebase('settings/users', settings, 'Configuración de usuarios guardada');
}

function saveApiSettings() {
    const settings = {
        cloudinaryCloudName: document.getElementById('apiCloudName').value,
        cloudinaryApiKey: document.getElementById('apiCloudKey').value,
        cloudinaryUploadPreset: document.getElementById('apiUploadPreset').value,
        cloudinaryFolder: document.getElementById('apiCloudFolder').value,
        googleMapsKey: document.getElementById('googleMapsKey').value
    };
    saveToFirebase('settings/api', settings, 'Configuración de API guardada');
}

function saveSocialSettings() {
    const settings = {
        facebook: document.getElementById('socialFacebook').value,
        instagram: document.getElementById('socialInstagram').value,
        tiktok: document.getElementById('socialTiktok').value,
        youtube: document.getElementById('socialYoutube').value
    };
    saveToFirebase('settings/social', settings, 'Configuración de redes sociales guardada');
}

function saveSeoSettings() {
    const settings = {
        title: document.getElementById('seoTitle').value,
        description: document.getElementById('seoDescription').value,
        keywords: document.getElementById('seoKeywords').value,
        favicon: document.getElementById('seoFavicon').value
    };
    saveToFirebase('settings/seo', settings, 'Configuración SEO guardada');
}

function saveToFirebase(path, data, successMessage) {
    if (!firebaseDatabase) { showAlert('Firebase no disponible', 'danger'); return; }
    showLoading('Guardando...');
    firebaseDatabase.ref(path).update(data)
        .then(() => { hideLoading(); showAlert(successMessage, 'success'); })
        .catch(error => { hideLoading(); showAlert('Error: ' + error.message, 'danger'); });
}