import type { DownloadTask } from '../shared/types.js';
import { progressBytesFromLine, progressFromLine } from '../shared/utils.js';

export class DownloadProgress {
  private aggregate = false;
  private largestTotal = 0;
  update(line: string): Partial<DownloadTask> | undefined {
    const bytes = progressBytesFromLine(line);
    if (!bytes) {
      const progress = progressFromLine(line);
      return progress !== null && !this.aggregate && this.largestTotal === 0 ? { progress } : undefined;
    }
    const aggregate = /(?:^|[\s⠁-⣿])(?:Initializing|Downloading(?: ntfs\.\.\.)?)\s*[:·]?\s*\d/i.test(line);
    if (this.aggregate && !aggregate || bytes.total < this.largestTotal) return;
    if (aggregate) this.aggregate = true;
    this.largestTotal = bytes.total;
    return {
      downloadedBytes: bytes.current, totalBytes: bytes.total,
      progress: Math.min(100, bytes.current / bytes.total * 100),
      transferRate: line.match(/[\d.]+\s*(?:KiB|MiB|GiB|TiB|KB|MB|GB|TB|B)\/s/i)?.[0],
      phase: 'Downloading and extracting game files',
    };
  }
}
