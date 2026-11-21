import { useEffect } from 'react';
import { HashRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DialogHost } from './components/dialogs';
import { IS_ARTIFACT } from './lib/env';

const Router = IS_ARTIFACT ? MemoryRouter : HashRouter;
import { Home } from './pages/Home';
import { TripPage } from './pages/TripPage';
import { useStore } from './store';

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
