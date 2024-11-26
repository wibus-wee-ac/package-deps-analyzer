import { BaseAnalyzer } from './base-analyzer';
import { parse as parseYaml } from 'yaml';
import { readFile } from 'fs/promises';
import { PackageInfo, AnalyzeResult, PnpmLockfile, DependencyChain } from '../types';

export class PnpmAnalyzer extends BaseAnalyzer {
  protected lockfileContent: PnpmLockfile | null = null;

  async init() {
    const content = await readFile(this.lockfilePath, 'utf-8');
    this.lockfileContent = parseYaml(content);
  }

  async analyze(packageName: string): Promise<AnalyzeResult> {
    if (!this.lockfileContent) {
      throw new Error('Lockfile not initialized');
    }

    const { dependencies, dependedBy, version } = await this.analyzeDependencies(packageName);
    return { dependencies, dependedBy, version };
  }

  private async analyzeDependencies(packageName: string): Promise<AnalyzeResult> {
    const { packages = {}, snapshots = {} } = this.lockfileContent!;
    const dependencies: PackageInfo[] = [];
    const dependedBy: PackageInfo[] = [];
    let targetVersion: string | undefined;

    // 分析基础包依赖
    const basePackage = this.findBasePackage(packages, packageName);
    if (basePackage) {
      const [pkgPath, pkgInfo] = basePackage;
      targetVersion = this.parsePackagePath(pkgPath).version;
      this.collectDependencies(pkgInfo, dependencies);
    }

    // 分析快照依赖
    const snapshotKey = `${packageName}@${targetVersion}`;
    if (snapshots[snapshotKey]) {
      this.collectSnapshotDependencies(snapshots[snapshotKey], dependencies);
    }

    // 分析被依赖关系
    this.collectDependedBy(packages, snapshots, packageName, dependedBy);

    return { dependencies, dependedBy, version: targetVersion };
  }

  private findBasePackage(packages: Record<string, any>, packageName: string): [string, any] | undefined {
    return Object.entries(packages).find(([path]) => {
      const pkg = this.parsePackagePath(path);
      return pkg.name === packageName && !path.includes('(');
    });
  }

  private collectDependencies(pkgInfo: any, dependencies: PackageInfo[]) {
    this.addDependenciesByType(pkgInfo.dependencies, 'normal', dependencies);
    this.addDependenciesByType(pkgInfo.peerDependencies, 'peer', dependencies);
    this.addDependenciesByType(pkgInfo.optionalDependencies, 'optional', dependencies);
  }

  private addDependenciesByType(
    deps: Record<string, string> | undefined, 
    type: 'normal' | 'peer' | 'optional',
    target: PackageInfo[]
  ) {
    if (!deps) return;
    
    Object.entries(deps).forEach(([name, version]) => {
      if (!target.some(d => d.name === name)) {
        target.push({
          name,
          version: version.toString(),
          type
        });
      }
    });
  }

  private collectSnapshotDependencies(snapshot: any, dependencies: PackageInfo[]) {
    this.addDependenciesByType(snapshot.dependencies, 'normal', dependencies);
    this.addDependenciesByType(snapshot.optionalDependencies, 'optional', dependencies);
  }

  private collectDependedBy(
    packages: Record<string, any>,
    snapshots: Record<string, any>,
    packageName: string,
    dependedBy: PackageInfo[]
  ) {
    // 检查包依赖
    Object.entries(packages).forEach(([pkgPath, pkgInfo]) => {
      if (!pkgPath.includes(packageName)) {
        const pkg = this.parsePackagePath(pkgPath);
        this.checkAndAddDependedBy(pkgInfo, pkg, packageName, dependedBy);
      }
    });

    // 检查快照依赖
    Object.entries(snapshots).forEach(([snapshotKey, snapshotInfo]) => {
      if (!snapshotKey.includes(packageName)) {
        const [name, version] = snapshotKey.split('@');
        this.checkAndAddDependedBy(snapshotInfo, { name, version }, packageName, dependedBy);
      }
    });
  }

  private checkAndAddDependedBy(
    info: any,
    pkg: { name: string; version: string },
    packageName: string,
    dependedBy: PackageInfo[]
  ) {
    if (info.dependencies?.[packageName]) {
      dependedBy.push({ ...pkg, type: 'normal' });
    } else if (info.peerDependencies?.[packageName]) {
      dependedBy.push({ ...pkg, type: 'peer' });
    } else if (info.optionalDependencies?.[packageName]) {
      dependedBy.push({ ...pkg, type: 'optional' });
    }
  }

  async getAllPackageNames(): Promise<string[]> {
    if (!this.lockfileContent) {
      throw new Error('Lockfile not initialized');
    }

    const packages = new Set<string>();
    Object.keys(this.lockfileContent.packages || {}).forEach(pkgPath => {
      const pkg = this.parsePackagePath(pkgPath);
      if (pkg.name) {
        packages.add(pkg.name);
      }
    });

    return Array.from(packages);
  }

  async traceDependencyChain(packageName: string): Promise<DependencyChain[]> {
    if (!this.lockfileContent) {
      throw new Error('Lockfile not initialized');
    }

    const chains: DependencyChain[] = [];
    const visited = new Set<string>();

    const findDependencyChains = (
      pkgName: string,
      chain: DependencyChain | undefined = undefined
    ) => {
      if (visited.has(pkgName)) return;
      visited.add(pkgName);

      const { packages = {}, snapshots = {} } = this.lockfileContent!;

      // 查找所有依赖这个包的包
      for (const [pkgPath, pkgInfo] of Object.entries(packages)) {
        if (pkgPath.includes(pkgName)) continue;

        const pkg = this.parsePackagePath(pkgPath);
        let dependencyType: 'normal' | 'peer' | 'optional' | undefined;

        if (pkgInfo.dependencies?.[pkgName]) {
          dependencyType = 'normal';
        } else if (pkgInfo.peerDependencies?.[pkgName]) {
          dependencyType = 'peer';
        } else if (pkgInfo.optionalDependencies?.[pkgName]) {
          dependencyType = 'optional';
        }

        if (dependencyType) {
          const newChain: DependencyChain = {
            name: pkg.name,
            version: pkg.version,
            type: dependencyType,
            parent: chain
          };

          if (!chain) {
            chains.push(newChain);
          }
          
          findDependencyChains(pkg.name, newChain);
        }
      }

      // 检查快照中的依赖
      for (const [snapshotKey, snapshotInfo] of Object.entries(snapshots)) {
        if (snapshotKey.includes(pkgName)) continue;

        const [name, version] = snapshotKey.split('@');
        let dependencyType: 'normal' | 'peer' | 'optional' | undefined;

        if (snapshotInfo.dependencies?.[pkgName]) {
          dependencyType = 'normal';
        } else if (snapshotInfo.peerDependencies?.[pkgName]) {
          dependencyType = 'peer';
        } else if (snapshotInfo.optionalDependencies?.[pkgName]) {
          dependencyType = 'optional';
        }

        if (dependencyType) {
          const newChain: DependencyChain = {
            name,
            version,
            type: dependencyType,
            parent: chain
          };

          if (!chain) {
            chains.push(newChain);
          }

          findDependencyChains(name, newChain);
        }
      }
    };

    findDependencyChains(packageName);
    return chains;
  }
}