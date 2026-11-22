// 제주도 함께가기 — 실시간 중계 서버 (Cloudflare Worker + Durable Object)
// 게임 화면(index.html)은 public 폴더에서 그대로 보내 주고, /ws 로 들어온 웹소켓은 Hub 하나가 받아서
// 방(최대 30명)을 나눠 주고, 같은 방 사람들의 상태(위치·모습·말풍선)를 서로에게 전해 준다. 아무것도 저장하지 않는다.
import { DurableObject } from 'cloudflare:workers';

const ROOM_MAX = 30;
const MAX_STATE = 4096;

export class Hub extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }
  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
    const [client, server] = Object.values(new WebSocketPair());
    const peer = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ peer, room: 0, s: {} });
    return new Response(null, { status: 101, webSocket: client });
  }
  all() { return this.ctx.getWebSockets().map(ws => ({ ws, a: ws.deserializeAttachment() || {} })); }
  inRoom(room) { return this.all().filter(x => x.a.room === room); }
  send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch {} }
  async webSocketMessage(ws, msg) {
    if (typeof msg !== 'string' || msg.length > MAX_STATE + 200) return;
    let m; try { m = JSON.parse(msg); } catch { return; }
    const a = ws.deserializeAttachment() || {};
    if (m.t === 'join' && !a.room) {
      const counts = {};
      for (const x of this.all()) if (x.a.room) counts[x.a.room] = (counts[x.a.room] || 0) + 1;
      let k = 1; while ((counts[k] || 0) >= ROOM_MAX) k++;
      a.room = k; a.s = clean(m.s); ws.serializeAttachment(a);
      const others = this.inRoom(k).filter(x => x.ws !== ws);
      this.send(ws, { t: 'room', room: k, peers: others.map(x => ({ peer: x.a.peer, s: x.a.s })) });
      for (const x of others) this.send(x.ws, { t: 'up', peer: a.peer, s: a.s });
    } else if (m.t === 'p' && a.room) {
      a.s = clean(m.s); ws.serializeAttachment(a);
      const out = JSON.stringify({ t: 'up', peer: a.peer, s: a.s });
      for (const x of this.inRoom(a.room)) if (x.ws !== ws) { try { x.ws.send(out); } catch {} }
    }
  }
  async webSocketClose(ws) { this.leave(ws); }
  async webSocketError(ws) { this.leave(ws); }
  leave(ws) {
    const a = ws.deserializeAttachment() || {};
    if (!a.room) return;
    for (const x of this.inRoom(a.room)) if (x.ws !== ws) this.send(x.ws, { t: 'left', peer: a.peer });
    a.room = 0; ws.serializeAttachment(a);
    try { ws.close(); } catch {}
  }
}
function clean(s) {
  if (!s || typeof s !== 'object') return {};
  const txt = JSON.stringify(s);
  return txt.length > MAX_STATE ? {} : s;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') return env.HUB.get(env.HUB.idFromName('jeju')).fetch(req);
    return env.ASSETS.fetch(req);
  },
};
