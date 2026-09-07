const { mkdtemp, mkdir, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { downloadAndUnzipVSCode } = require('@vscode/test-electron');
(async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'sfsymbols-vscode-host-'));
  const workspace = path.join(root, 'workspace');
  const pkg = path.join(workspace, 'node_modules/@bradleyhodges/sfsymbols');
  await mkdir(path.join(pkg, 'dist/module'), { recursive: true });
  await writeFile(path.join(pkg, 'package.json'), JSON.stringify({ name: '@bradleyhodges/sfsymbols', exports: { './sf*': { import: { default: './dist/module/sf*.js' } } } }));
  for (const name of ['sfCircle', 'sfSquare']) await writeFile(path.join(pkg, `dist/module/${name}.js`), `export const ${name}={iconName:'${name}',viewBox:'0 0 20 20',svgPathData:[{d:'M0 0h20v20z',fillOpacity:.5}]};`);
  console.log(`Isolated test host: ${root}`);
  const executable = process.env.VSCODE_EXECUTABLE || await downloadAndUnzipVSCode();
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  // Launch the executable directly: no shell interpolation or visible helper console on Windows.
  const child = spawn(executable, [workspace, `--extensionDevelopmentPath=${path.resolve(__dirname, '..')}`, `--extensionTestsPath=${path.resolve(__dirname, '../dist/host.cjs')}`, '--user-data-dir', path.join(root, 'user-data'), '--extensions-dir', path.join(root, 'extensions'), '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust', '--disable-telemetry', '--disable-updates'], { windowsHide: true, stdio: 'inherit', env: environment });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Extension host exceeded the 120-second test limit.')); }, 120000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); code === 0 ? resolve() : reject(new Error(`Extension host failed with exit code ${code}.`)); });
  });
})().catch(error => { console.error(error); process.exitCode = 1; });
