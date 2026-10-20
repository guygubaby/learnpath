import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import { syncTaxonomy } from './server/taxonomy-sync'

const handleRequest = createStartHandler(defaultStreamHandler)

export default {
  fetch(request: Request) {
    return handleRequest(request)
  },
  async scheduled() {
    await syncTaxonomy()
  },
}
