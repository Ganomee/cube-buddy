import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { createProjectStore } from '../src/project-store.js';
import './style.css';

const store = createProjectStore(window.localStorage);
createRoot(document.getElementById('root')).render(<App store={store} />);
