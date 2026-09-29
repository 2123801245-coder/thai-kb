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
import http.server, json, os, re, socket, socketserver, sys, time
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


# ────────────────────────────────────────────────────────────
# 📌 固定到知识库：把浏览器里「我的添加」（生词 / 句型 / 导入课文）
# 直接写进 data/*.json，成为知识库本体的一部分 —— 从此随版本更新、
# 备份与发版一起走，不再依赖某个浏览器的 localStorage。
# 发布版目录里只有打包好的 data/*.js，所以写完 .json 再镜像更新同名 .js。
# 只接受本机（127.0.0.1）请求：局域网里的手机 / 平板不能改文件。
# ────────────────────────────────────────────────────────────

def _load_json(path):
    """读 JSON 文件；不存在返回 (None, None)。"""
    if not os.path.exists(path):
        return None, None
    with open(path, 'rb') as f:
        raw = f.read()
    return raw, json.loads(raw.decode('utf-8'))


def _style_index(raw, data):
    """认出原文件的排版（缩进 / 紧凑、末尾换行），返回样式序号。
    已知：words/patterns/lessons.meta 是 1 空格缩进 + 末尾换行，
    lessons.json 是无空格紧凑且无末尾换行 —— 逐个试，避免重排整个文件。"""
    for i, t in enumerate(_style_trials(data)):
        if t.encode('utf-8') == raw:
            return i
    return 0


def _style_trials(data):
    return [
        json.dumps(data, ensure_ascii=False, indent=1) + '\n',
        json.dumps(data, ensure_ascii=False, indent=2) + '\n',
        json.dumps(data, ensure_ascii=False, indent=4) + '\n',
        json.dumps(data, ensure_ascii=False, separators=(',', ':')),
        json.dumps(data, ensure_ascii=False),
    ]


def _write_json(path, data, style):
    """按认出的排版写回；先写临时文件再替换，避免写一半损坏。"""
    text = _style_trials(data)[style]
    tmp = path + '.pin-tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(text)
    os.replace(tmp, path)
    _mirror_js(path, text)


def _mirror_js(json_path, json_text):
    """发布版目录里有打包好的 data/*.js（window.KB_RAW 注入），同步更新它，
    这样双击 HTML / 发布版打开时固定的内容立即生效。没有 .js 就跳过（开发目录）。"""
    name = os.path.basename(json_path)
    if not name.endswith('.json'):
        return
    js_path = os.path.join(os.path.dirname(json_path), name[:-5] + '.js')
    if not os.path.exists(js_path):
        return
    key = name
    prefix = 'window.KB_RAW=window.KB_RAW||{};window.KB_PACK=1;window.KB_RAW["%s"]=' % key
    with open(js_path, 'rb') as f:
        raw = f.read()
    if not raw.startswith(prefix.encode('utf-8')):
        return   # 格式不认识就不动它，宁可不镜像也不写坏
    body = json.dumps(json_text, ensure_ascii=False)
    tmp = js_path + '.pin-tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(prefix + body + ';')
    os.replace(tmp, js_path)


def _clean_str(v, limit=100000):
    s = str(v if v is not None else '').strip()
    return s if len(s) <= limit else s[:limit]


def _clean_paras(paras):
    out = []
    if not isinstance(paras, list):
        return out
    for p in paras:
        if not isinstance(p, dict):
            continue
        t = _clean_str(p.get('t'), 20000)
        if not t:
            continue
        item = {'t': t}
        z = _clean_str(p.get('z'), 20000)
        if z:
            item['z'] = z
        out.append(item)
    return out


