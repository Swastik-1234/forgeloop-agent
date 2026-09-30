import "dotenv/config";
import { Template, defaultBuildLogger } from "e2b";
import { reactTemplate } from "./e2b-template";

async function main() {
  await Template.build(reactTemplate, {
    alias: "likeable-react-base",
    cpuCount: 1,
    memoryMB: 1024,
    onBuildLogs: defaultBuildLogger(),
  });
  console.log("Built Successful");
}

main().catch(console.error);
