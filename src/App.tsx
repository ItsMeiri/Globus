import { useEffect } from 'react';
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DialogHost } from './components/dialogs';
import { IS_ARTIFACT } from './lib/env';
import { Home } from './pages/Home';
import { TripPage } from './pages/TripPage';
import { useStore } from './store';

// The hosted web app uses real URLs (Firebase rewrites every path to index.html);
// the single-file artifact build keeps routing in memory.
const Router = IS_ARTIFACT ? MemoryRouter : BrowserRouter;

export function App() {
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/trip/:id" element={<TripPage />} />
        <Route path="/trip/:id/:tab" element={<TripPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <DialogHost />
    </Router>
  );
}
