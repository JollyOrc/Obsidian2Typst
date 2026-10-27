export function installBuild(options: {from: string; to: string}): {
  version: string;
  checksum: string;
};
export function installSample(options: {from: string; to: string}): {
  files: number;
};
