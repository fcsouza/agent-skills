// Verified against: elysia 1.4.32, @elysiajs/cors 1.4.3, better-auth 1.7.23 (2026-11-14)
import { cors } from '@elysiajs/cors';
import type { Auth } from 'better-auth';
import { Elysia } from 'elysia';
import {
  type ClientMessage,
  clientMessage,
  type ServerMessage,
} from '../templates/message-types';
import { type PlayerSocket, RoomManager } from './room-manager';

// The two parts of your Better Auth instance this server uses. Pass the
// `auth` your auth file exports (see the `betterauth-integration` skill).
export type GameAuth = Pick<Auth, 'handler'> & {
  api: Pick<Auth['api'], 'getSession'>;
};

const send = (ws: PlayerSocket, message: ServerMessage) =>
  ws.send(JSON.stringify(message));

const route = (
  rooms: RoomManager,
  ws: PlayerSocket,
  playerId: string,
  message: ClientMessage,
) => {
  switch (message.type) {
    case 'join_room':
      send(ws, rooms.joinRoom(message.roomId, playerId, ws));
      break;
    case 'leave_room':
      rooms.leaveRoom(message.roomId, playerId);
      send(ws, { type: 'room_left', roomId: message.roomId });
      break;
    case 'action':
      rooms.queueAction(message.roomId, playerId, message.action);
      break;
    case 'room_message':
      if (!rooms.getRoom(message.roomId)?.players.has(playerId)) break;
      rooms.broadcastToRoom(message.roomId, {
        type: 'room_message',
        roomId: message.roomId,
        playerId,
        content: message.content,
        serverTime: Date.now(),
      });
      break;
    case 'ping':
      send(ws, { type: 'pong', serverTime: Date.now() });
      break;
  }
};

// The upgrade decision. Two kinds of client reach the socket:
// - Browsers always send Origin. It must be in trustedOrigins, and the session
//   comes from the cookie or a bearer token, as getSession reads it.
// - Native clients (Godot, Unity) send no Origin. They must send
//   `Authorization: Bearer <token>` and the session must come from that token
//   alone. A cookie does not count. The token is read from the header only,
//   never from the URL.
// An Origin the client sets proves nothing, so an untrusted Origin is 403 even
// with a valid token. No Origin and no valid bearer session is 403.
// auth.api skips Better Auth's origin checks, which is why this runs here.
export const authorizeUpgrade = async (
  auth: GameAuth,
  request: Request,
  trustedOrigins: string[],
): Promise<{ playerId: string } | { status: 401 | 403 }> => {
  const origin = request.headers.get('origin');
  let headers = request.headers;
  if (origin === null) {
    const authorization = request.headers.get('authorization');
    if (!(authorization && /^bearer\s+\S/i.test(authorization))) {
      return { status: 403 };
    }
    headers = new Headers({ authorization });
  } else if (!trustedOrigins.includes(origin)) {
    return { status: 403 };
  }
  const session = await auth.api.getSession({
    headers,
    query: { disableCookieCache: true },
  });
  if (!session) return { status: origin === null ? 403 : 401 };
  return { playerId: session.user.id };
};

// trustedOrigins: the game client origins. Use the same list as Better
// Auth's `trustedOrigins` option.
export const createGameServer = (auth: GameAuth, trustedOrigins: string[]) => {
  const rooms = new RoomManager();

  // Its own instance, so the derive below runs only on these routes and
  // not on the mounted auth handler.
  const game = new Elysia()
    .derive(async ({ request, status }) => {
      const result = await authorizeUpgrade(auth, request, trustedOrigins);
      if ('status' in result) return status(result.status);
      return result;
    })
    .post('/rooms', () => {
      const room = rooms.createRoom({ maxPlayers: 8, tickRate: 20 });
      return { roomId: room.id };
    })
    .ws('/ws', {
      body: clientMessage,
      open(ws) {
        send(ws, {
          type: 'connected',
          playerId: ws.data.playerId,
          serverTime: Date.now(),
        });
      },
      message(ws, message) {
        route(rooms, ws, ws.data.playerId, message);
      },
      close(ws) {
        // Only the rooms this socket is in: a reconnect may have replaced it.
        rooms.removePlayerFromAllRooms(ws.data.playerId, ws);
      },
    });

  return new Elysia()
    .use(cors({ origin: trustedOrigins, credentials: true }))
    .mount(auth.handler)
    .use(game);
};

// Usage, in your entry file:
//   import { auth } from './auth';
//   createGameServer(auth, ['https://play.example.com']).listen(3000);
