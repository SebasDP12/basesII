// Estado global de la aplicacion cliente
let currentInstitution = 'hospital';
let cachedPatients = [];

const INSTITUTION_CONFIG = {
  hospital: {
    id: 'hospital',
    name: 'Hospital General',
    engine: 'PostgreSQL',
    port: '5432',
    colorClass: 'engine-postgres',
    user: 'Dr. Carlos Ramirez (Medicina Interna)',
    subtitle: 'Atencion Hospitalaria e Internacion | Motor: PostgreSQL 16 | Puerto: 5432',
    showTipoSangre: true,
    showTutor: false
  },
  odontologia: {
    id: 'odontologia',
    name: 'Clinica Odontologica',
    engine: 'MySQL',
    port: '3307',
    colorClass: 'engine-mysql',
    user: 'Dra. Sofia Mendoza & Recepcion',
    subtitle: 'Atencion Dental y Procedimientos | Motor: MySQL 8.0 (InnoDB) | Puerto: 3307',
    showTipoSangre: false,
    showTutor: false
  },
  laboratorio: {
    id: 'laboratorio',
    name: 'Laboratorio Clinico',
    engine: 'MongoDB',
    port: '27017',
    colorClass: 'engine-mongo',
    user: 'Lic. Marco Tulio Pena (Quimico Biologo)',
    subtitle: 'Analisis y Procesamiento de Pruebas | Motor: MongoDB 7.0 | Puerto: 27017',
    showTipoSangre: false,
    showTutor: false
  },
  pediatria: {
    id: 'pediatria',
    name: 'Centro Medico Pediatrico',
    engine: 'Firebase Firestore',
    port: '8080',
    colorClass: 'engine-firebase',
    user: 'Dra. Elena Castillo (Pediatria)',
    subtitle: 'Control Infantil y Vacunacion | Motor: Firebase Firestore | Puerto: 8080',
    showTipoSangre: false,
    showTutor: true
  }
};

// Inicializacion al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().split('T')[0];
  const time = new Date().toTimeString().split(' ')[0].substring(0, 5);
  const fFecha = document.getElementById('eventFecha');
  const fHora = document.getElementById('eventHora');
  if (fFecha) fFecha.value = today;
  if (fHora) fHora.value = time;

  verificarSaludMotores();
  cargarQueryLogs();

  setInterval(cargarQueryLogs, 4000);
  setInterval(verificarSaludMotores, 8000);
});

