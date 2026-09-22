import dns from "dns";
import mongoose from "mongoose";

type MongoCache = {
  connection: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  dnsConfigured: boolean;
};

const globalForMongo = globalThis as typeof globalThis & {
  __rpgChessMongo?: MongoCache;
};
const cache = globalForMongo.__rpgChessMongo ?? {
  connection: null,
  promise: null,
  dnsConfigured: false,
};
globalForMongo.__rpgChessMongo = cache;

const timeoutMs = () =>
  Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS) || 5000;

const configureDns = (uri: string) => {
  if (cache.dnsConfigured || !uri.startsWith("mongodb+srv://")) return;
  const configured = process.env.MONGODB_DNS_SERVERS;
  const defaults =
    process.env.NODE_ENV === "production" ? "" : "8.8.8.8,1.1.1.1";
  const servers = (configured || defaults)
    .split(",")
    .map((server) => server.trim())
    .filter(Boolean);
  if (servers.length) dns.setServers(servers);
  cache.dnsConfigured = true;
};

export const connectToDatabase = async () => {
  if (cache.connection && mongoose.connection.readyState === 1)
    return cache.connection;
  const uri = process.env.MONGODB_URI;
  if (!uri)
    throw new Error(
      "MONGODB_URI is missing. Add it to .env.local and your deployment environment.",
    );
  configureDns(uri);
  if (!cache.promise) {
    const timeout = timeoutMs();
    cache.promise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: timeout,
      connectTimeoutMS: timeout,
      socketTimeoutMS: timeout,
    });
  }
  try {
    cache.connection = await cache.promise;
    return cache.connection;
  } catch (error) {
    cache.promise = null;
    await mongoose.disconnect().catch(() => undefined);
    throw error;
  }
};

export const isDatabaseConnectivityError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: string; code?: string };
  return (
    [
      "MongoNetworkError",
      "MongoNetworkTimeoutError",
      "MongooseServerSelectionError",
    ].includes(candidate.name ?? "") ||
    ["ETIMEOUT", "ENOTFOUND", "ECONNREFUSED", "ECONNRESET"].includes(
      candidate.code ?? "",
    )
  );
};
