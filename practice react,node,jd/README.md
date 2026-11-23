# React + Node Practice

## Chalane ka tareeqa

```bash
npm run dev        # server (5050) + client (5180) dono ek saath
npm run server     # sirf Node server
npm run client     # sirf React app
```

Browser mein kholo: http://localhost:5180

Pehli dafa (ya kisi aur computer pe) dependencies install karne ke liye: `npm run install:all`

## Folders

| Folder | Kya hai |
|---|---|
| `client/` | React app (Vite). `src/App.jsx` todo app hai, `src/exercises/` mein practice components |
| `server/` | Node + Express API. `routes/todos.js` mein CRUD routes |
| `js-practice/` | Plain JavaScript / Node files. Chalao: `node js-practice/01-basics.js` |

## API

| Method | URL | Kaam |
|---|---|---|
| GET | /api/todos | sab todos |
| GET | /api/todos/:id | ek todo |
| POST | /api/todos | naya todo `{ "title": "..." }` |
| PUT | /api/todos/:id | update `{ "title"?, "done"? }` |
| DELETE | /api/todos/:id | delete |

Har file mein neeche **EXERCISES** likhi hain — unhe khud solve karo.
