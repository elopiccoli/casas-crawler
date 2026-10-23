# Auditoría de inmobiliarias — 23 de octubre de 2026

Se revisaron **71 fuentes**, excluyendo las **51** indicadas por el usuario. **51** tuvieron extracción verificada y **20** requieren atención o no aportaron publicaciones de Mar del Plata en la muestra.

Se consultaron 43 fuentes para recuperar publicaciones, se incorporaron **2311 avisos** y el archivo combinado quedó en **7943**. Se conservaron los avisos anteriores.

## Alcance y límites

Se comprobó la portada, la primera página de cada listado configurado y una muestra de fichas por operación. La muestra comienza con tres fichas y se amplía hasta doce cuando no aparece una publicación que cumpla los filtros. Para las fuentes recuperadas se ejecutó además su búsqueda configurada; las advertencias de esas corridas se detallan abajo. Las fuentes ya consultadas recientemente no se recorrieron de nuevo en su totalidad.

Una extracción verificada confirma que el crawler obtiene publicaciones reales; no garantiza cobertura completa del catálogo ni que cada ficha publique precio, ambientes o cochera. Se mantienen los filtros de Mar del Plata y tipos de propiedad. No se infiere la ciudad a partir de la oficina ni se confunden dormitorios con ambientes. Las páginas consultadas hoy se guardaron para poder repetir el análisis sin volver a solicitar todo a cada sitio.

## Incidencias pendientes

