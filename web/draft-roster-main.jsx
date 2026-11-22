import React from 'react';
import { createRoot } from 'react-dom/client';
import DraftRosterApp from './DraftRosterApp.jsx';
import './style.css';
import './draft-roster.css';

createRoot(document.getElementById('root')).render(<DraftRosterApp />);
