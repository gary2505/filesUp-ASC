export const newRequestId = () => (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
