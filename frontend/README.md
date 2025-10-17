# UR Tuft Engine – Frontend

React + Vite interface for uploading tufting artwork, generating Universal Robots programs, and monitoring delivery to the robot.

## Scripts

```bash
npm run dev     # start the development server (default: http://localhost:5173)
npm run build   # type-check and build production assets
npm run preview # preview the production build locally
npm run docs    # build TypeDoc documentation into ../docs/frontend
```

## Environment Variables

Copy `.env.example` to `.env` and set:

- `VITE_API_URL` – Base URL of the backend API (default `http://localhost:4000`).

## Notes

- The UI can be toggled between English and German via the language selector in the top-right corner.
- Tweak the layout in `src/App.css` and extend behaviour in `src/App.tsx` as the backend capabilities grow.
