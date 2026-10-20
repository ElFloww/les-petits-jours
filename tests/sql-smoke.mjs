import { spawnSync } from 'node:child_process';

const [project, action] = process.argv.slice(2);
if (!/^advent-smoke-[a-f0-9]{8}$/.test(project ?? '') || !['backup', 'restore'].includes(action))
  throw new Error('Only the disposable smoke project may be backed up or restored.');

const sql = action === 'backup'
  ? "BACKUP DATABASE [Advent2026] TO DISK = N'/var/opt/mssql/smoke.bak' WITH COPY_ONLY, INIT, CHECKSUM; RESTORE VERIFYONLY FROM DISK = N'/var/opt/mssql/smoke.bak' WITH CHECKSUM;"
  : "ALTER DATABASE [Advent2026] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; RESTORE DATABASE [Advent2026] FROM DISK = N'/var/opt/mssql/smoke.bak' WITH REPLACE, CHECKSUM; ALTER DATABASE [Advent2026] SET MULTI_USER;";
// Native argv avoids Windows PowerShell's rewriting of nested shell quotation.
const result = spawnSync('docker', [
  'exec', `${project}-sql-1`, 'sh', '-c',
  `SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -Q "${sql}"`,
], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