// ===============================================================
// Navegacion entre Portal General y Pantalla Exclusiva
// ===============================================================
function irAlPortal() {
  document.getElementById('view-portal').style.display = 'block';
  document.getElementById('view-establishment').style.display = 'none';
  document.getElementById('activeEngineBadge').style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function entrarAEstablecimiento(institutionId) {
  currentInstitution = institutionId;
  const cfg = INSTITUTION_CONFIG[currentInstitution];
  if (!cfg) return;

  // Cambiar vista principal a exclusiva
  document.getElementById('view-portal').style.display = 'none';
  document.getElementById('view-establishment').style.display = 'block';

  // Actualizar titulos y badges
  document.getElementById('exclusiveTitle').textContent = cfg.name;
  document.getElementById('exclusiveSubtitle').textContent = `${cfg.subtitle} | Sesion: ${cfg.user}`;
  document.getElementById('newPatientInstName').textContent = cfg.name;

  const badge = document.getElementById('activeEngineBadge');
  badge.style.display = 'inline-flex';
  badge.className = `engine-badge ${cfg.colorClass}`;
  badge.textContent = `${cfg.engine} :${cfg.port}`;

  const sel = document.getElementById('exclusiveSwitchSelect');
  if (sel) sel.value = currentInstitution;

  // Ajustar campos condicionales
  const fTipoSangre = document.getElementById('fieldTipoSangre');
  const fTutorNombre = document.getElementById('fieldTutorNombre');
  const fTutorParentesco = document.getElementById('fieldTutorParentesco');
  if (fTipoSangre) fTipoSangre.style.display = cfg.showTipoSangre ? 'block' : 'none';
  if (fTutorNombre) fTutorNombre.style.display = cfg.showTutor ? 'block' : 'none';
  if (fTutorParentesco) fTutorParentesco.style.display = cfg.showTutor ? 'block' : 'none';

  document.querySelectorAll('.odonto-only').forEach(el => el.style.display = currentInstitution === 'odontologia' ? 'block' : 'none');
  document.querySelectorAll('.pediatria-only').forEach(el => el.style.display = currentInstitution === 'pediatria' ? 'block' : 'none');
  document.querySelectorAll('.lab-only').forEach(el => el.style.display = currentInstitution === 'laboratorio' ? 'block' : 'none');

  // Cambiar a la primera pestaña por defecto y cargar datos
  switchExclusiveTab('historiales');
  cargarPacientes();
  cargarEstadisticas();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Pestañas de la pantalla exclusiva
function switchExclusiveTab(tabId) {
  document.querySelectorAll('#view-establishment .tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });

  const sectionMap = {
    'historiales': 'exclusive-tab-historiales',
    'profesionales': 'exclusive-tab-profesionales',
    'nuevo-paciente': 'exclusive-tab-nuevo-paciente',
    'atencion': 'exclusive-tab-atencion',
    'bajas': 'exclusive-tab-bajas',
    'inspector': 'exclusive-tab-inspector'
  };

  Object.values(sectionMap).forEach(sId => {
    const sec = document.getElementById(sId);
    if (sec) sec.style.display = 'none';
  });

  const activeSec = document.getElementById(sectionMap[tabId]);
  if (activeSec) activeSec.style.display = 'block';

  if (tabId === 'profesionales') {
    cargarProfesionales();
  } else if (tabId === 'atencion') {
    poblarSelectPacientes();
  } else if (tabId === 'bajas') {
    cargarPacientesBajas();
  } else if (tabId === 'inspector') {
    cargarQueryLogs();
  }
}

// ===============================================================
// Verificacion de Salud de Motores
// ===============================================================
async function verificarSaludMotores() {
  try {
    const res = await fetch('/api/system/health');
    const json = await res.json();
    if (!json.success || !json.engines) return;

    actualizarBadgeSalud('status-pg', json.engines.hospital);
    actualizarBadgeSalud('status-mysql', json.engines.odontologia);
    actualizarBadgeSalud('status-mongo', json.engines.laboratorio);
    actualizarBadgeSalud('status-firebase', json.engines.pediatria);
  } catch (err) {
    console.error('Error al consultar salud de bases de datos:', err);
  }
}

function actualizarBadgeSalud(elementId, engineData) {
  const el = document.getElementById(elementId);
  if (!el || !engineData) return;

  const isOnline = engineData.connected || engineData.status === 'online';
  const dot = el.previousElementSibling;
  if (dot && dot.classList.contains('status-dot')) {
    dot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
  }

  el.textContent = isOnline
    ? `Conectado (${engineData.latencyMs}ms)`
    : `Desconectado`;
  el.style.color = isOnline ? '#166534' : '#991b1b';
}

// ===============================================================
// Estadisticas del Establecimiento
// ===============================================================
async function cargarEstadisticas() {
  try {
    const res = await fetch(`/api/system/stats`, {
      headers: { 'x-institution-id': currentInstitution }
    });
    const json = await res.json();
    if (json.success && json.data) {
      document.getElementById('metricTotalPacientes').textContent = json.data.totalPacientes ?? 0;
      document.getElementById('metricPacientesActivos').textContent = json.data.pacientesActivos ?? 0;
      document.getElementById('metricPacientesArchivados').textContent = json.data.pacientesArchivados ?? 0;
      document.getElementById('metricTotalConsultas').textContent = json.data.totalConsultas ?? 0;
    }
  } catch (err) {
    console.error('Error cargando estadisticas:', err);
  }
}

// ===============================================================
// Cargar y Listar Pacientes
// ===============================================================
async function cargarPacientes() {
  const tbody = document.getElementById('patientsTableBody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem;">Consultando datos en ${INSTITUTION_CONFIG[currentInstitution].engine}...</td></tr>`;

  try {
    const statusVal = document.getElementById('statusFilter').value;
    let url = `/api/patients?institutionId=${currentInstitution}`;
    if (statusVal !== '') url += `&activo=${statusVal}`;

    const res = await fetch(url, {
      headers: { 'x-institution-id': currentInstitution }
    });
    const json = await res.json();

    if (!json.success || !json.data) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#ef4444; padding: 2rem;">Error al consultar: ${json.error || 'Desconocido'}</td></tr>`;
      return;
    }

    cachedPatients = json.data;
    renderTablaPacientes(cachedPatients);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#ef4444; padding: 2rem;">Error de conexion: ${err.message}</td></tr>`;
  }
}

function filtrarPacientes() {
  const term = document.getElementById('searchInput').value.toLowerCase().trim();
  if (!term) {
    renderTablaPacientes(cachedPatients);
    return;
  }

  const filtered = cachedPatients.filter(p =>
    (p.nombre && p.nombre.toLowerCase().includes(term)) ||
    (p.apellido && p.apellido.toLowerCase().includes(term)) ||
    (p.correo && p.correo.toLowerCase().includes(term)) ||
    (String(p.id).includes(term))
  );
  renderTablaPacientes(filtered);
}

function renderTablaPacientes(patients) {
  const tbody = document.getElementById('patientsTableBody');
  if (!tbody) return;

  if (patients.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color:#64748b;">No se encontraron historiales clinicos para el filtro actual.</td></tr>`;
    return;
  }

  tbody.innerHTML = patients.map(p => {
    const edad = calcularEdad(p.fechaNacimiento);
    const estadoBadge = p.activo
      ? `<span class="badge badge-active">Activo</span>`
      : `<span class="badge badge-archived" title="${p.motivoBaja || 'Baja'}">Archivado</span>`;

    let infoExtra = '';
    if (p.tipoSangre) {
      infoExtra = `<strong>Sangre:</strong> ${p.tipoSangre}`;
    } else if (p.tutor) {
      infoExtra = `<strong>Tutor:</strong> ${p.tutor.nombre} (${p.tutor.parentesco || 'Tutor'})`;
    } else {
      infoExtra = `<span style="color:#94a3b8;">${p.direccion || 'Sin observaciones'}</span>`;
    }

    return `
      <tr>
        <td><strong>#${p.id}</strong></td>
        <td>
          <div style="font-weight: 700; color: #0f172a;">${p.nombre} ${p.apellido}</div>
          <div style="font-size: 0.75rem; color: #64748b;">${p.genero || 'No especificado'}</div>
        </td>
        <td>
          <div>${p.fechaNacimiento || '-'}</div>
          <div style="font-size: 0.75rem; color: #64748b;">${edad}</div>
        </td>
        <td>
          <div>Tel: ${p.telefono || 'Sin tel.'}</div>
          <div style="font-size: 0.75rem; color: #64748b;">Correo: ${p.correo || 'Sin correo'}</div>
        </td>
        <td>${infoExtra}</td>
        <td>${estadoBadge}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-secondary btn-sm" onclick="verHistorialCompleto('${p.id}')">
            Ver Historial
          </button>
          <button class="btn btn-primary btn-sm" onclick="abrirAtencionParaPaciente('${p.id}')">
            Consulta
          </button>
          ${p.activo
            ? `<button class="btn btn-danger btn-sm" onclick="abrirModalBaja('${p.id}', '${p.nombre} ${p.apellido}')">Archivar</button>`
            : `<button class="btn btn-success btn-sm" onclick="reactivarPaciente('${p.id}')">Reactivar</button>`
          }
        </td>
      </tr>
    `;
  }).join('');
}

function calcularEdad(fechaNac) {
  if (!fechaNac) return '-';
  const nac = new Date(fechaNac);
  const diff = Date.now() - nac.getTime();
  const edadAnios = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  if (edadAnios < 1) {
    const meses = Math.floor(diff / (1000 * 60 * 60 * 24 * 30.4));
    return `${meses} meses`;
  }
  return `${edadAnios} anos`;
}

// ===============================================================
// Historial Clinico Completo
// ===============================================================
async function verHistorialCompleto(patientId) {
  const modal = document.getElementById('historyModal');
  const modalContent = document.getElementById('modalHistoryContent');
  const modalTitle = document.getElementById('modalPatientName');
  const modalInfo = document.getElementById('modalPatientInfo');

  modal.classList.add('active');
  modalContent.innerHTML = `<div style="text-align:center; padding: 2rem;">Cargando historial clinico desde ${INSTITUTION_CONFIG[currentInstitution].engine}...</div>`;

  try {
    const res = await fetch(`/api/clinical/patients/${patientId}/history`, {
      headers: { 'x-institution-id': currentInstitution }
    });
    const json = await res.json();

    if (!json.success || !json.data) {
      modalContent.innerHTML = `<div style="color:#ef4444; padding: 1.5rem;">Error al obtener el historial: ${json.error || 'Desconocido'}</div>`;
      return;
    }

    const { paciente, consultas, totalConsultas, motor, garantiaConsistencia, vacunasAplicadas } = json.data;

    modalTitle.textContent = `Historial Clinico: ${paciente.nombre} ${paciente.apellido}`;
    modalInfo.innerHTML = `
      <span>Institucion: <strong>${INSTITUTION_CONFIG[currentInstitution].name}</strong></span> |
      <span>Motor: <strong>${motor}</strong></span> |
      <span>Estado: <strong>${paciente.activo ? 'Activo' : 'Archivado / Baja'}</strong></span>
    `;

    let html = `
      <div style="background:#f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem;">
        <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 0.4rem; color: #1e293b;">Datos Generales</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.5rem; font-size: 0.85rem;">
          <div><strong>Fecha Nacimiento:</strong> ${paciente.fechaNacimiento || '-'} (${calcularEdad(paciente.fechaNacimiento)})</div>
          <div><strong>Genero:</strong> ${paciente.genero || 'No especificado'}</div>
          <div><strong>Telefono:</strong> ${paciente.telefono || 'N/A'}</div>
          <div><strong>Correo:</strong> ${paciente.correo || 'N/A'}</div>
          ${paciente.tipoSangre ? `<div><strong>Tipo Sangre:</strong> ${paciente.tipoSangre}</div>` : ''}
          ${paciente.tutor ? `<div><strong>Tutor Legal:</strong> ${paciente.tutor.nombre} (${paciente.tutor.parentesco})</div>` : ''}
          ${!paciente.activo ? `<div style="color:#dc2626; grid-column: 1 / -1;"><strong>Motivo de Baja:</strong> ${paciente.motivoBaja || 'Sin especificar'} (Fecha: ${paciente.fechaBaja || '-'})</div>` : ''}
        </div>
        <div style="margin-top: 0.5rem; font-size: 0.75rem; color: #64748b;">
          <em>${garantiaConsistencia}</em>
        </div>
      </div>

      <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.75rem;">Registro Cronologico de Atenciones (${totalConsultas})</h4>
    `;

    if (consultas.length === 0) {
      html += `<div style="text-align:center; padding: 2rem; color:#64748b; background:#f8fafc; border-radius: 8px;">Este paciente no tiene atenciones registradas en este establecimiento.</div>`;
    } else {
      html += `<div class="timeline">`;
      consultas.forEach(c => {
        html += `
          <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-card">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap;">
                <span style="font-weight: 700; color: #0f172a; font-size: 0.95rem;">
                  Fecha: ${c.fecha} - ${c.motivo}
                </span>
                <span class="badge badge-secondary" style="font-size: 0.72rem;">${c.profesional || 'Profesional tratante'}</span>
              </div>
        `;

        if (c.controlCrecimiento && (c.controlCrecimiento.pesoKg || c.controlCrecimiento.tallaCm)) {
          html += `
            <div style="background: #fefce8; border: 1px solid #fef08a; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.8rem; margin-bottom: 0.5rem; color: #854d0e;">
              <strong>Control Pediatrico:</strong> Peso: ${c.controlCrecimiento.pesoKg} kg | Talla: ${c.controlCrecimiento.tallaCm} cm.
              <em>${c.controlCrecimiento.observaciones || ''}</em>
            </div>
          `;
        }

        if (c.procedimientos && c.procedimientos.length > 0) {
          html += `
            <div style="background: #ecfeff; border: 1px solid #a5f3fc; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.8rem; margin-bottom: 0.5rem; color: #0e7490;">
              <strong>Procedimientos Odontologicos:</strong>
              ${c.procedimientos.map(p => `<div>- ${p.tipo} (${p.piezaDental}) - Costo: Q${p.costo.toFixed(2)} [${p.observaciones || 'OK'}]</div>`).join('')}
            </div>
          `;
        }

        if (c.resultadosExamen && c.resultadosExamen.length > 0) {
          html += `
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.8rem; margin-bottom: 0.5rem; color: #166534;">
              <strong>Resultados de Laboratorio (${c.tipoExamen || 'Parametros'}):</strong>
              <table style="margin-top: 0.3rem; background: white; border: 1px solid #dcfce7; font-size: 0.75rem;">
                <thead><tr><th>Parametro</th><th>Valor Obtenido</th><th>Referencia</th><th>Unidad</th></tr></thead>
                <tbody>
                  ${c.resultadosExamen.map(r => `
                    <tr>
                      <td><strong>${r.parametro}</strong></td>
                      <td style="color:#1d4ed8; font-weight:700;">${r.valor_obtenido}</td>
                      <td>${r.valor_referencia}</td>
                      <td>${r.unidad_medida}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `;
        }

        if (c.diagnosticos && c.diagnosticos.length > 0) {
          c.diagnosticos.forEach(d => {
            html += `
              <div style="margin-top: 0.5rem; font-size: 0.85rem;">
                <div><strong>Diagnostico:</strong> ${d.descripcion} ${d.codigoReferencia ? `(Ref: ${d.codigoReferencia})` : ''} - <span class="badge badge-secondary">${d.gravedad}</span></div>
            `;
            if (d.tratamientos && d.tratamientos.length > 0) {
              html += `<div style="margin-top: 0.3rem; padding-left: 1rem; color: #334155;"><strong>Prescripcion:</strong>
                ${d.tratamientos.map(t => `${t.medicamento} - ${t.dosis} (${t.frecuencia || 'Continuo'})`).join('; ')}
              </div>`;
            }
            html += `</div>`;
          });
        }

        html += `</div></div>`;
      });
      html += `</div>`;
    }

    if (vacunasAplicadas && vacunasAplicadas.length > 0) {
      html += `
        <div style="margin-top: 1.5rem; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 1rem;">
          <h5 style="font-size: 0.88rem; font-weight: 700; color: #92400e; margin-bottom: 0.5rem;">Esquema de Vacunacion Registrado</h5>
          <ul style="font-size: 0.82rem; padding-left: 1.25rem; color: #78350f;">
            ${vacunasAplicadas.map(v => `<li><strong>${v.nombre_vacuna}</strong> (Dosis ${v.dosis_numero}) - Aplicada el ${v.fecha_aplicacion}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    modalContent.innerHTML = html;
  } catch (err) {
    modalContent.innerHTML = `<div style="color:#ef4444; padding: 1.5rem;">Error de conexion: ${err.message}</div>`;
  }
}

// ===============================================================
// Guardar Nuevo Paciente
// ===============================================================
async function guardarNuevoPaciente(event) {
  event.preventDefault();

  const payload = {
    nombre: document.getElementById('pNombre').value.trim(),
    apellido: document.getElementById('pApellido').value.trim(),
    fechaNacimiento: document.getElementById('pFechaNac').value,
    genero: document.getElementById('pGenero').value,
    telefono: document.getElementById('pTelefono').value.trim(),
    correo: document.getElementById('pCorreo').value.trim(),
    direccion: document.getElementById('pDireccion').value.trim(),
    tipoSangre: document.getElementById('pTipoSangre')?.value || 'O+',
    tutorNombre: document.getElementById('pTutorNombre')?.value.trim() || '',
    tutorParentesco: document.getElementById('pTutorParentesco')?.value || 'Madre'
  };

  try {
    const res = await fetch(`/api/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-institution-id': currentInstitution
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json();

    if (!json.success) {
      alert(`Error al generar historial: ${json.error}`);
      return;
    }

    alert(`Historial clinico generado exitosamente en ${INSTITUTION_CONFIG[currentInstitution].engine}. ID: ${json.data.id}`);
    document.getElementById('newPatientForm').reset();
    switchExclusiveTab('historiales');
    cargarPacientes();
    cargarEstadisticas();
    cargarQueryLogs();
  } catch (err) {
    alert(`Error de red: ${err.message}`);
  }
}

// ===============================================================
// Guardar Atencion Medica
// ===============================================================
function poblarSelectPacientes(preselectedId = null) {
  const sel = document.getElementById('eventPatientSelect');
  if (!sel) return;

  const activePatients = cachedPatients.filter(p => p.activo);
  if (activePatients.length === 0) {
    sel.innerHTML = `<option value="">No hay pacientes activos en ${INSTITUTION_CONFIG[currentInstitution].name}. Registre uno primero.</option>`;
    return;
  }

  sel.innerHTML = `<option value="">Seleccione un paciente de la lista...</option>` +
    activePatients.map(p => `
      <option value="${p.id}" ${String(p.id) === String(preselectedId) ? 'selected' : ''}>
        #${p.id} - ${p.nombre} ${p.apellido} (${p.correo || p.telefono || 'Sin contacto'})
      </option>
    `).join('');
}

function abrirAtencionParaPaciente(patientId) {
  switchExclusiveTab('atencion');
  setTimeout(() => {
    poblarSelectPacientes(patientId);
  }, 100);
}

async function guardarAtencionMedica(event) {
  event.preventDefault();

  const patientId = document.getElementById('eventPatientSelect').value;
  if (!patientId) {
    alert('Debe seleccionar un paciente.');
    return;
  }

  const payload = {
    patientId: patientId,
    fecha: document.getElementById('eventFecha').value,
    hora: document.getElementById('eventHora').value,
    motivo: document.getElementById('eventMotivo').value.trim(),
    diagnosticoDescripcion: document.getElementById('eventDiagnostico').value.trim(),
    codigoReferencia: document.getElementById('eventCodigoRef').value.trim(),
    gravedad: document.getElementById('eventGravedad').value,
    medicamento: document.getElementById('eventMedicamento').value.trim(),
    piezaDental: document.getElementById('eventPiezaDental')?.value.trim(),
    costo: document.getElementById('eventCosto')?.value,
    pesoKg: document.getElementById('eventPeso')?.value,
    tallaCm: document.getElementById('eventTalla')?.value,
    vacunaNombre: document.getElementById('eventVacuna')?.value.trim(),
    tipoExamenNombre: document.getElementById('eventTipoExamen')?.value,
    parametroValor: document.getElementById('eventParametroValor')?.value.trim()
  };

  try {
    const res = await fetch(`/api/clinical/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-institution-id': currentInstitution
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json();

    if (!json.success) {
      alert(`Error al registrar atencion: ${json.error}`);
      return;
    }

    alert(`Atencion medica y prescripcion registradas exitosamente en ${INSTITUTION_CONFIG[currentInstitution].engine}.`);
    document.getElementById('medicalEventForm').reset();
    switchExclusiveTab('historiales');
    cargarEstadisticas();
    cargarQueryLogs();
  } catch (err) {
    alert(`Error de red: ${err.message}`);
  }
}

// ===============================================================
// Bajas y Archivo de Historiales
// ===============================================================
function abrirModalBaja(patientId, patientName) {
  document.getElementById('archivePatientId').value = patientId;
  document.getElementById('archivePatientName').textContent = `Paciente: ${patientName} (#${patientId})`;
  document.getElementById('archiveCustomReason').value = '';
  document.getElementById('archiveReasonSelect').value = 'Traslado a otra institucion medica';
  document.getElementById('archiveCustomReasonGroup').style.display = 'none';
  document.getElementById('archiveModal').classList.add('active');
}

function cambiarTipoMotivo(val) {
  const customGroup = document.getElementById('archiveCustomReasonGroup');
  customGroup.style.display = val === 'OTRO' ? 'block' : 'none';
}

async function confirmarBajaPaciente(event) {
  event.preventDefault();
  const id = document.getElementById('archivePatientId').value;
  const selectVal = document.getElementById('archiveReasonSelect').value;
  const customVal = document.getElementById('archiveCustomReason').value.trim();

  const motivo = selectVal === 'OTRO' ? customVal : selectVal;
  if (!motivo) {
    alert('Debe especificar el motivo de la baja.');
    return;
  }

  try {
    const res = await fetch(`/api/patients/${id}/archive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-institution-id': currentInstitution
      },
      body: JSON.stringify({ motivo })
    });
    const json = await res.json();

    if (!json.success) {
      alert(`Error al archivar: ${json.error}`);
      return;
    }

    cerrarModal('archiveModal');
    alert(`Historial clinico archivado exitosamente.`);
    cargarPacientes();
    cargarEstadisticas();
    cargarQueryLogs();
  } catch (err) {
    alert(`Error de red: ${err.message}`);
  }
}

async function reactivarPaciente(id) {
  if (!confirm('Desea reactivar este historial clinico previamente archivado?')) return;

  try {
    const res = await fetch(`/api/patients/${id}/restore`, {
      method: 'POST',
      headers: { 'x-institution-id': currentInstitution }
    });
    const json = await res.json();

    if (!json.success) {
      alert(`Error al reactivar: ${json.error}`);
      return;
    }

    alert('Historial clinico reactivado con exito.');
    cargarPacientes();
    cargarEstadisticas();
    cargarQueryLogs();
  } catch (err) {
    alert(`Error de red: ${err.message}`);
  }
}

async function cargarPacientesBajas() {
  const tbody = document.getElementById('archivedTableBody');
  if (!tbody) return;

  try {
    const res = await fetch(`/api/patients?institutionId=${currentInstitution}&activo=false`, {
      headers: { 'x-institution-id': currentInstitution }
    });
    const json = await res.json();

    if (!json.success || !json.data) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#ef4444;">Error al cargar bajas.</td></tr>`;
      return;
    }

    if (json.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color:#64748b;">No existen pacientes en estado de baja en ${INSTITUTION_CONFIG[currentInstitution].name}.</td></tr>`;
      return;
    }

    tbody.innerHTML = json.data.map(p => `
      <tr>
        <td><strong>#${p.id}</strong></td>
        <td><strong>${p.nombre} ${p.apellido}</strong><br><span style="font-size:0.75rem; color:#64748b;">${p.correo || p.telefono || ''}</span></td>
        <td>${p.fechaBaja ? p.fechaBaja.substring(0, 10) : 'Fecha registrada'}</td>
        <td style="color:#b91c1c; font-weight:600;">${p.motivoBaja || 'Sin motivo registrado'}</td>
        <td>
          <button class="btn btn-success btn-sm" onclick="reactivarPaciente('${p.id}')">Reactivar</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#ef4444;">Error de red.</td></tr>`;
  }
}

// ===============================================================
// Inspector de Consultas
// ===============================================================
async function cargarQueryLogs() {
  const consoleEl = document.getElementById('queryConsole');
  if (!consoleEl) return;

  try {
    const res = await fetch('/api/system/query-logs');
    const json = await res.json();
    if (!json.success || !json.data) return;

    if (json.data.length === 0) {
      consoleEl.innerHTML = `<div style="color: #64748b;">No hay consultas registradas aun en el buffer.</div>`;
      return;
    }

    consoleEl.innerHTML = json.data.map(q => `
      <div class="query-log-item">
        <div class="query-log-header">
          <span>[${q.timestamp.split('T')[1].substring(0, 8)}] <strong>${q.engine}</strong> (${q.institutionId.toUpperCase()}) - Op: ${q.operation}</span>
          <span>${q.executionTimeMs} ms</span>
        </div>
        <div class="query-code">${escapeHtml(q.rawQuery)}</div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error al cargar trazas:', err);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ===============================================================
// Documento Comparativo Modal
// ===============================================================
function verDocumentoComparativo() {
  const modal = document.getElementById('comparativeModal');
  const target = document.getElementById('comparativeDocContent');

  target.innerHTML = `
    <h3 style="font-size: 1.15rem; color: #0f172a; margin-bottom: 0.75rem;">1. Justificacion de Asignacion de Motores</h3>
    <table style="margin-bottom: 1.5rem;">
      <thead>
        <tr>
          <th>Establecimiento</th>
          <th>Motor Asignado</th>
          <th>Tipo</th>
          <th>Justificacion Tecnica</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Hospital General</strong></td>
          <td>PostgreSQL</td>
          <td>Relacional</td>
          <td>Requiere control estricto de citas y tratamientos con transacciones ACID indivisibles. No permite diagnosticos a medias ni tratamientos huerfanos.</td>
        </tr>
        <tr>
          <td><strong>Clinica Odontologica</strong></td>
          <td>MySQL</td>
          <td>Relacional</td>
          <td>Atencion agil gestionada por secretarias. Modelo normalizado con alta velocidad en lecturas cotidianas, asociacion de piezas dentales y facturacion.</td>
        </tr>
        <tr>
          <td><strong>Laboratorio Clinico</strong></td>
          <td>MongoDB</td>
          <td>NoSQL Documental</td>
          <td>Resultados heterogeneos segun tipo de prueba. Embebe los parametros dentro de cada orden, evitando el antipatron relacional EAV y reduciendo joins.</td>
        </tr>
        <tr>
          <td><strong>Centro Medico Pediatrico</strong></td>
          <td>Firebase Firestore</td>
          <td>NoSQL Tiempo Real</td>
          <td>Consultas frecuentes de seguimiento infantil. Embebe los datos del tutor legal en el menor y gestiona controles de peso/talla y vacunas en subcolecciones.</td>
        </tr>
      </tbody>
    </table>

    <h3 style="font-size: 1.15rem; color: #0f172a; margin-bottom: 0.5rem;">2. Decisiones de Modelado Documental: Embebido vs Referenciado</h3>
    <ul style="padding-left: 1.5rem; line-height: 1.7; margin-bottom: 1.25rem;">
      <li>
        <strong>MongoDB (Laboratorio Clinico):</strong>
        <br>- Referenciado: Las ordenes de examen se referencian por <code>id_paciente</code> para evitar superar el limite de 16MB por documento.
        <br>- Embebido: Los parametros y resultados de cada examen se embeben directamente en la orden para recuperarse en una sola lectura I/O sin $lookup.
      </li>
      <li style="margin-top: 0.5rem;">
        <strong>Firebase Firestore (Centro Medico Pediatrico):</strong>
        <br>- Embebido: Los datos del tutor legal se embeben en el paciente para recuperar la ficha completa del menor en una sola operacion de lectura.
        <br>- Subcolecciones / Referenciado: Los controles de peso/talla y vacunas se almacenan en subcolecciones para que el documento raiz del menor sea liviano.
      </li>
    </ul>

    <h3 style="font-size: 1.15rem; color: #0f172a; margin-bottom: 0.5rem;">3. Consistencia y Transacciones</h3>
    <p>
      PostgreSQL y MySQL implementan transacciones ACID completas con BEGIN/START TRANSACTION y COMMIT/ROLLBACK.
      MongoDB y Firestore ofrecen atomicidad por documento y escrituras por lote para preservar consistencia sin riesgo de registros corruptos.
    </p>
  `;

  modal.classList.add('active');
}

// Modal closing
function cerrarModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}
