#!/usr/bin/env python3
# 本地知识库服务器：支持 Range 请求（视频进度条任意拖动必需）。
# 用法：python3 server.py [端口]  （默认 8765）
import http.server, os, re, socketserver, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
ROOT = os.path.dirname(os.path.abspath(__file__ if '__file__' in globals() else os.getcwd()))

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

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

if __name__ == '__main__':
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(('127.0.0.1', PORT), H) as httpd:
        print('serving at http://127.0.0.1:%d  (Range 支持 ✓)' % PORT)
        httpd.serve_forever()
