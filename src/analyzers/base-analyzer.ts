import { AnalyzeResult } from '../types';

export abstract class BaseAnalyzer {
  protected lockfileContent: any = null;

  constructor(protected lockfilePath: string) {}

  abstract init(): Promise<void>;
  abstract analyze(packageName: string): Promise<AnalyzeResult>;
  abstract getAllPackageNames(): Promise<string[]>;
  
  protected parsePackagePath(pkgPath: string): { name: string; version: string; path: string } {
    const cleanPath = pkgPath.startsWith('/') ? pkgPath.slice(1) : pkgPath;
    
    // 处理带括号的特殊情况，如 'unbuild@2.0.0(typescript@5.7.2)'
    const parenthesesMatch = cleanPath.match(/^(.+?)@([^(]+)\((.*?)\)$/);
    if (parenthesesMatch) {
      return {
        name: parenthesesMatch[1],
        version: `${parenthesesMatch[2]}(${parenthesesMatch[3]})`, // 保留完整的版本信息，包括括号内容
        path: cleanPath
      };
    }

    // 处理普通情况
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
}