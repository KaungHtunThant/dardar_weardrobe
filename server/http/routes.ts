import { createRouter, eventHandler, type H3Event } from 'h3'
import type { Container } from '../container'
import { ImageController } from '../controllers/ImageController'
import { ItemController } from '../controllers/ItemController'
import { LookController } from '../controllers/LookController'
import { PhotoController } from '../controllers/PhotoController'
import { SettingsController } from '../controllers/SettingsController'
import { UploadController } from '../controllers/UploadController'
import { WardrobeController } from '../controllers/WardrobeController'
import { toHttpError } from './errors'

const handle = (fn: (event: H3Event) => unknown) =>
  eventHandler(async (event) => {
    try {
      return await fn(event)
    } catch (e) {
      throw toHttpError(e)
    }
  })

/**
 * The whole API as one route table. Nitro mounts it via server/api/[...].ts;
 * tests mount the very same router on a standalone h3 app.
 */
export function createApiRouter(c: Container) {
  const items = new ItemController(c.items, c.tagging)
  const photos = new PhotoController(c.photos)
  const uploads = new UploadController(c.uploads)
  const images = new ImageController(c.images)
  const looks = new LookController(c.looks, c.styling, c.today)
  const settings = new SettingsController(c.settings)
  const wardrobe = new WardrobeController(() => c.clearWardrobe())

  const router = createRouter({ preemptive: true })
    .get('/api/items', handle(() => items.list()))
    .post('/api/items', handle((e) => items.create(e)))
    .post('/api/items/suggest', handle((e) => items.suggest(e)))
    .patch('/api/items/:id', handle((e) => items.update(e)))
    .put('/api/items/:id/photo', handle((e) => items.replacePhoto(e)))
    .delete('/api/items/:id', handle((e) => items.delete(e)))
    .post('/api/photos', handle((e) => photos.upload(e)))
    .get('/api/uploads', handle(() => uploads.list()))
    .post('/api/uploads', handle((e) => uploads.enqueue(e)))
    .post('/api/uploads/:id/retry', handle((e) => uploads.retry(e)))
    .post('/api/uploads/:id/save', handle((e) => uploads.save(e)))
    .delete('/api/uploads/:id', handle((e) => uploads.discard(e)))
    .get('/api/images/:id', handle((e) => images.show(e)))
    .get('/api/looks', handle(() => looks.list()))
    .get('/api/looks/today', handle((e) => looks.today(e)))
    .put('/api/looks/:id/favourite', handle((e) => looks.setFavourite(e)))
    .delete('/api/looks/:id', handle((e) => looks.delete(e)))
    .post('/api/looks/generate', handle((e) => looks.generate(e)))
    .post('/api/looks/generate/stream', handle((e) => looks.generateStream(e)))
    .get('/api/settings', handle(() => settings.show()))
    .put('/api/settings', handle((e) => settings.update(e)))
    .post('/api/agent/recreate', handle(() => settings.recreateAgent()))
    .post('/api/wardrobe/clear', handle((e) => wardrobe.clear(e)))

  if (c.allowReset) router.post('/api/dev/reset', handle(async () => ({ reset: await c.reset() })))
  return router
}
