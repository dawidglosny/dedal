#!/usr/bin/env node
import { run } from '../dist/figma/cli.js'

process.exitCode = await run(process.argv.slice(2))
