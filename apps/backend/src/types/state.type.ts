import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

export const StateAnnotation = Annotation.Root({
  messages: MessagesAnnotation.spec.messages,
  projectId: Annotation<string>,
  sandbox: Annotation<any>,
  plan: Annotation<string[]>,
  currentStep: Annotation<string | undefined>,
  buildOutput: Annotation<string | undefined>,
  error: Annotation<string | undefined>,
});

export type GraphState = typeof StateAnnotation.State;