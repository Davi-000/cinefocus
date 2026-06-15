require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

const API_KEY = process.env.TMDB_API_KEY;

app.get('/api/search', async (req, res) => {
  try {
    const q = req.query.q || '';

    const r = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(q)}&language=pt-BR&page=1`
    );

    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: 'Erro na API search' });
  }
});

app.get('/api/popular', async (req, res) => {
  try {
    const r = await fetch(
      `https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}&language=pt-BR&page=1`
    );

    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: 'Erro na API popular' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT);