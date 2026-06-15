
require('dotenv').config();
const express=require('express');
const cors=require('cors');

const app=express();
app.use(cors());

app.get('/api/search', async (req,res)=>{
 const q=req.query.q||'';
 const r=await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(q)}&language=pt-BR&page=1`);
 res.json(await r.json());
});

app.get('/api/popular', async (req,res)=>{
 const r=await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${process.env.TMDB_API_KEY}&language=pt-BR&page=1`);
 res.json(await r.json());
});

app.listen(3000);
