import assert from 'node:assert/strict'
import test from 'node:test'

import {changelogHasRelease, isExactSemanticVersion} from '../release-metadata.mjs'

test('release metadata accepts changing stable and prerelease versions', () => {
    assert.equal(isExactSemanticVersion('0.1.0-alpha.1'), true)
    assert.equal(isExactSemanticVersion('0.2.0'), true)
    assert.equal(isExactSemanticVersion('2.4.1-rc.3'), true)
    assert.equal(isExactSemanticVersion('next'), false)
    assert.equal(isExactSemanticVersion('1.2'), false)
})

test('release metadata requires a matching changelog heading', () => {
    const changelog = '# Changelog\n\n## 0.2.0-alpha.1 - 2026-09-02\n\n## 0.2.0 - 2026-09-03\n'
    assert.equal(changelogHasRelease(changelog, '0.2.0'), true)
    assert.equal(changelogHasRelease(changelog, '0.1.0-alpha.1'), false)
    assert.equal(changelogHasRelease(changelog, '0.2'), false)
    assert.equal(changelogHasRelease(changelog, '0.2.0-alpha'), false)
})
