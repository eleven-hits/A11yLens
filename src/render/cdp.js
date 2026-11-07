export class CDP {
  constructor(webSocketUrl, options = {}) {
    this.url = webSocketUrl;
    this.timeout = options.timeout ?? 30000;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.eventWaiters = new Set();
    this.socket = null;
    this.closed = false;
  }

  async connect() {
    if (typeof WebSocket === 'undefined') throw new Error('Global WebSocket is not available.');
    await new Promise((resolve, reject) => {
      const socket = new WebSocket(this.url);
      this.socket = socket;
      const timer = setTimeout(() => reject(new Error(`Timed out connecting to ${this.url}`)), 10000);
      socket.addEventListener('open', () => {
        clearTimeout(timer);
        resolve();
      });
      socket.addEventListener('error', (event) => {
        clearTimeout(timer);
        reject(new Error(`WebSocket error: ${event?.message ?? 'connection failed'}`));
      });
      socket.addEventListener('message', (event) => this.handleMessage(event.data));
      socket.addEventListener('close', () => this.handleClose());
    });
  }

  handleMessage(data) {
    let message;
    try {
      message = JSON.parse(String(data));
    } catch {
      return;
    }
    if (message.id && this.pending.has(message.id)) {
      const entry = this.pending.get(message.id);
      this.pending.delete(message.id);
      clearTimeout(entry.timer);
      if (message.error) entry.reject(new Error(`${entry.method}: ${message.error.message}`));
      else entry.resolve(message.result ?? {});
      return;
    }
    if (message.method) {
      const handlers = this.listeners.get(message.method) ?? [];
      for (const handler of handlers) {
        try {
          handler(message.params ?? {});
        } catch {
        }
      }
    }
  }

  handleClose() {
    this.closed = true;
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error(`${entry.method}: DevTools connection closed`));
      this.pending.delete(id);
    }
    for (const cancel of [...this.eventWaiters]) cancel();
    this.listeners.clear();
  }

  send(method, params = {}, timeout = this.timeout) {
    if (this.closed) return Promise.reject(new Error(`Cannot send ${method}: DevTools connection is closed.`));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method}: DevTools call timed out after ${timeout} ms`));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer, method });
      try {
        this.socket.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  on(method, handler) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(handler);
    return () => {
      const list = this.listeners.get(method) ?? [];
      this.listeners.set(method, list.filter((entry) => entry !== handler));
    };
  }

  once(method, timeout = this.timeout) {
    if (this.closed) return Promise.reject(new Error(`Cannot wait for ${method}: DevTools connection is closed.`));
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        off();
        this.eventWaiters.delete(cancel);
      };
      const cancel = () => {
        cleanup();
        reject(new Error(`${method}: DevTools connection closed`));
      };
      const off = this.on(method, (params) => {
        cleanup();
        resolve(params);
      });
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeout);
      this.eventWaiters.add(cancel);
    });
  }

  close() {
    this.handleClose();
    try {
      this.socket?.close();
    } catch {
    }
  }
}

export async function fetchJson(url, timeout = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}
