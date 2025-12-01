# Be_Try_Moba

Mobile-first twin-stick arena shooter (Vite + React + Canvas).

- Left joystick — movement
- Right joystick — aim + auto fire
- Enemies spawn around player and chase
- XP orbs, level system, increasing difficulty
- Minimal visuals, focus on mechanics

## Scripts

```bash
npm install
npm run dev      # dev server
npm run build    # production build
npm run preview  # preview built dist
```

## Deploy

Project is configured for GitHub Pages:

- `vite.config.js` uses `base: '/Be_Try_Moba/'`
- `.github/workflows/deploy.yml` automatically builds and deploys on push to `main`
