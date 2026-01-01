export interface Contract {
  name: string;
  input: any;
  expected: any;
  got: any;
  ok: boolean;
}
