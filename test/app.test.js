const assert = require('assert');
const institutionRouter = require('../src/domain/services/InstitutionRouterService');
const medicalRecordService = require('../src/domain/services/MedicalRecordService');
const PostgresAdapter = require('../src/infrastructure/adapters/PostgresAdapter');
const MySQLAdapter = require('../src/infrastructure/adapters/MySQLAdapter');
const MongoAdapter = require('../src/infrastructure/adapters/MongoAdapter');
const FirestoreAdapter = require('../src/infrastructure/adapters/FirestoreAdapter');

async function runTests() {
  console.log('Iniciando Suite de Pruebas de Arquitectura Hexagonal...');

  // 1. Registro de adaptadores
  const pgAdapter = new PostgresAdapter();
  const myAdapter = new MySQLAdapter();
  const mgAdapter = new MongoAdapter();
  const fsAdapter = new FirestoreAdapter();

  institutionRouter.registerAdapter('hospital', pgAdapter);
  institutionRouter.registerAdapter('odontologia', myAdapter);
  institutionRouter.registerAdapter('laboratorio', mgAdapter);
  institutionRouter.registerAdapter('pediatria', fsAdapter);

  console.log('[OK] Adaptadores registrados correctamente.');

  // 2. Verificar resolucion de enrutamiento
  const resolvedPg = institutionRouter.getAdapter('hospital');
  assert.strictEqual(resolvedPg.institutionId, 'hospital');
  assert.strictEqual(resolvedPg.engineName, 'PostgreSQL');

  const resolvedMy = institutionRouter.getAdapter('odontologia');
  assert.strictEqual(resolvedMy.institutionId, 'odontologia');
  assert.strictEqual(resolvedMy.engineName, 'MySQL');

  const resolvedMg = institutionRouter.getAdapter('laboratorio');
  assert.strictEqual(resolvedMg.institutionId, 'laboratorio');
  assert.strictEqual(resolvedMg.engineName, 'MongoDB');

  const resolvedFs = institutionRouter.getAdapter('pediatria');
  assert.strictEqual(resolvedFs.institutionId, 'pediatria');
  assert.strictEqual(resolvedFs.engineName, 'Firebase Firestore');

  console.log('[OK] Enrutamiento verificado para los 4 motores.');

  // 3. Probar adapter Firestore (Pediatria)
  const pediatricPatients = await medicalRecordService.listPatients('pediatria');
  assert.ok(Array.isArray(pediatricPatients));
  assert.ok(pediatricPatients.length > 0);
  console.log(`[OK] Consulta en Pediatria (Firestore): ${pediatricPatients.length} pacientes.`);

  // 4. Probar creacion de nuevo paciente en Pediatria
  const newPediatric = await medicalRecordService.registerNewPatient('pediatria', {
    nombre: 'Lucas',
    apellido: 'Ramirez Test',
    fechaNacimiento: '2024-01-01',
    genero: 'Masculino',
    tutorNombre: 'Maria Test',
    tutorParentesco: 'Madre',
    telefono: '5559-9999'
  });
  assert.ok(newPediatric.id);
  assert.strictEqual(newPediatric.nombre, 'Lucas');
  console.log(`[OK] Registro de paciente nuevo generado con ID: ${newPediatric.id}`);

  // 5. Probar registro de atencion medica
  const medicalEventResult = await medicalRecordService.recordMedicalEvent('pediatria', {
    patientId: newPediatric.id,
    motivo: 'Control de rutina pediatrico',
    diagnosticoDescripcion: 'Desarrollo normal sin alteraciones',
    pesoKg: 10.5,
    tallaCm: 78.0,
    vacunaNombre: 'Hexavalente',
    vacunaDosis: 1,
    medicamento: 'Gotas de Vitamina A+D'
  });
  assert.ok(medicalEventResult.success);
  console.log(`[OK] Registro de atencion medica, diagnostico y vacuna exitoso.`);

  // 6. Probar obtencion de historial clinico consolidado
  const history = await medicalRecordService.getFullClinicalHistory('pediatria', newPediatric.id);
  assert.ok(history);
  assert.strictEqual(history.paciente.nombre, 'Lucas');
  assert.ok(history.consultas.length >= 1);
  console.log(`[OK] Historial clinico completo recuperado: ${history.consultas.length} consultas.`);

  // 7. Probar baja / archivo de historial por motivo especifico
  const archived = await medicalRecordService.archivePatientRecord('pediatria', newPediatric.id, 'Traslado a otra institucion medica');
  assert.strictEqual(archived.activo, false);
  assert.strictEqual(archived.motivoBaja, 'Traslado a otra institucion medica');
  console.log(`[OK] Baja y archivo de historial clinico ejecutado correctamente.`);

  // 8. Probar reactivacion de historial
  const restored = await medicalRecordService.restorePatientRecord('pediatria', newPediatric.id);
  assert.strictEqual(restored.activo, true);
  assert.strictEqual(restored.motivoBaja, null);
  console.log(`[OK] Reactivacion de historial clinico ejecutada correctamente.`);

  // 9. Verificar Query Logs en tiempo real
  const logs = institutionRouter.getQueryLogs();
  assert.ok(logs.length > 0);
  console.log(`[OK] Query Inspector capturo ${logs.length} trazas en tiempo real.`);

  console.log('\nPruebas automatizadas completadas con exito (100%).\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Error durante la ejecución de pruebas:', err);
  process.exit(1);
});

