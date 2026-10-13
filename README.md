# Casas crawler

Crawler configurable para monitorear publicaciones inmobiliarias y exportarlas a Excel con:

- `inmobiliaria`
- `direccion`
- `metros`
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

Para que funcione, el repositorio de GitHub necesita el secret `FIREBASE_TOKEN` configurado. Una vez guardado ese secret, GitHub corre:

```powershell
npm ci
npm run crawl:web
npx firebase-tools deploy --only hosting --project casas-crawler
```

## Filtro por precio

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
  neighborhoods:
    - "Stella Maris"
    - "Loma de Stella Maris"
    - "Los Troncos"
    - "Guemes"
    - "Playa Grande"
    - "Divino Rostro"
```

El filtro ignora mayusculas, minusculas y tildes.

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

Cada fuente del `config.yml` tiene:

- `name`: nombre de la inmobiliaria.
- `enabled`: `true` o `false`; si es `false`, el crawler la ignora.
- `startUrls`: paginas de listado o busqueda.
- `listingSelector`: selector CSS de cada tarjeta de propiedad.
- `linkSelector`: selector CSS del link dentro de la tarjeta.
- `publicationUrlRegex`: filtro opcional para evitar links irrelevantes.
- `fields`: selectores dentro de la tarjeta.
- `detailFields`: selectores dentro de la publicacion individual.
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
