import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  ArrowLeft,
  Users,
  Crown,
  Gamepad2,
  Music,
  Lock,
  Unlock,
  RefreshCw,
  Globe,
  Radio,
  Check,
  Hourglass,
} from 'lucide-react';
import { usePublicRoom } from '@/hooks/usePublicRoom';
import { StateBadge } from '@/components/StateBadge';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { UserDetailDialog } from '@/components/UserDetailDialog';
import { ChartDetailDialog } from '@/components/ChartDetailDialog';
import { classifyLog } from '@/lib/log-classifier';
import { formatTime } from '@/lib/formatters';

export function PublicRoomDetailPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [selectedChartId, setSelectedChartId] = useState<number | null>(null);
  const [chartDialogOpen, setChartDialogOpen] = useState(false);

  const { room, isLoading, error, wsConnected, wsLogs, fetchRoomDetail } = usePublicRoom(roomId);

  const handleOpenUserDetail = (userId: number) => {
    setSelectedUserId(userId);
    setUserDialogOpen(true);
  };

  const handleOpenChartDetail = (chartId: number) => {
    setSelectedChartId(chartId);
    setChartDialogOpen(true);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" onClick={() => navigate('/player/rooms')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回房间列表
          </Button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className={`h-8 w-8 mx-auto mb-4 ${isLoading ? 'animate-spin' : ''}`} />
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => navigate('/player/rooms')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回
              </Button>
              <div>
                <h1 className="text-xl font-bold">房间详情</h1>
                <p className="text-sm text-muted-foreground">{room.roomid}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StateBadge state={room.state} />
              {room.lock ? (
                <Badge variant="destructive" className="gap-1">
                  <Lock className="h-3 w-3" />
                  锁定
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <Unlock className="h-3 w-3" />
                  开放
                </Badge>
              )}
              <Badge variant={wsConnected ? "default" : "secondary"} className="gap-1">
                <Radio className={`h-3 w-3 ${wsConnected ? 'animate-pulse' : ''}`} />
                {wsConnected ? '实时' : '轮询'}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Globe className="h-3 w-3" />
                访客视图
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：基本信息 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 房间概览 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gamepad2 className="h-5 w-5" />
                  房间概览
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">最大人数</div>
                    <div className="text-lg font-semibold">{room.max_users ?? '-'}</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">当前玩家</div>
                    <div className="text-lg font-semibold">{room.current_users}</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">观战者</div>
                    <div className="text-lg font-semibold">{room.monitors}</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">循环模式</div>
                    <div className="text-lg font-semibold">{room.cycle ? '开启' : '关闭'}</div>
                  </div>
                </div>

                <Separator />

                {/* 房主信息 - 可点击卡片 */}
                <div
                  className="p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors group"
                  onClick={() => handleOpenUserDetail(parseInt(room.host.id, 10))}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Crown className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm text-muted-foreground">房主:</span>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{room.host.name?.[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <span className="font-medium block">{room.host.name}</span>
                          <span className="text-xs text-muted-foreground">ID: {room.host.id}</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      点击查看详情 →
                    </span>
                  </div>
                </div>

                {/* 谱面信息 - 可点击卡片 */}
                <div
                  className={`p-3 bg-muted/50 rounded-lg transition-colors group ${room.chart?.id && room.chart.id !== '0' ? 'cursor-pointer hover:bg-muted' : 'cursor-default opacity-60'}`}
                  onClick={() => {
                    const chartId = parseInt(room.chart?.id, 10);
                    if (!isNaN(chartId) && chartId > 0) {
                      handleOpenChartDetail(chartId);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Music className="h-4 w-4 text-blue-500" />
                      <span className="text-sm text-muted-foreground">当前谱面:</span>
                      <div>
                        <span className="font-medium block">{room.chart?.name || '未选择'}</span>
                        {room.chart?.id && room.chart.id !== '0' && (
                          <span className="text-xs text-muted-foreground">ID: {room.chart.id}</span>
                        )}
                      </div>
                    </div>
                    {room.chart?.id && room.chart.id !== '0' && (
                      <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        点击查看详情 →
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 玩家列表 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  玩家列表 ({room.players?.length || 0})
                  {room.state === 'waiting_for_ready' && room.ready_count !== undefined && (
                    <Badge variant="secondary" className="ml-2">
                      {room.ready_count}/{room.players?.length || 0} 已准备
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {room.players?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    暂无玩家
                  </div>
                ) : (
                  <div className="space-y-2">
                    {room.players_with_ready?.map((player) => (
                      <div
                        key={player.id}
                        className="p-3 border rounded-lg flex items-center justify-between hover:border-primary/50 transition-colors cursor-pointer group"
                        onClick={() => handleOpenUserDetail(player.id)}
                      >
                        <div className="flex items-center gap-3">
                          <ConnectionStatus connected={true} showIconOnly />
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {player.name}
                              {room.host.id === String(player.id) && (
                                <Badge variant="outline" className="text-xs">
                                  <Crown className="h-3 w-3 mr-1 text-yellow-500" />
                                  房主
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              ID: {player.id}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* 准备状态 */}
                          {room.state === 'waiting_for_ready' && (
                            player.is_ready ? (
                              <Badge variant="default" className="bg-green-500 text-white">
                                <Check className="h-3 w-3 mr-1" />
                                已准备
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                <Hourglass className="h-3 w-3 mr-1" />
                                未准备
                              </Badge>
                            )
                          )}
                          {/* 在线状态 */}
                          <ConnectionStatus connected={true} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 右侧：信息面板 */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  操作
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={fetchRoomDetail}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  刷新数据
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  数据每 5 秒自动刷新
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>房间状态</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">锁定状态</span>
                    <span>{room.lock ? '已锁定' : '未锁定'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">循环模式</span>
                    <span>{room.cycle ? '开启' : '关闭'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">当前状态</span>
                    <StateBadge state={room.state} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* WebSocket 日志 */}
            {wsLogs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Radio className="h-4 w-4" />
                    实时日志
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[260px] overflow-y-auto space-y-1.5">
                    {wsLogs.map((log, index) => {
                      const cls = classifyLog(log.message);
                      const Icon = cls.icon;
                      return (
                        <div
                          key={index}
                          className={`px-2.5 py-1.5 rounded-md text-xs ${cls.containerClass}`}
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Icon className={`h-3 w-3 shrink-0 ${cls.iconClass}`} />
                            <span className={`font-medium ${cls.speakerClass}`}>
                              {cls.type === 'chat' ? cls.speaker : cls.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {formatTime(log.timestamp)}
                            </span>
                          </div>
                          <div className="break-words leading-snug">{cls.body}</div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 提示信息 */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-sm text-blue-600 dark:text-blue-400">
                <Globe className="h-4 w-4 inline mr-1" />
                这是访客视图，仅显示公开信息。
                如需查看完整房间信息（如观战者、游戏进度、历史记录等），请使用管理员账号登录。
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* 用户详情弹窗 - 访客模式（只读） */}
      <UserDetailDialog
        userId={selectedUserId || 0}
        open={userDialogOpen}
        onOpenChange={setUserDialogOpen}
        readOnly={true}
      />

      {/* 谱面详情弹窗 */}
      {selectedChartId && (
        <ChartDetailDialog
          chartId={selectedChartId}
          open={chartDialogOpen}
          onOpenChange={setChartDialogOpen}
        />
      )}
    </div>
  );
}
