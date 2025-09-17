// Usamos 'DOMContentLoaded' para asegurarnos de que todo el HTML de la página se haya cargado
// antes de que nuestro código JavaScript intente interactuar con él.
document.addEventListener('DOMContentLoaded', () => {
    
    // --- SECCIÓN DE CONFIGURACIÓN ---
    // En esta sección se deben pegar las URLs generadas desde Google Sheets.
    // Esta constante contendrá la URL para LEER la lista de usuarios.
    const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vScuPKtNBDI5Y_0o0D3W6P2sjbuDIypV5wOuryu6HYebhJnASRXPFWgxAKjeBfbDmhLGzLzC_sKA0CD/pub?gid=0&single=true&output=csv'; 
    // Esta constante contendrá la URL para ESCRIBIR un nuevo registro.
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwhIJMlsUYuIrskROiAKCU5_NaQ9sOiAzqzBupealI6rYuE4IHX_1E3jGH0BcvWou_bJw/exec';

    // --- VARIABLES GLOBALES ---
    // 'baseDeDatos' es un array que guardará en memoria la lista de todos los usuarios
    // una vez que se cargue desde Google Sheets.
    let baseDeDatos = [];       
    // 'registroDelDia' es un array que guardará los registros que se hagan durante la sesión actual.
    // Sirve para actualizar la interfaz (tabla, KPIs, gráfico) al instante.
    let registroDelDia = [];    

    // --- REFERENCIAS A ELEMENTOS DEL DOM ---
    // Guardamos en constantes las referencias a los elementos HTML con los que vamos a interactuar.
    // Esto es más eficiente que buscarlos cada vez que los necesitamos.
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
    // Obtenemos el "lienzo" (canvas) del HTML donde se dibujará el gráfico.
    const chartCtx = document.getElementById('serviciosChart').getContext('2d');
    // Creamos una nueva instancia del gráfico.
    const serviciosChart = new Chart(chartCtx, {
        type: 'doughnut', // Tipo de gráfico: dona.
        data: {
            labels: ['Desayunos', 'Almuerzos'],
            datasets: [{
                data: [0, 0], // Los datos iniciales son cero.
                backgroundColor: ['#0284c7', '#d97706'], // Colores para cada sección.
                borderColor: ['#f0f9ff', '#fff7ed'],   // Colores de los bordes.
                borderWidth: 4,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true, // El gráfico se adaptará al tamaño de su contenedor.
            maintainAspectRatio: false, // Permite que el gráfico no sea siempre cuadrado.
            cutout: '70%', // El grosor del anillo de la dona.
            plugins: {
                legend: {
                    position: 'bottom', // La leyenda aparecerá debajo del gráfico.
                    labels: { padding: 20, font: { size: 14 } }
                }
            }
        }
    });

    // --- FUNCIONES PRINCIPALES ---

    // Función 'async' para cargar la base de datos de usuarios desde Google Sheets.
    const cargarBaseDeDatos = async () => {
        // Muestra la pantalla de carga.
        loadingOverlay.style.display = 'flex';

        // CONDICIÓN MODO DEMO: Si la URL no ha sido reemplazada, la app entra en modo de demostración.
        if (GOOGLE_SHEET_CSV_URL === 'URL_PUBLICA_DE_TU_CSV_AQUI') {
            console.warn('MODO DEMO: La URL de Google Sheets (CSV) no ha sido configurada.');
            configWarningDiv.classList.remove('hidden'); // Muestra el aviso de modo demo.
            // Carga datos de ejemplo para que se pueda probar la funcionalidad.
            baseDeDatos = [
                { rut: '11111111-1', nombre: 'Ana Contreras (Demo)', curso: '1° Medio A', foto: 'https://placehold.co/150x150/f9a8d4/4a044e?text=AC' },
                { rut: '22222222-2', nombre: 'Benjamín Soto (Demo)', curso: '2° Medio B', foto: 'https://placehold.co/150x150/a5b4fc/1e1b4b?text=BS' },
                { rut: '33333333-3', nombre: 'Carla Díaz (Demo)', curso: '1° Medio A', foto: 'https://placehold.co/150x150/fde047/78350f?text=CD' },
            ];
            // Habilita el input para que el usuario pueda interactuar.
            rutInput.disabled = false;
            rutInput.placeholder = "Ingrese RUT y presione Enter";
            rutInput.focus();
            loadingOverlay.style.display = 'none'; // Oculta la pantalla de carga.
            return; // Termina la función aquí.
        }

        // Si la URL sí está configurada, intenta cargar los datos reales.
        try {
            // 'fetch' hace una petición a la URL del CSV. 'await' espera a que la petición termine.
            const response = await fetch(GOOGLE_SHEET_CSV_URL);
            // Si la respuesta no es exitosa (ej. error 404), lanza un error.
            if (!response.ok) { throw new Error('No se pudo cargar la base de datos. Revisa la URL.'); }
            // Obtiene el contenido de la respuesta como texto.
            const csvText = await response.text();
            // Procesa el texto CSV para convertirlo en un array de objetos.
            const lines = csvText.split(/\r\n|\n/).filter(line => line); // Separa por líneas y elimina las vacías.
            const headers = lines[0].split(','); // La primera línea son las cabeceras.
            baseDeDatos = lines.slice(1).map(line => { // Procesa cada línea de datos.
                const values = line.split(',');
                // Crea un objeto por cada usuario usando las cabeceras como claves.
                return headers.reduce((obj, header, index) => {
                    obj[header.trim()] = values[index] ? values[index].trim() : '';
                    return obj;
                }, {});
            }).filter(obj => obj.rut); // Filtra por si alguna fila no tiene RUT.
            
            console.log('Base de datos cargada exitosamente:', baseDeDatos);
            // Habilita el input para el usuario.
            rutInput.disabled = false;
            rutInput.placeholder = "Ingrese RUT y presione Enter";
            rutInput.focus();
        } catch (error) {
            // Si algo falla en el 'try', se ejecuta este bloque.
            console.error('Error al cargar la base de datos:', error);
            feedbackArea.innerHTML = `<p class="text-red-800 font-medium text-left"><b>Error al Cargar Datos:</b><br>Revisa que la URL del CSV sea correcta y que la planilla esté publicada.</p>`;
            feedbackArea.classList.remove('bg-stone-100');
            feedbackArea.classList.add('bg-red-100');
        } finally {
            // Este bloque se ejecuta siempre, ya sea que haya habido éxito o error.
            loadingOverlay.style.display = 'none'; // Oculta la pantalla de carga.
        }
    };
    
    // Función 'async' para ENVIAR un nuevo registro al Google Apps Script.
    const enviarRegistro = async (nuevoRegistro) => {
        // Si la URL del script no está configurada, muestra una advertencia y no hace nada más.
        if (APPS_SCRIPT_URL === 'URL_DE_TU_APPS_SCRIPT_AQUI') {
            console.warn("ADVERTENCIA: La URL de Apps Script no está configurada. El registro no se guardará en Google Sheets.");
            return; 
        }

        try {
            // 'fetch' hace una petición POST al script, enviando los datos del registro.
            const response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors', // Se usa 'no-cors' porque Apps Script puede tener problemas de CORS complejos.
                body: JSON.stringify(nuevoRegistro), // Convierte el objeto a texto JSON.
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // El script está configurado para recibir texto plano.
            });
            console.log("Solicitud de registro enviada a Google Sheets.");
        } catch (error) {
            // Si la petición falla (ej. sin internet), muestra un error en consola y una alerta al usuario.
            console.error('Error al enviar el registro a Google Sheets:', error);
            alert("Error de conexión: No se pudo guardar el registro en la planilla. Revise su conexión a internet y la configuración del Apps Script.");
        }
    };

    // Función principal que se ejecuta con cada escaneo o "Enter".
    const processRegistration = () => {
        const rut = rutInput.value.trim();
        if (!rut) return; // Si no hay nada escrito, no hace nada.

        // Busca al usuario en la base de datos que tenemos en memoria.
        const usuario = baseDeDatos.find(u => u.rut === rut);

        if (!usuario) {
            showFeedback('RUT no encontrado.', 'error');
            return;
        }

        const now = new Date();
        const horaActual = now.toTimeString().slice(0, 8);
        let servicioActual = "";

        // Determina el bloque horario y el servicio.
        if (horaActual >= "08:30:00" && horaActual <= "11:00:00") {
            servicioActual = "Desayuno";
        } else if (horaActual >= "13:00:00" && horaActual <= "14:30:00") {
            servicioActual = "Almuerzo";
        }

        if (servicioActual === "") {
            showFeedback('Registro fuera de horario permitido.', 'warning');
            return;
        }
        
        // Valida si ya existe un registro para ese usuario, en ese servicio, el día de hoy.
        const hoy = now.toISOString().slice(0, 10);
        const registroPrevio = registroDelDia.find(r => r.rut === rut && r.fecha === hoy && r.servicio === servicioActual);

        if (registroPrevio) {
            showFeedback(`Ya tiene un registro de ${servicioActual} hoy.`, 'warning');
            return;
        }
        
        // Si pasa todas las validaciones, crea el objeto del nuevo registro.
        const nuevoRegistro = {
            hora: now.toTimeString().slice(0, 5),
            fecha: hoy,
            rut: usuario.rut,
            nombre: usuario.nombre,
            servicio: servicioActual,
            curso: usuario.curso
        };
        
        // Añade el nuevo registro al principio del array de la sesión.
        registroDelDia.unshift(nuevoRegistro);
        // Llama a la función que envía los datos a Google Sheets en segundo plano.
        enviarRegistro(nuevoRegistro);
        
        // Limpia el input y actualiza toda la interfaz.
        rutInput.value = '';
        showFeedback(`Registrado: ${usuario.nombre}`, 'success');
        showUserInfo(usuario);
        updateUI();
    };
    
    // --- FUNCIONES AUXILIARES DE ACTUALIZACIÓN DE LA INTERFAZ ---
    const updateUI = () => { updateKPIs(); updateChart(); renderLogTable(); };
    const updateKPIs = () => { const d = registroDelDia.filter(r => r.servicio === 'Desayuno').length; const a = registroDelDia.filter(r => r.servicio === 'Almuerzo').length; kpiTotal.textContent = registroDelDia.length; kpiDesayunos.textContent = d; kpiAlmuerzos.textContent = a; };
    const updateChart = () => { const d = registroDelDia.filter(r => r.servicio === 'Desayuno').length; const a = registroDelDia.filter(r => r.servicio === 'Almuerzo').length; serviciosChart.data.datasets[0].data = [d, a]; serviciosChart.update(); };
    const renderLogTable = (filter = '') => { logTableBody.innerHTML = ''; const fLogs = registroDelDia.filter(r => r.nombre.toLowerCase().includes(filter) || r.rut.toLowerCase().includes(filter) || r.servicio.toLowerCase().includes(filter)); if (fLogs.length === 0) { logTableBody.innerHTML = `<tr><td colspan="4" class="text-center py-10 text-stone-400">${registroDelDia.length > 0 ? 'No hay resultados.' : 'Aún no hay registros.'}</td></tr>`; return; } fLogs.forEach(r => { const tr = document.createElement('tr'); tr.className = 'bg-white border-b hover:bg-stone-50'; tr.innerHTML = `<td class="px-4 py-3">${r.hora}</td><td class="px-4 py-3 font-medium text-stone-900">${r.rut}</td><td class="px-4 py-3">${r.nombre}</td><td class="px-4 py-3"><span class="px-2 py-1 text-xs font-medium rounded-full ${r.servicio === 'Desayuno' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'}">${r.servicio}</span></td>`; logTableBody.appendChild(tr); }); };
    const showFeedback = (message, type) => { let c; switch(type) { case 'success': c = 'bg-teal-100 text-teal-800'; break; case 'warning': c = 'bg-amber-100 text-amber-800'; break; case 'error': c = 'bg-red-100 text-red-800'; break; default: c = 'bg-stone-100 text-stone-500'; } feedbackArea.className = `p-4 rounded-lg text-center h-24 flex items-center justify-center transition-all duration-300 ${c.split(' ')[0]}`; feedbackArea.innerHTML = `<p class="${c.split(' ')[1]} font-medium">${message}</p>`; };
    const showUserInfo = (usuario) => { userName.textContent = usuario.nombre; userCourse.textContent = usuario.curso; userPhoto.src = usuario.foto; userInfoDiv.classList.remove('hidden'); };
    
    
// --- FUNCIÓN DE EXPORTACIÓN A CSV (CORREGIDA) ---
    const exportToCSV = () => {
        // Valida si hay datos para exportar.
        if (registroDelDia.length === 0) {
            alert("No hay registros para exportar.");
            return;
        }
        
        // Define las cabeceras y convierte los datos del registro a formato CSV.
        const headers = "Fecha y Hora,RUT,Nombre,Curso,Servicio";
        const rows = registroDelDia.map(reg => 
            `"${reg.fecha} ${reg.hora}","${reg.rut}","${reg.nombre}","${reg.curso}","${reg.servicio}"`
        ).join("\n");

        // Concatena las cabeceras y las filas.
        const csvContent = headers + "\n" + rows;

        // --- EL CAMBIO CLAVE PARA CORREGIR CARACTERES ESPECIALES ---
        // Se crea un "Blob", que es un objeto para manejar datos de archivos.
        // Se le añade el carácter \uFEFF (Byte Order Mark o BOM) al principio del contenido.
        // Este carácter invisible le indica a Excel que debe abrir el archivo con codificación UTF-8,
        // lo que permite que las tildes y otros caracteres especiales se muestren correctamente.
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        
        // Se crea una URL temporal para el objeto Blob.
        const url = URL.createObjectURL(blob);
        
        // Se crea un elemento de enlace <a> invisible en la página.
        const link = document.createElement("a");
        link.setAttribute("href", url); // Se le asigna la URL del Blob.
        const fileName = `Registro Junaeb ${new Date().toISOString().slice(0, 10)}.csv`;
        link.setAttribute("download", fileName); // Se le asigna el nombre del archivo.
        
        // Se añade el enlace al documento, se simula un clic para iniciar la descarga, y luego se elimina.
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };    

// --- LÓGICA DE AUTOCOMPLETADO ---

// 1. Se añade un "escuchador" al campo de búsqueda que se activa cada vez que escribes algo.
rutInput.addEventListener('input', () => {
    // Obtiene el valor actual del campo y lo convierte a minúsculas para una búsqueda sin distinción.
    const value = rutInput.value.toLowerCase();
    // Limpia la lista de sugerencias anterior.
    autocompleteList.innerHTML = '';

    // Si el campo de búsqueda está vacío, oculta la lista y no hace nada más.
    if (!value) {
        autocompleteList.classList.add('hidden');
        return;
    }

    // 2. Filtra la 'baseDeDatos' para encontrar usuarios cuyo RUT comience con lo que has escrito.
    //    .slice(0, 5) limita los resultados a un máximo de 5 sugerencias para que la lista no sea muy larga.
    const suggestions = baseDeDatos.filter(user => user.rut.toLowerCase().startsWith(value)).slice(0, 5);

    // 3. Si se encontraron sugerencias...
    if (suggestions.length > 0) {
        // ...recorre cada sugerencia y crea un elemento HTML para ella.
        suggestions.forEach(user => {
            const item = document.createElement('div');
            // Se le asignan clases de Tailwind para el estilo.
            item.className = 'p-3 hover:bg-stone-100 cursor-pointer border-b border-stone-100';
            // Se define el contenido HTML, mostrando el RUT y el nombre del usuario.
            item.innerHTML = `
                <p class="font-semibold text-stone-800">${user.rut}</p>
                <p class="text-sm text-stone-500">${user.nombre}</p>
            `;
            // 4. Se añade un evento de clic a cada sugerencia.
            item.addEventListener('click', () => {
                rutInput.value = user.rut; // Pone el RUT seleccionado en el campo de búsqueda.
                autocompleteList.classList.add('hidden'); // Oculta la lista.
                rutInput.focus(); // Devuelve el foco al campo de búsqueda.
                processRegistration(); // Llama a la función principal para registrar al usuario.
            });
            // Añade el elemento de la sugerencia a la lista visible.
            autocompleteList.appendChild(item);
        });
        // Muestra el contenedor de la lista.
        autocompleteList.classList.remove('hidden');
    } else {
        // Si no hay sugerencias, se asegura de que la lista esté oculta.
        autocompleteList.classList.add('hidden');
    }
});

// --- FIN DE LÓGICA DE AUTOCOMPLETADO ---

    
    // --- "ESCUCHADORES" DE EVENTOS ---
    // Asigna las funciones a las acciones del usuario.
    rutInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') processRegistration(); });
    searchLogInput.addEventListener('input', (e) => renderLogTable(e.target.value.toLowerCase()));
    exportButton.addEventListener('click', exportToCSV);
    
    // --- INICIALIZACIÓN ---
    // Llama a la función para cargar la base de datos en cuanto la página esté lista.
    cargarBaseDeDatos();
});



