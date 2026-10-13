// WebSocket 服务

import { apiService } from './api';

export interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
}

export interface RoomUpdateMessage {
  type: 'room_update';
  data: {
    roomid: string;
    state: string;
    locked: boolean;
    cycle: boolean;
    live: boolean;
    /** 房间人数上限。自建服务端会返回；官方格式没有此字段。 */
    max_users?: number;
    chart: {
      name: string;
      id: number;
    };
    host: {
      id: number;
      name: string;
    };
    users: Array<{
      id: number;
      name: string;
      is_ready?: boolean;
    }>;
    monitors: Array<{
      id: number;
      name: string;
    }>;
  };
}

export interface RoomLogEvent {
  type: 'room_log';
  data: {
    message: string;
    timestamp: number;
  };
}

export interface AdminUpdateMessage {
  type: 'admin_update';
  data: {
    timestamp: number;
    changes: {
      rooms: Array<{
        roomid: string;
        max_users: number;
        current_users: number;
        current_monitors: number;
        replay_eligible: boolean;
        live: boolean;
        locked: boolean;
        cycle: boolean;
        host: {
          id: number;
          name: string;
          connected: boolean;
        };
        state: {
          type: string;
          ready_users?: number[];
          ready_count?: number;
          results_count?: number;
          aborted_count?: number;
          finished_users?: number[];
          aborted_users?: number[];
        };
        chart: {
          name: string;
          id: number;
        };
        contest?: {
          whitelist_count: number;
          whitelist: number[];
          manual_start: boolean;
          auto_disband: boolean;
        };
        users: Array<{
          id: number;
          name: string;
          connected: boolean;
          is_host: boolean;
          game_time: number | null;
          language: string;
          finished?: boolean;
          aborted?: boolean;
          record_id?: number | null;
        }>;
        monitors: Array<{
          id: number;
          name: string;
          connected: boolean;
          language: string;
        }>;
      }>;
      total_rooms: number;
    };
  };
}

type MessageHandler = (message: WebSocketMessage) => void;
type ConnectionHandler = () => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private baseUrl: string = '';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private connectHandlers: Set<ConnectionHandler> = new Set();
  private disconnectHandlers: Set<ConnectionHandler> = new Set();
  private isConnecting: boolean = false;
  private subscribedRoomId: string | null = null;
  private isAdminSubscribed: boolean = false;

  // 设置基础 URL
  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/^http/, 'ws');
  }

  // 连接 WebSocket
  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    if (this.isConnecting) {
      return new Promise((resolve) => {
        const checkConnected = () => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            resolve();
          } else {
            setTimeout(checkConnected, 100);
          }
        };
        checkConnected();
      });
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      if (!this.baseUrl) {
        this.isConnecting = false;
        reject(new Error('WebSocket URL not set'));
        return;
      }

      try {
        this.ws = new WebSocket(`${this.baseUrl}/ws`);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnecting = false;
          this.startHeartbeat();
          this.connectHandlers.forEach(handler => handler());
          
          // 重新订阅之前的房间
          if (this.subscribedRoomId) {
            this.subscribeRoom(this.subscribedRoomId);
          }
          // 重新订阅管理员
          if (this.isAdminSubscribed) {
            this.adminSubscribe();
          }
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as WebSocketMessage;
            this.handleMessage(message);
          } catch {
            console.error('Failed to parse WebSocket message:', event.data);
          }
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.isConnecting = false;
          this.stopHeartbeat();
          this.disconnectHandlers.forEach(handler => handler());
          this.scheduleReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          reject(error);
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  // 断开连接
  disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscribedRoomId = null;
    this.isAdminSubscribed = false;
  }

  // 订阅房间
  subscribeRoom(roomId: string, userId?: number) {
    this.subscribedRoomId = roomId;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        type: 'subscribe',
        roomId,
        userId,
      });
    }
  }

  // 取消订阅房间
  unsubscribeRoom() {
    this.subscribedRoomId = null;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: 'unsubscribe' });
    }
  }

  // 管理员订阅
  adminSubscribe() {
    const token = apiService.getAdminToken();
    if (!token) {
      console.warn('No admin token available for WebSocket subscription');
      return;
    }
    
    this.isAdminSubscribed = true;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        type: 'admin_subscribe',
        token,
      });
    }
  }

  // 取消管理员订阅
  adminUnsubscribe() {
    this.isAdminSubscribed = false;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: 'admin_unsubscribe' });
    }
  }

  // 发送消息
  private send(message: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  // 订阅状态
  private subscribed = false;
  private subscribeHandlers: Set<(success: boolean) => void> = new Set();

  // 处理消息
  private handleMessage(message: WebSocketMessage) {
    // 处理心跳响应
    if (message.type === 'pong') {
      return;
    }

    // 处理订阅成功
    if (message.type === 'subscribed') {
      const roomId = (message as unknown as { roomId: string }).roomId;
      console.log('Subscribed to room:', roomId);
      this.subscribed = true;
      this.subscribeHandlers.forEach(handler => handler(true));
      return;
    }

    // 处理管理员订阅成功
    if (message.type === 'admin_subscribed') {
      console.log('Admin subscribed successfully');
      this.subscribed = true;
      this.subscribeHandlers.forEach(handler => handler(true));
      return;
    }

    // 处理错误
    if (message.type === 'error') {
      const errorMsg = (message as unknown as { message: string }).message;
      console.error('WebSocket error message:', errorMsg);
      // 如果是授权错误，重置订阅状态
      if (errorMsg === 'unauthorized') {
        this.subscribed = false;
        this.subscribeHandlers.forEach(handler => handler(false));
      }
      return;
    }

    // 通知所有处理器
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('Message handler handler error:', error);
      }
    });
  }

  // 检查是否已订阅
  isSubscribed(): boolean {
    return this.subscribed;
  }

  // 添加订阅状态处理器
  onSubscribe(handler: (success: boolean) => void) {
    this.subscribeHandlers.add(handler);
    return () => this.subscribeHandlers.delete(handler);
  }

  // 启动心跳
  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 25000);
  }

  // 停止心跳
  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // 计划重连
  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log('Attempting to reconnect WebSocket...');
      this.connect().catch(() => {
        // 重连失败，继续计划下一次重连
        this.scheduleReconnect();
      });
    }, 3000);
  }

  // 添加消息处理器
  onMessage(handler: MessageHandler) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  // 添加连接处理器
  onConnect(handler: ConnectionHandler) {
    this.connectHandlers.add(handler);
    return () => this.connectHandlers.delete(handler);
  }

  // 添加断开处理器
  onDisconnect(handler: ConnectionHandler) {
    this.disconnectHandlers.add(handler);
    return () => this.disconnectHandlers.delete(handler);
  }

  // 检查是否已连接
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const webSocketService = new WebSocketService();
