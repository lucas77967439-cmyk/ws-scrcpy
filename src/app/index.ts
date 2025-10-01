import '../style/app.css';
import { StreamClientScrcpy } from './googDevice/client/StreamClientScrcpy';
import { HostTracker } from './client/HostTracker';
import { Tool } from './client/Tool';

// --- 动态密码配置 ---
const PASSWORD_SALT = '77967439'; // 修改为你的密钥
const CHANGE_HOUR = 12; // 每天更换密码的时间
const PASSWORD_VIEWER_PATH = '/sp'; // 密码查看页面路径，已修改为/sp

// 生成当天密码
function generateDailyPassword(): string {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), CHANGE_HOUR, 0, 0);
  
  if (now > target) {
    target.setDate(target.getDate() + 1);
  }
  
  const dateStr = target.toISOString().split('T')[0];
  const text = `${PASSWORD_SALT}-${dateStr}`;
  
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash &= hash;
  }
  
  return Math.abs(hash).toString(36).slice(0, 6);
}

// 创建密码查看页面
function createPasswordViewer(): void {
  const viewer = document.createElement('div');
  viewer.id = 'password-viewer';
  viewer.innerHTML = `
    <style>
      #password-viewer {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        background: #111;
        color: #fff;
        font-family: sans-serif;
      }
      .password-box {
        padding: 20px;
        border-radius: 8px;
        background: #222;
        text-align: center;
      }
      .password-display {
        font-size: 24px;
        font-weight: bold;
        padding: 10px 20px;
        margin: 15px 0;
        background: #333;
        border-radius: 4px;
        letter-spacing: 3px;
      }
      .expire-info {
        color: #bbb;
        font-size: 14px;
        margin-top: 10px;
      }
      a {
        color: #2ecc71;
        margin-top: 20px;
        text-decoration: none;
      }
    </style>
    <div class="password-box">
      <h2>今日访问密码</h2>
      <div class="password-display">${ generateDailyPassword() }</div>
      <div class="expire-info">
        有效期至 ${getExpireTime().toLocaleString()}
      </div>
    </div>
    <a href="/">返回主页面</a> <!-- 链接已修改为根路径 -->
  `;
  document.body.innerHTML = '';
  document.body.appendChild(viewer);
}

// 获取密码过期时间
function getExpireTime(): Date {
  const now = new Date();
  const expire = new Date(now.getFullYear(), now.getMonth(), now.getDate(), CHANGE_HOUR, 0, 0);
  
  if (now > expire) {
    expire.setDate(expire.getDate() + 1);
  }
  
  return expire;
}

// --- 认证相关函数 ---
const AUTH_PARAM = 'auth_token';

