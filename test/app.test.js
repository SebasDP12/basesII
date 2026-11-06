const assert = require('assert');
const institutionRouter = require('../src/domain/services/InstitutionRouterService');
const medicalRecordService = require('../src/domain/services/MedicalRecordService');
const PostgresAdapter = require('../src/infrastructure/adapters/PostgresAdapter');
const MySQLAdapter = require('../src/infrastructure/adapters/MySQLAdapter');
const MongoAdapter = require('../src/infrastructure/adapters/MongoAdapter');
const FirestoreAdapter = require('../src/infrastructure/adapters/FirestoreAdapter');

async function runTests() {
  console.log('🧪 Iniciando Suite de Pruebas Automatizadas de Arquitectura Hexagonal...');

  // 1. Registro de adaptadores
  const pgAdapter = new PostgresAdapter();
  const myAdapter = new MySQLAdapter();
  const mgAdapter = new MongoAdapter();
  const fsAdapter = new FirestoreAdapter();

  institutionRouter.registerAdapter('hospital', pgAdapter);
  institutionRouter.registerAdapter('odontologia', myAdapter);
  institutionRouter.registerAdapter('laboratorio', mgAdapter);
  institutionRouter.registerAdapter('pediatria', fsAdapter);

  console.log('✅ Adaptadores registrados correctamente.');

  // 2. Verificar resolución de enrutamiento
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

  console.log('✅ Enrutamiento por institución verificado exitosamente para los 4 motores.');

  // 3. Probar adapter Firestore (Pediatría)
  const pediatricPatients = await medicalRecordService.listPatients('pediatria');
  assert.ok(Array.isArray(pediatricPatients));
  assert.ok(pediatricPatients.length > 0);
  console.log(`✅ Consulta de pacientes en Pediatría (Firestore) exitosa: ${pediatricPatients.length} pacientes encontrados.`);

  // 4. Probar creación de nuevo paciente en Pediatría
  const newPediatric = await medicalRecordService.registerNewPatient('pediatria', {
    nombre: 'Lucas',
    apellido: 'Ramírez Test',
    fechaNacimiento: '2024-01-01',
    genero: 'Masculino',
    tutorNombre: 'María Test',
    tutorParentesco: 'Madre',
    telefono: '5559-9999'
  });
  assert.ok(newPediatric.id);
  assert.strictEqual(newPediatric.nombre, 'Lucas');
  console.log(`✅ Registro de paciente nuevo (Historial Clínico) generado con ID: ${newPediatric.id}`);

  // 5. Probar registro de atención médica
  const medicalEventResult = await medicalRecordService.recordMedicalEvent('pediatria', {
    patientId: newPediatric.id,
    motivo: 'Control de rutina pediátrico',
    diagnosticoDescripcion: 'Desarrollo normal sin alteraciones',
    pesoKg: 10.5,
    tallaCm: 78.0,
    vacunaNombre: 'Hexavalente',
    vacunaDosis: 1,
    medicamento: 'Gotas de Vitamina A+D'
  });
  assert.ok(medicalEventResult.success);
  console.log(`✅ Registro de atención médica, diagnóstico y vacuna exitoso:`, medicalEventResult.message);

  // 6. Probar obtención de historial clínico consolidado
  const history = await medicalRecordService.getFullClinicalHistory('pediatria', newPediatric.id);
  assert.ok(history);
  assert.strictEqual(history.paciente.nombre, 'Lucas');
  assert.ok(history.consultas.length >= 1);
  console.log(`✅ Historial clínico completo recuperado: ${history.consultas.length} consultas registradas.`);

  // 7. Probar baja / archivo de historial por motivo específico
  const archived = await medicalRecordService.archivePatientRecord('pediatria', newPediatric.id, 'Traslado a otra institución médica');
  assert.strictEqual(archived.activo, false);
  assert.strictEqual(archived.motivoBaja, 'Traslado a otra institución médica');
  console.log(`✅ Baja y archivo de historial clínico ejecutado correctamente con auditoría de motivo.`);

  // 8. Probar reactivación de historial
  const restored = await medicalRecordService.restorePatientRecord('pediatria', newPediatric.id);
  assert.strictEqual(restored.activo, true);
  assert.strictEqual(restored.motivoBaja, null);
  console.log(`✅ Reactivación de historial clínico ejecutada correctamente.`);

  // 9. Verificar Query Logs en tiempo real
  const logs = institutionRouter.getQueryLogs();
  assert.ok(logs.length > 0);
  console.log(`✅ Query Inspector capturó ${logs.length} trazas de operaciones en tiempo real.`);

  console.log('\n🎉 ¡TODAS LAS PRUEBAS AUTOMATIZADAS PASARON SATISFACTORIAMENTE (100%)!\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Error durante la ejecución de pruebas:', err);
  process.exit(1);
});
