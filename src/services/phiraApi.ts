// Phira 官方 API 服务

import type { CurrentUserInfo } from '@/types/api';

export interface PhiraLoginRequest {
  email: string;
  password: string;
}

export interface PhiraLoginResponse {
  id: number;
  token: string;
  refreshToken: string;
  expireAt: string;
}

export interface PhiraLoginError {
  error: string;
}

export interface ChartInfo {
  id: number;
  name: string;
  level: string;
  difficulty: number;
  charter: string;
  composer: string;
  illustrator: string;
  description: string;
  ranked: boolean;
  reviewed: boolean;
  stable: boolean;
  illustration: string;
  preview: string;
  file: string;
  uploader: number;
  tags: string[];
  rating: number;
  ratingCount: number;
  created: string;
  updated: string;
  chartUpdated: string;
}

export interface RecordInfo {
  id: number;
  player: number;
  chart: number;
  score: number;
  accuracy: number;
  perfect: number;
  good: number;
  bad: number;
  miss: number;
  speed: number;
  max_combo: number;
  best: boolean;
  best_std: boolean;
  mods: number;
  full_combo: boolean;
  time: string;
  std: number | null;
  std_score: number | null;
}

export interface UserDetailInfo {
  id: number;
  name: string;
  avatar: string;
  badges: string[];
  language: string;
  bio: string;
  exp: number;
  rks: number;
  joined: string;
  last_login: string;
  roles: number;
  banned: boolean;
  login_banned: boolean;
  follower_count: number;
  following_count: number;
  following: boolean;
}

// 轻量级用户信息（用于用户列表缓存）
export interface UserListItem {
  id: number;
  name: string;
  avatar: string;
}

const PHIRA_API_BASE = 'https://phira.5wyxi.com';

const STORAGE_KEY_TOKEN = 'phira_user_token';
const STORAGE_KEY_USER_ID = 'phira_user_id';
const STORAGE_KEY_USER_LIST = 'phira_user_list_cache';
const STORAGE_KEY_USER_LIST_COUNT = 'phira_user_list_count';
const STORAGE_KEY_USER_LIST_PAGE = 'phira_user_list_page';
const STORAGE_KEY_USER_LIST_TIMESTAMP = 'phira_user_list_timestamp';
/** 登录返回的 TOKEN 过期时间（毫秒时间戳），用于本地判定，避免无谓的网络请求 */
const STORAGE_KEY_TOKEN_EXPIRE = 'phira_token_expire_at';

