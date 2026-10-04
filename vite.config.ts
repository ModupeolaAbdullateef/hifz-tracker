import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Repo name on GitHub Pages — update if the repo is renamed.
const REPO_NAME = 'hifz-tracker'

export default defineConfig({
  plugins: [react()],
  base: `/${REPO_NAME}/`,
})
