import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatTiles } from '@/components/StatTiles';
import { applyApiConfig } from '@/hooks/useApiConfig';
import { getStateBadgeConfig } from '@/lib/utils';
import { apiService } from '@/services/api';
import { phiraApiService } from '@/services/phiraApi';
import { toast } from 'sonner';
import { Gamepad2, Globe, LayoutGrid, Lock, RefreshCw, Repeat, Search, Users, X } from 'lucide-react';

import type { ChartInfo } from '@/services/phiraApi';
import type { PublicRoom } from '@/types/api';

type RankedRoom = {
  room: PublicRoom;
  index: number;
  score: number;
};

export function RoomQueryPanel() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [chartInfos, setChartInfos] = useState<Map<number, ChartInfo>>(new Map());
  const hasAutoFetched = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadChartInfo = useCallback(async (chartId: number) => {
    const info = await phiraApiService.getChartInfoCached(chartId);
    if (info) {
      setChartInfos(prev => new Map(prev).set(chartId, info));
    }
    return info;
  }, []);

  const fetchRooms = useCallback(async () => {
    const config = apiService.getConfig();
    if (!config.baseUrl) {
      toast.error('请先配置 API 地址');
      return;
    }

    setLoading(true);
    try {
      const data = await apiService.getRooms();
      const roomsData = data.rooms || [];
      setRooms(roomsData);

      roomsData.forEach(room => {
        if (room.chart?.id) {
          loadChartInfo(Number(room.chart.id));
        }
      });

      const playerCount = roomsData.reduce((sum, room) => sum + (room.players?.length || 0), 0);
      toast.success(`获取到 ${roomsData.length} 个房间，共 ${playerCount} 名玩家`);
    } catch {
      toast.error('获取房间列表失败');
    } finally {
      setLoading(false);
    }
  }, [loadChartInfo]);

  useEffect(() => {
    applyApiConfig();

    const hasUrlConfig = searchParams.has('api_url') || searchParams.has('admin_token');
    const savedUrl = localStorage.getItem('api_base_url') || '';

    if (savedUrl && !hasAutoFetched.current && !hasUrlConfig) {
      hasAutoFetched.current = true;
      fetchRooms();
    }
  }, [fetchRooms, searchParams]);

  useEffect(() => {
    const handleUrlConfigRoomsLoaded = (event: CustomEvent<PublicRoom[]>) => {
      const roomsData = event.detail;
      setRooms(roomsData);
      hasAutoFetched.current = true;

      roomsData.forEach(room => {
        if (room.chart?.id) {
          loadChartInfo(Number(room.chart.id));
        }
      });
    };

    window.addEventListener('urlConfigRoomsLoaded', handleUrlConfigRoomsLoaded as EventListener);
    return () => {
      window.removeEventListener('urlConfigRoomsLoaded', handleUrlConfigRoomsLoaded as EventListener);
    };
  }, [loadChartInfo]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const getStateBadge = (state: string) => {
    const config = getStateBadgeConfig(state);
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const rankRoom = (room: PublicRoom, index: number): RankedRoom | null => {
    if (!normalizedQuery) {
      return { room, index, score: 0 };
    }

    const roomId = room.roomid?.toLowerCase() || '';
    const playerNames = room.players?.map(player => player.name?.toLowerCase() || '') || [];
    const playerIds = room.players?.map(player => String(player.id)) || [];
    const chartId = room.chart?.id ? String(room.chart.id).toLowerCase() : '';
    const chartName = room.chart?.name?.toLowerCase() || '';
    const chartInfo = room.chart?.id ? chartInfos.get(Number(room.chart.id)) : undefined;
    const cachedChartId = chartInfo ? String(chartInfo.id).toLowerCase() : '';
    const cachedChartName = chartInfo?.name?.toLowerCase() || '';

    let score = -1;

    if (roomId === normalizedQuery) score = Math.max(score, 400);
    else if (roomId.startsWith(normalizedQuery)) score = Math.max(score, 320);
    else if (roomId.includes(normalizedQuery)) score = Math.max(score, 260);

    if (playerIds.some(id => id === normalizedQuery) || playerNames.some(name => name === normalizedQuery)) {
      score = Math.max(score, 180);
    } else if (
      playerIds.some(id => id.includes(normalizedQuery)) ||
      playerNames.some(name => name.includes(normalizedQuery))
    ) {
      score = Math.max(score, 140);
    }

    if (
      chartId === normalizedQuery ||
      cachedChartId === normalizedQuery ||
      chartName === normalizedQuery ||
      cachedChartName === normalizedQuery
    ) {
      score = Math.max(score, 110);
    } else if (
      chartId.includes(normalizedQuery) ||
      cachedChartId.includes(normalizedQuery) ||
      chartName.includes(normalizedQuery) ||
      cachedChartName.includes(normalizedQuery)
    ) {
      score = Math.max(score, 90);
    }

    if (score < 0) {
      return null;
    }

    return { room, index, score };
  };

  const filteredRooms = normalizedQuery
    ? rooms
        .map((room, index) => rankRoom(room, index))
        .filter((item): item is RankedRoom => item !== null)
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .map(item => item.room)
    : rooms;

  const visiblePlayerCount = filteredRooms.reduce((sum, room) => sum + (room.players?.length || 0), 0);
  const totalPlayers = rooms.reduce((sum, room) => sum + (room.players?.length || 0), 0);
  const playingCount = rooms.filter((room) => room.state === 'playing').length;

  return (
    <div className="flex flex-1 flex-col space-y-4 animate-fade-in">
      {rooms.length > 0 && (
        <StatTiles
          tiles={[
            { label: '总房间', value: rooms.length, icon: LayoutGrid },
            { label: '游戏中', value: playingCount, icon: Gamepad2, accent: 'text-green-600' },
            { label: '在线玩家', value: totalPlayers, icon: Users },
          ]}
          className="sm:grid-cols-3"
        />
      )}
      <Card className="flex flex-1 flex-col">
        <CardHeader>
          {/* 标题列用 auto 而不是 1fr：768px 时搜索框会抢走全部宽度，把标题挤成竖排 */}
          <CardTitle className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <Users className="h-5 w-5 shrink-0" />
              房间列表
              {rooms.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {filteredRooms.length}/{rooms.length} 个房间
                </Badge>
              )}
            </div>

            <div className="mx-auto flex w-full max-w-xl items-center justify-center">
              <div className="relative w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  placeholder="搜索房间ID，或玩家名字/ID、谱面名字/ID"
                  className="h-10 pl-9 pr-20"
                />
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
                  {searchQuery && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => {
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      title="清空搜索"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  <KbdGroup className="hidden sm:inline-flex">
                    <Kbd>Ctrl</Kbd>
                    <Kbd>K</Kbd>
                  </KbdGroup>
                </div>
              </div>
            </div>

            <div className="flex justify-start md:justify-end">
              <Button size="sm" onClick={fetchRooms} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
            </div>
          </CardTitle>

          <CardDescription className="flex flex-wrap items-center gap-2">
            <span>获取当前所有房间的基本信息</span>
            {rooms.length > 0 && (
              <span className="text-muted-foreground">| 当前显示玩家数: {visiblePlayerCount} 人</span>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col">
          {rooms.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-8 text-center text-muted-foreground">
              暂无房间数据，点击刷新获取
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              没有找到匹配的房间，可尝试搜索房间ID、玩家名字或谱面信息
            </div>
          ) : (
            <>
              {/* 移动端：堆叠卡片 */}
              <div className="space-y-2 sm:hidden">
                {filteredRooms.map((room, index) => {
                  const chartId = Number(room.chart?.id);
                  const chartInfo = chartInfos.get(chartId);

                  // 隐私房间：只显示灰块，不可点击、不暴露任何信息
                  if (room.hidden) {
                    return (
                      <div
                        key={`hidden-${index}`}
                        className="rounded-lg border border-dashed bg-muted/50 p-3 text-muted-foreground"
                      >
                        <div className="flex items-center gap-2">
                          <Lock className="h-4 w-4" />
                          <span className="font-medium">*隐藏的房间*</span>
                        </div>
                        <p className="mt-1 text-xs">
                          房主将房间设为隐私，只有知道完整房间号的人才能加入
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={room.roomid}
                      className="cursor-pointer rounded-lg border p-3 transition-colors hover:border-primary/50"
                      onClick={() => navigate(`/public/room/${room.roomid}`)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-medium">{room.roomid}</span>
                        <div className="flex items-center gap-1">
                          {getStateBadge(room.state)}
                          {room.lock && (
                            <Badge variant="destructive" className="gap-1">
                              <Lock className="h-3 w-3" />
                              锁定
                            </Badge>
                          )}
                          {room.cycle && (
                            <Badge variant="outline" className="gap-1">
                              <Repeat className="h-3 w-3" />
                              循环
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                        <div>房主: {room.host?.name || '未知'} (ID: {room.host?.id ?? '-'})</div>
                        <div>
                          谱面:{' '}
                          {chartInfo ? (
                            <span>
                              {chartInfo.name}
                              <span className="ml-1 text-xs text-muted-foreground">[{chartInfo.level}]</span>
                            </span>
                          ) : room.chart?.id && room.chart.id !== '0' ? (
                            room.chart.name || `ID ${room.chart.id}`
                          ) : (
                            <span className="text-muted-foreground">未选择</span>
                          )}
                        </div>
                        <div>玩家: {room.players?.length || 0}</div>
                      </div>
                      <div
                        className="mt-3 flex items-center justify-end gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => navigate(`/public/room/${room.roomid}`)}
                        >
                          <Globe className="h-4 w-4 mr-1" />
                          访客视图
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 桌面端：紧凑表格 */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>房间 ID</TableHead>
                      <TableHead>房主</TableHead>
                      <TableHead>谱面</TableHead>
                      <TableHead className="text-center">玩家</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
              <TableBody>
                {filteredRooms.map((room, index) => {
                  const chartId = Number(room.chart?.id);
                  const chartInfo = chartInfos.get(chartId);
                  const playerNames = room.players?.map((p) => `${p.name} (${p.id})`).join('、');

                  // 隐私房间：灰块行，无点击事件
                  if (room.hidden) {
                    return (
                      <TableRow key={`hidden-${index}`} className="bg-muted/50 text-muted-foreground">
                        <TableCell className="font-medium">*隐藏的房间*</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell className="text-center">-</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="gap-1">
                            <Lock className="h-3 w-3" />
                            隐私
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">-</TableCell>
                      </TableRow>
                    );
                  }

                  return (
                    <TableRow
                      key={room.roomid}
                      className="cursor-pointer"
                      onClick={() => navigate(`/public/room/${room.roomid}`)}
                    >
                      <TableCell className="font-mono font-medium">{room.roomid}</TableCell>
                      <TableCell>
                        <div className="max-w-[140px] truncate">{room.host?.name || '未知'}</div>
                        <div className="text-xs text-muted-foreground">ID: {room.host?.id || '-'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate">
                          {chartInfo ? (
                            <span>
                              {chartInfo.name}
                              <span className="ml-1 text-xs text-muted-foreground">
                                [{chartInfo.level}]
                              </span>
                            </span>
                          ) : room.chart?.id && room.chart.id !== '0' ? (
                            room.chart.name || `ID ${room.chart.id}`
                          ) : (
                            <span className="text-muted-foreground">未选择</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="font-medium" title={playerNames}>
                          {room.players?.length || 0}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getStateBadge(room.state)}
                          {room.lock && (
                            <Badge variant="destructive" className="gap-1">
                              <Lock className="h-3 w-3" />
                              锁定
                            </Badge>
                          )}
                          {room.cycle && (
                            <Badge variant="outline" className="gap-1">
                              <Repeat className="h-3 w-3" />
                              循环
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => navigate(`/public/room/${room.roomid}`)}
                          title="访客视图"
                        >
                          <Globe className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
        </CardContent>
      </Card>
    </div>
  );
}
