import {createHash} from 'node:crypto'

const semanticVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/
const datePattern = /^\d{4}-\d{2}-\d{2}$/

export const releasePackageDefinitions = [
    // Keep propagation and presentation peers before optional tools.
    {
        key: 'capillary', name: '@capillaryjs/capillary', directory: 'capillary',
        changelog: 'packages/capillary/CHANGELOG.md',
    },
    {
        key: 'capillaryUi', name: '@capillaryjs/capillary-ui', directory: 'capillary-ui',
        changelog: 'packages/capillary-ui/CHANGELOG.md',
    },
    {
        key: 'capillaryViz', name: '@capillaryjs/capillary-viz',
        directory: 'capillary-viz', changelog: 'packages/capillary-viz/CHANGELOG.md',
    },
    {
        key: 'capillaryDevtools', name: '@capillaryjs/capillary-devtools',
        directory: 'capillary-devtools', changelog: 'packages/capillary-devtools/CHANGELOG.md',
    },
]

/** A stable, explicit release identity shared by the desktop tool and CI. */
export function parseReleasePlan(value) {
    const source = typeof value === 'string' ? JSON.parse(value) : value
    assert(source && typeof source === 'object', 'release plan must be an object')
    assert(source.schemaVersion === 1, 'release plan schemaVersion must be 1')
    assert(typeof source.releaseDate === 'string' && datePattern.test(source.releaseDate),
        'release plan requires a YYYY-MM-DD releaseDate')
    assert(Array.isArray(source.packages) && source.packages.length > 0,
        'release plan must select at least one package')

    const selected = source.packages.map((entry) => {
        assert(entry && typeof entry === 'object', 'release plan package entry must be an object')
        const definition = releasePackageDefinitions.find(({key}) => key === entry.key)
        assert(definition, `release plan names an unknown package: ${entry.key ?? '(missing)'}`)
        assert(isExactSemanticVersion(entry.version),
            `${definition.name} requires an exact semantic version`)
        const expectedTag = releaseTagForVersion(entry.version)
        assert(entry.tag === expectedTag,
            `${definition.name}@${entry.version} requires npm tag ${expectedTag}`)
        assert(entry.missingNotesApproval == null || /^[0-9a-f]{64}$/.test(entry.missingNotesApproval),
            'missing notes approval must identify the exact changelog SHA-256')
        return {...definition, version: entry.version, tag: entry.tag,
            ...(entry.missingNotesApproval ? {missingNotesApproval: entry.missingNotesApproval} : {})}
    })
    assert(new Set(selected.map(({key}) => key)).size === selected.length,
        'release plan selects a package more than once')

    const ordered = [...selected].sort((left, right) => packageIndex(left.key) - packageIndex(right.key))
    return {schemaVersion: 1, releaseDate: source.releaseDate, packages: ordered}
}

export function formatReleasePlan(plan) {
    const normalized = parseReleasePlan(plan)
    return JSON.stringify({
        schemaVersion: normalized.schemaVersion,
        releaseDate: normalized.releaseDate,
        packages: normalized.packages.map(({key, version, tag, missingNotesApproval}) =>
            ({key, version, tag, ...(missingNotesApproval ? {missingNotesApproval} : {})})),
    })
}

export function releaseTagForVersion(version) {
    assert(isExactSemanticVersion(version), 'npm tag requested for an invalid semantic version')
    return version.includes('-') ? 'next' : 'latest'
}

/** The diagnostics protocol and automatic UI consumers first ship in the 1.2 line. */
export function assertDevtoolsPeerVersions(capillaryVersion, capillaryUiVersion) {
    for (const [name, version] of [['Capillary', capillaryVersion], ['Capillary UI', capillaryUiVersion]]) {
        const [major, minor] = version.split('.').map(Number)
        assert(major > 1 || (major === 1 && minor >= 2),
            `Capillary DevTools requires ${name} 1.2 or later; include its diagnostics update in the release plan`)
    }
}

export function isExactSemanticVersion(value) {
    return typeof value === 'string' && semanticVersionPattern.test(value)
}

export function changelogHasRelease(changelog, version) {
    const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`^## ${escapedVersion}(?: - \\d{4}-\\d{2}-\\d{2})?[ \\t]*$`, 'm')
        .test(changelog)
}

