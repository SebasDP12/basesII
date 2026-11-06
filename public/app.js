// Estado de la Aplicación Cliente
let currentInstitution = 'hospital';
let cachedPatients = [];

const INSTITUTION_CONFIG = {
  hospital: {
    name: 'Hospital General',
    engine: 'PostgreSQL',
    port: '5432',
    colorClass: 'engine-postgres',
    icon: '🐘',
    user: 'Dr. Carlos Ramírez (Medicina Interna)',
    desc: 'Control estricto de citas, diagnósticos y tratamientos con transaccionalidad ACID fuerte.',
    showTipoSangre: true,
    showTutor: false
  },
  odontologia: {
    name: 'Clínica Odontológica',
    engine: 'MySQL',
    port: '3306',
    colorClass: 'engine-mysql',
    icon: '🐬',
    user: 'Dra. Sofía Mendoza & Recepción',
    desc: 'Atención ágil en clínica dental, citas rápidas y facturación de procedimientos.',
    showTipoSangre: false,
    showTutor: false
  },
  laboratorio: {
    name: 'Laboratorio Clínico',
    engine: 'MongoDB',
    port: '27017',
    colorClass: 'engine-mongo',
    icon: '🍃',
    user: 'Lic. Marco Tulio Peña (Químico Biólogo)',
    desc: 'Esquema documental flexible para órdenes con parámetros dinámicos embebidos.',
    showTipoSangre: false,
    showTutor: false
  },
  pediatria: {
    name: 'Centro Médico Pediátrico',
    engine: 'Firebase Firestore',
    port: '8080',
    colorClass: 'engine-firebase',
    icon: '🔥',
    user: 'Dra. Elena Castillo (Pediatría)',
    desc: 'Seguimiento continuo de crecimiento, vacunas y tutores en Firestore.',
    showTipoSangre: false,
    showTutor: true
  }
};

// ===============================================================
// Inicialización
// ===============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Establecer fecha y hora actual en los formularios
  const today = new Date().toISOString().split('T')[0];
  const time = new Date().toTimeString().split(' ')[0].substring(0, 5);
  const fFecha = document.getElementById('eventFecha');
  const fHora = document.getElementById('eventHora');
  if (fFecha) fFecha.value = today;
  if (fHora) fHora.value = time;

  // Cargar datos iniciales
  actualizarUIInstitucion();
  verificarSaludMotores();
  cargarPacientes();
  cargarEstadisticas();
  cargarQueryLogs();
  cargarDocumentoComparativo();

  // Polling periódico para query logs y salud
  setInterval(cargarQueryLogs, 5000);
  setInterval(verificarSaludMotores, 12000);
});

// ===============================================================
// Cambio de Institución / Usuario (Enrutamiento por Usuario)
// ===============================================================
function cambiarInstitucion(newInst) {
  currentInstitution = newInst;
  actualizarUIInstitucion();
  cargarPacientes();
  cargarEstadisticas();
}

function actualizarUIInstitucion() {
  const cfg = INSTITUTION_CONFIG[currentInstitution];
  if (!cfg) return;

  // Actualizar selector
  const userSelector = document.getElementById('userSelector');
  if (userSelector && userSelector.value !== currentInstitution) {
    userSelector.value = currentInstitution;
  }

  // Actualizar badge
  const badge = document.getElementById('activeEngineBadge');
  if (badge) {
    badge.className = `engine-badge ${cfg.colorClass}`;
    badge.textContent = `${cfg.icon} ${cfg.engine} :${cfg.port}`;
  }

  // Actualizar banner
  const title = document.getElementById('bannerInstTitle');
  const desc = document.getElementById('bannerInstDesc');
  if (title) title.textContent = `${cfg.name} — Motor Activo: ${cfg.engine} (${cfg.user})`;
  if (desc) desc.textContent = cfg.desc;

  // Ajustar formularios según la institución activa
  const newInstName = document.getElementById('newPatientInstName');
  if (newInstName) newInstName.textContent = cfg.name;

  const fTipoSangre = document.getElementById('fieldTipoSangre');
  const fTutorNombre = document.getElementById('fieldTutorNombre');
  const fTutorParentesco = document.getElementById('fieldTutorParentesco');
  if (fTipoSangre) fTipoSangre.style.display = cfg.showTipoSangre ? 'block' : 'none';
  if (fTutorNombre) fTutorNombre.style.display = cfg.showTutor ? 'block' : 'none';
  if (fTutorParentesco) fTutorParentesco.style.display = cfg.showTutor ? 'block' : 'none';

  // Formularios de atención médica condicionales
  document.querySelectorAll('.odonto-only').forEach(el => el.style.display = currentInstitution === 'odontologia' ? 'block' : 'none');
  document.querySelectorAll('.pediatria-only').forEach(el => el.style.display = currentInstitution === 'pediatria' ? 'block' : 'none');
  document.querySelectorAll('.lab-only').forEach(el => el.style.display = currentInstitution === 'laboratorio' ? 'block' : 'none');
}

