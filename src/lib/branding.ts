/**
 * 户山兔兔 · Phira 服务器面板
 * 品牌与默认配置集中在此，方便后续统一修改。
 */

export const BRAND = {
  /** 面板名称（顶栏主标题） */
  name: '户山兔兔 Phira',
  /** 顶栏副标题 */
  subtitle: '多人联机面板',
  /** 站点标题（浏览器标签页） */
  pageTitle: '户山兔兔的 Phira 服务器面板',
  /** 主人昵称 */
  owner: '户山兔兔',
  /** 主站 */
  siteUrl: 'https://danieluu.top',
  /** 服务器状态页（原版监控页） */
  statusUrl: 'https://iphira.danieluu.top/',
  /** 本面板（游玩记录 / 游玩排行 / 回放查询）的线上地址 */
  panelUrl: 'https://tphira.danieluu.top/',
  /** Uptime Kuma 状态接口（提供心跳数据，用于渲染可用性格子） */
  statusApiUrl: 'https://kumaphira.danieluu.top/api',
  /** 游戏内联机地址 */
  joinAddress: 'phira.Danieluu.top:26638',
  /** 交流群 */
  groups: [
    { label: 'Phigros ①群', url: 'https://qm.qq.com/q/yk0LNRNFKi' },
    { label: 'Phigros ②群', url: 'https://qm.qq.com/q/REhwVaZSIC' },
  ],
} as const;

/**
 * 默认 API 地址（后端 HTTP 服务根路径）。
 * 面板首次打开会自动写入此地址，无需手动配置。
 */
export const DEFAULT_API_BASE_URL = 'https://p.danieluu.top:39000/phira';

/** 默认配置在「已保存配置」列表中的展示名 */
export const DEFAULT_CONFIG_NAME = '户山兔兔 Phira 服务器';

const DEFAULT_CONFIG_ID = 'default-server';

/**
 * 首次访问时写入默认 API 配置。
 * 若用户已自行配置过，则不做任何改动。
 */
export function seedDefaultApiConfig(): void {
  try {
    if (localStorage.getItem('api_base_url')) return;

    localStorage.setItem('api_base_url', DEFAULT_API_BASE_URL);

    const existingRaw = localStorage.getItem('api_saved_configs_v2');
    const existing = existingRaw ? JSON.parse(existingRaw) : [];
    const configs = Array.isArray(existing) ? existing : [];

    if (!configs.some((c: { id?: string }) => c?.id === DEFAULT_CONFIG_ID)) {
      configs.unshift({
        id: DEFAULT_CONFIG_ID,
        name: DEFAULT_CONFIG_NAME,
        baseUrl: DEFAULT_API_BASE_URL,
        createdAt: Date.now(),
      });
    }

    localStorage.setItem('api_saved_configs_v2', JSON.stringify(configs));
    localStorage.setItem('api_config_id', DEFAULT_CONFIG_ID);
  } catch {
    // localStorage 不可用时静默跳过，用户仍可手动配置
  }
}
