"""เซิร์ฟเวอร์ในเครื่อง (เปิดแอป.bat · .claude/launch.json)

เหมือน python -m http.server ทุกอย่าง ต่างแค่ส่ง Cache-Control: no-cache
http.server เดิมไม่บอกเบราว์เซอร์ว่าไฟล์เก็บได้นานแค่ไหน เบราว์เซอร์เลยเดาเอง
แล้วหยิบไฟล์ชุดเก่าจากแคชมาใช้โดยไม่ถามเซิร์ฟเวอร์ แก้ไฟล์แล้วเปิดดูยังเห็นของเดิม
no-cache = ถามทุกครั้งว่าไฟล์เปลี่ยนไหม ไม่เปลี่ยนก็ได้ 304 กลับมา ไม่ช้าลง

ใช้: python tools/serve.py [พอร์ต] [โฟลเดอร์]
"""
import functools
import http.server
import sys


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 5599
root = sys.argv[2] if len(sys.argv) > 2 else '.'
print(f'Serving {root} at http://localhost:{port}', flush=True)
http.server.ThreadingHTTPServer(('', port), functools.partial(NoCache, directory=root)).serve_forever()