export function setManifestVersion(contents, version) {
    assert(isExactSemanticVersion(version), 'manifest version must be an exact semantic version')
    const matches = contents.match(/"version"\s*:\s*"[^"]+"/g) ?? []
    assert(matches.length === 1, 'package manifest must contain exactly one version field')
    return contents.replace(matches[0], `"version": "${version}"`)
}

export function setManifestDependencyRange(contents, section, dependency, range) {
    const manifest = JSON.parse(contents)
    assert(typeof manifest[section] === 'object' && manifest[section] !== null,
        `package manifest has no ${section} section`)
    assert(Object.hasOwn(manifest[section], dependency),
        `package manifest has no ${dependency} entry in ${section}`)
    manifest[section][dependency] = range
    return `${JSON.stringify(manifest, null, 2)}\n`
}

export function hasSubstantiveReleaseNotes(notes) {
    let categorized = false
    for (const line of notes.split('\n')) {
        if (/^### /.test(line.trim())) categorized = /^### (Added|Changed|Fixed|Removed|Deprecated|Security)\s*$/.test(line.trim())
        if (categorized && /^[-*] \S/.test(line.trim())
            && !/^[-*] (?:TODO|TBD|None|N\/A|No changes|\.\.\.|…)[.!]?$/i.test(line.trim())) return true
    }
    return false
}

export function promoteUnreleased(contents, version, releaseDate, missingNotesApproval) {
    const approved = missingNotesApproval === createHash('sha256').update(contents).digest('hex')
    const unreleasedNotes = markdownSection(contents, 'Unreleased')
    if (changelogHasRelease(contents, version)) {
        assert(!hasSubstantiveReleaseNotes(unreleasedNotes ?? ''),
            `CHANGELOG.md already contains ${version} while Unreleased has substantive notes; choose a new version or reconcile the historical changelog before preparing`)
        const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const match = new RegExp(`^## ${escaped}(?: - \\d{4}-\\d{2}-\\d{2})?[ \\t]*$`, 'm').exec(contents)
        const start = match.index + match[0].length
        const next = contents.indexOf('\n## ', start)
        const end = next < 0 ? contents.length : next
        const notes = contents.slice(start, end)
        if (hasSubstantiveReleaseNotes(notes) ||
            (missingNotesApproval && notes.includes('Release notes omitted with maintainer approval.'))) return contents
        assert(approved, 'prepared release has no substantive notes; explicit missing-notes approval required')
        return `${contents.slice(0, start)}\n\nRelease notes omitted with maintainer approval.\n${contents.slice(end)}`
    }
    const heading = '## Unreleased'
    const start = contents.indexOf(heading)
    if (start < 0) {
        assert(approved, 'CHANGELOG.md has no Unreleased heading; explicit missing-notes approval required')
        return `${contents.trimEnd()}\n\n## Unreleased\n\n## ${version} - ${releaseDate}\n\nRelease notes omitted with maintainer approval.\n`
    }
    const contentStart = start + heading.length
    const nextHeading = contents.indexOf('\n## ', contentStart)
    const end = nextHeading < 0 ? contents.length : nextHeading
    let notes = contents.slice(contentStart, end).trim()
    if (!hasSubstantiveReleaseNotes(notes)) {
        assert(approved, 'CHANGELOG.md Unreleased section has no categorized release notes; explicit missing-notes approval required')
        notes = 'Release notes omitted with maintainer approval.'
    }
    const suffix = nextHeading < 0 ? '' : contents.slice(nextHeading)
    const updated = `${contents.slice(0, start)}${heading}\n\n`
        + `## ${version} - ${releaseDate}\n\n${notes}\n${suffix.replace(/^\n?/, '\n')}`
    return updated.endsWith('\n') ? updated : `${updated}\n`
}

function markdownSection(contents, heading) {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = new RegExp(`^## ${escaped}[ \\t]*$`, 'm').exec(contents)
    if (!match) return undefined
    const start = match.index + match[0].length
    const next = contents.indexOf('\n## ', start)
    return contents.slice(start, next < 0 ? contents.length : next)
}

function packageIndex(key) {
    return releasePackageDefinitions.findIndex((definition) => definition.key === key)
}

function assert(condition, message) {
    if (!condition) throw new Error(message)
}
