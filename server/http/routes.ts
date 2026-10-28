import { createRouter, eventHandler, type H3Event } from 'h3'
import type { Container } from '../container'
import { ImageController } from '../controllers/ImageController'
import { ItemController } from '../controllers/ItemController'
import { LookController } from '../controllers/LookController'
import { PhotoController } from '../controllers/PhotoController'
import { SettingsController } from '../controllers/SettingsController'
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
  const items = new ItemController(c.items)
  const photos = new PhotoController(c.photos)
  const images = new ImageController(c.images)
  const looks = new LookController(c.looks, c.styling)
  const settings = new SettingsController(c.settings)

  const router = createRouter({ preemptive: true })
    .get('/api/items', handle(() => items.list()))
    .post('/api/items', handle((e) => items.create(e)))
    .post('/api/photos', handle((e) => photos.upload(e)))
    .get('/api/images/:id', handle((e) => images.show(e)))
    .get('/api/looks', handle(() => looks.list()))
    .put('/api/looks/:id/favourite', handle((e) => looks.setFavourite(e)))
    .post('/api/looks/generate', handle((e) => looks.generate(e)))
    .get('/api/settings', handle(() => settings.show()))
    .put('/api/settings', handle((e) => settings.update(e)))

  if (c.allowReset) router.post('/api/dev/reset', handle(async () => ({ reset: await c.reset() })))
  return router
}
