import { Hono } from "hono";
import userApp from "./user.route";

const apiRouter = new Hono()

apiRouter.route('/users', userApp)

// 导出总路由接口
export default apiRouter