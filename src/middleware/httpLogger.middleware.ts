import type { MiddlewareHandler } from 'hono';
import { Logger } from '../utils/logger';

const httpLogger = new Logger('HTTP');

export const customLogger = (): MiddlewareHandler => {
  return async (c, next) => {
    const { method, path } = c.req;
    // const { method, path, url } = c.req;
    // console.dir(c.req);

    const start = Date.now();

    // 先执行后续路由逻辑
    await next();

    // 路由执行完毕后，计算耗时并打印
    const ms = Date.now() - start;
    const status = c.res.status;

    // 根据状态码决定颜色
    if (status >= 500) {
      httpLogger.error(`${method} ${path} ${status} - ${ms}ms`);
    } else if (status >= 400) {
      httpLogger.warn(`${method} ${path} ${status} - ${ms}ms`);
    } else {
      httpLogger.log(`${method} ${path} ${status} - ${ms}ms`);
    }
  };
};
