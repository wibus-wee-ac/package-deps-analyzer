import { BaseAnalyzer } from './base-analyzer';
import { PnpmAnalyzer } from './pnpm-analyzer';
import path from 'path';

export class AnalyzerFactory {
  static create(lockfilePath: string): BaseAnalyzer {
    const filename = path.basename(lockfilePath);
    
    switch(filename) {
      case 'pnpm-lock.yaml':
        return new PnpmAnalyzer(lockfilePath);
      default:
        throw new Error(`不支持的锁文件类型: ${filename}`);
    }
  }
}