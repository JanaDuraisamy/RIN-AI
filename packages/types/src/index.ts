export const API_VERSION = '0.1.0';

export type MemoryType = 'working' | 'short-term' | 'long-term';

export interface PrimaryOwner {
  id: string;
  displayName: string;
  email: string;
  preferredLanguage: string;
  timezone: string;
  profileImage: string | null;
  preferences: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Memory {
  id: string;
  title: string;
  content: string;
  memoryType: MemoryType;
  importance: number;
  tags: string[];
  source: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface Conversation {
  id: string;
  sessionId: string;
  startedAt: string;
  endedAt: string | null;
  summary: string | null;
  contextVersion: string;
}

export interface Message {
  id: string;
  conversationId: string;
  sender: string;
  content: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  healthStatus: string;
  configuration: Record<string, unknown>;
  createdAt: string;
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  manifest: Record<string, unknown>;
  permissions: string[];
  enabled: boolean;
  installedAt: string;
}

export interface RuntimeConfiguration {
  id: string;
  configurationKey: string;
  configurationValue: unknown;
  environment: string;
  updatedAt: string;
}

export interface Event {
  id: string;
  eventType: string;
  source: string;
  correlationId: string;
  payload: unknown;
  timestamp: string;
  processingStatus: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  resource: string;
  timestamp: string;
  outcome: string;
  metadata: Record<string, unknown>;
}

export interface CoreApiRequest {
  requestId: string;
  timestamp: string;
  callingComponent: string;
  apiVersion: string;
  authContext?: string;
}

export type CoreApiStatus = 'success' | 'error';

export interface CoreApiError {
  code: string;
  message: string;
  traceId: string;
}

export interface CoreApiResponse<T> {
  status: CoreApiStatus;
  result: T | null;
  error: CoreApiError | null;
  executionTimeMs: number;
  version: string;
}

export interface EventEnvelope {
  eventId: string;
  eventType: string;
  source: string;
  timestamp: string;
  correlationId: string;
  eventVersion: string;
  payload: unknown;
}

export interface IpcRequestEnvelope {
  requestId: string;
  apiVersion: string;
  channelId: string;
  timestamp: string;
  sessionId: string;
}

export * from './configuration.js';
export * from './event-bus.js';
export * from './health.js';
export * from './memory.js';
export * from './runtime.js';
export * from './service-registry.js';
export * from './version.js';
