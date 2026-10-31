import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const GITHUB = 'https://github.com/dawidglosny/dedal'

/** The package version, from the repository's package.json — no second place to bump at a release. */
export const VERSION: string = JSON.parse(readFileSync(join(process.cwd(), '../package.json'), 'utf8')).version
