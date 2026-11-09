import { Router, type Request, type Response } from 'express';
import { store } from '../lib/store.js';

export const audioRouter = Router();

audioRouter.get('/:path(*)', (req: Request, res: Response) => {
  const rawPath = req.params['path'];
  if (!rawPath || typeof rawPath !== 'string') {
    res.status(400).send('Audio path required');
    return;
  }

  const audioItem = store.getMemoryAudio(rawPath);
  if (!audioItem) {
    res.status(404).send('Audio not found');
    return;
  }

  res.setHeader('Content-Type', audioItem.mimeType);
  res.setHeader('Content-Length', audioItem.buffer.length);
  res.send(audioItem.buffer);
});
