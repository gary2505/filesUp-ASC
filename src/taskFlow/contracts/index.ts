// Contract definitions for ASC
export interface Contract {
  name: string;
  input: unknown;
  expected: unknown;
  got?: unknown;
  passed?: boolean;
}

export class ContractTracker {
  private contracts: Contract[] = [];

  addContract(contract: Contract): void {
    this.contracts.push(contract);
  }

  getFailures(): Contract[] {
    return this.contracts.filter(c => !c.passed);
  }

  allPassed(): boolean {
    return this.contracts.every(c => c.passed !== false);
  }

  toJSON() {
    return this.contracts;
  }
}

export function validateContract(contract: Contract, actual: unknown): boolean {
  const passed = JSON.stringify(contract.expected) === JSON.stringify(actual);
  contract.got = actual;
  contract.passed = passed;
  return passed;
}
