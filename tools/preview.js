/* Development-only browser adapter. The game logic, WXML and WXSS come directly
 * from the mini program; this is not a replacement for WeChat device testing. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname,'../miniprogram');
const files = {'/template': 'pages/index/index.wxml', '/style': 'app.wxss', '/page': 'pages/index/index.js', '/sudoku': 'utils/sudoku.js', '/storage': 'utils/storage.js'};
const server=http.createServer((req,res)=>{
  const route=req.url.split('?')[0];
  res.setHeader('Cache-Control','no-store');
  if(files[route]){res.setHeader('Content-Type','text/plain; charset=utf-8');res.end(fs.readFileSync(path.join(root,files[route])));return;}
  if(route==='/adapter.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(fs.readFileSync(path.join(__dirname,'preview-adapter.js')));return;}
  if(route!=='/'){res.writeHead(404);res.end('Not found');return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>小芽数独 · 浏览器预览</title><style id="wxss"></style><style>:root{--rpx:min(calc(100vw / 750), .6px)}body{margin:0;background:#ebece5}#root{max-width:450px;margin:auto;background:#f7f8f2;min-height:100vh}button{cursor:pointer;font-family:inherit;border:0}input{accent-color:#43745e;width:40px;height:24px}button:disabled{cursor:default}span{white-space:pre-line}.preview-label{font:11px sans-serif;text-align:center;background:#3f6150;color:#f7f8f2;padding:8px;letter-spacing:1px}</style></head><body><div id="root"><div class="preview-label">小芽数独 · 浏览器体验版 / 本地存档</div><main id="screen"></main></div><script src="/adapter.js"></script></body></html>');
});
server.listen(Number(process.env.PORT)||4173,'127.0.0.1',()=>console.log('小芽数独预览：http://127.0.0.1:'+server.address().port+'（Ctrl+C 退出）'));
