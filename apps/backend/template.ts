import { Template } from "e2b";

export const template = Template()
  .fromImage("e2bdev/code-interpreter:latest")
  .setUser("root")
  .setWorkdir("/")
  .setWorkdir("/home/user")
  .runCmd("npm create vite@latest . -- --template react && npm install")
  .setUser("user")
  .setWorkdir("/home/user")
  .setStartCmd("sudo npm run dev", "sleep 20");
