export interface PackageInfo {
  name: string;
  version: string;
  type?: 'normal' | 'peer' | 'optional';
  dependencies?: Record<string, string>;
  dependedBy?: Array<{
    name: string;
    version: string;
    type?: 'normal' | 'peer' | 'optional';
  }>;
}

export interface AnalyzeResult {
  dependencies: PackageInfo[];
  dependedBy: PackageInfo[];
  version?: string;
}

export interface PnpmLockfile {
  lockfileVersion: number;
  packages: Record<string, {
    version: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
  }>;
  snapshots?: Record<string, {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
  }>;
}