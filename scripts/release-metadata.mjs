const semanticVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/
const datePattern = /^\d{4}-\d{2}-\d{2}$/

export const releasePackageDefinitions = [
    {
        key: 'glue', name: '@sylwellsoftware/glue', directory: 'glue',
        changelog: 'packages/glue/CHANGELOG.md',
    },
    {
        key: 'fray', name: '@sylwellsoftware/fray', directory: 'fray',
        changelog: 'packages/fray/CHANGELOG.md',
    },
    {
        key: 'fray-visualization', name: '@sylwellsoftware/fray-visualization',
        directory: 'fray-visualization', changelog: 'packages/fray-visualization/CHANGELOG.md',
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
        return {...definition, version: entry.version, tag: entry.tag}
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
        packages: normalized.packages.map(({key, version, tag}) => ({key, version, tag})),
    })
}

export function releaseTagForVersion(version) {
    assert(isExactSemanticVersion(version), 'npm tag requested for an invalid semantic version')
    return version.includes('-') ? 'next' : 'latest'
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

export function promoteUnreleased(contents, version, releaseDate) {
    if (changelogHasRelease(contents, version)) return contents
    const heading = '## Unreleased'
    const start = contents.indexOf(heading)
    assert(start >= 0, 'CHANGELOG.md has no Unreleased heading')
    const contentStart = start + heading.length
    const nextHeading = contents.indexOf('\n## ', contentStart)
    const end = nextHeading < 0 ? contents.length : nextHeading
    const notes = contents.slice(contentStart, end).trim()
    assert(/### (Added|Changed|Fixed|Removed)/.test(notes),
        'CHANGELOG.md Unreleased section has no categorized release notes')
    const suffix = nextHeading < 0 ? '' : contents.slice(nextHeading)
    const updated = `${contents.slice(0, start)}${heading}\n\n`
        + `## ${version} - ${releaseDate}\n\n${notes}\n${suffix.replace(/^\n?/, '\n')}`
    return updated.endsWith('\n') ? updated : `${updated}\n`
}

function packageIndex(key) {
    return releasePackageDefinitions.findIndex((definition) => definition.key === key)
}

function assert(condition, message) {
    if (!condition) throw new Error(message)
}
