import { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '@/services/api';
import { applyApiConfig } from '@/hooks/useApiConfig';
import { phiraApiService } from '@/services/phiraApi';
import type { PublicRoom } from '@/types/api';

interface Player {
  id: number;
  name: string;
  is_ready?: boolean;
}

interface ExtendedPublicRoom extends PublicRoom {
  max_users?: number;
  current_users?: number;
  monitors?: number;
  ready_count?: number;
  players_with_ready?: Player[];
}

export interface PublicRoomLog {
  message: string;
  timestamp: number;
}

interface UsePublicRoomOptions {
  enableWebSocket?: boolean;
  autoRefreshInterval?: number;
}

export function usePublicRoom(roomId: string | undefined, options: UsePublicRoomOptions = {}) {
  const { enableWebSocket = true, autoRefreshInterval = 5000 } = options;

  const [room, setRoom] = useState<ExtendedPublicRoom | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [wsConnected, setWsConnected] = useState(false);
  const [wsLogs, setWsLogs] = useState<PublicRoomLog[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 获取房间数据
  const fetchRoomDetail = useCallback(async () => {
    if (!roomId) return;

    if (!apiService.getBaseUrl()) {
      applyApiConfig();
    }

    if (!apiService.getBaseUrl()) {
      setError('请先配置 API 地址');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const data = await apiService.getRooms();
      const foundRoom = data.rooms.find(r => r.roomid === roomId);

      if (foundRoom) {
        const extendedRoom: ExtendedPublicRoom = {
          ...foundRoom,
          max_users: foundRoom.max_users,
          current_users: foundRoom.players?.length || 0,
          monitors: 0,
        };
        setRoom(extendedRoom);

        // 预加载房主和谱面信息到缓存
        const hostId = parseInt(foundRoom.host?.id, 10);
        if (!isNaN(hostId)) {
          phiraApiService.getUserInfoCached(hostId).catch(() => {});
        }

        const chartId = parseInt(foundRoom.chart?.id, 10);
        if (!isNaN(chartId)) {
          phiraApiService.getChartInfoCached(chartId).catch(() => {});
        }
      } else {
        setError('房间不存在或已解散');
      }
    } catch {
      setError('获取房间信息失败');
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  // 初始加载
  useEffect(() => {
    fetchRoomDetail();
  }, [fetchRoomDetail]);

  // WebSocket 连接
  useEffect(() => {
    if (!roomId || !enableWebSocket) return;

    if (!apiService.getBaseUrl()) {
      applyApiConfig();
    }

    const baseUrl = apiService.getBaseUrl();
    if (!baseUrl) return;

    const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws';
    console.log('[WebSocket] 连接地址:', wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WebSocket] 已连接');
      setWsConnected(true);

      ws.send(JSON.stringify({
        type: 'subscribe',
        roomId: roomId,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('[WebSocket] 收到消息:', message);

        switch (message.type) {
          case 'subscribed':
            console.log('[WebSocket] 已订阅房间:', message.roomId);
            break;

          case 'room_update':
            if (message.data) {
              const playersWithReady: Player[] = message.data.users?.map((u: any) => ({
                id: u.id,
                name: u.name,
                is_ready: u.is_ready
              })) || [];
              const readyCount = playersWithReady.filter((p: Player) => p.is_ready).length;

              const updatedRoom: ExtendedPublicRoom = {
                roomid: message.data.roomid,
                cycle: message.data.cycle,
                lock: message.data.locked,
                host: message.data.host || { id: '0', name: '未知' },
                state: message.data.state || 'waiting',
                chart: message.data.chart || { id: '0', name: '未选择' },
                players: playersWithReady.map((p: Player) => ({ name: p.name, id: p.id })),
                max_users: message.data.max_users,
                current_users: message.data.users?.length || 0,
                monitors: message.data.monitors?.length || 0,
                ready_count: readyCount,
                players_with_ready: playersWithReady,
              };
              setRoom(updatedRoom);
            }
            break;

          case 'room_log':
            setWsLogs(prev => {
              const newLogs: PublicRoomLog[] = [
                { message: message.data.message, timestamp: message.data.timestamp },
                ...prev,
              ];
              return newLogs.slice(0, 50);
            });
            break;

          case 'error':
            console.error('[WebSocket] 错误:', message.message);
            break;

          case 'pong':
            break;
        }
      } catch (error) {
        console.error('[WebSocket] 解析消息失败:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] 错误:', error);
      setWsConnected(false);
    };

    ws.onclose = () => {
      console.log('[WebSocket] 已断开');
      setWsConnected(false);
    };

    heartbeatRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsubscribe' }));
        ws.close();
      }
    };
  }, [roomId, enableWebSocket]);

  // 自动刷新
  useEffect(() => {
    if (!autoRefreshInterval) return;

    const interval = setInterval(() => {
      fetchRoomDetail();
    }, autoRefreshInterval);

    return () => clearInterval(interval);
  }, [fetchRoomDetail, autoRefreshInterval]);

  return {
    room,
    isLoading,
    error,
    wsConnected,
    wsLogs,
    fetchRoomDetail,
  };
}
