'use strict';
const $ = id => document.getElementById(id);
const roles = {
  hospital: [{id:'admin',name:'Administrador'}, {id:'medico',name:'Médico'}, {id:'recepcion',name:'Recepción'}],
  odontologia: [{id:'admin',name:'Administrador'}, {id:'odontologo',name:'Odontólogo'}, {id:'recepcion',name:'Recepción'}],
  laboratorio: [{id:'admin',name:'Administrador'}, {id:'laboratorista',name:'Laboratorista'}, {id:'recepcion',name:'Recepción'}],
  pediatria: [{id:'admin',name:'Administrador'}, {id:'pediatra',name:'Pediatra'}, {id:'enfermeria',name:'Enfermería'}, {id:'recepcion',name:'Recepción'}]
};
const professional = new Set(['medico','odontologo','laboratorista','pediatra','admin']);
const names = {hospital:'Hospital General',odontologia:'Clínica Odontológica',laboratorio:'Laboratorio Clínico',pediatria:'Centro Médico Pediátrico',admin:'Administración'};

async function api(url, options={}) {
  const res = await fetch(url, {credentials:'same-origin',cache:'no-store',
    ...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
  const data = await res.json();
  if(!res.ok || !data.success) throw new Error(data.error || 'No se completó la petición');
  return data;
}
function show(id) {
  for(const panel of ['setupPanel','loginPanel','dashboard']) $(panel).classList.toggle('hidden',panel!==id);
}
function updateRoles() {
  const selected = $('newInstitution').value;
  $('newRole').replaceChildren(...roles[selected].map(r => {
    const o=document.createElement('option');o.value=r.id;o.textContent=r.name;return o;
  }));
  updateMedicalFields();
}
function updateMedicalFields() {
  const enabled=professional.has($('newRole').value);
  for(const node of document.querySelectorAll('.medicalField')) node.classList.toggle('hidden',!enabled);
  $('newSpecialty').required=enabled;
  $('newLicense').required=enabled;
}
async function refreshUsers() {
  const result=await api('/api/admin/users');
  const table=$('userRows');table.replaceChildren();
  for(const u of result.data) {
    const tr=document.createElement('tr');
    for(const val of [u.username,u.nombre,names[u.institutionId]||u.institutionId,u.rol,u.active?'Activa':'Suspendida']) {
      const td=document.createElement('td');td.textContent=val;tr.append(td);
    }
    const td=document.createElement('td');
    if(u.institutionId!=='admin') {
      const btn=document.createElement('button');
      btn.type='button';btn.className='btn btn-secondary btn-sm';
      btn.textContent=u.active?'Suspender':'Reactivar';
      btn.addEventListener('click',async()=>{
        btn.disabled=true;
        try {
          await api('/api/admin/users/'+encodeURIComponent(u.username),
            {method:'PATCH',body:JSON.stringify({active:!u.active})});
          await refreshUsers();
        } catch(err){alert(err.message);btn.disabled=false;}
      });
      td.append(btn);
    } else {td.textContent='Cuenta administrativa';}
    tr.append(td);table.append(tr);
  }
}
async function init(){
  updateRoles();
  try {
    const me=await api('/api/auth/me');
    if(me.user.institutionId==='admin'&&me.user.rol==='admin') {show('dashboard');await refreshUsers();return;}
  }catch{}
  try {
    const state=await api('/api/admin/setup-status');
    show(state.required?'setupPanel':'loginPanel');
  }catch {show('loginPanel');}
}
$('newInstitution').addEventListener('change',updateRoles);
$('newRole').addEventListener('change',updateMedicalFields);
$('setupForm').addEventListener('submit',async e=>{
  e.preventDefault();const msg=$('setupMessage');msg.textContent='';
  try{
    await api('/api/admin/setup',{method:'POST',body:JSON.stringify({
      setupCode:$('setupCode').value,
      username:$('setupUsername').value.trim().toLowerCase(),
      nombre:$('setupName').value.trim(),password:$('setupPassword').value
    })});
    $('setupCode').value='';$('setupPassword').value='';
    msg.textContent='Administrador creado. Inicia sesión con sus credenciales.';
    show('loginPanel');
  }catch(err){msg.textContent=err.message;msg.classList.add('err');}
});
$('loginForm').addEventListener('submit',async e=>{
  e.preventDefault();const msg=$('loginMessage');msg.textContent='';
  try{
    await api('/api/auth/login',{method:'POST',body:JSON.stringify({
      institutionId:'admin',username:$('loginUsername').value.trim().toLowerCase(),
      password:$('loginPassword').value
    })});
    $('loginPassword').value='';show('dashboard');await refreshUsers();
  }catch(err){msg.textContent=err.message;msg.classList.add('err');}
});
$('createForm').addEventListener('submit',async e=>{
  e.preventDefault();const msg=$('createMessage');msg.textContent='';
  const submit=$('createForm').querySelector('button[type=submit]');submit.disabled=true;
  try {
    await api('/api/admin/users',{method:'POST',body:JSON.stringify({
      institutionId:$('newInstitution').value,rol:$('newRole').value,
      username:$('newUsername').value.trim().toLowerCase(),nombre:$('newName').value.trim(),
      apellido:$('newSurname').value.trim(),especialidad:$('newSpecialty').value.trim(),
      numeroColegiado:$('newLicense').value.trim(),telefono:$('newPhone').value.trim(),
      password:$('newPassword').value
    })});
    $('newPassword').value='';$('newUsername').value='';$('newLicense').value='';
    msg.textContent='Cuenta y perfil registrados correctamente.';
    await refreshUsers();
  }catch(err){msg.textContent=err.message;msg.classList.add('err');}
  finally{submit.disabled=false;}
});
$('logoutBtn').addEventListener('click',async()=>{
  try{await api('/api/auth/logout',{method:'POST'});}catch{}
  show('loginPanel');
});
init();
