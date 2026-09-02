import {spawnSync} from 'node:child_process'
import {existsSync, statSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const separator = process.argv.indexOf('--')
if (separator < 0 || process.argv[separator + 1] === undefined) usage()

const options = process.argv.slice(2, separator)
let workingDirectory
let dryRun = false
for (let index = 0; index < options.length; index += 1) {
    if (options[index] === '--cwd') {
        workingDirectory = options[++index]
    } else if (options[index] === '--dry-run') {
        dryRun = true
    } else {
        usage()
    }
}

if (!workingDirectory) usage()
const resolvedDirectory = path.resolve(root, workingDirectory)
if (!existsSync(resolvedDirectory) || !statSync(resolvedDirectory).isDirectory()) {
    fail(`working directory does not exist: ${workingDirectory}`)
}
if (!existsSync(path.join(resolvedDirectory, 'pnpm-workspace.yaml'))) {
    fail(`working directory is not the public workspace: ${workingDirectory}`)
}

const [command, ...args] = process.argv.slice(separator + 1)
if (dryRun) {
    console.log(`[public-command] dry run in ${path.relative(root, resolvedDirectory) || '.'}: ${[command, ...args].join(' ')}`)
    process.exit(0)
}

const result = spawnSync(command, args, {
    cwd: resolvedDirectory,
    encoding: 'utf8',
    stdio: 'inherit',
})
if (result.error) fail(`unable to start ${command}: ${result.error.message}`)
if (result.status !== 0) fail(`${command} exited with status ${result.status}`)

function usage() {
    console.error('Usage: node scripts/run-public-command.mjs --cwd <path> [--dry-run] -- <command> [args...]')
    process.exit(2)
}

function fail(message) {
    console.error(`[public-command] ${message}`)
    process.exit(1)
}
