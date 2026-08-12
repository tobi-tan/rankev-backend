import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { verifyAccessToken } from '../lib/tokens';
import * as hub from './hub';
import { castVote } from '../modules/rankies/rankies.service';

/**
 * WebSocket endpoint for realtime Rankie voting.
 *
 * Connect: ws://host/ws?token=<accessToken>   (token optional → read-only)
 * Client → server messages:
 *   { type: 'subscribe_rankie',   rankieId }
 *   { type: 'unsubscribe_rankie', rankieId }
 *   { type: 'vote', rankieId, optionIds }      (requires token)
 * Server → client:
 *   { type: 'vote_update', rankieId, options }
 *   { type: 'new_comment', postId, comment }
 *   { type: 'rankie_closed', rankieId }
 *   { type: 'error', message }
 */
export default async function wsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/ws', { websocket: true }, (connection, req) => {
    const socket = connection.socket as WebSocket;

    // Optional auth via ?token= query param.
    let userId: string | null = null;
    const token = (req.query as { token?: string })?.token;
    if (token) {
      try {
        userId = verifyAccessToken(token).sub;
      } catch {
        userId = null;
      }
    }

    const reply = (payload: unknown) => {
      if (socket.readyState === 1) socket.send(JSON.stringify(payload));
    };

    socket.on('message', async (raw: Buffer) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return reply({ type: 'error', message: 'Invalid JSON' });
      }

      switch (msg?.type) {
        case 'subscribe_rankie':
          if (typeof msg.rankieId === 'string') hub.join(msg.rankieId, socket);
          break;
        case 'unsubscribe_rankie':
          if (typeof msg.rankieId === 'string') hub.leave(msg.rankieId, socket);
          break;
        case 'vote': {
          if (!userId) return reply({ type: 'error', message: 'Authentication required to vote' });
          if (typeof msg.rankieId !== 'string' || !Array.isArray(msg.optionIds)) {
            return reply({ type: 'error', message: 'rankieId and optionIds required' });
          }
          try {
            const res = await castVote(userId, msg.rankieId, { optionIds: msg.optionIds });
            // Fan out fresh tallies to everyone watching this rankie.
            hub.broadcastVoteUpdate(
              msg.rankieId,
              res.options.map((o) => ({ id: o.id, votes: o.votes, voters: o.voters })),
            );
          } catch (err: any) {
            reply({ type: 'error', message: err?.message ?? 'Vote failed' });
          }
          break;
        }
        default:
          reply({ type: 'error', message: `Unknown message type: ${msg?.type}` });
      }
    });

    socket.on('close', () => hub.leaveAll(socket));
    socket.on('error', () => hub.leaveAll(socket));
  });
}
