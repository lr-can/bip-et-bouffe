import { handleApi } from '../../server/handleApi.js'

export default async (req) => handleApi(req)

export const config = {
  path: ['/api', '/api/*'],
}
