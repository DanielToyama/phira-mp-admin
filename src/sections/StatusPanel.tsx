import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, Loader2, RefreshCw } from 'lucide-react';
import { BRAND } from '@/lib/branding';

/** Uptime Kuma 的单条心跳 */
type Heartbeat = {
  status: number;
  time: string;
  msg?: string;
  ping?: number | null;
};

type KumaPayload = {
  serverId?: string;
  heartbeatList?: Record<string, Heartbeat[]>;
  uptimeList?: Record<string, number>;
};

/** 格子最小宽度（px）与间距（px），用于按可用宽度决定显示多少格 */
const MIN_BEAT_PX = 6;
const BEAT_GAP_PX = 2;

/** 心跳块配色：1=在线(绿) 2=降级(黄) 其他=离线(红)，与原站保持一致 */
function beatClass(status: number): string {
  if (status === 1) return 'bg-[#48cfad]';
  if (status === 2) return 'bg-[#f6bb42]';
  return 'bg-[#ed5565]';
}

/** 把 Kuma 的 "YYYY-MM-DD HH:mm:ss" 转成相对时间文案 */
function formatRelativeTime(time: string): string {
  if (!time) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(time);
  if (!m) return time;
  const target = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6] ?? 0)
  );
  const diffMs = Date.now() - target.getTime();
  if (diffMs < 0) return '刚刚';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

/**
 * 单个服务的状态卡。
 *
 * 格子按容器宽度自适应：宽屏下每格 flex-1 撑满整行（不会留白），
 * 窄屏下只保留最近的若干格，避免折成两行。
 */
function ServiceCard({ serviceId, beats }: { serviceId: string; beats: Heartbeat[] }) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const update = () => setBarWidth(el.getBoundingClientRect().width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const onlineCount = beats.filter((b) => b.status === 1).length;
  const uptime = beats.length > 0 ? onlineCount / beats.length : 0;

  // 按可用宽度算出最多能放多少格，超出部分只保留最近的
  const maxBeats =
    barWidth > 0
      ? Math.max(1, Math.floor((barWidth + BEAT_GAP_PX) / (MIN_BEAT_PX + BEAT_GAP_PX)))
      : beats.length;
  const shown = beats.length > maxBeats ? beats.slice(-maxBeats) : beats;
  const hiddenCount = beats.length - shown.length;

  return (
    <Card className="card-soft">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-lg font-semibold">在线状态</span>
          <Badge
            title="可用率（按最近的心跳记录计算）"
            className="rounded-full bg-primary px-3 py-1 text-primary-foreground"
          >
            {(uptime * 100).toFixed(1)}%
          </Badge>
        </div>

        {/* 绿格子：每次探测一个方块，宽屏自动加宽铺满 */}
        <div ref={barRef} className="mt-3 flex min-h-[24px] flex-nowrap gap-0.5">
          {shown.map((beat, i) => (
            <div
              key={`${serviceId}-${i}`}
              title={`${beat.time}${beat.ping ? ` · ${beat.ping}ms` : ''}${beat.msg ? ` · ${beat.msg}` : ''}`}
              className={`h-6 min-w-[6px] flex-1 rounded-sm transition-transform hover:scale-y-125 ${beatClass(beat.status)}`}
            />
          ))}
        </div>

        {beats.length > 0 && (
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>{formatRelativeTime(shown[0]!.time)}</span>
            <span>{formatRelativeTime(shown[shown.length - 1]!.time)}</span>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>
            共 {beats.length} 次探测 · 在线 {onlineCount} 次
          </span>
          {beats.length > 0 && <span>最近延迟 {beats[beats.length - 1]!.ping ?? '-'} ms</span>}
          {hiddenCount > 0 && <span>已隐藏较早的 {hiddenCount} 次探测</span>}
        </div>
      </CardContent>
    </Card>
  );
}

export function StatusPanel() {
  const [heartbeats, setHeartbeats] = useState<Record<string, Heartbeat[]> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(BRAND.statusApiUrl, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`状态接口返回 ${res.status}`);
      const data = (await res.json()) as KumaPayload;
      const list = data?.heartbeatList;
      if (!list || Object.keys(list).length === 0) {
        setHeartbeats({});
        setError('没有可用的服务状态数据');
        return;
      }
      setHeartbeats(list);
    } catch (e) {
      setHeartbeats(null);
      setError(e instanceof Error ? e.message : '无法加载服务状态数据');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const serviceIds = heartbeats ? Object.keys(heartbeats) : [];

  return (
    <div className="flex flex-1 flex-col space-y-4 animate-fade-in">
      <Card className="flex flex-1 flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            服务器状态
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">
            基于 Uptime Kuma 的监控数据，每个格子代表一次探测（绿=在线 / 黄=降级 / 红=离线）
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
            </div>
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {loading && !heartbeats && (
            <div className="flex flex-1 items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在加载服务状态...
            </div>
          )}

          {serviceIds.map((serviceId) => (
            <ServiceCard key={serviceId} serviceId={serviceId} beats={heartbeats?.[serviceId] ?? []} />
          ))}

          {!loading && !error && serviceIds.length === 0 && (
            <div className="flex flex-1 items-center justify-center py-12 text-center text-muted-foreground">
              暂无服务状态数据
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
