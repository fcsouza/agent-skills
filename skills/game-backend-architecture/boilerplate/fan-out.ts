// Verified against: ioredis 6.0.0 (2026-11-14)
import type { Redis } from 'ioredis';

// Messages that cross server instances. A room and its tick loop live on one
// instance; these reach players connected anywhere.
export type FanOutMessage =
  | { kind: 'player'; playerId: string; data: string }
  | { kind: 'all'; data: string }
  | { kind: 'kick'; playerId: string };

// What each instance does with a message for its own sockets.
export interface LocalDelivery {
  toPlayer(playerId: string, data: string): void;
  toAll(data: string): void;
  kick(playerId: string): void;
}

// `redis` is the server's shared client. A subscribed connection accepts only
// subscribe-family commands, so subscribing uses a duplicate.
// `channel` carries the environment prefix, e.g. 'prod:fan-out'.
export const createFanOut = async (
  redis: Redis,
  channel: string,
  local: LocalDelivery,
) => {
  const sub = redis.duplicate();
  await sub.subscribe(channel);
  sub.on('message', (_channel, raw) => {
    const message: FanOutMessage = JSON.parse(raw);
    switch (message.kind) {
      case 'player':
        local.toPlayer(message.playerId, message.data);
        break;
      case 'all':
        local.toAll(message.data);
        break;
      case 'kick':
        local.kick(message.playerId);
        break;
    }
  });

  return {
    // Delivery is at most once: a message published while an instance is
    // down or reconnecting never reaches it.
    publish: (message: FanOutMessage) =>
      redis.publish(channel, JSON.stringify(message)),
    close: () => sub.quit(),
  };
};
