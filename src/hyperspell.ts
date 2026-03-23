import Hyperspell from "hyperspell";
import { getConfig } from "./config.js";

export function getClient(): Hyperspell {
  const { hyperspellApiKey, hyperspellUserId } = getConfig();
  return new Hyperspell({ apiKey: hyperspellApiKey, userID: hyperspellUserId });
}
