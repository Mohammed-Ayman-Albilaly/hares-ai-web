import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildOpenApiDocument } from './openapi';

const outputPath = fileURLToPath(new URL('../openapi.json', import.meta.url));
const document = buildOpenApiDocument();

writeFileSync(outputPath, JSON.stringify(document, null, 2) + '\n', 'utf8');
console.log(`OpenAPI document written to ${outputPath}`);
