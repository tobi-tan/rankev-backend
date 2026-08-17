import type { WebSocket } from 'ws';

/**
 * In-memory pub/sub for realtime fan-out, keyed by rankie/post id.
 * Single-instance only — for horizontal scaling, back this with Redis pub/sub
 * (see spec §1). The public API (broadcast*) stays the same either way.
 */

const rooms = new Map<string, Set<WebSocket>>();
const socketRooms = new Map<WebSocket, Set<string>>();

export function join(roomId: string, socket: WebSocket): void {
  let set = rooms.get(roomId);
  if (!set) {
    set = new Set();
    rooms.set(roomId, set);
  }
  set.add(socket);

  let mine = socketRooms.get(socket);
  if (!mine) {
    mine = new Set();
    socketRooms.set(socket, mine);
  }
  mine.add(roomId);
}

export function leave(roomId: string, socket: WebSocket): void {
  rooms.get(roomId)?.delete(socket);
  if (rooms.get(roomId)?.size === 0) rooms.delete(roomId);
  socketRooms.get(socket)?.delete(roomId);
}

export function leaveAll(socket: WebSocket): void {
  const mine = socketRooms.get(socket);
  if (mine) {
    for (const roomId of mine) {
      rooms.get(roomId)?.delete(socket);
      if (rooms.get(roomId)?.size === 0) rooms.delete(roomId);
    }
  }
  socketRooms.delete(socket);
}

function send(roomId: string, payload: unknown): void {
  const set = rooms.get(roomId);
  if (!set || set.size === 0) return;
  const data = JSON.stringify(payload);
  for (const socket of set) {
    if (socket.readyState === 1 /* OPEN */) {
      try {
        socket.send(data);
      } catch {
        /* drop broken sockets silently */
      }
    }
  }
}

export function broadcastVoteUpdate(
  rankieId: string,
  options: { id: string; votes: number; voters: number }[],
): void {
  send(rankieId, { type: 'vote_update', rankieId, options });
}

export function broadcastNewComment(postId: string, comment: unknown): void {
  send(postId, { type: 'new_comment', postId, comment });
}

export function broadcastRankieClosed(rankieId: string): void {
  send(rankieId, { type: 'rankie_closed', rankieId });
}

// --- Live presentation sessions ---
// Namespaced room key so a session id can never collide with a rankie id.
const liveRoom = (sessionId: string): string => `live:${sessionId}`;

export function joinLive(sessionId: string, socket: WebSocket): void {
  join(liveRoom(sessionId), socket);
}

export function leaveLive(sessionId: string, socket: WebSocket): void {
  leave(liveRoom(sessionId), socket);
}

/** Fan out a fresh results snapshot to every presenter watching this session. */
export function broadcastLiveUpdate(sessionId: string, results: unknown): void {
  send(liveRoom(sessionId), { type: 'live_update', sessionId, results });
}