// ===============================================================
// Pestañas / Tabs
// ===============================================================
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });

  const sectionMap = {
    'historiales': 'tab-historiales',
    'nuevo-paciente': 'tab-nuevo-paciente',
    'atencion': 'tab-atencion',
    'bajas': 'tab-bajas',
    'inspector': 'tab-inspector',
    'comparativo': 'tab-comparativo'
  };

  Object.values(sectionMap).forEach(sId => {
    const sec = document.getElementById(sId);
    if (sec) sec.style.display = 'none';
  });

  const activeSec = document.getElementById(sectionMap[tabId]);
  if (activeSec) activeSec.style.display = 'block';

  if (tabId === 'atencion') {
    poblarSelectPacientes();
  } else if (tabId === 'bajas') {
    cargarPacientesBajas();
  } else if (tabId === 'inspector') {
    cargarQueryLogs();
  }
}

// ===============================================================
// Health Check de los 4 Motores
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
    : `Desconectado / Iniciando`;
  el.style.color = isOnline ? '#166534' : '#991b1b';
}

// ===============================================================
// Estadísticas de la Institución
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
    console.error('Error cargando estadísticas:', err);
  }
}

// ===============================================================
// Cargar Pacientes (Historiales Clínicos)
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
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#ef4444; padding: 2rem;">Error de conexión: ${err.message}</td></tr>`;
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
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color:#64748b;">No se encontraron historiales clínicos para el filtro actual.</td></tr>`;
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
          <div>📞 ${p.telefono || 'Sin tel.'}</div>
          <div style="font-size: 0.75rem; color: #64748b;">✉️ ${p.correo || 'Sin correo'}</div>
        </td>
        <td>${infoExtra}</td>
        <td>${estadoBadge}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-secondary btn-sm" onclick="verHistorialCompleto('${p.id}')" title="Ver Historial Clínico Completo">
            👁️ Historial
          </button>
          <button class="btn btn-primary btn-sm" onclick="abrirAtencionParaPaciente('${p.id}')" title="Nueva Consulta">
            🩺 Consulta
          </button>
          ${p.activo
            ? `<button class="btn btn-danger btn-sm" onclick="abrirModalBaja('${p.id}', '${p.nombre} ${p.apellido}')" title="Dar de Baja / Archivar">📁 Archivar</button>`
            : `<button class="btn btn-success btn-sm" onclick="reactivarPaciente('${p.id}')" title="Reactivar Historial">🔄 Reactivar</button>`
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
  return `${edadAnios} años`;
}

