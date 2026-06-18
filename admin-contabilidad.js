// admin-contabilidad.js - Botón y modal principal

(function() {
    'use strict';

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        if (!document.getElementById('contabilidad-modal')) {
            createModal();
        }

        window.openContabilidadModal = openContabilidadModal;

        // Conectar el enlace del sidebar
        const sidebarLink = document.querySelector('.sidebar-menu a[onclick*="openContabilidadModal"]');
        if (sidebarLink) {
            sidebarLink.onclick = function(e) {
                e.preventDefault();
                openContabilidadModal();
            };
        }

        console.log('✅ Módulo de Contabilidad inicializado');
    }

    function createModal() {
        const modal = document.createElement('div');
        modal.id = 'contabilidad-modal';
        modal.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.6);
            z-index: 99999;
            justify-content: center;
            align-items: center;
            backdrop-filter: blur(4px);
        `;

        modal.innerHTML = `
            <div style="
                background: #ffffff;
                width: 98%;
                max-width: 1400px;
                max-height: 94vh;
                border-radius: 16px;
                padding: 0;
                overflow: hidden;
                box-shadow: 0 25px 60px rgba(0,0,0,0.3);
                display: flex;
                flex-direction: column;
            ">
                <div style="
                    background: linear-gradient(135deg, #0f3460 0%, #1a1a2e 100%);
                    padding: 16px 25px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 3px solid #e94560;
                    flex-shrink: 0;
                ">
                    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                        <i class="fas fa-calculator" style="color: #e94560; font-size: 22px;"></i>
                        <span style="color: white; font-size: 18px; font-weight: 700;">Sistema Contable Integral</span>
                        <span style="background: #e94560; color: white; font-size: 9px; padding: 2px 10px; border-radius: 12px; font-weight: 600;">NIIF</span>
                        <span style="background: #059669; color: white; font-size: 9px; padding: 2px 10px; border-radius: 12px; font-weight: 600;">KARDEX</span>
                    </div>
                    <button id="close-contabilidad-modal" style="
                        background: none;
                        border: none;
                        color: rgba(255,255,255,0.6);
                        font-size: 28px;
                        cursor: pointer;
                        transition: all 0.3s;
                        padding: 0 8px;
                        line-height: 1;
                    " onmouseover="this.style.color='#e94560'" onmouseout="this.style.color='rgba(255,255,255,0.6)'">
                        &times;
                    </button>
                </div>

                <div id="contabilidad-content" style="
                    padding: 20px;
                    overflow-y: auto;
                    flex: 1;
                    background: #f1f5f9;
                ">
                    <div style="text-align: center; padding: 40px;">
                        <div class="spinner-border" style="color: #0f3460; width: 3rem; height: 3rem;" role="status">
                            <span class="visually-hidden">Cargando...</span>
                        </div>
                        <p style="margin-top: 15px; color: #64748b;">Cargando sistema contable...</p>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('close-contabilidad-modal').addEventListener('click', function() {
            document.getElementById('contabilidad-modal').style.display = 'none';
        });

        modal.addEventListener('click', function(e) {
            if (e.target === modal) modal.style.display = 'none';
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                const modalEl = document.getElementById('contabilidad-modal');
                if (modalEl && modalEl.style.display === 'flex') {
                    modalEl.style.display = 'none';
                }
            }
        });
    }

    function openContabilidadModal() {
        const modal = document.getElementById('contabilidad-modal');
        if (!modal) return;

        modal.style.display = 'flex';
        const content = document.getElementById('contabilidad-content');
        if (!content) return;

        // Cargar módulos
        loadModules(content);
    }

    function loadModules(content) {
        const modules = [
            { name: 'Contabilidad', file: 'contab.js', global: 'ContabilidadModule' },
            { name: 'Kardex', file: 'kardex.js', global: 'KardexModule' },
            { name: 'Caja', file: 'caja.js', global: 'CajaModule' },
            { name: 'Cuentas', file: 'cuentas.js', global: 'CuentasModule' },
            { name: 'Reportes', file: 'reportes_conta.js', global: 'ReportesContaModule' }
        ];

        let loaded = 0;
        const total = modules.length;

        function checkAllLoaded() {
            loaded++;
            if (loaded === total) {
                // Todos los módulos cargados, inicializar
                if (typeof window.ContabilidadModule !== 'undefined') {
                    window.ContabilidadModule.init(content);
                } else {
                    content.innerHTML = `
                        <div style="text-align:center; padding:40px; color:#dc2626;">
                            <i class="fas fa-exclamation-triangle" style="font-size:48px;"></i>
                            <p>Error al cargar los módulos contables.</p>
                            <button onclick="location.reload()" class="btn btn-primary">Recargar</button>
                        </div>
                    `;
                }
            }
        }

        modules.forEach(mod => {
            if (typeof window[mod.global] !== 'undefined') {
                checkAllLoaded();
                return;
            }

            const script = document.createElement('script');
            script.src = mod.file;
            script.onload = checkAllLoaded;
            script.onerror = function() {
                console.error(`Error cargando ${mod.file}`);
                checkAllLoaded();
            };
            document.head.appendChild(script);
        });

        // Timeout por si algún script falla
        setTimeout(() => {
            if (loaded < total) {
                // Intentar cargar el módulo principal
                if (typeof window.ContabilidadModule !== 'undefined') {
                    window.ContabilidadModule.init(content);
                }
            }
        }, 5000);
    }

    window.openContabilidadModal = openContabilidadModal;

})();