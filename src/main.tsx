import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

// 🚀 AQUÍ ESTÁ LA MAGIA: 
// Le decimos a React que cargue tu paleta premium desde la carpeta styles
import './styles/global.css'; 

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);