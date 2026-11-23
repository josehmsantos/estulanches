const { spawnSync } = require('node:child_process');

function runNpm(args, options = {}) {
  // Dentro de `npm run`, chama diretamente o CLI JavaScript do npm e evita shell=true no Windows.
  if (process.env.npm_execpath) {
    return spawnSync(process.execPath, [process.env.npm_execpath, ...args], { ...options, shell: false });
  }
  // Fallback para execução direta do script fora de `npm run`.
  if (process.platform === 'win32') {
    return spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/c', `npm ${args.join(' ')}`], { ...options, shell: false });
  }
  return spawnSync('npm', args, { ...options, shell: false });
}

module.exports = { runNpm };
