// The render Function of experiment 0015: it renders its input with lodash's template, so the bundle inlines lodash.
import template from 'lodash/template.js';

import type { CloudEvent, FunctionContext } from '@funcd-dev/shim';

export interface FuncInput {
  text: string;
  name: string;
}

export interface FuncOutput {
  text: string;
}

export async function handle(_ctx: FunctionContext, event: CloudEvent<FuncInput>): Promise<FuncOutput> {
  return { text: template(event.data.text)({ name: event.data.name }) };
}
