import { mkdir, readFile, writeFile, copyFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const rootDir = process.cwd();
const clientDir = path.join(rootDir, 'src', 'client');
const publicDir = path.join(rootDir, 'public');

const staticFiles = ['index.html', 'gamestyles.css', 'splash.html'];
const staticDirs = ['images', 'sounds'];

async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

async function copyDir(sourceDir, destinationDir) {
  await ensureDir(destinationDir);
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);

    if (entry.isDirectory()) {
      await copyDir(sourcePath, destinationPath);
      continue;
    }

    if (entry.isFile()) {
      await copyFile(sourcePath, destinationPath);
    }
  }
}

async function copyStaticAssets() {
  await ensureDir(publicDir);

  for (const fileName of staticFiles) {
    await copyFile(path.join(clientDir, fileName), path.join(publicDir, fileName));
  }

  for (const dirName of staticDirs) {
    const sourcePath = path.join(clientDir, dirName);
    const destinationPath = path.join(publicDir, dirName);
    const sourceStats = await stat(sourcePath);

    if (sourceStats.isDirectory()) {
      await copyDir(sourcePath, destinationPath);
    }
  }
}

async function buildClientScript() {
  const source = await readFile(path.join(clientDir, 'main.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.None,
      strict: true,
      removeComments: false,
    },
    fileName: 'main.ts',
    reportDiagnostics: true,
  });

  if (compiled.diagnostics?.length) {
    const errors = compiled.diagnostics
      .map((diagnostic) => {
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        return diagnostic.file && typeof diagnostic.start === 'number'
          ? `${diagnostic.file.fileName}:${diagnostic.start}: ${message}`
          : message;
      })
      .join('\n');

    if (errors) {
      throw new Error(errors);
    }
  }

  await writeFile(path.join(publicDir, 'main.js'), compiled.outputText, 'utf8');
}

await copyStaticAssets();
await buildClientScript();