| Fuente | Diagnóstico |
| --- | --- |
| [Velati Propiedades](https://velati.com.ar) | Aplicación JavaScript: no publica enlaces de fichas en el HTML inicial; necesita adaptador de su catálogo. |
| [Ucci Propiedades](https://www.uccipropiedades.com) | Aplicación Gatsby/Mediahaus: el HTML inicial no contiene las fichas; requiere adaptador del catálogo público. |
| [Inmobiliaria Daniel Díaz](https://danieldiazpropiedades.com.ar) | Las fichas muestreadas corresponden a CABA y otras localidades. No se forzó su inclusión en Mar del Plata. |
| [DAR Propiedades](https://www.darpropiedades.com.ar) | Aplicación Next: tiene un catálogo público cargado por el cliente, pero el crawler HTML no lee sus tarjetas como fichas individuales. Adaptador pendiente. |
| [J. Urrizaga](https://www.urrizaga.com.ar) | La portada no expone fichas y los servicios públicos /dal/unidades.asp?Tipo=A y Tipo=V respondieron HTTP 500. |
| [Properati](https://www.properati.com.ar) | Portal registrado previamente como desactivado. Los enlaces generales no son fichas individuales y no hay adaptador validado. |
| [Bellucci Propiedades](https://www.belluccipropiedades.com) | Rutas de fichas y campos principales corregidos. Las fichas muestreadas no expresan la ciudad en un dato propio verificable; no se usa el texto de marca del sitio como ubicación. |
| [Gonnet Propiedades](https://www.gonnet.com.ar) | Aplicación Next: HTML sin fichas. Su consulta pública /api/proxy?path=/propiedades/venta responde, pero requiere un adaptador y validar la ubicación individual. |
| [Aboglio Propiedades](https://inmobiliariaaboglio.com) | Se descubren dos fichas, pero la estructura no tiene los campos necesarios reconocidos. Adaptador de InmoGes pendiente. |
| [Administración Julián Santillán](https://juliansantillan.com) | Rutas corregidas: 42 enlaces de fichas descubiertos. Sin un campo de ciudad verificable en la muestra; no se usa la ubicación de la oficina. |
| [Alan Propiedades](https://www.alanpropiedades.com.ar/) | El dominio sin www tiene un certificado inválido. La variante oficial con www responde HTTP 200, pero carga la aplicación por JavaScript y no expone fichas en HTML. |
| [Alba Propiedades](https://albapropiedades.com) | Aplicación Angular que carga el catálogo por API. Requiere identificar y adaptar su catálogo público. |
| [De Santis Propiedades](https://desantispropiedades.com.ar) | Fichas accesibles, pero faltan campos y una ciudad propia verificable con el adaptador actual. Se mantiene desactivada hasta validar la extracción. |
| [Burga Propiedades](https://walterburga.com) | Rutas de fichas identificadas y campos parcialmente extraídos. Falta ciudad verificable; uno de los listados de alquiler devolvió HTTP 429. Se mantiene desactivada. |
| [La Pérgola Propiedades](https://lapergolapropiedades.com) | El dominio consultado corresponde a una inmobiliaria en Puerto de la Cruz, Tenerife. Se mantiene desactivada para no importar avisos ajenos a Mar del Plata. |
| [Oreste Gonnet Inmobiliaria](https://orestegonnet.com.ar) | El dominio redirige al directorio general de inmobiliarias de Mardelplata.com. Sus avisos no se atribuyen a Oreste Gonnet. |
| [Mar del Plata Propiedades](https://mardelplatapropiedades.net) | El dominio mardelplatapropiedades.net no resuelve en DNS (ENOTFOUND). |
| [Breccia Inmuebles y Negocios](https://breccianegocios.com.ar) | La web carga propiedades con JavaScript y almacenamiento local; no hay fichas individuales extraíbles con el adaptador actual. |
| [Lascano Propiedades](https://lascanopropiedades.com.ar/) | Las fichas muestreadas están en Glew y otras localidades, fuera del filtro de Mar del Plata. |
| [Muiño Propiedades](https://www.xn--muiopropiedades-0qb.com.ar/) | Las fichas muestreadas están en San Bernardo del Tuyú/Costa Atlántica. Se mantiene el filtro de Mar del Plata. |

## Cobertura limitada o advertencias

- **Sanz y Ordoqui Propiedades:** La búsqueda completa devolvió 404 al intentar una segunda página de alquileres; se conservaron los 92 avisos válidos obtenidos.
- **Alberto Turlán:** Se verificaron fichas y el dominio actual. Se conservaron 3 avisos antes del límite temporal HTTP 429; el catálogo quedó parcial. Se configuró una pausa de 5 segundos y se corrigió el envío de página/desplazamiento.
- **Zulma Castillo Propiedades:** El catálogo retuvo 3 avisos con ubicación explícita compatible. No se asigna Mar del Plata a fichas que solo indican un barrio.
- **Messina Propiedades:** Se retuvieron 3 avisos. Las fichas sin ciudad verificable quedan fuera del filtro; precio y ambientes ahora usan campos propios de Estatik.

## Resultado de las 71 fuentes

| Fuente | Resultado | Muestras compatibles | Avisos de la nueva consulta |
| --- | --- | ---: | ---: |
| [Suarez Propiedades](https://www.suarezmardelplata.com) | Extracción verificada | 3 | 73 |
| [Ezequiel Jose Estudio Inmobiliario](https://www.ezequieljosepropiedades.com) | Extracción verificada | 4 | 63 |
| [Velati Propiedades](https://velati.com.ar) | Requiere atención / fuera de ámbito | 0 | — |
| [VA Propiedades](https://vapropiedades.com.ar) | Extracción verificada | 4 | 9 |
| [Ucci Propiedades](https://www.uccipropiedades.com) | Requiere atención / fuera de ámbito | 0 | — |
| [Dante Propiedades](https://www.dantepropiedades.com) | Extracción verificada | 5 | 238 |
| [Sanz y Ordoqui Propiedades](https://www.sanzyordoqui.com.ar) | Extracción verificada | 6 | 92 |
| [Martínez Arrechea Propiedades](https://martinezarrechea.com) | Extracción verificada | 6 | 67 |
| [Bártoli Propiedades](https://www.bartolipropiedades.com) | Extracción verificada | 2 | 22 |
| [Inmobiliaria Daniel Díaz](https://danieldiazpropiedades.com.ar) | Requiere atención / fuera de ámbito | 0 | — |
| [DAR Propiedades](https://www.darpropiedades.com.ar) | Requiere atención / fuera de ámbito | 0 | — |
| [J. Urrizaga](https://www.urrizaga.com.ar) | Requiere atención / fuera de ámbito | 0 | — |
| [Marino Pérez Propiedades](https://www.marinoperez.com.ar) | Extracción verificada | 6 | 167 |
| [Palma Propiedades](https://www.palmapropiedades.com.ar/) | Extracción verificada | 6 | — |
| [Del Rosso & Asociados](https://delrossopropiedades.com.ar) | Extracción verificada | 6 | 205 |
| [Acampora y Asociados](https://www.acamporayasoc.com) | Extracción verificada | 5 | 108 |
| [Properati](https://www.properati.com.ar) | Requiere atención / fuera de ámbito | 0 | — |
| [Bellucci Propiedades](https://www.belluccipropiedades.com) | Requiere atención / fuera de ámbito | 0 | — |
| [Coste y Freuler](https://www.costeyfreuler.com) | Extracción verificada | 6 | 28 |
| [Gonnet Propiedades](https://www.gonnet.com.ar) | Requiere atención / fuera de ámbito | 0 | — |
| [Zicarelli Real Estate](https://zicarelli.com.ar) | Extracción verificada | 3 | 4 |
| [Abdala Propiedades](https://abdalapropiedades.com) | Extracción verificada | 6 | 128 |
| [Aboglio Propiedades](https://inmobiliariaaboglio.com) | Requiere atención / fuera de ámbito | 0 | — |
| [Ademar Ocaranza](https://ademarocaranza.com) | Extracción verificada | 4 | 14 |
| [C. A. Di Bártolo e Hijos](https://www.cadibartoloehijos.com.ar/) | Extracción verificada | 3 | 4 |
| [Administración Julián Santillán](https://juliansantillan.com) | Requiere atención / fuera de ámbito | 0 | — |
| [Alan Propiedades](https://www.alanpropiedades.com.ar/) | Requiere atención / fuera de ámbito | 0 | — |
| [Alba Propiedades](https://albapropiedades.com) | Requiere atención / fuera de ámbito | 0 | — |
| [Alberto Turlán](https://www.turlanprop.com.ar/) | Extracción verificada | 2 | 3 |
| [Zamboni Propiedades](https://www.zambonipropiedades.com.ar/) | Extracción verificada | 5 | — |
| [De Santis Propiedades](https://desantispropiedades.com.ar) | Requiere atención / fuera de ámbito | 0 | — |
| [Burga Propiedades](https://walterburga.com) | Requiere atención / fuera de ámbito | 0 | — |
| [Marta Moghames](https://moghames.com.ar) | Extracción verificada | 3 | 38 |
| [La Pérgola Propiedades](https://lapergolapropiedades.com) | Requiere atención / fuera de ámbito | 0 | — |
| [Oreste Gonnet Inmobiliaria](https://orestegonnet.com.ar) | Requiere atención / fuera de ámbito | 0 | — |
| [GMC Propiedades](https://gmcpropiedades.com) | Extracción verificada | 6 | 55 |
| [La Plata Propiedades](https://laplatapropiedades.com) | Extracción verificada | 6 | 86 |
| [Mar del Plata Propiedades](https://mardelplatapropiedades.net) | Requiere atención / fuera de ámbito | 0 | — |
| [Breccia Inmuebles y Negocios](https://breccianegocios.com.ar) | Requiere atención / fuera de ámbito | 0 | — |
| [Zulma Castillo Propiedades](https://zcastillopropiedades.com) | Extracción verificada | 3 | 3 |
| [Scutella Propiedades](https://scutellapropiedades.com.ar) | Extracción verificada | 6 | 7 |
| [Santia Propiedades](https://santiapropiedades.com.ar) | Extracción verificada | 2 | 2 |
| [Allende Propiedades](https://allendepropiedades.com.ar) | Extracción verificada | 3 | 6 |
| [Berto Propiedades](https://bertopropiedades.com.ar) | Extracción verificada | 4 | 7 |
| [Vigo Consultores Inmobiliarios](https://vigo.com.ar) | Extracción verificada | 7 | 13 |
| [Nesca Propiedades](https://nescapropiedades.com) | Extracción verificada | 1 | 2 |
| [Inmobiliaria Castillo](https://inmobiliariacastillo.com.ar) | Extracción verificada | 4 | 81 |
| [Quintiero Propiedades](https://quintieroprop.com.ar) | Extracción verificada | 3 | 30 |
| [Bocian Propiedades](https://bocianpropiedades.com) | Extracción verificada | 6 | 31 |
| [Spano Propiedades](https://spanopropiedades.com.ar) | Extracción verificada | 1 | 18 |
| [DePaoli Propiedades](https://depaolipropiedades.com.ar) | Extracción verificada | 3 | 64 |
| [Salerno Propiedades](https://salerno-propiedades.com.ar) | Extracción verificada | 5 | 21 |
| [Potente Propiedades](https://potentepropiedades.com) | Extracción verificada | 75 | 75 |
| [Messina Propiedades](https://messinapropiedadesmdp.com.ar) | Extracción verificada | 1 | 3 |
| [Patricio Propiedades](https://patriciopropiedades.com.ar) | Extracción verificada | 3 | 5 |
| [Crespo Inmobiliaria](https://inmobiliariacrespo.com) | Extracción verificada | 5 | 127 |
| [Finca Inmobiliaria](https://inmobiliariafinca.com.ar) | Extracción verificada | 6 | 58 |
| [Inmobiliaria Mihocevich](https://inmobiliariamihocevich.com.ar) | Extracción verificada | 1 | 14 |
| [Alías Propiedades](https://aliaspropiedades.com.ar) | Extracción verificada | 5 | 48 |
| [Paulo Arroyo Propiedades](https://www.pauloarroyopropiedades.com) | Extracción verificada | 3 | 36 |
| [Sauro Propiedades](https://www.sauropropiedades.com/) | Extracción verificada | 5 | — |
| [Homes - Land Propiedades](https://www.homes-land.com.ar) | Extracción verificada | 5 | 158 |
| [Lascano Propiedades](https://lascanopropiedades.com.ar/) | Requiere atención / fuera de ámbito | 0 | — |
| [Kisic Propiedades](https://kisicpropiedades.com/) | Extracción verificada | 1 | 24 |
| [Del Prete Propiedades](https://www.delpretepropiedades.com/) | Extracción verificada | 2 | 74 |
| [Muiño Propiedades](https://www.xn--muiopropiedades-0qb.com.ar/) | Requiere atención / fuera de ámbito | 0 | — |
| [Alem Propiedades](https://alempropiedades.com/) | Extracción verificada | 2 | — |
| [Saforcada Propiedades](https://www.saforcada.com/) | Extracción verificada | 32 | — |
| [Eduardo Villarreal Propiedades](https://eduardovillarreal.com.ar/) | Extracción verificada | 1 | — |
| [Fulquet Propiedades](https://www.fulquetpropiedades.com.ar/) | Extracción verificada | 3 | — |
| [Groppo Propiedades](https://www.inmobiliariagroppo.com.ar/) | Extracción verificada | 8 | — |

## Fuentes excluidas por el usuario

- Russillo Asesores Inmobiliarios
- Coste Propiedades
- Latorre Negocios Inmobiliarios
- Valencia Consultores Inmobiliarios
- Berengeno, Fernando Abel
- Oteiza Propiedades
- Gerardo E. Barg Departamento Inmobiliario
- Iza Inmobiliaria
- Aguilera Propiedades
- Del Valle Estudio Inmobiliario
- M.A.S Propiedades
- Cabrera Propiedades
- Estudio Uno Propiedades
- Giromini Soluciones Inmobiliarias
- Inmobiliaria Berasueta
- Gisela D’Alessandro
- Espatolero y Lorenzo
- Gustavo Teruel
- Matías Sosa Broker Inmobiliario
- Arbini Propiedades
- Redondo Inmobiliaria
- Selecto Propiedades
- Introcaso Propiedades
- Napolitano Inmobiliaria
- Cecilia Martini Inmobiliaria
- Torres Inmobiliaria
- Abel Carranza Propiedades
- Aguirre Propiedades
- Aiello Propiedades
- Alejandro Aiello
- Alberto B. Rossi Propiedades
- Galán Broker Inmobiliario
- Canicoba Propiedades
- Urbana Propiedades
- M y F Propiedades
- Pezzati Propiedades
- RP Bienes Raíces
- Alejandra Dal Molin
- Dardo Propiedades
- Mar del Plata (portal)
- Bartolini Propiedades
- Duque Williams Propiedades
- Mardel Inmueble
- Rey Propiedades
- Loreley Propiedades
- Moreno Gómez Propiedades
- Beain Propiedades
- Flores Harismendi
- Patricia Moreno
- Nizzi Propiedades
- Girard Propiedades

## Reproducción

```powershell
node scripts/audit_sources.mjs --exclude=reports/auditoria-exclusiones-2026-10-23.json --refresh
```

El JSON de este informe conserva URLs de evidencia, respuestas HTTP y cobertura de campos. Los HTML y resultados completos de cada consulta se conservan en `outputs/source-audit/` (sin subir páginas ni datos de conexión al repositorio).
