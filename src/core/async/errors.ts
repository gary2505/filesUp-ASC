export class TimeoutError extends Error {
  constructor(public ms: number) { 
    super(`Timed out after ${ms} ms`); 
    this.name = 'TimeoutError'; 
  }
}

export class CanceledError extends Error {
  constructor(msg = 'Operation was canceled') { 
    super(msg); 
    this.name = 'CanceledError'; 
  }
}
