const semanticVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/

export function isExactSemanticVersion(value) {
    return typeof value === 'string' && semanticVersionPattern.test(value)
}

export function changelogHasRelease(changelog, version) {
    const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`^## ${escapedVersion}(?: - \\d{4}-\\d{2}-\\d{2})?[ \\t]*$`, 'm')
        .test(changelog)
}
