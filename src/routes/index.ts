import { Hono } from 'hono'
import ragApp from './rag.route'
import userApp from './user.route'

const apiRouter = new Hono()

apiRouter.route('/users', userApp)
apiRouter.route('/rag', ragApp)

export default apiRouter
