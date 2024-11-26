# package-deps-analyzer

Analyze package dependencies and dependents.

> [!NOTE]
> This tool is a toy project.

> Supported lockfile: `pnpm-lock.yaml`

## Usage

```bash
$ pkg-deps --help

Usage: pkg-deps [options] <packages...>

Analyze package dependencies and dependents

Arguments:
  packages           Package name (supports wildcards, e.g. @types/*)

Options:
  -V, --version      output the version number
  -f, --file <path>  Lockfile path (default: "./pnpm-lock.yaml")
  -t, --trace        Show complete dependency chains
  -h, --help         display help for command
```

### Analyze a package

```bash
pkg-deps 'glob'

📦 glob@8.1.0

Dependencies:
  ├─ fs.realpath@1.0.0
  ├─ inflight@1.0.6
  ├─ inherits@2.0.4
  ├─ minimatch@5.1.6
  ├─ once@1.4.0

Depended by:
  ├─ @rollup/plugin-commonjs

```


## Author

package-deps-analyzer © Wibus, Released under MIT. Created on Nov 26, 2024

> [Personal Website](http://wibus.ren/) · [Blog](https://blog.wibus.ren/) · GitHub [@wibus-wee](https://github.com/wibus-wee/) · Telegram [@wibus✪](https://t.me/wibus_wee)
