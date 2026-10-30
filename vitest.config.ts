import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  // examples have their own dependencies and tests (npm test in the example's directory)
  test: { exclude: [...configDefaults.exclude, 'examples/**'] },
})
