from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))
server = HTTPServer(('localhost', 3004), SimpleHTTPRequestHandler)
print('Serving on http://localhost:3004')
server.serve_forever()
