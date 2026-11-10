const express = require('express');
const path = require('path');

const app = express();

app.use(express.json());
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.get('/script.js', (req, res) => res.sendFile(path.join(__dirname, 'script.js')));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'style.css')));

app.use('/api/categories', require('./categories'));
app.use('/api/expenses', require('./expenses'));
app.use('/api/stats', require('./stats'));
app.use('/api/savings', require('./savings'));

const PORT = 3000;
app.listen(PORT, () => console.log('Server running at http://localhost:' + PORT));
