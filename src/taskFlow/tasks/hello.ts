// Hello Task: minimal example for ASC demo
import { Contract, validateContract } from '../contracts/index';

export interface HelloTaskInput {
  name: string;
}

export interface HelloTaskOutput {
  message: string;
}

export async function helloTask(input: HelloTaskInput): Promise<HelloTaskOutput> {
  // Contract for this task
  const contract: Contract = {
    name: 'helloTask_contract',
    input,
    expected: {
      message: `Hello, ${input.name}! ASC ready.`
    }
  };

  const output: HelloTaskOutput = {
    message: `Hello, ${input.name}! ASC ready.`
  };

  validateContract(contract, output);

  return output;
}
