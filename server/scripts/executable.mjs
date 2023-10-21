import { readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { exec } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))

const infile = resolve(__dirname, '../out/server.js')
const outfile = resolve(__dirname, '../out/stimulus-language-server')

writeFileSync(
  outfile,
  '#!/usr/bin/env node\n' + readFileSync(infile, 'utf-8'),
  'utf-8'
)

exec('chmod +x out/stimulus-language-server', (error, _stdout, _stderr) => {
  if (error) {
    console.error(`Error setting file permissions: ${error}`);
  } else {
    console.log('File permissions set successfully');
  }
});