// ===============================================================
// Historial Clínico Completo (Modal)
// ===============================================================
async function verHistorialCompleto(patientId) {
  const modal = document.getElementById('historyModal');
  const modalContent = document.getElementById('modalHistoryContent');
  const modalTitle = document.getElementById('modalPatientName');
  const modalInfo = document.getElementById('modalPatientInfo');

  modal.classList.add('active');
  modalContent.innerHTML = `<div style="text-align:center; padding: 2rem;">Cargando historial clínico desde ${INSTITUTION_CONFIG[currentInstitution].engine}...</div>`;

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

    modalTitle.textContent = `Historial Clínico: ${paciente.nombre} ${paciente.apellido}`;
    modalInfo.innerHTML = `
      <span>Institución: <strong>${INSTITUTION_CONFIG[currentInstitution].name}</strong></span> |
      <span>Motor: <strong>${motor}</strong></span> |
      <span>Estado: <strong>${paciente.activo ? 'Activo' : 'Archivado / Baja'}</strong></span>
    `;

    let html = `
      <div style="background:#f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem;">
        <h3 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 0.4rem; color: #1e293b;">📋 Datos Generales del Historial</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.5rem; font-size: 0.85rem;">
          <div><strong>Fecha Nac:</strong> ${paciente.fechaNacimiento || '-'} (${calcularEdad(paciente.fechaNacimiento)})</div>
          <div><strong>Género:</strong> ${paciente.genero || 'No especificado'}</div>
          <div><strong>Teléfono:</strong> ${paciente.telefono || 'N/A'}</div>
          <div><strong>Correo:</strong> ${paciente.correo || 'N/A'}</div>
          ${paciente.tipoSangre ? `<div><strong>Tipo Sangre:</strong> ${paciente.tipoSangre}</div>` : ''}
          ${paciente.tutor ? `<div><strong>Tutor:</strong> ${paciente.tutor.nombre} (${paciente.tutor.parentesco})</div>` : ''}
          ${!paciente.activo ? `<div style="color:#dc2626; grid-column: 1 / -1;"><strong>Motivo de Baja:</strong> ${paciente.motivoBaja || 'Sin especificar'} (Fecha: ${paciente.fechaBaja || '-'})</div>` : ''}
        </div>
        <div style="margin-top: 0.5rem; font-size: 0.75rem; color: #64748b;">
          🔒 <em>${garantiaConsistencia}</em>
        </div>
      </div>

      <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem;">📅 Registro de Atenciones, Diagnósticos y Tratamientos (${totalConsultas})</h3>
    `;

    if (consultas.length === 0) {
      html += `<div style="text-align:center; padding: 2rem; color:#64748b; background:#f8fafc; border-radius: 8px;">Este paciente no tiene atenciones previas registradas en este establecimiento.</div>`;
    } else {
      html += `<div class="timeline">`;
      consultas.forEach(c => {
        html += `
          <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-card">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap;">
                <span style="font-weight: 700; color: #0f172a; font-size: 0.95rem;">
                  🗓️ ${c.fecha} - ${c.motivo}
                </span>
                <span class="badge badge-secondary" style="font-size: 0.72rem;">${c.profesional || 'Médico tratante'}</span>
              </div>
        `;

        // Detalles específicos según motor/institución
        if (c.controlCrecimiento && (c.controlCrecimiento.pesoKg || c.controlCrecimiento.tallaCm)) {
          html += `
            <div style="background: #fefce8; border: 1px solid #fef08a; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.8rem; margin-bottom: 0.5rem; color: #854d0e;">
              👶 <strong>Control Pediátrico:</strong> Peso: ${c.controlCrecimiento.pesoKg} kg | Talla: ${c.controlCrecimiento.tallaCm} cm.
              <em>${c.controlCrecimiento.observaciones || ''}</em>
            </div>
          `;
        }

        if (c.procedimientos && c.procedimientos.length > 0) {
          html += `
            <div style="background: #ecfeff; border: 1px solid #a5f3fc; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.8rem; margin-bottom: 0.5rem; color: #0e7490;">
              🦷 <strong>Procedimientos Odontológicos:</strong>
              ${c.procedimientos.map(p => `<div>• ${p.tipo} (${p.piezaDental}) - Costo: Q${p.costo.toFixed(2)} [${p.observaciones || 'OK'}]</div>`).join('')}
            </div>
          `;
        }

        if (c.resultadosExamen && c.resultadosExamen.length > 0) {
          html += `
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.8rem; margin-bottom: 0.5rem; color: #166534;">
              🧪 <strong>Resultados de Laboratorio (${c.tipoExamen || 'Parámetros'}):</strong>
              <table style="margin-top: 0.3rem; background: white; border: 1px solid #dcfce7; font-size: 0.75rem;">
                <thead><tr><th>Parámetro</th><th>Valor Obtenido</th><th>Referencia</th><th>Unidad</th></tr></thead>
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

        // Diagnósticos y Tratamientos
        if (c.diagnosticos && c.diagnosticos.length > 0) {
          c.diagnosticos.forEach(d => {
            html += `
              <div style="margin-top: 0.5rem; font-size: 0.85rem;">
                <div>🩺 <strong>Diagnóstico:</strong> ${d.descripcion} ${d.codigoReferencia ? `(Ref: ${d.codigoReferencia})` : ''} - <span class="badge badge-secondary">${d.gravedad}</span></div>
            `;
            if (d.tratamientos && d.tratamientos.length > 0) {
              html += `<div style="margin-top: 0.3rem; padding-left: 1rem; color: #334155;">💊 <strong>Prescripción / Medicamento:</strong>
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

    // Vacunas en pediatría
    if (vacunasAplicadas && vacunasAplicadas.length > 0) {
      html += `
        <div style="margin-top: 1.5rem; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 1rem;">
          <h4 style="font-size: 0.9rem; font-weight: 700; color: #92400e; margin-bottom: 0.5rem;">💉 Esquema de Vacunación Registrado en Firestore</h4>
          <ul style="font-size: 0.82rem; padding-left: 1.25rem; color: #78350f;">
            ${vacunasAplicadas.map(v => `<li><strong>${v.nombre_vacuna}</strong> (Dosis ${v.dosis_numero}) - Aplicada el ${v.fecha_aplicacion}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    modalContent.innerHTML = html;
  } catch (err) {
    modalContent.innerHTML = `<div style="color:#ef4444; padding: 1.5rem;">Error de conexión: ${err.message}</div>`;
  }
}

// ===============================================================
// Guardar Nuevo Paciente (Generar Nuevo Historial)
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

    alert(`✅ Historial clínico generado exitosamente en ${INSTITUTION_CONFIG[currentInstitution].engine}. ID: ${json.data.id}`);
    document.getElementById('newPatientForm').reset();
    switchTab('historiales');
    cargarPacientes();
    cargarEstadisticas();
    cargarQueryLogs();
  } catch (err) {
    alert(`Error de red: ${err.message}`);
  }
}

// ===============================================================
// Guardar Nueva Atención Médica (Consulta + Diagnóstico + Tratamiento)
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
  switchTab('atencion');
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
    // Campos condicionales
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
      alert(`Error al registrar atención: ${json.error}`);
      return;
    }

    alert(`✅ Atención médica y prescripción registradas exitosamente en ${INSTITUTION_CONFIG[currentInstitution].engine}.`);
    document.getElementById('medicalEventForm').reset();
    switchTab('historiales');
    cargarEstadisticas();
    cargarQueryLogs();
  } catch (err) {
    alert(`Error de red: ${err.message}`);
  }
}

