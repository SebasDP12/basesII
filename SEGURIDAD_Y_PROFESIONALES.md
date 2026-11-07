# SaludRed: acceso seguro y profesionales

## Alcance

Esta rama NO modifica el archivo base `docker-compose.yml`, los puertos,
los esquemas actuales, los registros de pacientes ni los volúmenes de bases de datos.

Incluye una pantalla intermedia de acceso, credenciales hash scrypt en un
archivo local privado, sesiones temporales mediante cookie HttpOnly y
autorización por institución en las API de pacientes, eventos, estadísticas,
inspector y profesionales.

## Configuración local de usuarios (sin contraseñas en GitHub)

1. En la raíz del repositorio: `npm install`.
2. Crear un usuario desde una **terminal interactiva**:
   `node scripts/create-user.js carlos.ramirez hospital "Dr. Carlos Ramírez"`
3. El script solicitará una contraseña de 12 o más caracteres. No la incluye
   en la línea de comandos ni la guarda en texto plano.
4. Repetir según corresponda:
   - `node scripts/create-user.js sofia.mendoza odontologia "Dra. Sofía Mendoza"`
   - `node scripts/create-user.js marco.pena laboratorio "Lic. Marco Tulio Peña"`
   - `node scripts/create-user.js elena.castillo pediatria "Dra. Elena Castillo"`
5. Se crea el archivo `security/users.json` (ignorado por Git).
   Nunca lo suba al repositorio.

**Nota:** Este archivo se debe respaldar de forma privada. Si el servidor
se reinicia, las sesiones en memoria expiran y los usuarios deben ingresar
nuevamente; las contraseñas guardadas en el archivo siguen disponibles.

## Ejecutar en el equipo

Si la aplicación Node se ejecuta fuera de Docker:

```bash
docker compose up -d
npm start
```

Si Node se ejecuta dentro de Docker, utilice el archivo de composición adicional,
sin cambiar los contenedores de bases de datos existentes:

```bash
docker compose -f docker-compose.yml -f docker-compose.security.yml up -d --build app
```

Crear usuarios desde el host antes de levantar el contenedor o después mediante
`docker compose -f docker-compose.yml -f docker-compose.security.yml exec -it app node scripts/create-user.js ...`.
El directorio `security/` se monta en el servicio app.

## Profesionales

PostgreSQL (`medico`) y MySQL (`odontologo`) ya tienen tablas y datos.
La pestaña **Profesionales** consulta estas tablas existentes.

Para añadir los catálogos iniciales de profesionales al laboratorio (MongoDB)
y pediatría (Firestore), ejecutar una sola vez:

```bash
node scripts/seed-professionals.js
```

Este script usa upsert y comprobación de existencia: no elimina registros.
Al ejecutarlo dentro del contenedor app, use `docker compose exec app node scripts/seed-professionals.js`.
La pestaña de profesionales funciona con los cuatro motores, aunque los dos
catálogos documentales estarán vacíos hasta cargar los datos.

## Comprobación

```bash
node test/security.test.js
npm test
```

Verifique en navegador que: (1) el portal solicita credenciales; (2) una
contraseña inválida deniega el acceso; (3) las API clínicas sin sesión
devuelven HTTP 401; (4) no se puede pasar a otra institución alterando la
cabecera; (5) el inspector no muestra contraseñas.

## Pendientes relevantes antes de producción

- **Credenciales filtradas:** `.env` ya está versionado y el compose
  contiene contraseñas de ejemplo. Añadir `.env` al gitignore NO borra su
  historial. Rotar las credenciales de PostgreSQL/MySQL y retirar los secretos
  del historial con una estrategia acordada por el equipo. No confiar en que
  este cambio los haya eliminado.
- **Demo no es producción:** los adapters siguen pudiendo usar archivos
  JSON de respaldo si las bases están caídas; las pantallas pueden parecer
  operativas sin consultar los motores reales.
- Usar HTTPS y almacenamiento de sesiones compartido si se despliega con
  múltiples procesos o instancias. La protección por origen de las peticiones
  requiere también una configuración correcta de proxy y HTTPS.
- La interfaz previa crea HTML con contenido de pacientes sin escapar en
  varios lugares; se debe corregir para prevenir XSS antes de usar datos reales.
- No utilizar información médica real sin configurar controles de privacidad,
  permisos por rol, auditoría y copias de seguridad.

## Archivos de esta rama

- `public/access.js`, `public/access.css`: pantalla de autenticación y profesionales
- `public/index.html`, `public/app.js`: integración visual mínima
- `src/infrastructure/http/security/authService.js`: contraseñas y sesiones
- `src/infrastructure/http/routes/authRoutes.js`: login y logout
- `src/infrastructure/http/routes/professionalRoutes.js`: consulta de profesionales
- `src/infrastructure/http/routes/patientRoutes.js`, `clinicalRoutes.js`, `systemRoutes.js`: autorización
- `src/infrastructure/http/server.js`: protección de endpoints
- `src/domain/services/InstitutionRouterService.js`: censura de trazas
- `scripts/create-user.js`, `scripts/seed-professionals.js`: configuración
- `docker-compose.security.yml`: montaje de datos de usuarios sin tocar compose principal
- `.gitignore`, `test/security.test.js`: exclusiones y prueba
