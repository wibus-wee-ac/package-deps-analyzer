import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    'src/index',
  ],
  clean: true,
  rollup: {
    inlineDependencies: true,
    esbuild: {
      minify: true,
    },
  },
  declaration: false,
  failOnWarn: false,
  outDir: 'dist',
  externals: [
    'chalk',
    'commander',
    'yaml',
  ],
}) 