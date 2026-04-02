import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

export interface AssistantSessionJoinRequest {
  sessionId: string;
  locale?: string;
  persona?: string;
  pagePath?: string;
  pageTitle?: string;
  module?: string;
  contextSummary?: string;
  metadata?: Record<string, string>;
}

export interface AssistantSessionJoined {
  sessionId: string;
  userId: string;
  userName: string;
  welcomeMessage: string;
  capabilities: string[];
  locale: string;
  persona: string;
  sessionSummary?: string;
  humanHandoverAvailable: boolean;
  featureFlags: Record<string, boolean>;
  suggestedReplies: string[];
  messages: AssistantChatMessage[];
}

export interface AssistantSendMessageRequest {
  sessionId: string;
  message: string;
  locale?: string;
  persona?: string;
  pagePath?: string;
  pageTitle?: string;
  module?: string;
  contextSummary?: string;
  metadata?: Record<string, string>;
}

export interface AssistantChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  quickReplies?: string[];
}

const resolveHubUrl = () => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  if (apiBaseUrl.startsWith('http://') || apiBaseUrl.startsWith('https://')) {
    const origin = new URL(apiBaseUrl).origin;
    return `${origin}/hubs/assistant`;
  }

  return '/hubs/assistant';
};

export const createAssistantConnection = () => {
  return new HubConnectionBuilder()
    .withUrl(resolveHubUrl(), {
      accessTokenFactory: () => localStorage.getItem('accessToken') || '',
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 20000])
    .configureLogging(LogLevel.Warning)
    .build();
};

export const assistantRealtime = {
  async start(connection: HubConnection) {
    if (connection.state === 'Connected') return;
    await connection.start();
  },

  joinSession(connection: HubConnection, payload: AssistantSessionJoinRequest) {
    return connection.invoke('JoinSession', payload);
  },

  sendUserMessage(connection: HubConnection, payload: AssistantSendMessageRequest) {
    return connection.invoke('SendUserMessage', payload);
  },
};
