const fs = require('fs');
const path = require('path');
const killPort = require('kill-port');

function readPortFromEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.split(/\r?\n/).find((l) => /^PORT=/.test(l));
      if (match) {
        const port = match.replace(/^PORT=/, '').trim();
        const num = parseInt(port, 10);
        if (!Number.isNaN(num)) return num;
      }
    } catch {}
  }
  const envPort = parseInt(process.env.PORT || '', 10);
  if (!Number.isNaN(envPort)) return envPort;
  return 3000;
}

(async () => {
  const port = readPortFromEnv();
  try {
    await killPort(port, 'tcp');
    console.log(`[prestart:dev] Porta ${port} finalizada antes de iniciar o servidor.`);
  } catch (err) {
    // Nada escutando na porta; ignore
  }
})();

