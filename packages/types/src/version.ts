export interface RuntimeVersionInfo {
  runtimeVersion: string;
  apiVersion: string;
}

export interface BuildInfo {
  buildId: string;
  buildDate: string;
  commitSha: string;
  repositoryUrl: string;
}

export interface CompatibilityInfo {
  minimumApiVersion: string;
  currentApiVersion: string;
  compatible: boolean;
}
