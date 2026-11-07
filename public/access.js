'use strict';
// Complemento de interfaz: no reemplaza la lógica de expedientes existente.
let pendingInstitution = null;
let accessUser = null;
const originalEnterInstitution = window.entrarAEstablecimiento;
const originalGoPortal = window.irAlPortal;

function showAccess(institutionId) {
  if (!INSTITUTION_CONFIG[institutionId]) return;
  pendingInstitution = institutionId;
  document.getElementById('view-portal').style.display = 'none';
  document.getElementById('view-establishment').style.display = 'none';
  document.getElementById('view-access').style.display = 'block';
  document.getElementById('activeEngineBadge').style.display = 'none';
  document.getElementById('accessInstitutionName').textContent =
    'Ingrese con su usuario y contraseña para acceder a ' + INSTITUTION_CONFIG[institutionId].name + '.';
  document.getElementById('accessError').textContent = '';
  document.getElementById('accessPassword').value = '';
  document.getElementById('accessUser').focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.entrarAEstablecimiento = async function (institutionId) {
  if (!INSTITUTION_CONFIG[institutionId]) return;
  // El cambio de institución nunca reutiliza una sesión de otra.
  try {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
    const result = await response.json();
    if (response.ok && result.success && result.user.institutionId === institutionId) {
      accessUser = result.user;
      document.getElementById('view-access').style.display = 'none';
      originalEnterInstitution(institutionId);
      document.getElementById('exclusiveSubtitle').textContent =
        INSTITUTION_CONFIG[institutionId].subtitle + ' | Sesión: ' + result.user.nombre;
      return;
    }
  } catch (err) {
    console.warn('No se pudo recuperar la sesión:', err.message);
  }
  showAccess(institutionId);
}

window.irAlPortal = function () {
  document.getElementById('view-access').style.display = 'none';
  originalGoPortal();
}

async function cerrarSesion() {
  try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); }
  catch (err) { console.warn('No se pudo contactar el servidor para cerrar sesión.'); }
  accessUser = null;
  pendingInstitution = null;
  irAlPortal();
}

document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.navbar > div:last-child');
  if (nav) {
    const button = document.createElement('button');
    button.className = 'btn btn-secondary btn-sm';
    button.type = 'button';
    button.textContent = 'Cerrar sesión';
    button.addEventListener('click', cerrarSesion);
    nav.prepend(button);
  }
  const form = document.getElementById('accessForm');
  if (form) form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!pendingInstitution) return;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    const error = document.getElementById('accessError');
    error.textContent = '';
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId: pendingInstitution,
          username: document.getElementById('accessUser').value.trim(),
          password: document.getElementById('accessPassword').value
        })
      });
      const result = await response.json();
      document.getElementById('accessPassword').value = '';
      if (!response.ok || !result.success) {
        error.textContent = result.error || 'No fue posible iniciar sesión.';
        return;
      }
      accessUser = result.user;
      await entrarAEstablecimiento(pendingInstitution);
    } catch (err) {
      error.textContent = 'No se pudo contactar el servidor.';
    } finally {
      submit.disabled = false;
    }
  });
});

async function cargarProfesionales() {
  const tbody = document.getElementById('professionalsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4">Cargando profesionales...</td></tr>';
  try {
    const response = await fetch('/api/professionals', {
      headers: { 'x-institution-id': currentInstitution },
      credentials: 'same-origin', cache: 'no-store'
    });
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.error || 'Error de consulta');
    if (json.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4">No se registraron profesionales en este establecimiento.</td></tr>';
      return;
    }
    tbody.replaceChildren(...json.data.map(prof => {
      const row = document.createElement('tr');
      for (const value of [prof.id, prof.nombre + ' ' + prof.apellido, prof.especialidad, prof.numero_colegiado]) {
        const cell = document.createElement('td');
        cell.textContent = String(value ?? '');
        row.append(cell);
      }
      return row;
    }));
  } catch (err) {
    tbody.innerHTML = '';
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.textContent = err.message;
    row.append(cell);
    tbody.append(row);
  }
}
