# Casas crawler

[🌐 Abrir el sitio web con los resultados](https://casas-crawler.web.app)

Crawler configurable para monitorear publicaciones inmobiliarias y exportarlas a Excel con:

- `inmobiliaria`
- `direccion`
- `metros`
- `ambientes`
- `cochera`: `Sí`, `No`, `Opcional` o `No informado`. Incluye garage/garaje. No se interpreta la falta de informacion como ausencia de cochera. Se prioriza la ficha tecnica; tambien se reconocen afirmaciones explicitas en el titulo o la descripcion del inmueble. Se puede configurar el selector `parking` en `fields` y `detailFields`.
- `precio`
- `moneda`
- `link`
- `fecha_extraccion`

## Uso

1. Instalar dependencias:

```powershell
npm install
```

2. Revisar la configuracion:

```powershell
notepad config.yml
```

3. Editar `config.yml` si queres cambiar fuentes, barrios o precio.

4. Ejecutar:

```powershell
npm run crawl
```

El Excel se genera en `outputs/publicaciones.xlsx`.

## Dashboard web

### Agregar URLs sin recorrer las anteriores

En la web, **Agregar URLs** abre la accion de GitHub correspondiente. Con tu sesion de GitHub iniciada, elegi **Run workflow**, pega una o varias URLs separadas por espacios o comas y selecciona **Inmobiliarias** (sitio o listado) o **Publicaciones** (fichas individuales).

La accion consulta solo esas fuentes, combina sus publicaciones con las que estan publicadas y conserva las anteriores. Una misma URL y operacion se actualiza sin duplicarse. Las nuevas fuentes con resultados se guardan en `config.extra.yml` para las actualizaciones completas futuras. El Excel combinado se descarga desde el artifact **publicaciones-incrementales** de esa ejecucion.

Si una inmobiliaria nueva necesita selectores especificos o no devuelve fichas, la accion lo informa en el registro. Si no obtiene ninguna publicacion valida, se detiene sin cambiar los resultados actuales.

Desde la terminal:

```powershell
npm run crawl:add -- https://www.inmobiliaria.com
```

Para fichas individuales, usa `$env:CRAWLER_URL_KIND = "Publicaciones"` antes del comando. Las URLs tambien se pueden pasar en la variable `CRAWLER_URLS`.

Los filtros de barrios y ambientes permiten marcar varias opciones en un dropdown. El filtro de cochera separa incluida, opcional, sin cochera y sin dato. Los tipos Terreno y Lote estan habilitados tanto en la extraccion como en el selector de la web.

Para generar el Excel y el JSON que lee la web:

```powershell
npm run crawl:web
```

Eso actualiza:

- `outputs/publicaciones.xlsx`
- `web/publicaciones.json`

Para publicar manualmente en Firebase Hosting:

```powershell
firebase deploy --only hosting
```

La carpeta publicada por Firebase es `web`.

## Ejecucion online con GitHub Actions

El workflow `.github/workflows/deploy-firebase.yml` permite actualizar la web desde GitHub:

- manualmente desde la pestaña **Actions** con **Run workflow**
- automaticamente todos los dias a las 10:00 UTC
- al subir cambios de `web/` a `master`, publica los datos guardados sin ejecutar nuevamente el crawler.

Para que funcione, el repositorio de GitHub necesita el secret `FIREBASE_SERVICE_ACCOUNT` con el JSON de la cuenta de servicio autorizada a publicar en Firebase Hosting. El workflow usa un archivo temporal de credenciales y lo elimina al terminar. GitHub corre:

```powershell
npm ci
npm run crawl:web
npx firebase-tools deploy --only hosting --project casas-crawler
```

## Filtro por precio

La configuracion actual consulta ventas y alquileres permanentes, incluyendo departamentos, y no limita la moneda: `filters.price.currency: null` conserva tanto pesos como dolares. Cada publicacion conserva su moneda original; los precios no se convierten. Las fuentes pueden tener diferente oferta y algunas no exponen sus listados al crawler HTML. Cuando una ficha informa venta y alquiler, se conserva una fila por operacion con su precio correspondiente.

La columna `ambientes` contiene la cantidad total de ambientes publicada, sin confundirla con dormitorios. Se extrae de los campos de la ficha, del catalogo, de JSON-LD (`numberOfRooms`) o del titulo cuando indica explicitamente ambientes. Si no se informa, queda vacia en Excel y como `null` en JSON. Se puede configurar el selector `rooms` en `fields` y `detailFields` de cada fuente.

El filtro se configura en `config.yml`. Puede ser global:

```yml
filters:
  price:
    min: 50000
    max: 250000
    currency: "USD"
```

Tambien puede definirse dentro de una inmobiliaria para pisar el filtro global de esa fuente:

```yml
sources:
  - name: "Inmobiliaria de ejemplo"
    filters:
      price:
        min: 80000
        max: 180000
        currency: "USD"
```

El filtro se aplica sobre el precio extraido de cada publicacion. Si una publicacion no informa precio, el crawler la conserva para evitar descartar datos por error de extraccion.

## Filtros de tipo y ubicacion

Tambien se pueden filtrar tipo de propiedad, ciudad y barrios:

```yml
filters:
  propertyTypes:
    - "Casa"
  city: "Mar del Plata"
  neighborhoods: [] # Todos los barrios
```

Con `neighborhoods: []` se incluyen todos los barrios, incluso publicaciones sin barrio informado. Para limitar la busqueda, se puede indicar una lista de barrios. El filtro ignora mayusculas, minusculas y tildes.

## Ejecucion manual o diaria

Manual:

```powershell
npm run crawl
```

Una vez por dia, dejando el proceso corriendo:

```powershell
npm run crawl:daily
```

Tambien se puede programar con el Programador de tareas de Windows ejecutando `npm run crawl` una vez por dia. Esa opcion suele ser mas robusta que dejar una terminal abierta.

## Configuracion por inmobiliaria

Las fuentes nuevas quedan registradas con `website` (la URL original solicitada) y `startUrls` (los listados que consulta el crawler). Se evitan duplicados entre dominios con y sin `www`. `preferConfiguredFields: true` permite priorizar los selectores especificos de una fuente ante encabezados genericos como "Detalle". Las fuentes que requieren un adaptador cliente se identifican en `notes`; estar configurada no garantiza que una inmobiliaria entregue publicaciones en HTML.

Cada fuente del `config.yml` tiene:

- `name`: nombre de la inmobiliaria.
- `enabled`: `true` o `false`; si es `false`, el crawler la ignora.
- `startUrls`: paginas de listado o busqueda.
- `listingSelector`: selector CSS de cada tarjeta de propiedad.
- `linkSelector`: selector CSS del link dentro de la tarjeta.
- `publicationUrlRegex`: filtro opcional para evitar links irrelevantes.
- `fields`: selectores dentro de la tarjeta.
- `detailFields`: selectores dentro de la publicacion individual.
- Los selectores separados por comas se prueban en orden; se usa el primer texto no vacio, sin concatenar duplicados ni propiedades similares. Direccion, titulo y tipo rechazan textos demasiado largos y el elemento `body`.
- Direccion, precio, superficie, barrio, operacion y tipo se extraen de elementos especificos de la propiedad. No se usa `body` ni la descripcion como respaldo para campos estructurados. Los adaptadores reconocen las variantes Tokko, Houzez, Wasi y el catalogo Robles.

## Validacion de campos

`operacion` se normaliza como Venta, Alquiler, Alquiler temporario o Venta / Alquiler. Si hay precios de venta y alquiler, se elige el bloque que corresponde a la operacion del enlace. Si no se puede determinar, el precio queda vacio y se marca para revision.

`barrio` prioriza la ubicacion explicita del inmueble. Los nombres mencionados como lugares cercanos en la descripcion no se usan. `tipo` contiene una categoria y `metros` un numero, con `superficieTipo` para distinguir cubierta, total o terreno. No se reemplaza una direccion desconocida por el titulo.

El JSON incluye `revision` para campos faltantes o inciertos y `evidencia` con el elemento o dato estructurado usado. La web muestra **Datos incompletos** cuando hay campos pendientes. Eso permite revisar incertidumbres; no implica que cada publicacion haya sido comprobada manualmente.

Para descargar nuevamente las publicaciones actuales, auditarlas y actualizar el JSON:

```powershell
npm run audit:fields -- --refresh --update
```

Sin `--update`, solo se genera `outputs/field-audit.json`. Sin `--refresh`, se reutilizan las paginas guardadas en `outputs/pages`. El proceso conserva una copia del JSON anterior en `outputs/publicaciones-before-field-audit.json` antes de actualizarlo. `web/auditoria.json` registra las correcciones, evidencia y fuentes sin ejemplos disponibles; estas ultimas quedan como no verificadas. La auditoria conserva las publicaciones existentes y señala cuales no cumplen los filtros actuales, sin descartarlas.
- `filters.price.min`: precio minimo opcional.
- `filters.price.max`: precio maximo opcional.
- `filters.price.currency`: moneda opcional, por ejemplo `USD` o `$`.
- `pagination.nextSelector`: selector del boton de pagina siguiente.
- `pagination.maxPages`: limite de paginas por listado.

Si un sitio publica datos estructurados JSON-LD, el crawler tambien intenta usarlos como respaldo.

## Plataformas con proteccion anti-bot

Algunas plataformas, como ZonaProp, pueden devolver una pantalla de verificacion de Cloudflare en vez del HTML de publicaciones. En esos casos el crawler HTML simple no puede extraer datos de forma confiable.

ZonaProp queda agregado en `config.yml` como fuente deshabilitada (`enabled: false`) para documentarlo sin romper las corridas actuales. Para activarlo haria falta un adaptador aparte con navegador real y cookies de sesion, o usar una fuente autorizada/exportable de esa plataforma si esta disponible.

## Notas

Los sitios inmobiliarios no tienen todos el mismo HTML. Para cada link real conviene ajustar los selectores una vez y luego dejar corriendo el monitoreo. El crawler evita duplicados por link y deja vacio cualquier campo que no pueda extraer con confianza.
