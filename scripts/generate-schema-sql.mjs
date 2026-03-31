import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const schemaPath = path.join(projectRoot, 'server/prisma/schema.prisma');
const outputPath = path.join(projectRoot, 'schema.sql');
const prismaBin = path.join(
  projectRoot,
  process.platform === 'win32' ? 'node_modules/.bin/prisma.cmd' : 'node_modules/.bin/prisma'
);

const manualStart = '-- >>> MANUAL_PERMISSION_AND_DATA_CHANGES_START';
const manualEnd = '-- >>> MANUAL_PERMISSION_AND_DATA_CHANGES_END';

function getManualSection(existingSql) {
  const start = existingSql.indexOf(manualStart);
  const end = existingSql.indexOf(manualEnd);

  if (start === -1 || end === -1 || end < start) {
    return [
      manualStart,
      '-- Add permission seed SQL, role-permission mappings, or other manual data migration statements here.',
      '-- This block is preserved when `npm run schema:generate-sql` regenerates the DDL above.',
      '-- Example:',
      "-- INSERT INTO `permissions` (`name`, `code`, `module`, `resource`, `action`) VALUES ('角色查看', 'system:role:view', 'system', 'role', 'view');",
      manualEnd,
    ].join('\n');
  }

  return existingSql.slice(start, end + manualEnd.length).trim();
}

const generatedSql = execFileSync(
  prismaBin,
  ['migrate', 'diff', '--from-empty', '--to-schema-datamodel', schemaPath, '--script'],
  {
    cwd: projectRoot,
    encoding: 'utf8',
  }
).trim();

const existingSql = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : '';
const manualSection = getManualSection(existingSql);

const output = [
  '-- Auto-generated from server/prisma/schema.prisma.',
  '-- Run `npm run schema:generate-sql` after database structure changes.',
  '-- Keep permission seed/data migration SQL in the preserved manual block at the bottom.',
  '',
  generatedSql,
  '',
  manualSection,
  '',
].join('\n');

writeFileSync(outputPath, output);