function getCurrentQuery(): string {
  return location.hash.replace(/^#!/, '');
}

function buildUrlWithAuth(query: string): string {
  const params = new URLSearchParams(query);
  params.set(AUTH_PARAM, btoa(generateDailyPassword()));
  return '#!' + params.toString();
}

function isAuthenticated(): boolean {
  const query = getCurrentQuery();
  const params = new URLSearchParams(query);
  const token = params.get(AUTH_PARAM);
  if (!token) return false;
  
  try {
    return atob(token) === generateDailyPassword();
  } catch (e) {
    return false;
  }
}

function requireAuth(): boolean {
  // 密码查看页面不需要验证，直接判断路径
  if (location.pathname === PASSWORD_VIEWER_PATH) {
    return false;
  }

  // 需要验证的页面列表
  const authRequiredActions = [
    StreamClientScrcpy.ACTION,
    /// #if INCLUDE_ADB_SHELL
    'shell',
    /// #endif
    /// #if INCLUDE_DEV_TOOLS
    'devtools',
    /// #endif
    /// #if INCLUDE_FILE_LISTING
    'file-listing',
    /// #endif
    /// #if INCLUDE_APPL
    /// #if USE_QVH_SERVER
    'stream-qv',
    /// #endif
    /// #if USE_WDA_MJPEG_SERVER
    'stream-mjpeg',
    /// #endif
    /// #endif
  ];
  
  const params = new URLSearchParams(getCurrentQuery());
  const action = params.get('action');
  return !!action && authRequiredActions.includes(action);
}

// 检查是否是密码查看页面（直接判断路径）
function isPasswordViewer(): boolean {
  return location.pathname === PASSWORD_VIEWER_PATH;
}

// --- 应用初始化函数 ---
async function initApp(): Promise<void> {
  // 先检查是否是密码查看页面
  if (isPasswordViewer()) {
    createPasswordViewer();
    return;
  }

  const hash = getCurrentQuery();
  const params = new URLSearchParams(hash);
  const action = params.get('action');

  // 注册播放器
  /// #if USE_BROADWAY
  const { BroadwayPlayer } = await import('./player/BroadwayPlayer');
  StreamClientScrcpy.registerPlayer(BroadwayPlayer);
  /// #endif

  /// #if USE_H264_CONVERTER
  const { MsePlayer } = await import('./player/MsePlayer');
  StreamClientScrcpy.registerPlayer(MsePlayer);
  /// #endif

  /// #if USE_TINY_H264
  const { TinyH264Player } = await import('./player/TinyH264Player');
  StreamClientScrcpy.registerPlayer(TinyH264Player);
  /// #endif

  /// #if USE_WEBCODECS
  const { WebCodecsPlayer } = await import('./player/WebCodecsPlayer');
  StreamClientScrcpy.registerPlayer(WebCodecsPlayer);
  /// #endif

  // 处理StreamClientScrcpy
  if (action === StreamClientScrcpy.ACTION && params.get('udid')) {
    StreamClientScrcpy.start(params);
    return;
  }

  /// #if INCLUDE_APPL
  {
    const { DeviceTracker } = await import('./applDevice/client/DeviceTracker');

    /// #if USE_QVH_SERVER
    const { StreamClientQVHack } = await import('./applDevice/client/StreamClientQVHack');
    DeviceTracker.registerTool(StreamClientQVHack);

    /// #if USE_WEBCODECS
    const { WebCodecsPlayer } = await import('./player/WebCodecsPlayer');
    StreamClientQVHack.registerPlayer(WebCodecsPlayer);
    /// #endif

    /// #if USE_H264_CONVERTER
    const { MsePlayerForQVHack } = await import('./player/MsePlayerForQVHack');
    StreamClientQVHack.registerPlayer(MsePlayerForQVHack);
    /// #endif

    if (action === StreamClientQVHack.ACTION && params.get('udid')) {
      StreamClientQVHack.start(StreamClientQVHack.parseParameters(params));
      return;
    }
    /// #endif

    /// #if USE_WDA_MJPEG_SERVER
    const { StreamClientMJPEG } = await import('./applDevice/client/StreamClientMJPEG');
    DeviceTracker.registerTool(StreamClientMJPEG);

    const { MjpegPlayer } = await import('./player/MjpegPlayer');
    StreamClientMJPEG.registerPlayer(MjpegPlayer);

    if (action === StreamClientMJPEG.ACTION && params.get('udid')) {
      StreamClientMJPEG.start(StreamClientMJPEG.parseParameters(params));
      return;
    }
    /// #endif
  }
  /// #endif

  const tools: Tool[] = [];

  /// #if INCLUDE_ADB_SHELL
  const { ShellClient } = await import('./googDevice/client/ShellClient');
  if (action === ShellClient.ACTION && params.get('udid')) {
    ShellClient.start(ShellClient.parseParameters(params));
    return;
  }
  tools.push(ShellClient);
  /// #endif

  /// #if INCLUDE_DEV_TOOLS
  const { DevtoolsClient } = await import('./googDevice/client/DevtoolsClient');
  if (action === DevtoolsClient.ACTION) {
    DevtoolsClient.start(DevtoolsClient.parseParameters(params));
    return;
  }
  tools.push(DevtoolsClient);
  /// #endif

  /// #if INCLUDE_FILE_LISTING
  const { FileListingClient } = await import('./googDevice/client/FileListingClient');
  if (action === FileListingClient.ACTION) {
    FileListingClient.start(FileListingClient.parseParameters(params));
    return;
  }
  tools.push(FileListingClient);
  /// #endif

  if (tools.length) {
    const { DeviceTracker } = await import('./googDevice/client/DeviceTracker');
    tools.forEach((tool) => {
      DeviceTracker.registerTool(tool);
    });
  }
  HostTracker.start();
}

// --- 页面加载主逻辑 ---
window.onload = async function (): Promise<void> {
  // 如果是密码查看页面，直接显示
  if (isPasswordViewer()) {
    await initApp();
    return;
  }

  // 创建登录界面
  const loginScreen = document.createElement('div');
  loginScreen.id = 'login-screen';
  loginScreen.innerHTML = `
    <style>
      #login-screen {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        background: #111;
        color: #fff;
        font-family: sans-serif;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 9999;
      }
      #login-form {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 20px;
        border: 1px solid #444;
        border-radius: 8px;
        background: #1a1a1a;
      }
      #login-form input, #login-form button {
        padding: 8px 12px;
        border-radius: 4px;
        border: 1px solid #555;
        background: #222;
        color: #fff;
      }
      #login-form button {
        background: #2ecc71;
        border: none;
        cursor: pointer;
      }
      #login-form button:hover {
        background: #27ae60;
      }
      .error {
        color: #e74c3c;
        font-size: 12px;
      }
    </style>
    <form id="login-form">
      <h2>请输入密码</h2>
      <input type="password" id="password" placeholder="Password" required autocomplete="current-password">
      <div class="error" id="error" style="display:none;">密码错误</div>
      <button type="submit">登录</button>
    </form>
  `;
  document.body.appendChild(loginScreen);

  const loginForm = document.getElementById('login-form');
  const passwordInput = document.getElementById('password') as HTMLInputElement;
  const errorEl = document.getElementById('error');

  // 验证逻辑
  if (requireAuth()) {
    if (isAuthenticated()) {
      loginScreen.style.display = 'none';
      await initApp();
    } else {
      if (loginForm && passwordInput) {
        loginForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          console.log('登录表单提交事件触发');
          
          const inputPwd = passwordInput.value.trim();
          const correctPwd = generateDailyPassword();
          console.log('输入密码:', inputPwd, '正确密码:', correctPwd);
          
          if (inputPwd === correctPwd) {
            const newUrl = buildUrlWithAuth(getCurrentQuery());
            console.log('密码正确，更新URL并初始化应用:', newUrl);
            
            // 更新URL但不触发路由拦截
            history.replaceState({}, document.title, newUrl);
            
            // 手动执行初始化流程
            loginScreen.style.display = 'none';
            await initApp();
          } else {
            console.log('密码错误');
            if (errorEl) {
              errorEl.style.display = 'block';
              setTimeout(() => errorEl.style.display = 'none', 3000);
            }
            passwordInput.value = '';
          }
        });
        
        // 键盘回车支持
        passwordInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            loginForm.dispatchEvent(new Event('submit'));
          }
        });
      } else {
        console.error('登录表单或密码输入框不存在');
      }
    }
  } else {
    loginScreen.style.display = 'none';
    await initApp();
  }
};
    
