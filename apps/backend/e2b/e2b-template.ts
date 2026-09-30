import { Template, waitForTimeout } from "e2b";

export const reactTemplate = Template()
  .fromTemplate("code-interpreter-v1")
  .setEnvs({
    NODE_ENV: "development",
    REACT_APP_ROOT: "/home/user/react-app",
  })
  .runCmd([
    "mkdir -p /home/user/react-app",
    "cd /home/user/react-app && npm create vite@latest . -- --template react-ts --yes",
    "cd /home/user/react-app && npm install",
  ])
  .runCmd([
    "cd /home/user/react-app && npm install react-router-dom",
    "cd /home/user/react-app && npm install tailwindcss@next @tailwindcss/vite",
    "cd /home/user/react-app && npm install class-variance-authority clsx tailwind-merge",
    "cd /home/user/react-app && npm install lucide-react",
  ])
  .runCmd(
    `cat > /home/user/react-app/vite.config.ts << 'VITEEOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: true
  }
})
VITEEOF`
  )
  .runCmd(
    `cat > /home/user/react-app/components.json << 'COMPEOF'
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
COMPEOF`
  )
  .runCmd(
    `cat > /home/user/react-app/src/index.css << 'CSSEOF'
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Instrument+Serif:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap');
@import url('https://cdn.jsdelivr.net/npm/geist@latest/dist/mono/font.css');
@import "tailwindcss";

@theme {
  /* Colors - using HSL format for compatibility */
  --color-background: hsl(0 0% 100%);
  --color-foreground: hsl(222.2 84% 4.9%);
  --color-card: hsl(0 0% 100%);
  --color-card-foreground: hsl(222.2 84% 4.9%);
  --color-popover: hsl(0 0% 100%);
  --color-popover-foreground: hsl(222.2 84% 4.9%);
  --color-primary: hsl(222.2 47.4% 11.2%);
  --color-primary-foreground: hsl(210 40% 98%);
  --color-secondary: hsl(210 40% 96.1%);
  --color-secondary-foreground: hsl(222.2 47.4% 11.2%);
  --color-muted: hsl(210 40% 96.1%);
  --color-muted-foreground: hsl(215.4 16.3% 46.9%);
  --color-accent: hsl(210 40% 96.1%);
  --color-accent-foreground: hsl(222.2 47.4% 11.2%);
  --color-destructive: hsl(0 84.2% 60.2%);
  --color-destructive-foreground: hsl(210 40% 98%);
  --color-border: hsl(214.3 31.8% 91.4%);
  --color-input: hsl(214.3 31.8% 91.4%);
  --color-ring: hsl(222.2 84% 4.9%);
  
  /* Border radius */
  --radius: 0.5rem;
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  
  /* Fonts */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  --font-serif: 'Instrument Serif', Georgia, 'Times New Roman', serif;
  --font-mono: 'Geist Mono', 'Courier New', Courier, monospace;
}

@layer base {
  body {
    @apply bg-background text-foreground;
    font-family: var(--font-sans);
  }
}
CSSEOF`
  )
  .runCmd([
    `mkdir -p /home/user/react-app/src/lib /home/user/react-app/src/components/ui`,
    `cat > /home/user/react-app/src/lib/utils.ts << 'EOF'
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
EOF`,
  ])
  .runCmd(
    `cat > /home/user/react-app/src/main.tsx << 'MAINEOF'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
MAINEOF`
  )
  .runCmd([
    `cd /home/user/react-app && node -e "const fs = require('fs'); const tsconfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8')); tsconfig.compilerOptions = tsconfig.compilerOptions || {}; tsconfig.compilerOptions.baseUrl = '.'; tsconfig.compilerOptions.paths = { '@/*': ['./src/*'] }; fs.writeFileSync('tsconfig.json', JSON.stringify(tsconfig, null, 2));"`,
  ])
  .setStartCmd(
    "cd /home/user/react-app && npm run dev || echo 'React Template Ready'",
    waitForTimeout(30000)
  );

