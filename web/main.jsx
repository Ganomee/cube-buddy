import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import PrintApp from './PrintApp.jsx';
import { createProjectStore } from '../src/project-store.js';
import './style.css';

const store = createProjectStore(window.localStorage);
const Root = window.location.pathname === '/print' ? PrintApp : App;
createRoot(document.getElementById('root')).render(<Root store={store} />);
