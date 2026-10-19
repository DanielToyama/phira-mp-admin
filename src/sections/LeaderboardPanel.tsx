import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  RefreshCw,
  Trophy,
} from 'lucide-react';
import { apiService } from '@/services/api';
import { phiraApiService, type UserDetailInfo } from '@/services/phiraApi';
import { applyApiConfig } from '@/hooks/useApiConfig';
import type { LeaderboardEntry } from '@/types/api';

/** 每页条数（滚动到底部自动加载下一页） */
const PAGE_SIZE = 30;

/** 前三名用不同颜色高亮 */
function rankClass(rank: number): string {
  const base = 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold';
  if (rank === 1) return `${base} bg-amber-400/20 text-amber-600 dark:text-amber-400`;
  if (rank === 2) return `${base} bg-slate-400/20 text-slate-600 dark:text-slate-300`;
  if (rank === 3) return `${base} bg-orange-400/20 text-orange-600 dark:text-orange-400`;
  return `${base} bg-muted text-muted-foreground`;
}

function StatCell({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-muted/60 p-3">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {hint && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label={`${label}说明`} className="cursor-help underline decoration-dotted">
                ?
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-center">
              {hint}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

export function LeaderboardPanel() {
  const [players, setPlayers] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [profiles, setProfiles] = useState<Map<number, UserDetailInfo | null>>(new Map());
  const [profilesLoading, setProfilesLoading] = useState<Set<number>>(new Set());
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const inFlightRef = useRef(false);

  const fetchPage = useCallback(async (offset: number, replace: boolean) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    setError('');
    try {
      if (!apiService.getBaseUrl()) applyApiConfig();
      const data = await apiService.getLeaderboard(offset, PAGE_SIZE);
      if (!data?.ok) throw new Error('服务端返回异常');
      setTotal(data.total);
      setPlayers((prev) => (replace ? data.players : [...prev, ...data.players]));
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取排行失败');
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  // 首次加载 / 刷新
  const reload = useCallback(() => {
    setExpanded(new Set());
    void fetchPage(0, true);
  }, [fetchPage]);

  useEffect(() => {
    void fetchPage(0, true);
  }, [fetchPage]);

  const hasMore = players.length < total;

  // 滚动到底部自动加载下一页
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((it) => it.isIntersecting)) {
          void fetchPage(players.length, false);
        }
      },
      { rootMargin: '240px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchPage, hasMore, loading, players.length]);

  // 展开时按需拉取 Phira 主站资料（rks / 粉丝 / 头像）
  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (profiles.has(id) || profilesLoading.has(id)) return;
    setProfilesLoading((prev) => new Set(prev).add(id));
    void phiraApiService
      .getUserInfoCached(id)
      .then((info) => setProfiles((prev) => new Map(prev).set(id, info)))
      .catch(() => setProfiles((prev) => new Map(prev).set(id, null)))
      .finally(() =>
        setProfilesLoading((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        })
      );
  };

  return (
    <div className="flex flex-1 flex-col space-y-4 animate-fade-in">
      <Card className="flex flex-1 flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            游玩排行
            {total > 0 && (
              <Badge variant="secondary" className="ml-1">
                共 {total} 人
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">
            按在本服务器完成的对局次数排名，展开可查看 Phira 资料与平均表现
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={reload}
              disabled={loading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col">
          {error && (
            <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {players.length === 0 && !loading ? (
            <div className="flex flex-1 items-center justify-center py-12 text-center text-muted-foreground">
              {error ? '加载失败，请点击刷新重试' : '暂无排行数据，服务器上完成对局后就会出现在这里'}
            </div>
          ) : (
            <div className="space-y-2">
              {players.map((p, index) => {
                const rank = index + 1;
                const isOpen = expanded.has(p.id);
                const profile = profiles.get(p.id);
                const isLoadingProfile = profilesLoading.has(p.id);
                return (
                  <div
                    key={p.id}
                    className="rounded-lg border transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-center gap-2 p-3 sm:gap-3">
                      <span className={rankClass(rank)}>{rank}</span>

                      <Avatar className="h-9 w-9 shrink-0">
                        {profile?.avatar && <AvatarImage src={profile.avatar} alt={p.name} />}
                        <AvatarFallback>{p.name?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{p.name}</div>
                        {/* 窄屏把次数并到 ID 后面：单列宽度不够，右侧独立列会把两边都截断 */}
                        <div className="truncate text-xs text-muted-foreground sm:hidden">
                          {p.id} · <span className="font-semibold text-primary">{p.plays}</span> 次
                        </div>
                        <div className="hidden truncate text-xs text-muted-foreground sm:block">
                          ID: {p.id}
                        </div>
                      </div>

                      <div className="hidden shrink-0 text-right sm:block">
                        <div className="font-semibold text-primary">{p.plays}</div>
                        <div className="whitespace-nowrap text-xs text-muted-foreground">次游玩</div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={isOpen ? '收起详情' : '展开详情'}
                              onClick={() => toggleExpand(p.id)}
                            >
                              {isOpen ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">{isOpen ? '收起详情' : '展开详情'}</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" asChild>
                              <a
                                href={`https://phira.moe/user/${p.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`在 Phira 打开 ${p.name} 的主页`}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">在 Phira 打开个人主页</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="border-t p-3">
                        {isLoadingProfile ? (
                          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            正在获取 Phira 资料...
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <StatCell
                              label="RKS"
                              value={profile ? profile.rks.toFixed(4) : '-'}
                              hint="来自 Phira 主站的个人资料"
                            />
                            <StatCell
                              label="粉丝"
                              value={profile ? String(profile.follower_count) : '-'}
                              hint="来自 Phira 主站的个人资料"
                            />
                            <StatCell
                              label="平均准度"
                              value={`${(p.avg_accuracy * 100).toFixed(2)}%`}
                              hint="本服务器上每局结算 accuracy 的平均值"
                            />
                            <StatCell
                              label="平均分数"
                              value={p.avg_score.toLocaleString()}
                              hint="本服务器上每局结算分数的平均值"
                            />
                          </div>
                        )}
                        {!isLoadingProfile && !profile && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            未能获取该玩家的 Phira 资料（可能是主站接口不可用或该用户不存在）
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 滚动加载哨兵 */}
              <div ref={sentinelRef} className="h-px" aria-hidden="true" />

              {loading && players.length > 0 && (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在加载...
                </div>
              )}

              {!hasMore && players.length > 0 && (
                <div className="py-4 text-center text-xs text-muted-foreground">已经到底了</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
