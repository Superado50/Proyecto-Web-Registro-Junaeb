// El evento 'DOMContentLoaded' se asegura de que todo el documento HTML se haya cargado y procesado
// antes de que nuestro código JavaScript intente interactuar con él. Es la forma más segura de iniciar.
document.addEventListener('DOMContentLoaded', async () => {
    
    // --- SECCIÓN DE CONFIGURACIÓN ---
    const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vScuPKtNBDI5Y_0o0D3W6P2sjbuDIypV5wOuryu6HYebhJnASRXPFWgxAKjeBfbDmhLGzLzC_sKA0CD/pub?gid=0&single=true&output=csv'; 
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwhIJMlsUYuIrskROiAKCU5_NaQ9sOiAzqzBupealI6rYuE4IHX_1E3jGH0BcvWou_bJw/exec';
    
    // --- VARIABLES GLOBALES ---
    let baseDeDatos = [];       
    let registroDelDia = [];    

    // --- REFERENCIAS A ELEMENTOS DEL DOM ---
    const rutInput = document.getElementById('rutInput');
    const feedbackArea = document.getElementById('feedbackArea');
    const userInfoDiv = document.getElementById('userInfo');
    const userPhoto = document.getElementById('userPhoto');
    const userName = document.getElementById('userName');
    const userCourse = document.getElementById('userCourse');
    const kpiTotal = document.getElementById('kpiTotal');
    const kpiDesayunos = document.getElementById('kpiDesayunos');
    const kpiAlmuerzos = document.getElementById('kpiAlmuerzos');
    const logTableBody = document.getElementById('logTableBody');
    const exportButton = document.getElementById('exportButton');
    const searchLogInput = document.getElementById('searchLog');
    const loadingOverlay = document.getElementById('loading-overlay');
    const configWarningDiv = document.getElementById('config-warning');
    const autocompleteList = document.getElementById('autocomplete-list');

    // --- INICIALIZACIÓN DEL GRÁFICO (Chart.js) ---
    const chartCtx = document.getElementById('serviciosChart').getContext('2d');
    const serviciosChart = new Chart(chartCtx, { type: 'doughnut', data: { labels: ['Desayunos', 'Almuerzos'], datasets: [{ data: [0, 0], backgroundColor: ['#0284c7', '#d97706'], borderColor: ['#f0f9ff', '#fff7ed'], borderWidth: 4, hoverOffset: 8 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { padding: 20, font: { size: 14 } } } } } });

    // --- FUNCIÓN PARA CARGAR REGISTROS PREVIOS DEL DÍA ---
    const cargarRegistrosDelDia = async () => {
        if (APPS_SCRIPT_URL === 'URL_DE_TU_APPS_SCRIPT_AQUI') {
            console.log("No se cargarán registros previos.");
            return;
        }
        try {
            const url = new URL(APPS_SCRIPT_URL);
            url.searchParams.append('cacheBuster', new Date().getTime());
            const response = await fetch(url);
            if (!response.ok) { throw new Error('La respuesta del script para leer registros no fue exitosa.'); }
            const datosDesdeScript = await response.json();
            if (datosDesdeScript.status === 'error') { throw new Error(datosDesdeScript.message); }
            registroDelDia = datosDesdeScript.map(reg => {
                const fechaHora = new Date(reg.fechaHora);
                return {
                    hora: formatAMPM(fechaHora),
                    fecha: fechaHora.toISOString().slice(0, 10),
                    rut: reg.rut,
                    nombre: reg.nombre,
                    curso: reg.curso,
                    servicio: reg.servicio
                };
            });
            console.log(`Cargados ${registroDelDia.length} registros del día de hoy.`);
        } catch (error) {
            console.error("Error al cargar los registros del día:", error);
            feedbackArea.innerHTML = `<p class="text-red-800 font-medium text-left"><b>Error de Sincronización</b></p>`;
            feedbackArea.classList.add('bg-red-100');
        }
    };

    // --- FUNCIÓN PARA CARGAR LA BASE DE DATOS DE USUARIOS ---
    const cargarBaseDeDatos = async () => {
        loadingOverlay.style.display = 'flex';
        if (GOOGLE_SHEET_CSV_URL === 'URL_PUBLICA_DE_TU_CSV_DE_BASE_DE_DATOS_AQUI') {
            console.warn('MODO DEMO activado.');
            configWarningDiv.classList.remove('hidden');
            baseDeDatos = [
                { rut: '11111111-1', nombre: 'Ana Contreras (Demo)', curso: '1° Medio A', foto: 'https://placehold.co/150x150/f9a8d4/4a044e?text=AC' },
                { rut: '22222222-2', nombre: 'Benjamín Soto (Demo)', curso: '2° Medio B', foto: 'https://placehold.co/150x150/a5b4fc/1e1b4b?text=BS' },
            ];
        } else {
             try {
                const url = new URL(GOOGLE_SHEET_CSV_URL);
                url.searchParams.append('cacheBuster', new Date().getTime());
                const response = await fetch(url, { cache: 'no-store' });
                if (!response.ok) { throw new Error('No se pudo cargar la base de datos.'); }
                const csvText = await response.text();
                const lines = csvText.split(/\r\n|\n/).filter(line => line);
                const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
                baseDeDatos = lines.slice(1).map(line => {
                    const values = line.split(',');
                    return headers.reduce((obj, header, index) => {
                        obj[header] = values[index] ? values[index].trim().replace(/"/g, '') : '';
                        return obj;
                    }, {});
                }).filter(obj => obj.rut);
                console.log('Base de datos cargada exitosamente.');
            } catch (error) {
                console.error('Error al cargar la base de datos:', error);
                feedbackArea.innerHTML = `<p class="text-red-800 font-medium text-left"><b>Error al Cargar Datos.</b></p>`;
                feedbackArea.classList.add('bg-red-100');
            }
        }
        await cargarRegistrosDelDia();
        updateUI();
        rutInput.disabled = false;
        rutInput.placeholder = "Ingrese RUT y presione Enter";
        rutInput.focus();
        loadingOverlay.style.display = 'none';
    };
    
    // --- FUNCIÓN PARA ENVIAR UN NUEVO REGISTRO AL SCRIPT ---
    const enviarRegistro = async (nuevoRegistro) => {
        if (APPS_SCRIPT_URL === 'URL_DE_TU_APPS_SCRIPT_AQUI') { return; }
        try {
            await fetch(APPS_SCRIPT_URL, {
                method: 'POST', mode: 'no-cors', body: JSON.stringify(nuevoRegistro),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            });
            console.log("Solicitud de registro enviada.");
        } catch (error) {
            console.error('Error al enviar el registro:', error);
            alert("Error de conexión: No se pudo guardar el registro.");
        }
    };

    // --- FUNCIÓN PRINCIPAL DE REGISTRO ---
    const processRegistration = () => {
        const rut = rutInput.value.trim();
        if (!rut) return;
        autocompleteList.classList.add('hidden');
        autocompleteList.innerHTML = '';
        const usuario = baseDeDatos.find(u => u.rut === rut);
        if (!usuario) { showFeedback('RUT no encontrado.', 'error'); return; }
        const now = new Date();
        const horaActual = now.toTimeString().slice(0, 8);
        let servicioActual = "";
        if (horaActual >= "08:00:00" && horaActual <= "10:00:00") servicioActual = "Desayuno";
        else if (horaActual >= "11:00:00" && horaActual <= "23:50:00") servicioActual = "Almuerzo";
        if (servicioActual === "") { showFeedback('Registro fuera de horario permitido.', 'warning'); return; }
        const hoy = now.toISOString().slice(0, 10);
        const registroPrevio = registroDelDia.find(r => r.rut === rut && r.fecha === hoy && r.servicio === servicioActual);
        if (registroPrevio) { showFeedback(`Ya tiene un registro de ${servicioActual} hoy.`, 'warning'); return; }
        const nuevoRegistro = {
            hora: formatAMPM(now), fecha: hoy, rut: usuario.rut,
            nombre: usuario.nombre, servicio: servicioActual, curso: usuario.curso
        };
        registroDelDia.unshift(nuevoRegistro);
        enviarRegistro(nuevoRegistro);
        rutInput.value = '';
        showFeedback(`Registrado: ${usuario.nombre}`, 'success');
        showUserInfo(usuario);
        updateUI();
    };
    
    // --- FUNCIONES AUXILIARES DE ACTUALIZACIÓN DE LA INTERFAZ ---
    const formatAMPM = (date) => { let hours = date.getHours(); let minutes = date.getMinutes(); const ampm = hours >= 12 ? 'PM' : 'AM'; hours = hours % 12; hours = hours ? hours : 12; minutes = minutes < 10 ? '0' + minutes : minutes; return hours + ':' + minutes + ' ' + ampm; }
    const updateUI = () => { updateKPIs(); updateChart(); renderLogTable(); };
    const updateKPIs = () => { const d = registroDelDia.filter(r => r.servicio === 'Desayuno').length; const a = registroDelDia.filter(r => r.servicio === 'Almuerzo').length; kpiTotal.textContent = registroDelDia.length; kpiDesayunos.textContent = d; kpiAlmuerzos.textContent = a; };
    const updateChart = () => { const d = registroDelDia.filter(r => r.servicio === 'Desayuno').length; const a = registroDelDia.filter(r => r.servicio === 'Almuerzo').length; serviciosChart.data.datasets[0].data = [d, a]; serviciosChart.update(); };
    const renderLogTable = (filter = '') => { logTableBody.innerHTML = ''; const fLogs = registroDelDia.filter(r => r.nombre.toLowerCase().includes(filter) || r.rut.toLowerCase().includes(filter) || r.servicio.toLowerCase().includes(filter)); if (fLogs.length === 0) { logTableBody.innerHTML = `<tr><td colspan="4" class="text-center py-10 text-stone-400">${registroDelDia.length > 0 ? 'No hay resultados.' : 'Aún no hay registros.'}</td></tr>`; return; } fLogs.forEach(r => { const tr = document.createElement('tr'); tr.className = 'bg-white border-b hover:bg-stone-50'; tr.innerHTML = `<td class="px-4 py-3">${r.hora}</td><td class="px-4 py-3 font-medium text-stone-900">${r.rut}</td><td class="px-4 py-3">${r.nombre}</td><td class="px-4 py-3"><span class="px-2 py-1 text-xs font-medium rounded-full ${r.servicio === 'Desayuno' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'}">${r.servicio}</span></td>`; logTableBody.appendChild(tr); }); };
    const showFeedback = (message, type) => { let c; switch(type) { case 'success': c = 'bg-teal-100 text-teal-800'; break; case 'warning': c = 'bg-amber-100 text-amber-800'; break; case 'error': c = 'bg-red-100 text-red-800'; break; default: c = 'bg-stone-100 text-stone-500'; } feedbackArea.className = `p-4 rounded-lg text-center h-24 flex items-center justify-center transition-all duration-300 ${c.split(' ')[0]}`; feedbackArea.innerHTML = `<p class="${c.split(' ')[1]} font-medium">${message}</p>`; };
    const showUserInfo = (usuario) => { userName.textContent = usuario.nombre; userCourse.textContent = usuario.curso; userPhoto.src = usuario.foto; userInfoDiv.classList.remove('hidden'); };
    
    // --- FUNCIÓN MEJORADA DE EXPORTACIÓN A CSV ---
    // La función ahora es 'async' para poder usar 'await'.
    const exportToCSV = async () => {
        // Muestra un mensaje al usuario para que sepa que el proceso ha comenzado.
        feedbackArea.innerHTML = `<p class="text-stone-500 font-medium">Generando reporte completo...</p>`;
        feedbackArea.className = `p-4 rounded-lg text-center h-24 flex items-center justify-center transition-all duration-300 bg-stone-100`;
        try {
            // ** EL CAMBIO MÁS IMPORTANTE **
            // Antes de hacer nada, llama a la función 'cargarRegistrosDelDia' y espera a que termine.
            // Esto asegura que la variable 'registroDelDia' contenga la lista 100% actualizada
            // desde Google Sheets, incluyendo los registros de otros equipos.
            await cargarRegistrosDelDia();
            
            // El resto del código ahora trabaja con esta lista completa y actualizada.
            if (registroDelDia.length === 0) {
                alert("No hay registros hoy para exportar.");
                showFeedback('Esperando registro...', 'default'); // Restaura el mensaje.
                return;
            }
            // Construye el contenido del CSV.
            const h = "Fecha,Hora,RUT,Nombre,Curso,Servicio";
            const r = registroDelDia.map(reg => `"${reg.fecha}","${reg.hora}","${reg.rut}","${reg.nombre}","${reg.curso}","${reg.servicio}"`).join("\n");
            const csv = "\uFEFF" + h + "\n" + r; // Se añade el carácter BOM para compatibilidad con Excel.
            
            // Lógica para crear y descargar el archivo.
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            const fName = `Registro Junaeb ${new Date().toISOString().slice(0, 10)}.csv`;
            link.setAttribute("download", fName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showFeedback('Reporte exportado con éxito.', 'success');
        } catch (error) {
            // Manejo de errores en caso de que la carga o la exportación fallen.
            console.error("Error al exportar CSV:", error);
            alert("No se pudo generar el reporte. Revisa la conexión y la configuración.");
            showFeedback('Error al exportar.', 'error');
        }
    };
    
    // --- LÓGICA DE AUTOCOMPLETADO ---
    rutInput.addEventListener('input', () => {
        const value = rutInput.value.toLowerCase();
        autocompleteList.innerHTML = '';
        if (!value) { autocompleteList.classList.add('hidden'); return; }
        const suggestions = baseDeDatos.filter(user => user.rut.toLowerCase().startsWith(value)).slice(0, 5);
        if (suggestions.length > 0) {
            suggestions.forEach(user => {
                const item = document.createElement('div');
                item.className = 'p-3 hover:bg-stone-100 cursor-pointer border-b border-stone-100';
                item.innerHTML = `<p class="font-semibold text-stone-800">${user.rut}</p><p class="text-sm text-stone-500">${user.nombre}</p>`;
                item.addEventListener('click', () => {
                    rutInput.value = user.rut;
                    autocompleteList.classList.add('hidden');
                    rutInput.focus(); 
                    processRegistration();
                });
                autocompleteList.appendChild(item);
            });
            autocompleteList.classList.remove('hidden');
        } else {
            autocompleteList.classList.add('hidden');
        }
    });

    // --- EVENT LISTENERS ---
    rutInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') processRegistration(); });
    document.addEventListener('click', (e) => { if (!e.target.closest('.relative')) autocompleteList.classList.add('hidden'); });
    /*searchLogInput.addEventListener('input', (e) => renderLogTable(e.target.value.toLowerCase()));*/
    exportButton.addEventListener('click', exportToCSV);
    
    // --- INICIALIZACIÓN ---
    cargarBaseDeDatos();
});
