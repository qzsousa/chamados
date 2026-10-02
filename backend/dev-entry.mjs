/**
 * Entrada para subir o backend em desenvolvimento (TypeScript) via `node`.
 *
 * O `dev-restart` executa `node <arquivo>`, e o backend é TS com imports sem
 * extensão (`./utils/asyncHandler`), que o Node não resolve sozinho. Este
 * wrapper usa a API do tsx (já é devDependency) para importar o app.
 *
 * Uso: dev-restart -Port 10000 -Dir "<backend>" -Script dev-entry.mjs
 */
import { tsImport } from 'tsx/esm/api'

await tsImport('./src/index.ts', import.meta.url)
