export class InflightGate {
  private token = 0;
  
  next() { 
    const my = ++this.token; 
    return { 
      isCurrent: () => my === this.token 
    }; 
  }
  
  invalidateAll() { 
    this.token++; 
  }
}
