import { createClient, RedisClientType } from "redis";

let client: RedisClientType;

async function getRedisClient(): Promise<RedisClientType> {
    if (!client) {
        client = createClient();
        client.on("error", (err) => console.log("Redis Client Error", err));
        await client.connect();
    }
    return client;
}

type WebsiteEvent = {url: string, id: string}
type MessageType = {
    id: string,
    message: {
        url: string,
        id: string
    }
    //@ts-ignore
}

const STREAM_NAME = "betteruptime:website";

async function xAdd({url, id}: WebsiteEvent) {
    const c = await getRedisClient();
    await c.xAdd(
        STREAM_NAME, '*', {
            url,
            id
        }
    );
}

export async function xAddBulk(websites: WebsiteEvent[]) {
    for (const website of websites) {
        await xAdd({
            url: website.url,
            id: website.id
        })
    }
}

export async function xReadGroup(consumerGroup: string, workerId: string): Promise<MessageType[] | undefined> {
    const c = await getRedisClient();
    const res = await c.xReadGroup(
        consumerGroup, workerId, {
            key: STREAM_NAME,
            id: '>'
        }, {
        'COUNT': 5
        }
    );

    //@ts-ignore
    let messages: MessageType[] | undefined = res?.[0]?.messages;

    return messages;
}

async function xAck(consumerGroup: string, eventId: string) {
    const c = await getRedisClient();
    await c.xAck(STREAM_NAME, consumerGroup, eventId)
}

export async function xAckBulk(consumerGroup: string, eventIds: string[]) {
    eventIds.map(eventId => xAck(consumerGroup, eventId));
}