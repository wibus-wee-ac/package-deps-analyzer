import chalk from 'chalk';
import { AnalyzeResult, PackageInfo, DependencyChain } from '../types';

export class OutputFormatter {
  format(packageName: string, result: AnalyzeResult): string {
    const output: string[] = [];
    
    output.push(chalk.cyan(`\n📦 ${packageName}@${result.version}`));
    
    // 格式化依赖
    const groupedDeps = this.groupByType(result.dependencies);
    this.formatDependencies(groupedDeps, output);
    
    // 格式化被依赖
    const groupedDependedBy = this.groupByType(result.dependedBy);
    this.formatDependedBy(groupedDependedBy, output);
    
    output.push('\n' + '='.repeat(50) + '\n');
    
    return output.join('\n');
  }

  private groupByType(items: PackageInfo[]): Record<string, PackageInfo[]> {
    return items.reduce((acc, item) => {
      const type = item.type || 'normal';
      if (!acc[type]) acc[type] = [];
      acc[type].push(item);
      return acc;
    }, {} as Record<string, PackageInfo[]>);
  }

  private formatDependencies(grouped: Record<string, PackageInfo[]>, output: string[]) {
    if (grouped.normal?.length) {
      output.push(chalk.cyan('\nDependencies:'));
      grouped.normal.forEach(dep => {
        output.push(chalk.gray(`  ├─ ${dep.name}@${dep.version}`));
      });
    }

    if (grouped.peer?.length) {
      output.push(chalk.yellow('\nPeer dependencies:'));
      grouped.peer.forEach(dep => {
        output.push(chalk.gray(`  ├─ ${dep.name}@${dep.version}`));
      });
    }

    if (grouped.optional?.length) {
      output.push(chalk.blue('\nOptional dependencies:'));
      grouped.optional.forEach(dep => {
        output.push(chalk.gray(`  ├─ ${dep.name}@${dep.version}`));
      });
    }
  }

  private formatDependedBy(grouped: Record<string, PackageInfo[]>, output: string[]) {
    const hasAnyDependedBy = Object.values(grouped).some(group => group.length > 0);
    
    if (hasAnyDependedBy) {
      output.push(chalk.magenta('\nDepended by:'));
      
      if (grouped.normal?.length) {
        grouped.normal.forEach(dep => {
          output.push(chalk.gray(`  ├─ ${dep.name}@${dep.version}`));
        });
      }

      if (grouped.peer?.length) {
        grouped.peer.forEach(dep => {
          output.push(chalk.yellow(`  ├─ ${dep.name}@${dep.version} (peer)`));
        });
      }

      if (grouped.optional?.length) {
        grouped.optional.forEach(dep => {
          output.push(chalk.blue(`  ├─ ${dep.name}@${dep.version} (optional)`));
        });
      }
    } else {
      output.push(chalk.gray('\nNo packages depend on this package'));
    }
  }

  formatDependencyChains(chains: DependencyChain[]): string[] {
    const output: string[] = [];
    
    if (chains.length === 0) {
      output.push(chalk.gray('No dependency chains found'));
      return output;
    }

    output.push(chalk.cyan('\nDependency Chains:'));

    chains.forEach((chain, index) => {
      const isLast = index === chains.length - 1;
      let current: DependencyChain | undefined = chain;
      const parts: string[] = [];

      while (current) {
        parts.unshift(`${current.name}@${current.version}`);
        current = current.parent;
      }

      const prefix = isLast ? '└─' : '├─';
      const indent = '   ';
      
      parts.forEach((part, i) => {
        const isLastPart = i === parts.length - 1;
        const line = `${indent.repeat(i)}${i === 0 ? prefix : '└─'} ${part}`;
        output.push(chalk.gray(line));
      });
    });

    return output;
  }
}