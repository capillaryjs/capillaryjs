import {spawnSync} from 'node:child_process'
import {readFileSync, statSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const mode = process.argv[2]
if (mode !== 'format' && mode !== 'lint') {
    console.error('Usage: node scripts/public-source-check.mjs <format|lint>')
    process.exit(2)
}

const listed = run('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
    .split('\0')
    .filter(Boolean)
const failures = []
let checked = 0
const privatePath = ['apps', 'private', 'demo'].join('/')
const privateConcept = new RegExp(
    `\\b(?:${['Sast', 'Reporting'].join('')}|${['security', 'reporting'].join('-')})\\b`,
    'i',
)

for (const relativePath of listed) {
    const absolutePath = path.join(root, relativePath)
    if (!statSync(absolutePath).isFile()) continue
    const buffer = readFileSync(absolutePath)
    if (buffer.includes(0)) continue
    const text = buffer.toString('utf8')
    checked += 1

    if (mode === 'format') {
        if (text.length > 0 && !text.endsWith('\n')) failures.push(`${relativePath}: no final newline`)
        if (/\r/.test(text)) failures.push(`${relativePath}: contains CR line endings`)
        if (/[ \t]+$/m.test(text)) failures.push(`${relativePath}: trailing whitespace`)
    } else {
        if (text.includes(['<', '<', '<', '<', '<', '<', '<'].join(''))) {
            failures.push(`${relativePath}: merge marker`)
        }
        if (text.includes(['>', '>', '>', '>', '>', '>', '>'].join(''))) {
            failures.push(`${relativePath}: merge marker`)
        }
        if (text.toLowerCase().includes(privatePath) || privateConcept.test(text)) {
            failures.push(`${relativePath}: private application concept`)
        }
    }
}

if (failures.length > 0) {
    for (const failure of failures) console.error(`[public-source] ${failure}`)
    process.exit(1)
}
console.log(`[public-source] ${mode}: ${checked} text files passed`)

function run(command, args) {
    const result = spawnSync(command, args, {cwd: root, encoding: 'utf8'})
    if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`)
    return result.stdout
}
