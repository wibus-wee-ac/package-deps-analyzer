import { readFile } from 'fs/promises';
import { parse as parseYaml } from 'yaml';
import { PackageInfo, AnalyzeResult, PnpmLockfile } from './types';
import path from 'path';

interface PackageWithVersion {
  name: string;
  version: string;
  path: string;
}

export class DependencyAnalyzer {
  private lockfileContent: PnpmLockfile | null = null;
  private isPnpm: boolean = false;

  constructor(private lockfilePath: string) {
    this.isPnpm = path.basename(lockfilePath) === 'pnpm-lock.yaml';
  }

  async init() {
    const content = await readFile(this.lockfilePath, 'utf-8');

    if (this.isPnpm) {
      this.lockfileContent = parseYaml(content);
    } else {
      this.lockfileContent = JSON.parse(content);
    }
  }

  private parsePackagePath(pkgPath: string): PackageWithVersion {
    // 移除开头的 '/'
    const cleanPath = pkgPath.startsWith('/') ? pkgPath.slice(1) : pkgPath;

    // 解析带括号的包路径，如 'unbuild@2.0.0(typescript@5.7.2)'
    const parenthesesMatch = cleanPath.match(/^(.+?)@([^(]+)\((.*?)\)$/);
    if (parenthesesMatch) {
      return {
        name: parenthesesMatch[1],
        version: `${parenthesesMatch[2]}(${parenthesesMatch[3]})`,
        path: cleanPath
      };
    }

    // 解析普通包路径
    const normalMatch = cleanPath.match(/^(.+?)@([^(]+)$/);
    if (normalMatch) {
      return {
        name: normalMatch[1],
        version: normalMatch[2],
        path: cleanPath
      };
    }

    return {
      name: cleanPath,
      version: '',
      path: cleanPath
    };
  }

  async analyze(packageName: string): Promise<AnalyzeResult> {
    if (!this.lockfileContent) {
      throw new Error('Lockfile not initialized');
    }

    const dependencies: PackageInfo[] = [];
    const dependedBy: PackageInfo[] = [];
    let targetVersion: string | undefined;

    if (this.isPnpm) {
      const { packages = {}, snapshots = {} } = this.lockfileContent;

      // 获取所有与该包相关的条目
      const relatedPackages = Object.entries(packages).filter(([path]) => {
        const pkg = this.parsePackagePath(path);
        return pkg.name === packageName;
      });

      // 分别处理基础包和快照包
      const basePackage = relatedPackages.find(([path]) => !path.includes('('));
      const snapshotPackages = relatedPackages.filter(([path]) => path.includes('('));
      if (basePackage) {
        const [pkgPath, pkgInfo] = basePackage;
        const pkg = this.parsePackagePath(pkgPath);
        targetVersion = pkg.version;

        // 添加 peer dependencies
        if (pkgInfo.peerDependencies) {
          Object.entries(pkgInfo.peerDependencies).forEach(([name, version]) => {
            dependencies.push({
              name,
              version: version.toString(),
              type: 'peer'
            });
          });
        }

        // 添加基础包的依赖
        if (pkgInfo.dependencies) {
          Object.entries(pkgInfo.dependencies).forEach(([name, version]) => {
            if (!dependencies.some(d => d.name === name)) {
              dependencies.push({
                name,
                version: version.toString(),
                type: 'normal'
              });
            }
          });
        }

        // 添加可选依赖
        if (pkgInfo.optionalDependencies) {
          Object.entries(pkgInfo.optionalDependencies).forEach(([name, version]) => {
            if (!dependencies.some(d => d.name === name)) {
              dependencies.push({
                name,
                version: version.toString(),
                type: 'optional'
              });
            }
          });
        }
      }

      // 处理 snapshots 部分
      const snapshotKey = `${packageName}@${targetVersion}`;
      if (snapshots && snapshots[snapshotKey]) {
        const snapshotInfo = snapshots[snapshotKey];

        // 添加 snapshot 中的依赖
        if (snapshotInfo.dependencies) {
          Object.entries(snapshotInfo.dependencies).forEach(([name, version]) => {
            if (!dependencies.some(d => d.name === name)) {
              dependencies.push({
                name,
                version: version.toString(),
                type: 'normal'
              });
            }
          });
        }

        // 添加 snapshot 中的可选依赖
        if (snapshotInfo.optionalDependencies) {
          Object.entries(snapshotInfo.optionalDependencies).forEach(([name, version]) => {
            if (!dependencies.some(d => d.name === name)) {
              dependencies.push({
                name,
                version: version.toString(),
                type: 'optional'
              });
            }
          });
        }
      }

      // 查找被谁依赖 - 检查 packages
      for (const [pkgPath, pkgInfo] of Object.entries(packages)) {
        if (pkgPath.includes(packageName)) continue;

        const pkg = this.parsePackagePath(pkgPath);

        if (pkgInfo.dependencies?.[packageName]) {
          dependedBy.push({
            name: pkg.name,
            version: pkg.version || pkgInfo.version,
            type: 'normal'
          });
        } else if (pkgInfo.peerDependencies?.[packageName]) {
          dependedBy.push({
            name: pkg.name,
            version: pkg.version || pkgInfo.version,
            type: 'peer'
          });
        } else if (pkgInfo.optionalDependencies?.[packageName]) {
          dependedBy.push({
            name: pkg.name,
            version: pkg.version || pkgInfo.version,
            type: 'optional'
          });
        }
      }

      // 查找被谁依赖 - 检查 snapshots
      for (const [snapshotKey, snapshotInfo] of Object.entries(snapshots)) {
        if (snapshotKey.includes(packageName)) continue;

        const [name, version] = snapshotKey.split('@');

        if (snapshotInfo.dependencies?.[packageName]) {
          dependedBy.push({
            name,
            version,
            type: 'normal'
          });
        } else if (snapshotInfo.peerDependencies?.[packageName]) {
          dependedBy.push({
            name,
            version,
            type: 'peer'
          });
        } else if (snapshotInfo.optionalDependencies?.[packageName]) {
          dependedBy.push({
            name,
            version,
            type: 'optional'
          });
        }
      }
    }

    return { dependencies, dependedBy, version: targetVersion };
  }

  async getAllPackageNames(): Promise<string[]> {
    if (!this.lockfileContent) {
      throw new Error('Lockfile not initialized');
    }

    const packages = new Set<string>();

    if (this.isPnpm) {
      Object.keys(this.lockfileContent.packages || {}).forEach(pkgPath => {
        const pkg = this.parsePackagePath(pkgPath);
        if (pkg.name) {
          packages.add(pkg.name);
        }
      });
    }

    return Array.from(packages);
  }
}