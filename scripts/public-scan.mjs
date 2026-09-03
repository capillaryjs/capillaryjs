import {spawnSync} from 'node:child_process'
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const privatePath = ['apps', '[\\\\/]', 'private', '-', 'demo'].join('')
const privateConcept = [
    ['Sast', 'Reporting'].join(''),
    ['security', 'reporting'].join('-'),
].join('|')
const legacyScopes = ['gluefray', 'local'].join('-')
const rules = [
    {id: 'private-path', pattern: new RegExp(privatePath, 'i')},
    {id: 'private-application', pattern: new RegExp(`\\b(?:${privateConcept})\\b`, 'i')},
    {id: 'legacy-scope', pattern: new RegExp(`@(?:${legacyScopes}|imported-scope)/`)},
    {id: 'absolute-macos-path', pattern: /\/Users\/[^/\s"']+\//},
    {id: 'absolute-linux-home', pattern: /\/home\/[^/\s"']+\//},
    {id: 'private-key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/},
    {id: 'github-token', pattern: /\b(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{20,}\b/},
    {id: 'npm-token', pattern: /\bnpm_[A-Za-z0-9]{20,}\b/},
    {id: 'aws-key', pattern: /\bAKIA[0-9A-Z]{16}\b/},
]
const tracked = run('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
    .split('\0')
    .filter(Boolean)
const generated = [
    path.join(root, 'packages/glue/dist'),
    path.join(root, 'packages/fray/dist'),
    path.join(root, 'packages/fray-visualization/dist'),
    path.join(root, '.artifacts/release/packages'),
    path.join(root, '.artifacts/release/package-artifacts.json'),
].flatMap(listFiles)
const findings = []

for (const absolutePath of new Set([
    ...tracked.map((relativePath) => path.join(root, relativePath)),
    ...generated,
])) {
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) continue
    const buffer = readFileSync(absolutePath)
    if (buffer.includes(0)) continue
    const text = buffer.toString('utf8')
    for (const rule of rules) {
        if (rule.pattern.test(text)) {
            findings.push({file: path.relative(root, absolutePath), rule: rule.id})
        }
    }
}

if (findings.length > 0) {
    console.error(`[public-scan] ${findings.length} finding(s); matched values omitted`)
    for (const finding of findings) console.error(`[public-scan] ${finding.file}: ${finding.rule}`)
    process.exit(1)
}
console.log(`[public-scan] ${tracked.length} source paths plus generated artifacts: clean`)

function listFiles(directory) {
    if (!existsSync(directory)) return []
    if (statSync(directory).isFile()) return [directory]
    return readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name)
        return entry.isDirectory() ? listFiles(entryPath) : [entryPath]
    })
}

function run(command, args) {
    const result = spawnSync(command, args, {cwd: root, encoding: 'utf8'})
    if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`)
    return result.stdout
}