// ===============================================================
// Bajas y Archivo de Historiales (Rúbrica Entrega II)
// ===============================================================
function abrirModalBaja(patientId, patientName) {
  document.getElementById('archivePatientId').value = patientId;
  document.getElementById('archivePatientName').textContent = `Paciente: ${patientName} (#${patientId})`;
  document.getElementById('archiveCustomReason').value = '';
  document.getElementById('archiveReasonSelect').value = 'Traslado a otra institución médica';
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
    alert(`📁 Historial clínico archivado exitosamente.`);
    cargarPacientes();
    cargarEstadisticas();
    cargarQueryLogs();
  } catch (err) {
    alert(`Error de red: ${err.message}`);
  }
}

async function reactivarPaciente(id) {
  if (!confirm('¿Desea reactivar este historial clínico previamente archivado?')) return;

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

    alert('✅ Historial clínico reactivado con éxito.');
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
          <button class="btn btn-success btn-sm" onclick="reactivarPaciente('${p.id}')">🔄 Reactivar Historial</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#ef4444;">Error de red.</td></tr>`;
  }
}

// ===============================================================
// Inspector de Consultas (Query Trace Console)
// ===============================================================
async function cargarQueryLogs() {
  const consoleEl = document.getElementById('queryConsole');
  if (!consoleEl) return;

  try {
    const res = await fetch('/api/system/query-logs');
    const json = await res.json();
    if (!json.success || !json.data) return;

    if (json.data.length === 0) {
      consoleEl.innerHTML = `<div style="color: #64748b;">No hay consultas registradas aún en el buffer.</div>`;
      return;
    }

    consoleEl.innerHTML = json.data.map(q => `
      <div class="query-log-item">
        <div class="query-log-header">
          <span>[${q.timestamp.split('T')[1].substring(0, 8)}] <strong>${q.engine}</strong> (${q.institutionId.toUpperCase()}) &bull; Op: ${q.operation}</span>
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
// Documento Comparativo (Entrega II)
// ===============================================================
async function cargarDocumentoComparativo() {
  const target = document.getElementById('comparativeDocContent');
  if (!target) return;

  target.innerHTML = `
    <div style="background:#ffffff; padding: 1.5rem; border-radius: 10px; border: 1px solid #e2e8f0;">
      <h2 style="font-size: 1.4rem; color: #1e3a8a; margin-bottom: 0.5rem;">Documento Comparativo: Arquitectura y Asignación de Motores de BD</h2>
      <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 1.5rem;">
        <strong>Universidad Rafael Landívar | Facultad de Ingeniería | Bases de Datos II</strong><br>
        <strong>Autores:</strong> Angel Sebastian de Paz Mejia (1567823) y Rocio Iveth Cojulum Juarez (1547023)
      </p>

      <h3 style="font-size: 1.1rem; color: #0f172a; margin-top: 1.25rem; margin-bottom: 0.5rem;">1. Justificación de Asignación de Motores por Institución</h3>
      <table style="margin-bottom: 1.5rem;">
        <thead>
          <tr>
            <th>Institución</th>
            <th>Motor Elegido</th>
            <th>Tipo de Base de Datos</th>
            <th>Justificación Técnica y de Negocio</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Hospital General</strong></td>
            <td><span class="badge badge-active">PostgreSQL</span></td>
            <td>Relacional / Objeto-Relacional</td>
            <td>
              Requiere <strong>integridad transaccional fuerte (ACID)</strong> y control estricto sobre citas, diagnósticos y prescripciones.
              No se puede perder un diagnóstico a medias ni emitir un tratamiento huérfano. PostgreSQL ofrece aislamiento Serializable,
              constraints de integridad referencial rígidas (FOREIGN KEY ON DELETE RESTRICT/CASCADE) y soporte empresarial maduro.
            </td>
          </tr>
          <tr>
            <td><strong>Clínica Odontológica</strong></td>
            <td><span class="badge badge-active">MySQL (InnoDB)</span></td>
            <td>Relacional</td>
            <td>
              Institución pequeña sin personal técnico propio donde la atención al cliente la realizan secretarias.
              El modelo es simple y normalizado (paciente, cita, odontólogo, procedimiento con pieza dental y costo).
              MySQL provee <strong>alta velocidad en lecturas/escrituras cotidianas</strong>, bajo consumo de recursos y facilidad de mantenimiento.
            </td>
          </tr>
          <tr>
            <td><strong>Laboratorio Clínico</strong></td>
            <td><span class="badge badge-active">MongoDB</span></td>
            <td>NoSQL / Documental (BSON)</td>
            <td>
              Procesa resultados de exámenes cuya estructura varía radicalmente según la prueba: una hematología (hemoglobina, hematocrito, leucocitos)
              tiene parámetros distintos a un perfil lipídico o un examen de orina. El esquema flexible de documentos permite <strong>embeber los resultados dentro de la orden</strong>,
              evitando joins masivos y esquemas dispersos (EAV anti-pattern) en SQL.
            </td>
          </tr>
          <tr>
            <td><strong>Centro Médico Pediátrico</strong></td>
            <td><span class="badge badge-active">Firebase Firestore</span></td>
            <td>NoSQL / Documental en Tiempo Real</td>
            <td>
              Consultas frecuentes y de corta duración enfocadas en el seguimiento de crecimiento (curvas de peso/talla) y esquema de vacunación,
              siempre asociadas a un tutor legal responsable. Firestore permite <strong>embeber los datos del tutor</strong> en el paciente para lectura en un solo documento
              y organizar consultas y vacunas en subcolecciones estructuradas con sincronización en tiempo real.
            </td>
          </tr>
        </tbody>
      </table>

      <h3 style="font-size: 1.1rem; color: #0f172a; margin-top: 1.25rem; margin-bottom: 0.5rem;">2. Decisiones de Modelado Documental: Embebido vs Referenciado</h3>
      <ul style="padding-left: 1.5rem; line-height: 1.7; margin-bottom: 1.25rem;">
        <li>
          <strong>MongoDB (Laboratorio Clínico):</strong>
          <br>• <em>Datos Referenciados:</em> Las órdenes de examen se referencian por <code>id_paciente</code>. Un paciente puede acumular cientos de exámenes en su vida; embeber todas las órdenes dentro del documento del paciente violaría el límite BSON de 16MB y degradaría la lectura básica del paciente.
          <br>• <em>Datos Embebidos:</em> Los <strong>resultados individuales de los parámetros</strong> se embeben dentro del documento de la orden (<code>ordenes_examen.resultados: [...]</code>), ya que los resultados siempre se consultan y analizan conjuntamente con la orden que los originó.
        </li>
        <li style="margin-top: 0.5rem;">
          <strong>Firebase Firestore (Centro Médico Pediátrico):</strong>
          <br>• <em>Datos Embebidos:</em> Los datos del <strong>tutor responsable</strong> (nombre, parentesco, teléfono, dirección) se embeben directamente en el documento del paciente (<code>pacientes.tutor</code>), optimizando el consumo de lecturas en Firestore al recuperar toda la ficha del menor en una sola operación de lectura (1 document read).
          <br>• <em>Datos Referenciados / Subcolecciones:</em> Las consultas de control de crecimiento (peso/talla) y el historial de vacunación se almacenan en subcolecciones vinculadas por <code>id_paciente</code>, garantizando que el documento principal del paciente se mantenga ligero sin importar la cantidad de visitas mensuales.
        </li>
      </ul>

      <h3 style="font-size: 1.1rem; color: #0f172a; margin-top: 1.25rem; margin-bottom: 0.5rem;">3. Garantías de Consistencia y Transacciones</h3>
      <ul style="padding-left: 1.5rem; line-height: 1.7; margin-bottom: 1.25rem;">
        <li><strong>PostgreSQL:</strong> Transacciones ACID completas con <code>BEGIN ... COMMIT / ROLLBACK</code> asegurando que una cita, diagnóstico y medicamento se inserten atómicamente.</li>
        <li><strong>MySQL:</strong> Motor de almacenamiento InnoDB con transacciones ACID (<code>START TRANSACTION ... COMMIT</code>) y bloqueos a nivel de fila (Row-Level Locking).</li>
        <li><strong>MongoDB:</strong> Atomicidad garantizada a nivel de documento individual; la orden y su lista de resultados embebidos se persisten en una sola operación atómica (<code>insertOne</code> o <code>updateOne</code>). Soporte para transacciones multi-documento de réplica si se requiere.</li>
        <li><strong>Firebase Firestore:</strong> Atomicidad por documento y transacciones por lotes (Batched Writes) con consistencia fuertemente serializada a nivel de documento.</li>
      </ul>

      <h3 style="font-size: 1.1rem; color: #0f172a; margin-top: 1.25rem; margin-bottom: 0.5rem;">4. Seguridad y Clasificación de la Información</h3>
      <p style="margin-bottom: 1rem;">
        Se respeta la clasificación establecida en la Entrega I:
        <br>• <strong>Pública:</strong> Nombres y especialidades de los profesionales de salud, catálogo de exámenes y catálogo de vacunas.
        <br>• <strong>Confidencial:</strong> Datos de contacto del paciente y tutores (teléfonos, correos, dirección residencial).
        <br>• <strong>Restringida:</strong> Historiales de diagnósticos, tratamientos farmacológicos, resultados de laboratorio y motivo de bajas médicas.
      </p>

      <h3 style="font-size: 1.1rem; color: #0f172a; margin-top: 1.25rem; margin-bottom: 0.5rem;">5. Arquitectura Hexagonal y Enrutamiento por Usuario</h3>
      <p>
        El sistema desacopla enteramente la lógica clínica a través del puerto <code>MedicalRecordRepositoryPort</code>.
        Al autenticarse o seleccionar el usuario/establecimiento, el componente <code>InstitutionRouterService</code>
        enruta de manera transparente todas las operaciones al adaptador correspondiente (<code>PostgresAdapter</code>, <code>MySQLAdapter</code>, <code>MongoAdapter</code> o <code>FirestoreAdapter</code>),
        sin que los casos de uso ni la interfaz de usuario tengan que reescribirse.
      </p>
    </div>
  `;
}

// ===============================================================
// Utilidades de Modal
// ===============================================================
function cerrarModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}
