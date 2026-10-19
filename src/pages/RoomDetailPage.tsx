import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
  ArrowLeft, 
  Users, 
  Crown, 
  Gamepad2, 
  Music,
  RefreshCw,
  Trash2,
  MessageSquare,
  Settings,
  ExternalLink,
  Loader2,
  User,
  Send,
  Check,
  Hourglass
} from 'lucide-react';
import { useRoomDetail } from '@/hooks/useRoomDetail';
import { useUserInfo } from '@/hooks/useUserInfo';
import { useChartInfo } from '@/hooks/useChartInfo';
import { StateBadge } from '@/components/StateBadge';
import { DifficultyBadge } from '@/components/DifficultyBadge';
import { ConnectionStatus, WebSocketStatus } from '@/components/ConnectionStatus';
import { disbandRoomDialog, maxUsersDialog } from '@/lib/dialogs';
import { formatRks, formatTime } from '@/lib/formatters';
import { getGameStateText } from '@/lib/ui-helpers';
import { classifyLog } from '@/lib/log-classifier';
import { UserDetailDialog } from '@/components/UserDetailDialog';
import { ChartDetailDialog } from '@/components/ChartDetailDialog';
import { GameResultsDialog } from '@/components/GameResultsDialog';

export function RoomDetailPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [chartDialogOpen, setChartDialogOpen] = useState(false);
  const [gameResultsOpen, setGameResultsOpen] = useState(false);
  const [gameFinishedPlayers, setGameFinishedPlayers] = useState<{ userId: number; userName: string; recordId?: number }[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // 使用自定义 Hooks
  const {
    room,
    isLoading,
    error,
    wsConnected,
    wsSubscribed,
    chatMessages,
    fetchRoomDetail,
    sendMessage,
    disbandRoom,
    setMaxUsers,
  } = useRoomDetail(roomId, {
    onGameEnd: (players) => {
      setGameFinishedPlayers(players);
      setGameResultsOpen(true);
    },
  });

  const { userInfo: hostInfo, isLoading: loadingHost } = useUserInfo(room?.host?.id, {
    enabled: !!room?.host?.id,
  });

  const { chartInfo, isLoading: loadingChart } = useChartInfo(room?.chart?.id, {
    enabled: !!room?.chart?.id,
  });

  // 自动滚动到最新消息
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleDisbandRoom = async () => {
    if (!roomId) return;

    const confirmed = await disbandRoomDialog(roomId);
    if (!confirmed) return;

    const success = await disbandRoom();
    if (success) {
      navigate('/admin/rooms');
    }
  };

  const handleSendRoomChat = async () => {
    if (!message) {
      return;
    }
    const success = await sendMessage(message);
    if (success) {
      setMessage('');
    }
  };

  const handleOpenUserDetail = (userId: number) => {
    setSelectedUserId(userId);
    setUserDialogOpen(true);
  };

  const handleOpenChartDetail = () => {
    if (room?.chart?.id) {
      setChartDialogOpen(true);
    }
  };

  const handleOpenHostProfile = () => {
    if (room?.host?.id) {
      window.open(`https://phira.moe/user/${room.host.id}`, '_blank');
    }
  };

  const handleSetMaxUsers = async () => {
    if (!room) return;
    
    const result = await maxUsersDialog(room.max_users);
    if (result.isConfirmed && result.value !== undefined) {
      await setMaxUsers(result.value);
    }
  };

  if (error && !room) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md text-center">
          <RefreshCw className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </Button>
            <Button size="sm" onClick={() => fetchRoomDetail()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              重试
            </Button>
          </div>
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => navigate('/admin/rooms')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回
              </Button>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold sm:text-xl">房间详情</h1>
                <p className="truncate text-sm text-muted-foreground">{room.roomid}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StateBadge state={room.state.type} />
              {room.locked && <Badge variant="destructive">锁定</Badge>}
              {room.cycle && <Badge variant="outline">循环</Badge>}
              <WebSocketStatus wsSubscribed={wsSubscribed} wsConnected={wsConnected} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* 第一行：房间概览(2列) + 房间操作(1列) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* 左侧：房间概览（占2列） */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gamepad2 className="h-5 w-5" />
                  房间概览
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 第一排：人数相关 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div 
                    className="p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors group"
                    onClick={handleSetMaxUsers}
                  >
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      最大人数
                      <Settings className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-lg font-semibold">{room.max_users}</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">当前玩家</div>
                    <div className="text-lg font-semibold">{room.users?.length || 0}</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">观战者</div>
                    <div className="text-lg font-semibold">{room.monitors?.length || 0}</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">Live</div>
                    <div className="text-lg font-semibold">{room.live ? '是' : '否'}</div>
                  </div>
                </div>

                {/* 第二排：状态相关 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">锁定状态</div>
                    <div className="text-lg font-semibold">{room.locked ? '已锁定' : '未锁定'}</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">循环模式</div>
                    <div className="text-lg font-semibold">{room.cycle ? '开启' : '关闭'}</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">实时更新</div>
                    <div className={`text-lg font-semibold ${wsSubscribed ? 'text-green-600' : wsConnected ? 'text-yellow-600' : 'text-gray-400'}`}>
                      {wsSubscribed ? '已连接' : wsConnected ? '未授权' : '未连接'}
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">房间状态</div>
                    <div className="text-lg font-semibold">
                      {getGameStateText(room.state.type)}
                    </div>
                  </div>
                </div>

                {room.state?.type === 'waiting_for_ready' && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="text-sm font-medium">准备状态</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                          <div className="text-sm text-green-600 dark:text-green-400">已准备</div>
                          <div className="text-lg font-semibold">{room.state.ready_count || 0}</div>
                        </div>
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                          <div className="text-sm text-yellow-600 dark:text-yellow-400">未准备</div>
                          <div className="text-lg font-semibold">{(room.users?.length || 0) - (room.state.ready_count || 0)}</div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {room.state?.type === 'playing' && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="text-sm font-medium">游戏进度</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                          <div className="text-sm text-green-600 dark:text-green-400">已完成</div>
                          <div className="text-lg font-semibold">{room.state.finished_users?.length || 0}</div>
                        </div>
                        <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                          <div className="text-sm text-red-600 dark:text-red-400">已中止</div>
                          <div className="text-lg font-semibold">{room.state.aborted_users?.length || 0}</div>
                        </div>
                      </div>
                      {room.state.results_count !== undefined && (
                        <div className="text-sm text-muted-foreground">
                          已上传成绩: {room.state.results_count} / 中止: {room.state.aborted_count || 0}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 右侧：房间操作（占1列） */}
          <div>
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  房间操作
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
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleSetMaxUsers}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  设置最大人数
                </Button>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleDisbandRoom}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  解散房间
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 第二行：房主信息(1列) + 谱面信息(1列) + 玩家列表(1列) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* 房主信息 */}
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                房主信息
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHost ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : hostInfo ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={hostInfo.avatar} alt={hostInfo.name} />
                      <AvatarFallback>{hostInfo.name?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{hostInfo.name}</div>
                      <div className="text-sm text-muted-foreground">ID: {hostInfo.id}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2 bg-muted rounded text-center">
                      <div className="text-muted-foreground text-xs">RKS</div>
                      <div className="font-semibold">{formatRks(hostInfo.rks)}</div>
                    </div>
                    <div className="p-2 bg-muted rounded text-center">
                      <div className="text-muted-foreground text-xs">粉丝</div>
                      <div className="font-semibold">{hostInfo.follower_count}</div>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={handleOpenHostProfile}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    访问主页
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="font-medium">{room.host?.name || '未知'}</div>
                  <div className="text-sm">ID: {room.host?.id || '-'}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 谱面信息 */}
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="h-5 w-5" />
                谱面信息
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingChart ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : chartInfo ? (
                <div className="space-y-4">
                  {chartInfo.illustration && (
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                      <img
                        src={chartInfo.illustration}
                        alt={chartInfo.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div>
                    <div className="font-medium">{chartInfo.name}</div>
                    <div className="text-sm">
                      <DifficultyBadge difficulty={chartInfo.difficulty} level={chartInfo.level} />
                    </div>
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="text-muted-foreground">谱师: {chartInfo.charter}</div>
                    <div className="text-muted-foreground">曲师: {chartInfo.composer}</div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={handleOpenChartDetail}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    查看详情
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {room.chart?.name || '未选择谱面'}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 玩家列表 */}
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                玩家列表 ({room.users?.length || 0})
                {room.state?.type === 'waiting_for_ready' && room.state?.ready_count !== undefined && (
                  <Badge variant="secondary" className="ml-2">
                    {room.state.ready_count}/{room.users?.length || 0} 已准备
                  </Badge>
                )}
                {room.state?.type === 'playing' && room.state?.finished_users !== undefined && (
                  <Badge variant="default" className="ml-2">
                    {room.state.finished_users?.length || 0}/{room.users?.length || 0} 已完成
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {room.users?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  暂无玩家
                </div>
              ) : (
                <ScrollArea className="h-[280px]">
                  <div className="space-y-2">
                    {room.users?.map((user) => {
                      const isReady = room.state?.ready_users?.includes(user.id);
                      const isFinished = room.state?.finished_users?.includes(user.id);
                      const isAborted = room.state?.aborted_users?.includes(user.id);
                      return (
                        <div
                          key={user.id}
                          className="p-2 border rounded-lg flex items-center justify-between hover:border-primary/50 transition-colors cursor-pointer group"
                          onClick={() => handleOpenUserDetail(user.id)}
                        >
                          <div className="flex items-center gap-2">
                            <ConnectionStatus connected={user.connected} showIconOnly />
                            <div>
                              <div className="font-medium flex items-center gap-1">
                                {user.name}
                                {user.is_host && (
                                  <Crown className="h-3 w-3 text-yellow-500" />
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ID: {user.id}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* 准备状态 */}
                            {room.state?.type === 'waiting_for_ready' && (
                              isReady ? (
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
                            {/* 游戏状态 */}
                            {room.state?.type === 'playing' && (
                              isFinished ? (
                                <Badge variant="default" className="bg-green-500 text-white">
                                  <Check className="h-3 w-3 mr-1" />
                                  已上传成绩
                                </Badge>
                              ) : isAborted ? (
                                <Badge variant="destructive">
                                  已中止
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                  <Hourglass className="h-3 w-3 mr-1" />
                                  未上传成绩
                                </Badge>
                              )
                            )}
                            {/* 在线状态 */}
                            <ConnectionStatus connected={user.connected} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 第三行：公屏消息(2列) + 发送消息(1列) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：公屏消息（占2列） */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  公屏消息 ({chatMessages.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  ref={chatScrollRef}
                  className="h-[300px] overflow-y-auto space-y-2 pr-2"
                >
                  {chatMessages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      暂无消息
                    </div>
                  ) : (
                    chatMessages.map((msg, index) => {
                      const cls = classifyLog(msg.message);
                      const Icon = cls.icon;
                      return (
                        <div
                          key={index}
                          className={`px-3 py-2 rounded-md ${cls.containerClass}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className={`h-3.5 w-3.5 shrink-0 ${cls.iconClass}`} />
                            <span className={`font-medium text-sm ${cls.speakerClass}`}>
                              {cls.type === 'chat' ? cls.speaker : cls.label}
                            </span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {formatTime(msg.timestamp)}
                            </span>
                          </div>
                          <div className="text-sm break-words leading-relaxed">
                            {cls.body}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右侧：发送消息（占1列） */}
          <div>
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  发送消息
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <textarea
                  className="w-full min-h-[200px] p-3 border rounded-md text-sm resize-none"
                  placeholder="输入消息内容（1-200字符）"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={200}
                />
                <Button 
                  className="w-full" 
                  onClick={handleSendRoomChat}
                  disabled={!message}
                >
                  <Send className="h-4 w-4 mr-2" />
                  发送消息
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* 用户详情弹窗 */}
      <UserDetailDialog
        userId={selectedUserId || 0}
        open={userDialogOpen}
        onOpenChange={setUserDialogOpen}
      />

      {/* 谱面详情弹窗 */}
      {room.chart?.id && (
        <ChartDetailDialog
          chartId={room.chart.id}
          open={chartDialogOpen}
          onOpenChange={setChartDialogOpen}
        />
      )}

      {/* 游戏结束成绩统计弹窗 */}
      <GameResultsDialog
        open={gameResultsOpen}
        onOpenChange={setGameResultsOpen}
        playerRecordIds={gameFinishedPlayers}
      />
    </div>
  );
}
