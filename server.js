import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 4173);

app.use(express.static(path.join(root, 'build', 'web')));
app.use((request, response, next) => {
  if (request.method === 'GET' && request.accepts('html')) {
    return response.sendFile(path.join(root, 'build', 'web', 'index.html'));
  }
  return next();
});
app.listen(port, '127.0.0.1', () => console.log(`Mailroom available at http://127.0.0.1:${port}`));