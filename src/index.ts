#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';
import micromatch from 'micromatch';
import { AnalyzerFactory } from './analyzers/analyzer-factory';
import { OutputFormatter } from './formatters/output-formatter';
import { PnpmAnalyzer } from './analyzers/pnpm-analyzer';

const program = new Command();

program
  .name('pkg-deps')
  .description('Analyze package dependencies and dependents')
  .version('1.0.0')
  .argument('<packages...>', 'Package name (supports wildcards, e.g. @types/*)')
  .option('-f, --file <path>', 'Lockfile path', './pnpm-lock.yaml')
  .option('-t, --trace', 'Show complete dependency chains')
  .action(async (packages: string[], options) => {
    try {
      const lockfilePath = path.resolve(process.cwd(), options.file);
      
      if (!existsSync(lockfilePath)) {
        console.error(chalk.red(`Error: Lockfile not found: ${lockfilePath}`));
        process.exit(1);
      }

      const analyzer = AnalyzerFactory.create(lockfilePath);
      await analyzer.init();

      const availablePackages = await analyzer.getAllPackageNames();
      const matchedPackages = packages.reduce((acc, pattern) => {
        const matches = micromatch(availablePackages, pattern);
        return [...acc, ...matches];
      }, [] as string[]);

      const uniquePackages = [...new Set(matchedPackages)];

      if (uniquePackages.length === 0) {
        console.error(chalk.red('Error: No matching packages found'));
        process.exit(1);
      }

      const formatter = new OutputFormatter();

      for (const pkg of uniquePackages) {
        const result = await analyzer.analyze(pkg);
        console.log(formatter.format(pkg, result));

        if (options.trace) {
          const chains = await (analyzer as PnpmAnalyzer).traceDependencyChain(pkg);
          console.log(formatter.formatDependencyChains(chains).join('\n'));
        }
      }

    } catch (error) {
      console.error(chalk.red('Analysis failed:'), error);
      process.exit(1);
    }
  });

program.parse();