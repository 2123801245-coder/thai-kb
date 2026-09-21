#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""泰语个人知识库 · 本地服务器（支持 Range 请求：视频进度条任意拖动必需）

用法：
  python3 server.py                  只在本机打开：http://127.0.0.1:8765
  python3 server.py 9000             换端口
  python3 server.py 8765 --lan       局域网：手机 / 平板连同一个 Wi-Fi 直接打开
  python3 server.py 8765 0.0.0.0     同上（显式写绑定地址）

为什么要有 --lan：
  手机直接打开文件（file://）时，iPhone 上的 Safari 不让网页保存数据，
  笔记、图片、掌握度标记都存不住。改成用网址打开就没这个问题。
  局域网模式只在你当前这个 Wi-Fi 内可见 —— 公共 Wi-Fi（咖啡厅 / 机场）下别开，
  教材与音频仅限班内学习使用。

打开 http://<电脑IP>:<端口>/ 会看到一个手机友好的入口页，点一下进知识库。
"""
import http.server, os, re, socket, socketserver, sys
from urllib.parse import quote

DEFAULT_PORT = 8765
DEFAULT_HOST = '127.0.0.1'
APP = '泰语个人知识库.html'
ROOT = os.path.dirname(os.path.abspath(__file__ if '__file__' in globals() else os.getcwd()))

USAGE = __doc__

# 手机 / 平板打开 http://<电脑IP>:<端口>/ 时显示的入口页（故意不依赖任何外部资源）
LANDING = """<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="referrer" content="no-referrer">
<title>🇹🇭 泰语个人知识库</title>
<style>
  *{box-sizing:border-box;}
  body{
    margin:0; min-height:100vh; display:flex; flex-direction:column; align-items:center;
    justify-content:center; gap:14px; text-align:center; color:#232633;
    padding:28px 20px calc(28px + env(safe-area-inset-bottom, 0px));
    padding-top:calc(28px + env(safe-area-inset-top, 0px));
    font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif;
    background:
      radial-gradient(900px 420px at 85% -80px, rgba(91,95,199,.14), transparent 60%),
      radial-gradient(700px 380px at -10% 0, rgba(194,105,158,.12), transparent 55%),
      #f4f5fa;
  }
  .ico{font-size:54px; line-height:1;}
  h1{font-size:21px; margin:0; letter-spacing:-.01em;}
  p{margin:0; max-width:30em; font-size:13.5px; line-height:1.75; color:#7d8291;}
  a.open{
    display:block; width:100%; max-width:340px; padding:17px 20px; border-radius:16px;
    background:#5b5fc7; color:#fff; text-decoration:none; font-size:17px; font-weight:700;
    box-shadow:0 6px 20px rgba(91,95,199,.35); -webkit-tap-highlight-color:transparent;
  }
  a.open:active{transform:scale(.97);}
  a.alt{color:#5b5fc7; font-size:13.5px; font-weight:600; text-decoration:none;}
  .tip{
    max-width:340px; padding:10px 14px; border:1px dashed #dfe1ef; border-radius:12px;
    background:rgba(255,255,255,.75); font-size:12px; line-height:1.8; color:#7d8291;
  }
</style>
</head>
<body>
  <div class="ico">🇹🇭</div>
  <h1>泰语个人知识库</h1>
  <p>手机 / 平板已经连上电脑上的知识库了。点下面的按钮开始，界面会自动适配窄屏与触屏。</p>
  <a class="open" href="__APP__">📖 打开知识库</a>
  <a class="alt" href="/?browse=1">查看全部文件 →</a>
  <div class="tip">💡 加到桌面下次一点就进：Safari 点「分享 → 添加到主屏幕」，Chrome 点「⋮ → 添加到主屏幕」。</div>
</body>
</html>
"""


def parse_args(argv):
    port, host = DEFAULT_PORT, DEFAULT_HOST
    pos = []
    for a in argv:
        if a == '--lan':
            host = '0.0.0.0'
        elif a == '--help':
            print(USAGE)
            sys.exit(0)
        elif a.startswith('-'):
            print('未知参数：' + a + '\n')
            print(USAGE)
            sys.exit(2)
        else:
            pos.append(a)
    if pos:
        try:
            port = int(pos[0])
        except ValueError:
            print('端口必须是数字：' + pos[0])
            sys.exit(2)
    if len(pos) > 1:
        host = pos[1]
    return port, host


def _rank(ip):
    """越小越像「手机连得上」的地址：家用网段排前面，运营商大内网（100.64/10，含 Tailscale）靠后。"""
    if ip.startswith('192.168.') or ip.startswith('10.'):
        return 0
    parts = ip.split('.')
    if len(parts) == 4 and parts[0] == '172':
        try:
            if 16 <= int(parts[1]) <= 31:
                return 0
        except ValueError:
            pass
    return 2 if ip.startswith('100.') else 1


def lan_ips():
    """列出本机可能的局域网 IPv4 地址（不连外网，也不发数据包）。

    两个来源都取：主机名解析（macOS 上一般就是 Wi-Fi 那块网卡的地址）和
    「连一下 8.8.8.8 看自己从哪个地址出去」。后者在开着代理 / VPN 的机器上
    会拿到 TUN 网卡的地址（常见于 198.18.0.0/15，RFC 2544 保留段），手机连不上，
    所以这里把 198.18/198.19 与 169.254 链路段直接滤掉，剩下的按像不像家用网段排序。
    """
    cands = []
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            cands.append(info[4][0])
    except OSError:
        pass
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(('8.8.8.8', 80))
            cands.append(s.getsockname()[0])
        finally:
            s.close()
    except OSError:
        pass
    out, seen = [], set()
    for ip in cands:
        if ip in seen or ip.startswith('127.') or ip == '0.0.0.0':
            continue
        seen.add(ip)
        if ip.startswith('169.254.') or ip.startswith('198.18.') or ip.startswith('198.19.'):
            continue
        out.append(ip)
    return sorted(out, key=_rank)


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def do_GET(self):
        # 根路径给一个手机友好的入口页；/?browse=1 仍然看文件列表
        if self.path in ('/', '/index.html'):
            body = LANDING.replace('__APP__', quote(APP)).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        ctype = self.guess_type(path)
        try:
            f = open(path, 'rb')
        except OSError:
            self.send_error(404, 'File not found')
            return None
        try:
            fs = os.fstat(f.fileno())
            size = fs.st_size
            m = re.match(r'bytes=(\d*)-(\d*)$', self.headers.get('Range') or '')
            if m:
                start = int(m.group(1)) if m.group(1) else 0
                end = int(m.group(2)) if m.group(2) else size - 1
                end = min(end, size - 1)
                if start > end or start >= size:
                    self.send_response(416)
                    self.send_header('Content-Range', 'bytes */%d' % size)
                    self.end_headers()
                    f.close()
                    return None
                self.send_response(206)
                self.send_header('Content-Type', ctype)
                self.send_header('Content-Range', 'bytes %d-%d/%d' % (start, end, size))
                self.send_header('Accept-Ranges', 'bytes')
                self.send_header('Content-Length', str(end - start + 1))
                self.end_headers()
                self._range = (start, end)
                return f
            self.send_response(200)
            self.send_header('Content-Type', ctype)
            self.send_header('Accept-Ranges', 'bytes')
            self.send_header('Content-Length', str(size))
            self.end_headers()
            self._range = None
            return f
        except Exception:
            f.close()
            raise

    def copyfile(self, src, dst):
        r = getattr(self, '_range', None)
        if not r:
            return super().copyfile(src, dst)
        start, end = r
        src.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            chunk = src.read(min(65536, remaining))
            if not chunk:
                break
            dst.write(chunk)
            remaining -= len(chunk)

    _greeted = set()

    def log_message(self, fmt, *args):
        # 默认每条请求都往终端刷一行，手机翻页时太吵：
        # 只在每台设备第一次连上时报一次，以及出现 4xx / 5xx 时报错。
        ip = self.client_address[0] if self.client_address else '?'
        code = str(args[1]) if len(args) > 1 else ''
        if 'favicon.ico' in self.path:
            return                      # 浏览器每次都来要图标，别刷屏
        if code.startswith(('4', '5')):
            sys.stderr.write('  \u26a0\ufe0f  %s %s\n' % (ip, fmt % args))
            sys.stderr.flush()
        elif ip not in H._greeted:
            H._greeted.add(ip)
            print('  \u2705 已有%s连上：%s' % ('本机' if ip.startswith('127.') else '设备', ip))
            sys.stdout.flush()


def main():
    port, host = parse_args(sys.argv[1:])
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    try:
        httpd = socketserver.ThreadingTCPServer((host, port), H)
    except OSError as e:
        print('端口 %d 用不了（%s）。' % (port, e))
        print('换一个端口再试：python3 server.py %d' % (port + 1))
        sys.exit(1)

    print('泰语个人知识库 · 本地服务器（Range 支持 ✓）', flush=True)
    print('  本机打开        http://127.0.0.1:%d' % port, flush=True)
    if host == '0.0.0.0':
        print('  正在查本机的局域网地址…', flush=True)
        ips = lan_ips()
        if ips:
            print('  手机 / 平板打开  （手机连同一个 Wi-Fi，地址栏直接输下面这个）', flush=True)
            for ip in ips:
                print('                  http://%s:%d' % (ip, port))
            if _rank(ips[0]) >= 2:
                print('  ⚠️  这个地址看着像运营商大内网 / Tailscale，手机如果打不开，')
                print('     请在「系统设置 → Wi-Fi → 详细信息」里看路由器分配给电脑的 IP。')
        else:
            print('  ⚠️  没取到局域网地址：确认电脑已连上 Wi-Fi / 路由器')
        print('  提示：macOS 可能弹出「是否允许 Python 接受传入连接」，点「允许」；')
        print('        公共 Wi-Fi 下不要开这个模式，教材与音频别外传。', flush=True)
    print('  结束：Ctrl+C，或直接关掉这个终端窗口。', flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n已停止。')
    finally:
        httpd.server_close()


if __name__ == '__main__':
    main()
