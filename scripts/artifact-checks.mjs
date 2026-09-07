import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'

export function archiveSha256(filename) {
    return sha256(readFileSync(filename))
}

export function npmTarStreamSha256(filename) {
    return sha256(gunzipSync(readFileSync(filename)))
}

function sha256(contents) {
    return createHash('sha256').update(contents).digest('hex')
}
