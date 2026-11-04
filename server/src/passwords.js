import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const deriveKey = promisify(scrypt);

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await deriveKey(password, salt, 64);
  return `scrypt:${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password, hash) {
  const [algorithm, salt, storedKey] = (hash ?? "").split(":");
  if (
    algorithm !== "scrypt" ||
    !/^[a-f0-9]{32}$/.test(salt ?? "") ||
    !/^[a-f0-9]{128}$/.test(storedKey ?? "")
  )
    return false;
  const key = await deriveKey(password, salt, 64);
  return timingSafeEqual(key, Buffer.from(storedKey, "hex"));
}
