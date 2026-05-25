# scraper-alquilavende

Scraper de avisos de inmuebles hacia MongoDB Atlas. Hoy apunta a
[compraensanjuan.com](https://www.compraensanjuan.com) (sección Inmuebles), pero
está diseñado para extenderse a otros sitios cambiando la configuración y los
parsers.

## Cómo funciona

- Recorre cada categoría página por página y hace _upsert_ de los avisos en MongoDB.
- Respeta el `Crawl-delay` declarado en `robots.txt` (5s + margen) y usa concurrencia serial.
- Marca como inactivos los avisos que dejaron de aparecer (`staleAfterDays`).
- Corre diariamente por cron (GitHub Actions o `node-cron` local).

## Requisitos

- Node.js >= 18
- Una base MongoDB Atlas (o cualquier MongoDB accesible)

## Configuración

Copiá `env.example` a `.env` y completá:

```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority
DB_NAME=inmuebles_sj
COLLECTION_NAME=avisos
```

El `.env` está en `.gitignore`: **nunca** se commitea.

## Uso

```bash
npm install
npm run scrape   # una sola pasada (--once)
npm start        # modo daemon: queda corriendo y dispara por cron interno
```

## Cron en GitHub Actions (gratis)

El workflow `.github/workflows/scrape.yml` corre una pasada diaria. En repos
**públicos** los minutos de Actions son ilimitados y gratis.

Configurá los _secrets_ del repo (Settings → Secrets and variables → Actions):
`MONGODB_URI`, `DB_NAME`, `COLLECTION_NAME`.

> GitHub desactiva los workflows con `schedule` tras 60 días sin actividad en el
> repo. Si el scraper solo corre por cron, hacé un commit ocasional o reactivalo
> desde la pestaña Actions.

## Adaptar a otro sitio

La arquitectura concentra lo específico del sitio en pocos lugares:

- `src/config.js` → `HTTP.baseUrl`, `CATEGORIAS`, tiempos y umbrales.
- `src/scraping/listado-parser.js` → selectores de la página de listado.
- `src/scraping/detalle-parser.js` → selectores de la página de detalle.

El resto (cliente HTTP, repositorio Mongo, orquestación de jobs) es reutilizable.

## Estructura

```
src/
  config.js              # configuración central (URL, categorías, cron, Mongo)
  index.js               # entrada: modo --once o daemon
  jobs/                  # orquestación de una corrida completa por categoría
  scraping/              # cliente HTTP + parsers de listado y detalle
  storage/               # cliente Mongo + repositorio de avisos
  utils/                 # logger y sleep
```