def pin_merge(root, payload):
    """合并 payload 里的生词 / 句型 / 课文进 data/，返回给前端的结果摘要。
    先全部校验、后统一落盘：中途出错不留半截改动。"""
    if not isinstance(payload, dict):
        raise ValueError('请求体不是 JSON 对象')
    data_dir = os.path.join(root, 'data')

    # ---- 读入现有数据 ----
    plan = {}   # name -> (path, raw, data, style)
    for name in ('words.json', 'patterns.json', 'lessons.json', 'lessons.meta.json'):
        raw, data = _load_json(os.path.join(data_dir, name))
        if data is None:
            data = {}
        if not isinstance(data, (list, dict)):
            raise ValueError(name + ' 内容不对（不是数组/对象）')
        plan[name] = [os.path.join(data_dir, name), raw, data, (_style_index(raw, data) if raw is not None else 0)]

    words, patterns, lessons, meta = (plan[n][2] for n in
                                      ('words.json', 'patterns.json', 'lessons.json', 'lessons.meta.json'))
    if not isinstance(words, list) or not isinstance(patterns, list) or not isinstance(lessons, list) or not isinstance(meta, dict):
        raise ValueError('data/ 里的数据结构不对')
    courses = meta.get('courses') or []

    added = {'words': [], 'patterns': [], 'lessons': []}
    skipped = {'words': 0, 'patterns': 0, 'lessons': 0}
    touched = set()   # 真有新增才写盘：未变动的文件即使排版认不出也不碰

    # ---- 生词：{t,r,z,p,lesson} + pin 标记 ----
    seen_w = {_clean_str(w.get('t')) for w in words if isinstance(w, dict)}
    for w in (payload.get('words') or []):
        if not isinstance(w, dict):
            continue
        t = _clean_str(w.get('t'), 300)
        if not t:
            continue
        if t in seen_w:
            skipped['words'] += 1
            continue
        item = {'t': t}
        for k in ('r', 'z', 'p'):
            v = _clean_str(w.get(k), 2000)
            if v:
                item[k] = v
        item['lesson'] = _clean_str(w.get('lg') or w.get('lesson'), 200) or '我的生词'
        item['pin'] = 1
        words.append(item)
        seen_w.add(t)
        added['words'].append(t)
        touched.add('words.json')

    # ---- 句型：{p,z,ex,ez,lg} + pin 标记 ----
    seen_p = {_clean_str(x.get('p')) for x in patterns if isinstance(x, dict)}
    for x in (payload.get('patterns') or []):
        if not isinstance(x, dict):
            continue
        p = _clean_str(x.get('p'), 2000)
        z = _clean_str(x.get('z'), 5000)
        if not p or not z:
            continue
        if p in seen_p:
            skipped['patterns'] += 1
            continue
        item = {'p': p, 'z': z}
        for k in ('ex', 'ez', 'lg'):
            v = _clean_str(x.get(k), 5000)
            if v:
                item[k] = v
        item['pin'] = 1
        patterns.append(item)
        seen_p.add(p)
        added['patterns'].append(p)
        touched.add('patterns.json')

    # ---- 课文：与 lessons.json 同构，并同步 lessons.meta（自检硬要求）----
    seen_l = {_clean_str(l.get('label')) for l in lessons if isinstance(l, dict)}
    keys = meta.setdefault('lessonKeys', [])
    course_of = meta.setdefault('courseOf', {})
    for l in (payload.get('lessons') or []):
        if not isinstance(l, dict):
            continue
        label = _clean_str(l.get('label'), 500)
        course = _clean_str(l.get('course'), 100)
        paras = _clean_paras(l.get('paras'))
        if not label or not course or not paras:
            continue
        if courses and course not in courses:
            skipped['lessons'] += 1
            continue
        if label in seen_l:
            skipped['lessons'] += 1
            continue
        item = {'label': label}
        for k in ('title', 'titleZh', 'author'):
            v = _clean_str(l.get(k), 500)
            if v:
                item[k] = v
        item['course'] = course
        item['pin'] = 1
        item['paras'] = paras
        lessons.append(item)
        seen_l.add(label)
        if label not in keys:
            keys.append(label)
        course_of[label] = course
        added['lessons'].append(label)
        touched.add('lessons.json')
        touched.add('lessons.meta.json')

    # ---- 学习进度（掌握度 / 错题本 / 笔记文字）：整份快照写 data-personal/progress.json。
    #     这是个人数据：不入 git、不进发布包（make-zip / make-update 都会跳过这个目录），
    #     但落在磁盘上就随版本更新存活；浏览器清空后启动时由它恢复（见 js/loader.js）。
    progress_changed = False
    prog = payload.get('progress')
    if isinstance(prog, dict):
        cls_new = {}
        raw_cls = prog.get('cls')
        if isinstance(raw_cls, dict):
            for k, v in list(raw_cls.items())[:50000]:
                kk = _clean_str(k, 300)
                if not kk or isinstance(v, bool):
                    continue
                try:
                    iv = int(v)
                except (TypeError, ValueError):
                    continue
                if 0 <= iv <= 3:
                    cls_new[kk] = iv
        wrongs_new = prog.get('wrongs') if isinstance(prog.get('wrongs'), list) else []
        wrongs_new = wrongs_new[:5000]
        notes_new = _clean_str(prog.get('notes'), 2 * 1024 * 1024)
        prog_path = os.path.join(root, 'data-personal', 'progress.json')
        _, old_prog = _load_json(prog_path)
        if not isinstance(old_prog, dict):
            old_prog = {}
        if (old_prog.get('cls') != cls_new or old_prog.get('wrongs') != wrongs_new
                or old_prog.get('notes') != notes_new):
            snapshot = {'v': 1, 'pinnedAt': time.strftime('%Y-%m-%dT%H:%M:%S'),
                        'cls': cls_new, 'wrongs': wrongs_new, 'notes': notes_new}
            os.makedirs(os.path.dirname(prog_path), exist_ok=True)
            tmp = prog_path + '.pin-tmp'
            with open(tmp, 'w', encoding='utf-8') as f:
                f.write(json.dumps(snapshot, ensure_ascii=False, indent=1) + '\n')
            os.replace(tmp, prog_path)
            progress_changed = True

    # ---- 统一落盘 ----
    for n in sorted(touched):
        path, raw, data, style = plan[n]
        _write_json(path, data, style)

    return {'added': added, 'skipped': skipped, 'progressChanged': progress_changed}


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

    def _json_reply(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        # 📌 固定到知识库：只开本机，局域网设备一律拒绝
        if self.path.split('?')[0].rstrip('/') != '/api/pin':
            self.send_error(404, 'Not found')
            return
        ip = self.client_address[0] if self.client_address else ''
        if ip not in ('127.0.0.1', '::1'):
            self._json_reply(403, {'ok': False, 'error': '只允许在电脑本机固定内容（手机/平板请先在电脑上固定）'})
            return
        try:
            n = int(self.headers.get('Content-Length') or 0)
        except (TypeError, ValueError):
            n = 0
        if n <= 0 or n > 30 * 1024 * 1024:
            self._json_reply(400, {'ok': False, 'error': '请求体大小不对'})
            return
        try:
            payload = json.loads(self.rfile.read(n).decode('utf-8'))
            result = pin_merge(ROOT, payload)
        except Exception as e:
            self._json_reply(500, {'ok': False, 'error': str(e)})
            return
        result['ok'] = True
        self._json_reply(200, result)

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
