import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export interface Prompt {
  question(query: string): Promise<string>;
  close(): void;
}

class BufferedPrompt implements Prompt {
  private readonly answers: string[] = [];
  private readonly waiting: Array<(answer: string) => void> = [];
  private closed = false;

  constructor(private readonly rl: readline.Interface) {
    rl.on("line", (answer) => {
      const resolve = this.waiting.shift();
      if (resolve) resolve(answer);
      else this.answers.push(answer);
    });
    rl.on("close", () => {
      this.closed = true;
    });
  }

  question(query: string): Promise<string> {
    output.write(query);
    const answer = this.answers.shift();
    if (answer !== undefined) return Promise.resolve(answer);
    if (this.closed) return Promise.reject(new Error("Interactive input closed."));
    return new Promise((resolve) => this.waiting.push(resolve));
  }

  close(): void {
    this.rl.close();
  }
}

export function createPrompt(): Prompt | undefined {
  return input.isTTY
    ? new BufferedPrompt(readline.createInterface({ input, output }))
    : undefined;
}
