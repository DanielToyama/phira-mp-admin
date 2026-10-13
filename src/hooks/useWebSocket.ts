// WebSocket Hook

import { useEffect, useRef, useState, useCallback } from 'react';
import { webSocketService, type AdminUpdateMessage, type RoomUpdateMessage } from '@/services/websocket';
import { apiService } from '@/services/api';
import type { Room } from '@/types/api';

interface UseWebSocketOptions {
  roomId?: string;
  userId?: number;
  enableAdmin?: boolean;
}

export function useWebSocket({ roomId, userId, enableAdmin }: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [roomData, setRoomData] = useState<Room | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const initializedRef = useRef(false);

  // 初始化 WebSocket 连接
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const baseUrl = apiService.getBaseUrl();
    if (!baseUrl) return;

    webSocketService.setBaseUrl(baseUrl);

    const connect = async () => {
      try {
        await webSocketService.connect();
      } catch (error) {
        console.error('WebSocket connection failed:', error);
      }
    };

    connect();

    return () => {
      webSocketService.disconnect();
    };
  }, []);

  // 监听连接状态
  useEffect(() => {
    const unsubscribeConnect = webSocketService.onConnect(() => {
      setIsConnected(true);
    });

    const unsubscribeDisconnect = webSocketService.onDisconnect(() => {
      setIsConnected(false);
    });

    // 初始状态
    setIsConnected(webSocketService.isConnected());

    return () => {
      unsubscribeConnect();
      unsubscribeDisconnect();
    };
  }, []);

  // 订阅房间
  useEffect(() => {
    if (!roomId || !isConnected) return;

    webSocketService.subscribeRoom(roomId, userId);

    return () => {
      webSocketService.unsubscribeRoom();
    };
  }, [roomId, userId, isConnected]);

  // 管理员订阅
  useEffect(() => {
    if (!enableAdmin || !isConnected) return;

    webSocketService.adminSubscribe();

    return () => {
      webSocketService.adminUnsubscribe();
    };
  }, [enableAdmin, isConnected]);

  // 监听消息
  useEffect(() => {
    const unsubscribe = webSocketService.onMessage((message) => {
      // 处理房间更新
      if (message.type === 'room_update') {
        const roomMessage = message as unknown as RoomUpdateMessage;
        // 将 WebSocket 数据转换为 Room 类型
        const updatedRoom: Room = {
          roomid: roomMessage.data.roomid,
          max_users: roomMessage.data.max_users ?? 8, // 服务端未返回时才回退
          live: roomMessage.data.live,
          locked: roomMessage.data.locked,
          cycle: roomMessage.data.cycle,
          host: {
            id: roomMessage.data.host.id,
            name: roomMessage.data.host.name,
          },
          state: {
            type: roomMessage.data.state as 'select_chart' | 'playing' | 'waiting',
          },
          chart: roomMessage.data.chart,
          users: roomMessage.data.users.map(u => ({
            id: u.id,
            name: u.name,
            connected: true,
            is_host: u.id === roomMessage.data.host.id,
            game_time: -Infinity,
            language: 'zh-CN',
          })),
          monitors: roomMessage.data.monitors || [],
        };
        setRoomData(updatedRoom);
      }

      // 处理管理员更新
      if (message.type === 'admin_update') {
        const adminMessage = message as unknown as AdminUpdateMessage;
        const updatedRooms: Room[] = adminMessage.data.changes.rooms.map(r => ({
          roomid: r.roomid,
          max_users: r.max_users,
          live: r.live,
          locked: r.locked,
          cycle: r.cycle,
          host: {
            id: r.host.id,
            name: r.host.name,
          },
          state: {
            type: r.state.type as 'select_chart' | 'playing' | 'waiting',
            results_count: r.state.results_count,
            aborted_count: r.state.aborted_count,
            finished_users: r.state.finished_users,
            aborted_users: r.state.aborted_users,
          },
          chart: r.chart,
          users: r.users.map(u => ({
            id: u.id,
            name: u.name,
            connected: u.connected,
            is_host: u.is_host,
            game_time: u.game_time ?? -Infinity,
            language: u.language,
            finished: u.finished,
            aborted: u.aborted,
            record_id: u.record_id ?? undefined,
          })),
          monitors: r.monitors,
        }));
        setRooms(updatedRooms);

        // 如果当前在查看某个房间，更新该房间数据
        if (roomId) {
          const currentRoom = updatedRooms.find(r => r.roomid === roomId);
          if (currentRoom) {
            setRoomData(currentRoom);
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [roomId]);

  // 手动刷新（备用）
  const refresh = useCallback(async () => {
    if (roomId) {
      try {
        const data = await apiService.getAdminRooms();
        if (data.ok) {
          const foundRoom = data.rooms.find(r => r.roomid === roomId);
          if (foundRoom) {
            setRoomData(foundRoom);
          }
        }
      } catch (error) {
        console.error('Failed to refresh room data:', error);
      }
    }
  }, [roomId]);

  return {
    isConnected,
    roomData,
    rooms,
    refresh,
  };
}