/** 把登录接口返回的 ISO 过期时间转成毫秒时间戳；无法解析时返回 0（视为未知） */
function parseExpireAt(value: unknown): number {
  if (typeof value !== 'string' || !value) return 0;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

/**
 * 登录态校验结果。
 *
 * - `valid`：TOKEN 有效，附带账号资料
 * - `expired`：TOKEN 已失效（本地过期 / 主站 401 / 资料残缺），此时本地登录信息已被清空
 * - `unknown`：网络异常或主站故障，无法判定，登录态保持不变
 */
export type SessionValidation =
  | { status: 'valid'; profile: CurrentUserInfo }
  | { status: 'expired' }
  | { status: 'unknown' };

class PhiraApiService {
  private userToken: string = '';
  private userId: number = 0;
  /** TOKEN 过期时间（毫秒时间戳），0 表示未知 */
  private tokenExpireAt: number = 0;
  /** 并发调用合并用的进行中校验请求 */
  private sessionInFlight: Promise<SessionValidation> | null = null;

  constructor() {
    // 从 localStorage 加载保存的登录信息
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    
    const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    const savedUserId = localStorage.getItem(STORAGE_KEY_USER_ID);
    const savedExpire = localStorage.getItem(STORAGE_KEY_TOKEN_EXPIRE);

    if (savedToken) {
      this.userToken = savedToken;
    }
    if (savedUserId) {
      this.userId = parseInt(savedUserId, 10);
    }
    if (savedExpire) {
      const t = parseInt(savedExpire, 10);
      if (Number.isFinite(t)) this.tokenExpireAt = t;
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    
    if (this.userToken) {
      localStorage.setItem(STORAGE_KEY_TOKEN, this.userToken);
    } else {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
    }
    
    if (this.userId) {
      localStorage.setItem(STORAGE_KEY_USER_ID, this.userId.toString());
    } else {
      localStorage.removeItem(STORAGE_KEY_USER_ID);
    }

    if (this.tokenExpireAt > 0) {
      localStorage.setItem(STORAGE_KEY_TOKEN_EXPIRE, this.tokenExpireAt.toString());
    } else {
      localStorage.removeItem(STORAGE_KEY_TOKEN_EXPIRE);
    }
  }

  setUserToken(token: string, userId: number = 0, expireAt?: unknown) {
    this.userToken = token;
    if (userId) this.userId = userId;
    const parsed = parseExpireAt(expireAt);
    if (parsed > 0) this.tokenExpireAt = parsed;
    this.saveToStorage();
  }

  getUserToken(): string {
    return this.userToken;
  }

  getUserId(): number {
    return this.userId;
  }

  clearAuth() {
    this.userToken = '';
    this.userId = 0;
    this.tokenExpireAt = 0;
    this.sessionInFlight = null;
    this.saveToStorage();
  }

  /**
   * 拉取当前 TOKEN 对应的账号资料（含邮箱、头像等）。
   *
   * @throws 未登录、请求失败或返回体缺少关键字段时抛错。
   *         需要区分「TOKEN 失效」与「网络/主站异常」时请改用 validateSession()。
   */
  async fetchCurrentUser(): Promise<CurrentUserInfo> {
    if (!this.userToken) throw new Error('user-not-logged-in');
    const response = await fetch(`${PHIRA_API_BASE}/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.userToken}` },
    });
    if (!response.ok) throw new Error(`fetch-me-failed:${response.status}`);
    const data = (await response.json()) as Partial<CurrentUserInfo>;
    if (!data || typeof data.id !== 'number' || !data.name) throw new Error('invalid-profile');
    return data as CurrentUserInfo;
  }

  /**
   * 校验本地登录态是否仍然有效。
   *
   * 判定顺序：
   *   1. 本地保存的过期时间已过 → 直接判失效，不发网络请求；
   *   2. 主站 /me 返回 401/403，或返回体缺少关键字段（id/name，即邮箱头像那套资料）→ 判失效；
   *   3. 主站 5xx、限流、网络异常等 → 归为 unknown，**保留登录态**，避免网络抖动把用户踢下线。
   *
   * 判定失效时会清空本地登录信息并广播 `phiraSessionExpired`。
   * 并发调用会合并为一次请求。
   */
  async validateSession(): Promise<SessionValidation> {
    if (!this.userToken) return { status: 'expired' };
    if (this.sessionInFlight) return this.sessionInFlight;

    const promise = (async (): Promise<SessionValidation> => {
      try {
        if (this.tokenExpireAt > 0 && Date.now() >= this.tokenExpireAt) {
          return this.expireSession();
        }
        const response = await fetch(`${PHIRA_API_BASE}/me`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.userToken}` },
        });
        if (response.status === 401 || response.status === 403) return this.expireSession();
        // 主站侧故障（5xx / 限流）不能作为登录失效的依据
        if (!response.ok) return { status: 'unknown' };
        const data = (await response.json()) as Partial<CurrentUserInfo>;
        if (!data || typeof data.id !== 'number' || !data.name) return this.expireSession();
        return { status: 'valid', profile: data as CurrentUserInfo };
      } catch {
        // 网络异常或被拦截：无法判定，保留登录态
        return { status: 'unknown' };
      } finally {
        this.sessionInFlight = null;
      }
    })();

    this.sessionInFlight = promise;
    return promise;
  }

  /** 清空登录态并广播失效事件 */
  private expireSession(): SessionValidation {
    this.clearAuth();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('phiraSessionExpired'));
    }
    return { status: 'expired' };
  }

  // 用户列表 localStorage 缓存
  saveUserListCache(users: UserListItem[], count: number, page: number) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_USER_LIST, JSON.stringify(users));
      localStorage.setItem(STORAGE_KEY_USER_LIST_COUNT, count.toString());
      localStorage.setItem(STORAGE_KEY_USER_LIST_PAGE, page.toString());
      localStorage.setItem(STORAGE_KEY_USER_LIST_TIMESTAMP, Date.now().toString());
    } catch {
      // localStorage 满了或不可用，静默失败
    }
  }

  loadUserListCache(): { users: UserListItem[]; count: number; page: number; timestamp: number } | null {
    if (typeof window === 'undefined') return null;
    try {
      const usersStr = localStorage.getItem(STORAGE_KEY_USER_LIST);
      const countStr = localStorage.getItem(STORAGE_KEY_USER_LIST_COUNT);
      const pageStr = localStorage.getItem(STORAGE_KEY_USER_LIST_PAGE);
      const timestampStr = localStorage.getItem(STORAGE_KEY_USER_LIST_TIMESTAMP);
      
      if (!usersStr || !countStr || !pageStr || !timestampStr) return null;
      
      return {
        users: JSON.parse(usersStr),
        count: parseInt(countStr, 10),
        page: parseInt(pageStr, 10),
        timestamp: parseInt(timestampStr, 10),
      };
    } catch {
      return null;
    }
  }

  clearUserListCache() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY_USER_LIST);
    localStorage.removeItem(STORAGE_KEY_USER_LIST_COUNT);
    localStorage.removeItem(STORAGE_KEY_USER_LIST_PAGE);
    localStorage.removeItem(STORAGE_KEY_USER_LIST_TIMESTAMP);
  }

  // 登录获取 token
  async login(email: string, password: string): Promise<PhiraLoginResponse> {
    const response = await fetch(`${PHIRA_API_BASE}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    
    if (!response.ok || data.error) {
      throw new Error(data.error || '登录失败');
    }

    this.setUserToken(data.token, data.id, data.expireAt);
    return data;
  }

  // 获取谱面信息
  async getChartInfo(chartId: number): Promise<ChartInfo> {
    const response = await fetch(`${PHIRA_API_BASE}/chart/${chartId}`);
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    return data;
  }

  // 获取成绩信息
  async getRecordInfo(recordId: number): Promise<RecordInfo> {
    const response = await fetch(`${PHIRA_API_BASE}/record/${recordId}`);
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    return data;
  }

  // 批量获取谱面信息（带缓存）
  private chartCache: Map<number, ChartInfo> = new Map();
  
  async getChartInfoCached(chartId: number): Promise<ChartInfo | null> {
    if (this.chartCache.has(chartId)) {
      return this.chartCache.get(chartId)!;
    }
    
    try {
      const info = await this.getChartInfo(chartId);
      this.chartCache.set(chartId, info);
      return info;
    } catch {
      return null;
    }
  }

  // 批量获取成绩信息
  async getRecordInfoCached(recordId: number): Promise<RecordInfo | null> {
    try {
      return await this.getRecordInfo(recordId);
    } catch {
      return null;
    }
  }

  // 获取用户详细信息
  async getUserInfo(userId: number): Promise<UserDetailInfo> {
    const response = await fetch(`${PHIRA_API_BASE}/user/${userId}`);
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    return data;
  }

  // 获取用户列表（只返回轻量字段）
  async getUserList(
    pageNum: number = 20, 
    page: number = 1, 
    search?: string,
    signal?: AbortSignal
  ): Promise<{ count: number; results: UserListItem[] }> {
    const params = new URLSearchParams();
    params.set('pageNum', pageNum.toString());
    params.set('page', page.toString());
    if (search) params.set('search', search);

    const response = await fetch(`${PHIRA_API_BASE}/user/?${params.toString()}`, { signal });
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    // 只取需要的字段，减少内存占用
    return {
      count: data.count,
      results: data.results.map((u: UserDetailInfo) => ({
        id: u.id,
        name: u.name,
        avatar: u.avatar,
      })),
    };
  }

  // 获取用户详细信息（带缓存）
  private userCache: Map<number, UserDetailInfo> = new Map();
  
  async getUserInfoCached(userId: number): Promise<UserDetailInfo | null> {
    if (this.userCache.has(userId)) {
      return this.userCache.get(userId)!;
    }
    
    try {
      const info = await this.getUserInfo(userId);
      this.userCache.set(userId, info);
      return info;
    } catch {
      return null;
    }
  }

  clearCache() {
    this.chartCache.clear();
    this.userCache.clear();
  }

  // 获取缓存的谱面信息（同步）
  getCachedChartInfo(chartId: number): ChartInfo | undefined {
    return this.chartCache.get(chartId);
  }

  // 检查谱面是否已缓存
  hasChartCached(chartId: number): boolean {
    return this.chartCache.has(chartId);
  }

  // 加载多个谱面信息（带缓存优化）
  async loadChartInfos(chartIds: number[]): Promise<Map<number, ChartInfo>> {
    const result = new Map<number, ChartInfo>();
    const uncachedIds: number[] = [];

    // 先检查缓存
    for (const id of chartIds) {
      const cached = this.chartCache.get(id);
      if (cached) {
        result.set(id, cached);
      } else {
        uncachedIds.push(id);
      }
    }

    // 并行加载未缓存的谱面
    if (uncachedIds.length > 0) {
      const promises = uncachedIds.map(async (id) => {
        try {
          const info = await this.getChartInfo(id);
          this.chartCache.set(id, info);
          return { id, info };
        } catch {
          return null;
        }
      });

      const loaded = await Promise.all(promises);
      for (const item of loaded) {
        if (item) {
          result.set(item.id, item.info);
        }
      }
    }

    return result;
  }
}

export const phiraApiService = new PhiraApiService();
